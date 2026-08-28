import type { Pool } from 'pg';

import { forbidden, notFound } from './errors';

/**
 * 내 웨딩인지 확인한다. 배우자도 같은 웨딩을 본다 — 사업계획서 12번.
 * 남의 견적을 id만 알면 볼 수 있는 상태를 만들지 않는다.
 */
export async function assertWeddingAccess(
  pool: Pool,
  weddingId: string,
  userId: string
): Promise<void> {
  const { rows } = await pool.query(
    `SELECT 1 FROM structured.weddings
     WHERE id = $1 AND (owner_user_id = $2 OR partner_user_id = $2)`,
    [weddingId, userId]
  );

  if (rows.length === 0) {
    throw forbidden();
  }
}

/** 문서가 속한 웨딩까지 확인하고 웨딩 id를 준다. */
export async function assertQuoteAccess(
  pool: Pool,
  quoteId: string,
  userId: string
): Promise<string> {
  const { rows } = await pool.query<{ wedding_id: string; allowed: boolean }>(
    `SELECT q.wedding_id,
            (w.owner_user_id = $2 OR w.partner_user_id = $2) AS allowed
     FROM structured.quotes q
     JOIN structured.weddings w ON w.id = q.wedding_id
     WHERE q.id = $1`,
    [quoteId, userId]
  );

  const row = rows[0];

  if (!row) {
    throw notFound('문서');
  }

  if (!row.allowed) {
    throw forbidden();
  }

  return row.wedding_id;
}
