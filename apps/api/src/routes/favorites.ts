import { createFavoriteVendorRequestSchema } from '@weddingpick/api-contract';
import { displayableImageUrlCondition, type VendorCategory } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { notFound } from '../errors';

type FavoriteRow = {
  id: string;
  vendor_id: string;
  vendor_name: string;
  category: VendorCategory;
  region: string;
  image_url: string | null;
  created_at: Date;
};

export function registerFavoriteVendorRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get('/v1/me/favorite-vendors', auth, async (request) => {
    const userId = currentUserId(request);
    const { rows } = await context.pool.query<FavoriteRow>(
      `SELECT f.id, f.vendor_id, v.name AS vendor_name, v.category, v.region,
              (SELECT i.source_url
               FROM structured.vendor_images i
               WHERE i.vendor_id = v.id
                 AND i.status = 'approved'
                 AND i.copyright_basis <> 'unknown'
                 AND ${displayableImageUrlCondition('i.source_url')}
               ORDER BY i.is_representative DESC, i.created_at
               LIMIT 1) AS image_url,
              f.created_at
       FROM structured.favorite_vendors f
       JOIN structured.vendors v ON v.id = f.vendor_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [userId]
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        category: row.category,
        region: row.region,
        imageUrl: row.image_url ?? null,
        createdAt: row.created_at.toISOString(),
      })),
      total: rows.length,
    };
  });

  app.post('/v1/me/favorite-vendors', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = createFavoriteVendorRequestSchema.parse(request.body);

    const vendor = await context.pool.query('SELECT 1 FROM structured.vendors WHERE id = $1', [
      body.vendorId,
    ]);
    if (vendor.rows.length === 0) throw notFound('업체');

    const { rows } = await context.pool.query<{ id: string }>(
      `INSERT INTO structured.favorite_vendors (user_id, vendor_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, vendor_id)
       DO UPDATE SET vendor_id = EXCLUDED.vendor_id
       RETURNING id`,
      [userId, body.vendorId]
    );

    return reply.status(201).send({ favoriteId: rows[0]!.id });
  });

  app.delete<{ Params: { vendorId: string } }>(
    '/v1/me/favorite-vendors/:vendorId',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      await context.pool.query(
        'DELETE FROM structured.favorite_vendors WHERE user_id = $1 AND vendor_id = $2',
        [userId, request.params.vendorId]
      );
      return reply.status(204).send();
    }
  );
}
