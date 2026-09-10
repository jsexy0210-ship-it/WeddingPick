import type { Pool, PoolClient } from 'pg';

import { ApiError, notFound } from './errors';

/**
 * 업체 관리 — 상호 변경 · 영업 상태 · 병합.
 *
 * 화면은 WP-ADM-014(데이터 · 업체 관리)이고, 셋 다 「조회는 되는데 눌러도 아무 일도
 * 일어나지 않던」 단추였다.
 *
 * ## 병합을 왜 이렇게 조심하나
 *
 * 병합은 이 콘솔에서 되돌릴 수 없는 유일한 조작이고, **남의 기록에 닿는다.** 업체 A를
 * B로 합치면 A에 달린 제보 · 후기 · Pick · 이미지가 전부 B로 따라 움직인다. 그것들은
 * 관리자가 만든 것이 아니라 사용자가 쓴 것이다.
 *
 * 그래서 세 가지를 강제한다.
 *
 * 1. **세어서 보여준 뒤에 시킨다**(`mergePreview`). 몇 건이 옮겨 가는지 모르고 누르는
 *    일이 없어야 한다. v3.27 관리자 공통 규칙 — 위험한 조작은 무엇이 바뀌는지 항목으로
 *    보여준 뒤 한 번 더 확인.
 * 2. **사유를 받는다.** 나중에 따질 때 필요한 것은 바뀐 값이 아니라 왜 그렇게
 *    판단했는가다.
 * 3. **한 트랜잭션 안에서 옮기고 이력을 남긴다.** 절반만 옮겨 간 상태는 어느 쪽 업체를
 *    봐도 진실이 아니다.
 */

/** 화면이 그리는 상태 넷. `structured.vendors`의 컬럼 조합에서 끌어낸다. */
export type VendorStatus = 'active' | 'closed' | 'suspended' | 'merged';

/** 관리자가 직접 고를 수 있는 상태. 「병합됨」은 병합의 결과일 뿐 고르는 것이 아니다. */
export const SETTABLE_STATUSES = ['active', 'closed', 'suspended'] as const;
export type SettableVendorStatus = (typeof SETTABLE_STATUSES)[number];

/**
 * 병합할 때 vendor_id만 바꿔 달면 되는 표들.
 *
 * Pick(`vendor_candidates` · `category_decisions`)은 여기 없다 — 둘 사이에 FK가 걸려
 * 있어서 따로 다룬다(`movePicks` 참고).
 *
 * `conflict`는 「옮기려는데 그 자리에 이미 있는」 경우다. 표마다 사용자당 하나라는
 * UNIQUE가 걸려 있어서(한 사람이 한 업체에 후기 하나 등), 같은 사람이 A와 B 둘 다에
 * 남긴 것이 있으면 옮길 자리가 차 있다. 그때는 **옮기지 않고 A 쪽에 그대로 둔다** —
 * 지우면 사용자가 쓴 것이 소리 없이 사라진다.
 */
const MOVED_TABLES = [
  { table: 'structured.price_reports', label: '제보' },
  { table: 'structured.payment_proofs', label: '제보' },
  { table: 'structured.reviews', label: '후기' },
  { table: 'structured.vendor_images', label: '이미지' },
] as const;

export type MergeCount = {
  /** 화면에 그대로 적는 이름. 「제보」 · 「후기」 · 「Pick」 · 「이미지」 */
  label: string;
  /** 대상 업체로 옮겨 가는 건수. */
  moves: number;
  /** 대상 업체에 이미 같은 것이 있어 옮기지 않는 건수. 0이면 화면에 적지 않는다. */
  blocked: number;
};

export type MergePreview = {
  source: { id: string; name: string; category: string };
  target: { id: string; name: string; category: string };
  /** 무엇이 몇 건 옮겨 가는지. 합이 0이어도 항목은 그대로 보여준다 — 「0건」도 답이다. */
  counts: MergeCount[];
  /** 업종이 다르면 대개 잘못 고른 것이다. 막지는 않고 화면이 경고하도록 알려준다. */
  categoryDiffers: boolean;
};

