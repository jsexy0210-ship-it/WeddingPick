import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { optionalUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { notFound } from '../errors';

const listQuerySchema = z.object({
  sort: z.enum(['latest', 'stage', 'category']).default('latest'),
  stage: z.enum(['all', 'early', 'mid', 'late']).default('all'),
  category: z
    .enum(['all', 'planning', 'venue', 'dress', 'photo', 'beauty', 'catering', 'honeymoon'])
    .default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});

type WeddingInfoRow = {
  id: string;
  title: string;
  summary: string;
  category: string;
  stage: string;
  published_at: Date;
  thumbnail_url: string | null;
};

type WeddingInfoDetailRow = WeddingInfoRow & {
  body: string;
  checklist: unknown;
  related_vendor_ids: unknown;
};

type RelatedVendorRow = {
  id: string;
  name: string;
  category: string;
};

export function registerWeddingInfoRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: optionalUser(context) };

  /**
   * 웨딩 정보 목록. WP-EXPO-003.
   *
   * 준비단계별·카테고리별·최신순 필터. cursor 기반 페이지네이션.
   */
  app.get('/v1/wedding-info', auth, async (request) => {
    const query = listQuerySchema.parse(request.query);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query.stage !== 'all') {
      conditions.push(`stage = $${idx++}`);
      params.push(query.stage);
    }

    if (query.category !== 'all') {
      conditions.push(`category = $${idx++}`);
      params.push(query.category);
    }

    if (query.cursor) {
      conditions.push(`published_at < $${idx++}`);
      params.push(query.cursor);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const orderBy =
      query.sort === 'stage'
        ? 'stage ASC, published_at DESC'
        : query.sort === 'category'
          ? 'category ASC, published_at DESC'
          : 'published_at DESC';

    params.push(query.limit + 1);
    const limitParam = `$${idx}`;

    const { rows } = await context.pool.query<WeddingInfoRow>(
      `SELECT id, title, summary, category, stage, published_at, thumbnail_url
       FROM structured.wedding_info
       ${where}
       ORDER BY ${orderBy}
       LIMIT ${limitParam}`,
      params
    );

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: items.map((r) => ({
        id: r.id,
        title: r.title,
        summary: r.summary,
        category: r.category,
        stage: r.stage,
        publishedAt: r.published_at.toISOString().slice(0, 10),
        thumbnailUrl: r.thumbnail_url,
      })),
      nextCursor: hasMore ? items[items.length - 1]!.published_at.toISOString() : null,
    };
  });

  /**
   * 웨딩 정보 상세. WP-EXPO-004.
   *
   * 본문·체크리스트·관련 업체를 돌려준다.
   */
  app.get<{ Params: { infoId: string } }>('/v1/wedding-info/:infoId', auth, async (request) => {
    const { infoId } = request.params;

    const { rows } = await context.pool.query<WeddingInfoDetailRow>(
      `SELECT id, title, summary, body, category, stage, published_at, thumbnail_url,
              checklist, related_vendor_ids
       FROM structured.wedding_info
       WHERE id = $1`,
      [infoId]
    );

    if (!rows[0]) throw notFound('웨딩 정보');

    const info = rows[0];

    // 관련 업체 이름 조회
    const relatedIds = Array.isArray(info.related_vendor_ids) ? info.related_vendor_ids : [];

    let relatedVendors: Array<{ id: string; name: string; category: string }> = [];
    if (relatedIds.length > 0) {
      const vendorRows = await context.pool.query<RelatedVendorRow>(
        `SELECT id, name, category
         FROM structured.vendors
         WHERE id = ANY($1::uuid[])`,
        [relatedIds]
      );
      relatedVendors = vendorRows.rows.map((v) => ({
        id: v.id,
        name: v.name,
        category: v.category,
      }));
    }

    const checklist = Array.isArray(info.checklist) ? info.checklist : [];

    return {
      id: info.id,
      title: info.title,
      category: info.category,
      stage: info.stage,
      publishedAt: info.published_at.toISOString().slice(0, 10),
      thumbnailUrl: info.thumbnail_url,
      body: info.body,
      checklist: checklist as Array<{ id: string; label: string; done: boolean }>,
      relatedVendors,
    };
  });
}
