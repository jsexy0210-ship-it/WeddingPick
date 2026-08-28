import type { PoolClient } from 'pg';

/**
 * 문서에서 읽은 업체 이름을 실제 업체에 연결한다.
 *
 * 이름이 정확히(정규화 후) 같을 때만 연결한다. 비슷하다고 넘겨짚으면 남의 업체 가격이
 * 내 비교에 섞인다 — 틀린 연결보다 연결하지 않는 편이 낫다.
 *
 * 연결하지 못하면 null을 주고, 이름은 quotes.vendor_name_raw에 남는다.
 * 나중에 업체가 등록되면 그 값으로 다시 맞출 수 있다.
 */
export async function matchVendor(
  client: PoolClient,
  name: string | null
): Promise<string | null> {
  if (!name?.trim()) {
    return null;
  }

  const direct = await client.query<{ id: string }>(
    `SELECT id FROM structured.vendors
     WHERE normalized_name = structured.normalize_vendor_name($1)`,
    [name]
  );

  // 같은 이름의 업체가 여러 지역에 있으면 어느 쪽인지 알 수 없다. 연결하지 않는다.
  if (direct.rows.length === 1) {
    return direct.rows[0]!.id;
  }

  if (direct.rows.length > 1) {
    return null;
  }

  const alias = await client.query<{ vendor_id: string }>(
    `SELECT vendor_id FROM structured.vendor_aliases
     WHERE normalized_alias = structured.normalize_vendor_name($1)`,
    [name]
  );

  return alias.rows[0]?.vendor_id ?? null;
}

/**
 * 업체가 새로 등록되면 그 이름으로 남아 있던 문서들을 연결한다.
 * 이미 연결된 문서는 건드리지 않는다.
 */
export async function backfillVendorMatches(
  client: PoolClient,
  vendorId: string
): Promise<number> {
  const { rowCount } = await client.query(
    `UPDATE structured.quotes q
     SET vendor_id = $1
     FROM structured.vendors v
     WHERE v.id = $1
       AND q.vendor_id IS NULL
       AND q.vendor_name_raw IS NOT NULL
       AND structured.normalize_vendor_name(q.vendor_name_raw) = v.normalized_name`,
    [vendorId]
  );

  return rowCount ?? 0;
}