type VendorRow = {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  closed_at: Date | null;
  suspended_at: Date | null;
  merged_into_vendor_id: string | null;
};

const VENDOR_COLUMNS = `id, name, category::text AS category, is_active,
                        closed_at, suspended_at, merged_into_vendor_id`;

/**
 * 컬럼 조합에서 상태 하나를 끌어낸다.
 *
 * 순서가 곧 우선순위다. 병합된 업체는 폐업 여부와 무관하게 「병합됨」이고 — 흡수된
 * 뒤에는 그 업체를 따로 볼 일이 없다 — 정지는 폐업보다 먼저 본다. `closed_at`은
 * 한 번 폐업했다가 되살아난 업체에 과거 기록으로 남아 있을 수 있어서,
 * 그것만으로 「폐업」이라 읽으면 안 된다.
 */
export function vendorStatus(row: {
  is_active: boolean;
  closed_at: Date | null;
  suspended_at: Date | null;
  merged_into_vendor_id: string | null;
}): VendorStatus {
  if (row.merged_into_vendor_id !== null) return 'merged';
  if (row.is_active) return 'active';
  if (row.suspended_at !== null) return 'suspended';
  return 'closed';
}

async function loadVendor(
  db: Pool | PoolClient,
  id: string,
  lock = false
): Promise<VendorRow | null> {
  const { rows } = await db.query<VendorRow>(
    `SELECT ${VENDOR_COLUMNS} FROM structured.vendors WHERE id = $1${lock ? ' FOR UPDATE' : ''}`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * uuid가 아닌 것을 그대로 질의에 넣으면 Postgres가 22P02로 터진다. 그건 500이 되고,
 * 운영자에게는 「서버가 죽었다」로 보인다. 실제로는 ID를 잘못 붙여넣은 것이므로
 * 404로 돌려준다.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(id: string, what: string): void {
  if (!UUID.test(id)) throw notFound(what);
}

/** 이력 한 줄. 화면의 「재귀속 이력」이 이대로 그린다. */
export type ChangeLogEntry = { at: string; action: string; note: string };

const ACTION_LABEL: Record<string, string> = {
  name: '상호 변경',
  status: '영업 상태 변경',
  merged_into_vendor_id: '업체 병합',
};

/**
 * 업체 변경 이력을 화면이 읽는 모양으로.
 *
 * `vendor_change_log`(0048)에는 관리자 · 임포트 · 정정신청 · 관계자인증이 다 들어온다.
 * 화면은 그 넷을 구분하지 않고 「언제 · 무엇을 · 어떻게」만 그리므로 여기서 한 줄로 만든다.
 */
export async function vendorHistory(
  db: Pool | PoolClient,
  vendorId: string,
  limit = 20
): Promise<ChangeLogEntry[]> {
  const { rows } = await db.query<{
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    note: string | null;
    changed_at: Date;
  }>(
    `SELECT field_name, old_value, new_value, note, changed_at
       FROM structured.vendor_change_log
      WHERE vendor_id = $1
      ORDER BY changed_at DESC
      LIMIT $2`,
    [vendorId, limit]
  );

  return rows.map(toEntry);
}

/** 이력 한 줄을 화면이 읽는 모양으로. 목록과 상세가 같은 규칙을 쓰도록 한 곳에 둔다. */
function toEntry(r: {
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  changed_at: Date;
}): ChangeLogEntry {
  const changed =
    r.old_value !== null && r.new_value !== null
      ? `${r.old_value} → ${r.new_value}`
      : (r.new_value ?? r.old_value ?? '');
  return {
    at: r.changed_at.toISOString(),
    action: ACTION_LABEL[r.field_name] ?? r.field_name,
    // 사유가 있으면 사유가 먼저다. 무엇이 바뀌었는지는 대개 짐작이 되지만
    // 왜 바꿨는지는 적어둔 사람만 안다.
    note: r.note ? (changed ? `${r.note} (${changed})` : r.note) : changed,
  };
}

export type AdminVendor = {
  id: string;
  name: string;
  category: string;
  status: VendorStatus;
  dataCount: number;
  mergedInto: string | null;
  history: ChangeLogEntry[];
};

/** 한 번에 내려보내는 최대 업체 수. 화면이 받아서 스스로 걸러 보여준다. */
const LIST_LIMIT = 500;
/** 업체 하나에 붙여 보내는 이력 줄 수. 모달이 그리는 만큼만. */
const HISTORY_PER_VENDOR = 10;

/**
 * 관리자 표에 그릴 업체 목록.
 *
 * 이력을 업체마다 따로 읽지 않는다 — 500개면 질의가 501번 나간다. 한 번에 읽고
 * 업체별로 나눈다.
 */
export async function listVendors(pool: Pool): Promise<{ vendors: AdminVendor[]; total: number }> {
  const { rows } = await pool.query<
    VendorRow & { data_count: string; merged_into_name: string | null }
  >(
    `SELECT v.id, v.name, v.category::text AS category, v.is_active,
            v.closed_at, v.suspended_at, v.merged_into_vendor_id,
            m.name AS merged_into_name,
            (SELECT COUNT(*) FROM structured.price_reports pr
              WHERE pr.vendor_id = v.id AND pr.rejected_at IS NULL)
          + (SELECT COUNT(*) FROM structured.payment_proofs pp
              WHERE pp.vendor_id = v.id)
            AS data_count
       FROM structured.vendors v
       LEFT JOIN structured.vendors m ON m.id = v.merged_into_vendor_id
      ORDER BY v.created_at DESC
      LIMIT $1`,
    [LIST_LIMIT]
  );

  const { rows: totalRows } = await pool.query<{ n: string }>(
    'SELECT COUNT(*)::text AS n FROM structured.vendors'
  );

  const ids = rows.map((r) => r.id);
  const history = new Map<string, ChangeLogEntry[]>();

  if (ids.length > 0) {
    const { rows: logRows } = await pool.query<{
      vendor_id: string;
      field_name: string;
      old_value: string | null;
      new_value: string | null;
      note: string | null;
      changed_at: Date;
    }>(
      `SELECT vendor_id, field_name, old_value, new_value, note, changed_at
         FROM (
           SELECT vendor_id, field_name, old_value, new_value, note, changed_at,
                  ROW_NUMBER() OVER (PARTITION BY vendor_id ORDER BY changed_at DESC) AS rn
             FROM structured.vendor_change_log
            WHERE vendor_id = ANY($1::uuid[])
         ) ranked
        WHERE rn <= $2
        ORDER BY changed_at DESC`,
      [ids, HISTORY_PER_VENDOR]
    );

    for (const r of logRows) {
      const list = history.get(r.vendor_id) ?? [];
      list.push(toEntry(r));
      history.set(r.vendor_id, list);
    }
  }

  return {
    vendors: rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      status: vendorStatus(r),
      dataCount: Number(r.data_count),
      // 화면은 대상 업체를 사람이 읽어야 하므로 id가 아니라 이름을 준다.
      mergedInto: r.merged_into_name,
      history: history.get(r.id) ?? [],
    })),
    total: Number(totalRows[0]?.n ?? '0'),
  };
}

