import type { LifecycleStage, VendorCategory } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';

import { optionalUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { notFound } from '../errors';

const listQuerySchema = z.object({
  stage: z.string().trim().max(20).optional(),
  category: z.string().trim().max(30).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

type ArticleRow = {
  id: string;
  title: string;
  body: string;
  stage: LifecycleStage | null;
  related_category: VendorCategory | null;
  source: string;
  last_verified_at: Date;
  published_at: Date;
};

function encodeCursor(row: ArticleRow): string {
  return Buffer.from(JSON.stringify([row.published_at.toISOString(), row.id]), 'utf8').toString(
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

function toSummary(row: ArticleRow) {
  return {
    id: row.id,
    title: row.title,
    stage: row.stage,
    relatedCategory: row.related_category,
    publishedAt: row.published_at.toISOString(),
  };
}

const SELECT_ARTICLE = `
  SELECT id, title, body, stage, related_category, source, last_verified_at, published_at
  FROM structured.wedding_guide_articles
`;

async function loadArticleDetail(pool: Pool, articleId: string) {
  const { rows } = await pool.query<ArticleRow>(`${SELECT_ARTICLE} WHERE id = $1`, [articleId]);
  const article = rows[0];

  if (!article) {
    throw notFound('웨딩 정보');
  }

  return {
    ...toSummary(article),
    body: article.body,
    source: article.source,
    lastVerifiedAt: article.last_verified_at.toISOString(),
  };
}

export function registerGuideArticleRoutes(app: FastifyInstance, context: AppContext): void {
  /* 운영이 올리는 공개 콘텐츠다 — 업체 검색과 같은 Level 1 접근이면 된다. */
  const auth = { preHandler: optionalUser(context) };

  /** WP-EXPO-003 웨딩 정보 목록. 준비단계별 · 카테고리별 · 최신순. */
  app.get('/v1/guide-articles', auth, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const after = query.cursor ? decodeCursor(query.cursor) : null;

    const { rows } = await context.pool.query<ArticleRow>(
      `${SELECT_ARTICLE}
       WHERE ($1::wedding_guide_stage IS NULL OR stage = $1::wedding_guide_stage)
         AND ($2::vendor_category IS NULL OR related_category = $2::vendor_category)
         AND ($3::timestamptz IS NULL OR (published_at, id) < ($3, $4::uuid))
       ORDER BY published_at DESC, id DESC
       LIMIT $5`,
      [
        query.stage && query.stage.length > 0 ? query.stage : null,
        query.category && query.category.length > 0 ? query.category : null,
        after?.[0] ?? null,
        after?.[1] ?? null,
        query.limit + 1,
      ]
    );

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      articles: page.map(toSummary),
      nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null,
    };
  });

  app.get<{ Params: { articleId: string } }>('/v1/guide-articles/:articleId', auth, async (request) =>
    loadArticleDetail(context.pool, request.params.articleId)
  );
}
