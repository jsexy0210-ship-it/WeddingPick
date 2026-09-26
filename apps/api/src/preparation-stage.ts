import type { Pool } from 'pg';

import { preparationStage, type PreparationStage, type VendorCategory } from '@weddingpick/domain';

/**
 * 로그인한 사람의 준비 단계(domain `preparationStage`)를 DB에서 읽어 세운다.
 *
 * **새로 묻지 않는다** — 이미 있는 셋만 읽는다.
 *
 *   예식일        `weddings.wedding_date` — 남은 날은 **한국 날짜**로 센다. 서버 시계(UTC)로
 *                 세면 한국 자정~오전 9시 사이에 하루가 어긋나 경계(D-300 · D-30)에서 단계가 튄다.
 *   정한 업종     `wedding_preparation`(0041)의 결정 + `prepared_categories`(0088, 준비 현황)
 *   담는 중       `wedding_preparation`의 picking
 *
 * 웨딩을 찾는 규칙은 `/v1/me`(`routes/weddings.ts` `loadCurrentUser`)와 같다 — 주인이든
 * 배우자든, 가장 먼저 만든 웨딩 하나. 웨딩이 없으면(온보딩 전) null — 단계를 모르는 것이다.
 */
export async function loadPreparationStage(pool: Pool, userId: string): Promise<PreparationStage | null> {
  const { rows } = await pool.query<{
    days_left: number | null;
    prepared: VendorCategory[] | null;
    decided: VendorCategory[];
    picking: VendorCategory[];
  }>(
    `SELECT (w.wedding_date - (now() AT TIME ZONE 'Asia/Seoul')::date) AS days_left,
            /* enum 배열은 드라이버가 문자열 '{a,b}'로 준다 — text[]로 바꿔 읽는다. */
            w.prepared_categories::text[] AS prepared,
            coalesce(array_agg(p.category::text) FILTER (WHERE p.state = 'decided'), '{}') AS decided,
            coalesce(array_agg(p.category::text) FILTER (WHERE p.state = 'picking'), '{}') AS picking
     FROM (
       SELECT id, wedding_date, prepared_categories
       FROM structured.weddings
       WHERE owner_user_id = $1 OR partner_user_id = $1
       ORDER BY created_at
       LIMIT 1
     ) w
     LEFT JOIN structured.wedding_preparation p ON p.wedding_id = w.id
     GROUP BY w.id, w.wedding_date, w.prepared_categories`,
    [userId]
  );
  const row = rows[0];

  if (!row) return null;

  return preparationStage({
    daysLeft: row.days_left,
    decided: [...row.decided, ...(row.prepared ?? [])],
    picking: row.picking,
  });
}