async function writeChangeLog(
  db: PoolClient,
  entry: {
    vendorId: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    operatorId: string;
    note: string | null;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO structured.vendor_change_log
       (vendor_id, field_name, old_value, new_value, cause, changed_by, note)
     VALUES ($1, $2, $3, $4, 'admin', $5, $6)`,
    [entry.vendorId, entry.field, entry.oldValue, entry.newValue, entry.operatorId, entry.note]
  );
}

// ─── 상호 변경 ──────────────────────────────────────────────────────────────

export async function renameVendor(
  pool: Pool,
  vendorId: string,
  rawName: string,
  operatorId: string
): Promise<{ name: string }> {
  requireUuid(vendorId, '업체');
  const name = rawName.trim();
  if (!name) throw new ApiError('invalid_request', '상호를 입력해 주세요.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const vendor = await loadVendor(client, vendorId, true);
    if (!vendor) throw notFound('업체');

    // 병합된 업체의 상호를 고치는 것은 흡수된 껍데기에 손대는 것이라 뜻이 없다.
    if (vendor.merged_into_vendor_id !== null) {
      throw new ApiError('conflict', '병합된 업체는 수정할 수 없습니다.');
    }

    if (vendor.name !== name) {
      await client.query('UPDATE structured.vendors SET name = $2 WHERE id = $1', [vendorId, name]);
      await writeChangeLog(client, {
        vendorId,
        field: 'name',
        oldValue: vendor.name,
        newValue: name,
        operatorId,
        note: null,
      });
    }

    await client.query('COMMIT');
    return { name };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ─── 영업 상태 ──────────────────────────────────────────────────────────────

/**
 * 상태를 바꾼다.
 *
 * 셋 중 하나만 참이도록 나머지 표시를 지운다. 「정지였다가 폐업」으로 갈 때
 * `suspended_at`을 남겨두면 상태를 읽는 쪽이 어느 것을 먼저 볼지에 따라 답이 갈린다.
 */
export async function setVendorStatus(
  pool: Pool,
  vendorId: string,
  status: SettableVendorStatus,
  operatorId: string
): Promise<{ status: SettableVendorStatus }> {
  requireUuid(vendorId, '업체');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const vendor = await loadVendor(client, vendorId, true);
    if (!vendor) throw notFound('업체');

    if (vendor.merged_into_vendor_id !== null) {
      throw new ApiError('conflict', '병합된 업체는 수정할 수 없습니다.');
    }

    const before = vendorStatus(vendor);
    if (before !== status) {
      if (status === 'active') {
        await client.query(
          `UPDATE structured.vendors
              SET is_active = true, closed_at = NULL, suspended_at = NULL
            WHERE id = $1`,
          [vendorId]
        );
      } else if (status === 'closed') {
        await client.query(
          `UPDATE structured.vendors
              SET is_active = false, closed_at = now(), suspended_at = NULL
            WHERE id = $1`,
          [vendorId]
        );
      } else {
        await client.query(
          `UPDATE structured.vendors
              SET is_active = false, suspended_at = now(), closed_at = NULL
            WHERE id = $1`,
          [vendorId]
        );
      }

      await writeChangeLog(client, {
        vendorId,
        field: 'status',
        oldValue: before,
        newValue: status,
        operatorId,
        note: null,
      });
    }

    await client.query('COMMIT');
    return { status };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ─── 병합 ───────────────────────────────────────────────────────────────────

/**
 * 두 업체를 읽고 병합할 수 있는 짝인지 본다. 미리보기와 실제 병합이 같은 판단을
 * 쓰도록 한 곳에 둔다 — 미리보기가 통과시킨 것을 병합이 거절하면, 운영자는 세어서
 * 보여준 화면을 믿고 눌렀다가 거절당한다.
 */
async function loadMergePair(
  db: Pool | PoolClient,
  sourceId: string,
  targetId: string,
  lock = false
): Promise<{ source: VendorRow; target: VendorRow }> {
  requireUuid(sourceId, '업체');
  requireUuid(targetId, '병합할 업체');

  if (sourceId === targetId) {
    throw new ApiError('invalid_request', '같은 업체끼리는 병합할 수 없습니다.');
  }

  // 잠글 때는 id 순으로 — 두 운영자가 A→B와 B→A를 동시에 시작하면 서로를 기다린다.
  const [first, second] = sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];
  const rows = new Map<string, VendorRow>();
  for (const id of [first, second]) {
    const row = await loadVendor(db, id, lock);
    if (row) rows.set(id, row);
  }

  const source = rows.get(sourceId);
  if (!source) throw notFound('업체');
  const target = rows.get(targetId);
  if (!target) throw notFound('병합할 업체');

  if (source.merged_into_vendor_id !== null) {
    throw new ApiError('conflict', '이미 병합된 업체입니다.');
  }
  // 병합된 업체로 합치면 A → B → C 사슬이 생긴다. 사슬은 「어디로 갔나」를
  // 한 번에 답할 수 없게 만들고, 옮긴 기록도 중간 업체에 남아 흩어진다.
  if (target.merged_into_vendor_id !== null) {
    throw new ApiError('conflict', '이미 병합된 업체로는 합칠 수 없습니다.');
  }

  return { source, target };
}

/**
 * 무엇이 몇 건 옮겨 가는지 센다. 아무것도 바꾸지 않는다.
 *
 * 옮겨 갈 것(`moves`)과 자리가 차서 못 옮길 것(`blocked`)을 나눠 센다. 실제 병합의
 * `ON CONFLICT DO NOTHING`이 남길 결과와 같은 수가 나오도록 같은 조건으로 센다.
 */
export async function mergePreview(
  pool: Pool,
  sourceId: string,
  targetId: string
): Promise<MergePreview> {
  const { source, target } = await loadMergePair(pool, sourceId, targetId);

  const byLabel = new Map<string, MergeCount>();
  for (const { table, label } of MOVED_TABLES) {
    const conflict = CONFLICT_KEYS[table];
    // 옮길 자리가 이미 찬 행을 세는 조건. UNIQUE가 없는 표는 전부 옮겨 간다.
    const blockedExpr = conflict
      ? `SUM(CASE WHEN EXISTS (
             SELECT 1 FROM ${table} t
              WHERE t.vendor_id = $2 AND ${conflict.map((k) => `t.${k} = s.${k}`).join(' AND ')}
           ) THEN 1 ELSE 0 END)::text`
      // UNIQUE가 없는 표는 부딪힐 일이 없어 전부 옮겨 간다. 그래도 $2를 한 번
      // 짚어야 한다 — 안 쓰면 Postgres가 「인자 둘을 줬는데 하나만 쓴다」로 거절한다.
      : `(CASE WHEN $2::uuid IS NULL THEN '0' ELSE '0' END)`;

    const { rows } = await pool.query<{ total: string; blocked: string }>(
      `SELECT COUNT(*)::text AS total, COALESCE(${blockedExpr}, '0') AS blocked
         FROM ${table} s
        WHERE s.vendor_id = $1`,
      [sourceId, targetId]
    );

    const total = Number(rows[0]?.total ?? '0');
    const blocked = Number(rows[0]?.blocked ?? '0');
    const entry = byLabel.get(label) ?? { label, moves: 0, blocked: 0 };
    entry.moves += total - blocked;
    entry.blocked += blocked;
    byLabel.set(label, entry);
  }

  const picks = await countPicks(pool, sourceId, targetId);
  byLabel.set('Pick', picks);

  return {
    source: { id: source.id, name: source.name, category: source.category },
    target: { id: target.id, name: target.name, category: target.category },
    counts: [...byLabel.values()],
    categoryDiffers: source.category !== target.category,
  };
}

/**
 * 자리가 이미 찼는지 가르는 열쇠. 표마다 걸린 UNIQUE에서 vendor_id를 뺀 나머지다.
 *
 *  - price_reports    UNIQUE (vendor_id, reporter_user_id, product_name)  0021
 *  - reviews          UNIQUE (vendor_id, author_user_id)                  0020
 *  - vendor_candidates UNIQUE (wedding_id, vendor_id)                     0026
 *
 * payment_proofs의 UNIQUE에는 vendor_id가 없고(제보자·가맹점·시각·금액), vendor_images에는
 * UNIQUE가 없다 — 둘은 부딪힐 일이 없으므로 전부 옮겨 간다.
 */
const CONFLICT_KEYS: Record<string, readonly string[] | undefined> = {
  'structured.price_reports': ['reporter_user_id', 'product_name'],
  'structured.reviews': ['author_user_id'],
};

/**
 * Pick을 옮긴다. 후보와 결정을 함께 다뤄야 해서 다른 표들과 갈라놓았다.
 *
 * `category_decisions`는 `vendor_candidates (wedding_id, vendor_id)`를 FK로 가리키는데
 * (0041 `decision_is_a_pick`), 그 FK에 `ON UPDATE`가 없다. 그래서 후보의 vendor_id를
 * 그냥 UPDATE하면 결정이 가리키던 짝이 사라져 즉시 FK 위반으로 터진다 — 어느 예식이
 * 이 업체로 «결정»까지 해둔 경우가 정확히 그렇고, 흔한 경우다.
 *
 * 그래서 옮기지 않고 **넣고 · 옮기고 · 지운다.**
 *
 *   1. 대상 업체 후보를 넣는다(이미 있으면 그대로 둔다)
 *   2. 결정을 대상 업체로 옮긴다 — 이때 (예식, 대상업체) 후보는 1에서 확보돼 있다
 *   3. 원래 업체 후보를 지운다
 *
 * 순서를 지키면 FK가 한 번도 깨지지 않는다. 3에서 지우는 것 중에는 「대상 업체를 이미
 * 담고 있던」 예식의 것도 있는데, 그건 잃는 것이 아니다 — 그 예식의 Pick 목록에는
 * 대상 업체가 그대로 남는다.
 */
async function movePicks(
  client: PoolClient,
  sourceId: string,
  targetId: string
): Promise<MergeCount> {
  const { rows: overlap } = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
       FROM structured.vendor_candidates s
      WHERE s.vendor_id = $1
        AND EXISTS (
          SELECT 1 FROM structured.vendor_candidates t
           WHERE t.vendor_id = $2 AND t.wedding_id = s.wedding_id
        )`,
    [sourceId, targetId]
  );

  const inserted = await client.query(
    `INSERT INTO structured.vendor_candidates (wedding_id, vendor_id, added_by, note, added_at)
     SELECT s.wedding_id, $2, s.added_by, s.note, s.added_at
       FROM structured.vendor_candidates s
      WHERE s.vendor_id = $1
     ON CONFLICT (wedding_id, vendor_id) DO NOTHING`,
    [sourceId, targetId]
  );

  // 결정은 (예식, 업종)이 기본키라 한 예식·업종에 하나뿐이다. 그래서 vendor_id만
  // 바꿔도 기본키가 부딪히지 않는다 — 부딪힐 짝 자체가 존재할 수 없다.
  await client.query(
    `UPDATE structured.category_decisions SET vendor_id = $2 WHERE vendor_id = $1`,
    [sourceId, targetId]
  );

  await client.query(`DELETE FROM structured.vendor_candidates WHERE vendor_id = $1`, [sourceId]);

  return { label: 'Pick', moves: inserted.rowCount ?? 0, blocked: Number(overlap[0]?.n ?? '0') };
}

