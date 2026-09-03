import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { optionalUser, optionalUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { notFound } from '../errors';

const listQuerySchema = z.object({
  sort: z.enum(['date', 'region']).default('date'),
  region: z.string().trim().max(20).default('전체'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});

type ExpoRow = {
  id: string;
  title: string;
  organizer: string;
  starts_at: Date;
  ends_at: Date;
  venue: string;
  region: string;
  registration_deadline: Date | null;
  source_note: string;
  last_verified_at: Date;
};

type ExpoDetailRow = ExpoRow & {
  address: string;
  benefits: unknown;
  description: string;
};

/** 박람회 상태 계산. DB에는 저장하지 않고 날짜로 매번 계산한다. */
function expoStatus(startsAt: Date, endsAt: Date): 'upcoming' | 'ongoing' | 'closed' {
  const now = new Date();
  if (now < startsAt) return 'upcoming';
  if (now > endsAt) return 'closed';
  return 'ongoing';
}

/** 마감 임박 — 7일 이내 시작 또는 사전등록 마감이 3일 이내. */
function isDeadlineSoon(
  startsAt: Date,
  registrationDeadline: Date | null
): boolean {
  const now = new Date();
  const daysToStart = (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (registrationDeadline) {
    const daysToDeadline =
      (registrationDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysToDeadline >= 0 && daysToDeadline <= 3;
  }
  return daysToStart >= 0 && daysToStart <= 7;
}

export function registerExpoRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: optionalUser(context) };

  /**
   * 박람회 목록. WP-EXPO-001.
   *
   * 일정순·지역 필터. cursor 기반 페이지네이션.
   */
  app.get('/v1/expos', auth, async (request) => {
    const query = listQuerySchema.parse(request.query);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query.region !== '전체') {
      conditions.push(`region = $${idx++}`);
      params.push(query.region);
    }

    if (query.cursor) {
      conditions.push(`starts_at > $${idx++}`);
      params.push(query.cursor);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const orderBy =
      query.sort === 'region' ? 'region ASC, starts_at ASC' : 'starts_at ASC';

    params.push(query.limit + 1);
    const limitParam = `$${idx}`;

    const { rows } = await context.pool.query<ExpoRow>(
      `SELECT id, title, organizer, starts_at, ends_at, venue, region,
              registration_deadline, source_note, last_verified_at
       FROM structured.expos
       ${where}
       ORDER BY ${orderBy}
       LIMIT ${limitParam}`,
      params
    );

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: items.map((r) => {
        const status = expoStatus(r.starts_at, r.ends_at);
        return {
          id: r.id,
          title: r.title,
          organizer: r.organizer,
          startsAt: r.starts_at.toISOString().slice(0, 10),
          endsAt: r.ends_at.toISOString().slice(0, 10),
          venue: r.venue,
          region: r.region,
          status,
          isDeadlineSoon: isDeadlineSoon(r.starts_at, r.registration_deadline),
          sourceNote: r.source_note,
          lastVerifiedAt: r.last_verified_at.toISOString().slice(0, 10),
        };
      }),
      nextCursor: hasMore ? items[items.length - 1]!.starts_at.toISOString() : null,
    };
  });

  /**
   * 박람회 상세. WP-EXPO-002.
   *
   * 일정·장소·혜택·알림 구독 여부를 돌려준다.
   */
  app.get<{ Params: { expoId: string } }>('/v1/expos/:expoId', auth, async (request) => {
    const { expoId } = request.params;
    const userId = optionalUserId(request);

    const { rows } = await context.pool.query<ExpoDetailRow>(
      `SELECT id, title, organizer, starts_at, ends_at, venue, address, region,
              registration_deadline, benefits, description, source_note, last_verified_at
       FROM structured.expos
       WHERE id = $1`,
      [expoId]
    );

    if (!rows[0]) throw notFound('박람회');

    const expo = rows[0];
    const status = expoStatus(expo.starts_at, expo.ends_at);

    // 알림 구독 여부 (로그인한 경우에만)
    let notifyEnabled = false;
    if (userId) {
      const notify = await context.pool.query<{ expo_id: string }>(
        'SELECT expo_id FROM structured.expo_notify WHERE expo_id = $1 AND user_id = $2',
        [expoId, userId]
      );
      notifyEnabled = notify.rows.length > 0;
    }

    return {
      id: expo.id,
      title: expo.title,
      organizer: expo.organizer,
      startsAt: expo.starts_at.toISOString().slice(0, 10),
      endsAt: expo.ends_at.toISOString().slice(0, 10),
      venue: expo.venue,
      address: expo.address,
      region: expo.region,
      status,
      isDeadlineSoon: isDeadlineSoon(expo.starts_at, expo.registration_deadline),
      registrationDeadline: expo.registration_deadline
        ? expo.registration_deadline.toISOString().slice(0, 10)
        : null,
      benefits: Array.isArray(expo.benefits) ? expo.benefits : [],
      description: expo.description,
      notifyEnabled,
      sourceNote: expo.source_note,
      lastVerifiedAt: expo.last_verified_at.toISOString().slice(0, 10),
    };
  });

  /**
   * 박람회 알림 토글. PUT으로 켜고, DELETE로 끈다.
   *
   * 로그인 필수 — optionalUser로 처리하면 익명 사용자가 구독 행을 만들 수 있다.
   * 대신 requireUser를 쓴다.
   */
  const authRequired = { preHandler: requireUser(context) };

  app.put<{ Params: { expoId: string } }>(
    '/v1/expos/:expoId/notify',
    authRequired,
    async (request) => {
      const { expoId } = request.params;
      const userId = request.userId;

      // 박람회가 존재하는지 먼저 확인한다.
      const { rows } = await context.pool.query<{ id: string }>(
        'SELECT id FROM structured.expos WHERE id = $1',
        [expoId]
      );
      if (!rows[0]) throw notFound('박람회');

      // INSERT … ON CONFLICT DO NOTHING — 이미 구독 중이면 무시한다.
      await context.pool.query(
        `INSERT INTO structured.expo_notify (expo_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (expo_id, user_id) DO NOTHING`,
        [expoId, userId]
      );

      return { notifyEnabled: true };
    }
  );

  app.delete<{ Params: { expoId: string } }>(
    '/v1/expos/:expoId/notify',
    authRequired,
    async (request) => {
      const { expoId } = request.params;
      const userId = request.userId;

      await context.pool.query(
        'DELETE FROM structured.expo_notify WHERE expo_id = $1 AND user_id = $2',
        [expoId, userId]
      );

      return { notifyEnabled: false };
    }
  );
}
