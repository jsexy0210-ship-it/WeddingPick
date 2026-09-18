import type { Pool } from 'pg';

import { notFound } from './errors';
import type { Storage } from './storage/port';
import { isUuid } from './uuid';

type ScrapRow = {
  id: string;
  category_label: string;
  title: string;
  summary: string;
  image_key: string | null;
  saved_at: Date;
};

export async function listWeddingFeedScraps(
  pool: Pool,
  storage: Storage,
  userId: string
) {
  const { rows } = await pool.query<ScrapRow>(
    `SELECT p.id, p.category_label, p.title, p.summary, p.image_key,
            s.created_at AS saved_at
       FROM structured.wedding_feed_scraps s
       JOIN structured.wedding_feed_posts p ON p.id = s.post_id
      WHERE s.user_id = $1
        AND p.status = 'published'
      ORDER BY s.created_at DESC`,
    [userId]
  );

  return {
    items: await Promise.all(rows.map(async (row) => ({
      id: row.id,
      categoryLabel: row.category_label,
      title: row.title,
      summary: row.summary,
      imageUrl: row.image_key ? await storage.getPublicUrl(row.image_key, 3600) : null,
      savedAt: row.saved_at.toISOString(),
    }))),
  };
}

export async function weddingFeedScrapState(pool: Pool, userId: string, postId: string) {
  if (!isUuid(postId)) return { saved: false };

  const { rows } = await pool.query<{ saved: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM structured.wedding_feed_scraps s
         JOIN structured.wedding_feed_posts p ON p.id = s.post_id
        WHERE s.user_id = $1 AND s.post_id = $2 AND p.status = 'published'
     ) AS saved`,
    [userId, postId]
  );

  return { saved: rows[0]?.saved === true };
}

export async function saveWeddingFeedScrap(pool: Pool, userId: string, postId: string) {
  if (!isUuid(postId)) throw notFound('글');

  const exists = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM structured.wedding_feed_posts
       WHERE id = $1 AND status = 'published'
     ) AS exists`,
    [postId]
  );
  if (exists.rows[0]?.exists !== true) throw notFound('글');

  await pool.query(
    `INSERT INTO structured.wedding_feed_scraps (user_id, post_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, post_id) DO NOTHING`,
    [userId, postId]
  );

  return { saved: true };
}

export async function removeWeddingFeedScrap(pool: Pool, userId: string, postId: string) {
  if (isUuid(postId)) {
    await pool.query(
      'DELETE FROM structured.wedding_feed_scraps WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );
  }
  return { saved: false };
}