/** 미리보기에서 Pick이 몇 건 옮겨 갈지 센다. `movePicks`와 같은 조건으로 센다. */
async function countPicks(db: Pool, sourceId: string, targetId: string): Promise<MergeCount> {
  const { rows } = await db.query<{ total: string; overlap: string }>(
    `SELECT COUNT(*)::text AS total,
            COALESCE(SUM(CASE WHEN EXISTS (
              SELECT 1 FROM structured.vendor_candidates t
               WHERE t.vendor_id = $2 AND t.wedding_id = s.wedding_id
            ) THEN 1 ELSE 0 END), 0)::text AS overlap
       FROM structured.vendor_candidates s
      WHERE s.vendor_id = $1`,
    [sourceId, targetId]
  );
  const total = Number(rows[0]?.total ?? '0');
  const overlap = Number(rows[0]?.overlap ?? '0');
  return { label: 'Pick', moves: total - overlap, blocked: overlap };
}

export type MergeResult = {
  moved: MergeCount[];
  sourceId: string;
  targetId: string;
};

/**
 * 실제로 합친다. 되돌릴 수 없다.
 *
 * 옮기기 · 상태 바꾸기 · 이력 남기기가 한 트랜잭션이다. 사유(`reason`)는 반드시 받는다 —
 * 되돌릴 수 없는 조작에서 「누가 했는지」만 남고 「왜 했는지」가 없으면, 나중에 잘못을
 * 발견해도 어디서부터 잘못됐는지 짚을 수가 없다.
 */
