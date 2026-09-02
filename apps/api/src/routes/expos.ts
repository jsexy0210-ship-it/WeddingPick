import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';

import { optionalUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { notFound } from '../errors';

const listQuerySchema = z.object({
  region: z.string().trim().max(20).optional(),
  /** 기본은 진행 예정·진행 중만. true면 지난 일정도 함께 준다. WP-EXPO-001 상태값. */
  includePast: z.coerce.boolean().default(false),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

type ExpoRow = {
  id: string;
  name: string;
  organizer: string | null;
  region: string;
  venue: string | null;
  starts_at: Date;
  ends_at: Date;
  registration_url: string | null;
  benefits_note: string | null;
  source: string;
  last_verified_at: Date;
};

function encodeCursor(row: ExpoRow): string {
  return Buffer.from(JSON.stringify([row.starts_at.toISOString(), row.id]), 'utf8').toString(
    'base64url'
  );
}

function decodeCursor(cursor: string): [string, string] | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));

    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string'
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // 망가진 커서는 첫 쪽으로 되돌린다.
  }

  return null;
}

function toSummary(row: ExpoRow) {
  return {
    id: row.id,
    name: row.name,
    organizer: row.organizer,
    region: row.region,
    venue: row.venue,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    source: row.source,
    lastVerifiedAt: row.last_verified_at.toISOString(),
  };
}

const SELECT_EXPO = `
  SELECT id, name, organizer, region, venue, starts_at, ends_at,
         registration_url, benefits_note, source, last_verified_at
  FROM structured.wedding_expos
`;

async function loadExpoDetail(pool: Pool, expoId: string) {
  const { rows } = await pool.query<ExpoRow>(`${SELECT_EXPO} WHERE id = $1`, [expoId]);
  const expo = rows[0];

  if (!expo) {
    throw notFound('박람회');
  }

  return {
    ...toSummary(expo),
    registrationUrl: expo.registration_url,
    benefitsNote: expo.benefits_note,
  };
}

export function registerExpoRoutes(app: FastifyInstance, context: AppContext): void {
  /* 운영이 올리는 공개 콘텐츠다 — 업체 검색과 같은 Level 1 접근이면 된다. */
  const auth = { preHandler: optionalUser(context) };

  /** WP-EXPO-001 지역 필터. 목록에 실제로 뜨는 박람회의 지역만 모은다. */
  app.get('/v1/expos/regions', auth, async () => {
    const { rows } = await context.pool.query<{ name: string; expo_count: string }>(
      `SELECT region AS name, count(*) AS expo_count
       FROM structured.wedding_expos
       WHERE ends_at >= now()
       GROUP BY 1
       ORDER BY 1`
    );

    return { regions: rows.map((row) => ({ name: row.name, expoCount: Number(row.expo_count) })) };
  });

  /** WP-EXPO-001 박람회 목록. 일정순 · 지역 필터 · 기본은 지난 일정 제외. */
  app.get('/v1/expos', auth, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const after = query.cursor ? decodeCursor(query.cursor) : null;

    const { rows } = await context.pool.query<ExpoRow>(
      `${SELECT_EXPO}
       WHERE ($1::boolean OR ends_at >= now())
         AND ($2::text IS NULL OR region = $2)
         AND ($3::timestamptz IS NULL OR (starts_at, id) > ($3, $4::uuid))
       ORDER BY starts_at, id
       LIMIT $5`,
      [
        query.includePast,
        query.region && query.region.length > 0 ? query.region : null,
        after?.[0] ?? null,
        after?.[1] ?? null,
        query.limit + 1,
      ]
    );

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      expos: page.map(toSummary),
      nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null,
    };
  });

  app.get<{ Params: { expoId: string } }>('/v1/expos/:expoId', auth, async (request) =>
    loadExpoDetail(context.pool, request.params.expoId)
  );
}