export async function mergeVendors(
  pool: Pool,
  sourceId: string,
  targetId: string,
  rawReason: string,
  operatorId: string
): Promise<MergeResult> {
  const reason = rawReason.trim();
  if (!reason) {
    throw new ApiError('invalid_request', '병합 사유를 입력해 주세요.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { source, target } = await loadMergePair(client, sourceId, targetId, true);

    const byLabel = new Map<string, MergeCount>();
    for (const { table, label } of MOVED_TABLES) {
      const conflict = CONFLICT_KEYS[table];
      // 자리가 찬 행은 건드리지 않고 원래 업체에 남긴다. 지우면 사용자가 쓴 것이
      // 병합 때문에 사라진다 — 병합은 업체를 합치는 것이지 기록을 줄이는 것이 아니다.
      const guard = conflict
        ? ` AND NOT EXISTS (
              SELECT 1 FROM ${table} t
               WHERE t.vendor_id = $2 AND ${conflict.map((k) => `t.${k} = s.${k}`).join(' AND ')}
            )`
        : '';

      const { rowCount } = await client.query(
        `UPDATE ${table} s SET vendor_id = $2 WHERE s.vendor_id = $1${guard}`,
        [sourceId, targetId]
      );

      const { rows: left } = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM ${table} WHERE vendor_id = $1`,
        [sourceId]
      );

      const entry = byLabel.get(label) ?? { label, moves: 0, blocked: 0 };
      entry.moves += rowCount ?? 0;
      entry.blocked += Number(left[0]?.n ?? '0');
      byLabel.set(label, entry);
    }

    byLabel.set('Pick', await movePicks(client, sourceId, targetId));

    await client.query(
      `UPDATE structured.vendors
          SET merged_into_vendor_id = $2, is_active = false, suspended_at = NULL
        WHERE id = $1`,
      [sourceId, targetId]
    );

    const moved = [...byLabel.values()];
    // 옮긴 건수를 사유와 함께 적는다. 「제보 12건 · 후기 3건」이 나중에 되짚을 때
    // 유일한 근거다 — 옮기고 나면 원래 어디에 있었는지는 어디에도 안 남는다.
    const summary = moved
      .filter((m) => m.moves > 0)
      .map((m) => `${m.label} ${m.moves}건`)
      .join(' · ');

    await writeChangeLog(client, {
      vendorId: sourceId,
      field: 'merged_into_vendor_id',
      oldValue: source.name,
      newValue: target.name,
      operatorId,
      note: summary ? `${reason} — 옮김: ${summary}` : reason,
    });

    // 흡수한 쪽에도 남긴다. B만 보고 있던 사람에게 「어느 날 갑자기 제보가 늘어난」
    // 이유가 여기 말고는 없다.
    await writeChangeLog(client, {
      vendorId: targetId,
      field: 'merged_into_vendor_id',
      oldValue: null,
      newValue: source.name,
      operatorId,
      note: summary ? `${source.name} 병합 — 받음: ${summary}` : `${source.name} 병합`,
    });

    await client.query('COMMIT');
    return { moved, sourceId, targetId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
