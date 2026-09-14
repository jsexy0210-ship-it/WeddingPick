import {
  ACTIVITY_FOLD_RULE,
  ACTIVITY_MAX_AXES,
  ACTIVITY_MIN_SUBJECTS,
  REGION_SUFFIX_PATTERN,
  type ActivityPeriodDays,
} from '@weddingpick/domain';
import type { Pool } from 'pg';

/**
 * 1층을 읽어 2층을 뽑고, 관리자 화면이 읽을 값을 만드는 자리.
 *
 * **밖으로 나가는 것은 2층뿐이다**(`exportRollups`). 1층을 내보내는 길은 이 파일에
 * 없고, 만들지 않는다.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 2층 뽑기
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ── 접는 규칙 v1 ───────────────────────────────────────────────────────────
 *
 * 2층의 축 셋이 어디서 오는지. **행마다 `fold_rule`로 함께 저장된다** — 나중에
 * 「이게 정말 익명인가」를 다시 따질 때 어느 기준으로 접힌 값인지 알아야 한다.
 *
 *   region          그 회원의 웨딩 지역. 짧은 꼴 아홉으로 맞춘다
 *                   (`REGION_SUFFIX_PATTERN` — SQL과 코드가 같은 규칙을 쓴다).
 *                   목록에 없는 값은 NULL로 두고, 그 줄은 지역으로 가르는 묶음에서
 *                   빠진다. 없는 지역을 「그 외」로 밀어 넣지 않는다 — 「그 외」는
 *                   사용자가 실제로 고른 칸이라 거기에 모르는 값을 섞으면 그 칸의
 *                   수가 거짓이 된다.
 *
 *   category        사건이 업종을 직접 들고 있으면 그것(검색 · 업종 고르기).
 *                   업체를 가리키는 사건이면 그 업체의 업종을 붙인다.
 *                   둘 다 아니면 NULL.
 *
 *   budget_bracket  그 회원의 준비 예산 구간. `unknown`은 사용자가 실제로 고른
 *                   칸이라(«아직 모르겠어요») 그대로 한 묶음이 된다.
 *
 * **검색어는 목록값으로만 올라간다.** 원문은 1층에만 있고, 2층으로는 `foldSearchText`가
 * 집어낸 업종·지역만 간다. 어느 쪽에도 안 걸린 말은 축 없는 묶음에 든다.
 */
const FOLD_RULE_SQL = `
  WITH base AS (
    SELECT
      e.user_id,
      e.event_name,
      e.surface,
      CASE
        WHEN r.short_name IN ('서울','경기','인천','부산','대구','대전','광주','울산','그 외')
          THEN r.short_name
        ELSE NULL
      END AS region,
      COALESCE(e.category, v.category) AS category,
      w.budget_bracket
    FROM structured.activity_events e
    LEFT JOIN LATERAL (
      SELECT * FROM structured.weddings w2
      WHERE w2.owner_user_id = e.user_id OR w2.partner_user_id = e.user_id
      ORDER BY w2.created_at
      LIMIT 1
    ) w ON true
    LEFT JOIN LATERAL (
      SELECT regexp_replace(split_part(btrim(w.region), ' ', 1), $4, '') AS short_name
    ) r ON true
    LEFT JOIN structured.vendors v
      ON e.target_kind = 'vendor' AND v.id = e.target_id
    WHERE e.occurred_at >= $1::date
      AND e.occurred_at < $1::date + ($2 || ' days')::interval
      /*
       * 정정 줄이 붙은 줄은 세지 않는다. 틀린 줄은 원장에 그대로 남지만, 집계는
       * 바로잡힌 쪽만 센다 — 둘 다 세면 한 사건이 두 번 들어간다.
       */
      AND NOT EXISTS (
        SELECT 1 FROM structured.activity_events c WHERE c.corrects_event_id = e.id
      )
  ),
  /*
   * 축을 겹치는 조합 일곱. **셋을 한꺼번에 겹치는 조합은 없다** — 인원이 열이어도
   * 「서울 · 스튜디오 · 3천만원대」는 한 줄로 사람을 그린다(ACTIVITY_MAX_AXES).
   */
  grouped_raw AS (
    SELECT
      event_name,
      surface,
      region,
      category,
      budget_bracket,
      GROUPING(region) AS g_region,
      GROUPING(category) AS g_category,
      GROUPING(budget_bracket) AS g_budget,
      COUNT(DISTINCT user_id)::int AS subject_count,
      COUNT(*)::int AS event_count
    FROM base
    GROUP BY event_name, surface, GROUPING SETS (
      (),
      (region),
      (category),
      (budget_bracket),
      (region, category),
      (region, budget_bracket),
      (category, budget_bracket)
    )
  ),
  /*
   * **축으로 삼은 칸이 비어 있는 묶음은 버린다.**
   *
   * GROUPING SETS는 축에서 뺀 칸도 NULL로 채운다. 그래서 「지역으로 갈랐는데 그
   * 지역이 NULL인 묶음」과 「지역으로 안 가른 묶음」이 셋 다 NULL인 같은 줄이 되어
   * 서로를 덮어쓴다. 앞의 것은 애초에 내보낼 값이 아니다 — 「지역을 모르는 사람들」은
   * 지역 묶음이 아니다.
   *
   * GROUPING(x) = 1 이 「이 칸은 축이 아니다」라는 뜻이다.
   */
  grouped AS (
    SELECT event_name, surface, region, category, budget_bracket, subject_count, event_count
    FROM grouped_raw
    WHERE (g_region = 1 OR region IS NOT NULL)
      AND (g_category = 1 OR category IS NOT NULL)
      AND (g_budget = 1 OR budget_bracket IS NOT NULL)
  )
`;

export type RollupResult = {
  periodStart: string;
  periodDays: ActivityPeriodDays;
  rowsWritten: number;
  /** 최소 인원에 못 미쳐 내보내지 않은 묶음 수. */
  rowsSuppressed: number;
  kThreshold: number;
  foldRule: string;
};

/**
 * 한 기간을 뽑아 2층에 넣는다.
 *
 * **최소 인원에 못 미치는 묶음은 행 자체를 만들지 않는다.** 0으로 적거나 «적음»으로
 * 적는 것도 내보내는 것이다 — 그 칸이 비어 있다는 사실 자체가 「열 명이 안 된다」를
 * 말하고, 옆 칸과 견주면 남은 수가 드러난다.
 *
 * 같은 기간을 다시 뽑으면 행을 덮는다. 원장이 늦게 올라온 줄을 받았을 수 있어서다.
 * **덮는 것은 2층뿐이고 1층은 그대로다.**
 */
export async function buildRollup(
  pool: Pool,
  input: { periodStart: string; periodDays: ActivityPeriodDays }
): Promise<RollupResult> {
  const params = [input.periodStart, String(input.periodDays), ACTIVITY_MIN_SUBJECTS, REGION_SUFFIX_PATTERN];

  const { rows: counted } = await pool.query<{ total: string; publishable: string }>(
    `${FOLD_RULE_SQL}
     SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE subject_count >= $3::int) AS publishable
     FROM grouped`,
    params
  );

  const total = Number(counted[0]?.total ?? 0);
  const publishable = Number(counted[0]?.publishable ?? 0);

  if (publishable > 0) {
    await pool.query(
      `${FOLD_RULE_SQL}
       INSERT INTO structured.activity_rollups
         (period_start, period_days, event_name, surface, region, category, budget_bracket,
          subject_count, event_count, fold_rule, k_threshold)
       SELECT
         $1::date, $2::smallint, event_name, surface, region, category, budget_bracket,
         subject_count, event_count, $5, $3::smallint
       FROM grouped
       WHERE subject_count >= $3::int
       ON CONFLICT (period_start, period_days, event_name, surface, region, category, budget_bracket)
       DO UPDATE SET
         subject_count = excluded.subject_count,
         event_count = excluded.event_count,
         fold_rule = excluded.fold_rule,
         k_threshold = excluded.k_threshold,
         built_at = now()`,
      [...params, ACTIVITY_FOLD_RULE]
    );
  }

  await pool.query(
    `INSERT INTO structured.activity_rollup_runs
       (period_start, period_days, k_threshold, fold_rule, rows_written, rows_suppressed)
     VALUES ($1::date, $2::smallint, $3::smallint, $4, $5, $6)`,
    [
      input.periodStart,
      input.periodDays,
      ACTIVITY_MIN_SUBJECTS,
      ACTIVITY_FOLD_RULE,
      publishable,
      total - publishable,
    ]
  );

  return {
    periodStart: input.periodStart,
    periodDays: input.periodDays,
    rowsWritten: publishable,
    rowsSuppressed: total - publishable,
    kThreshold: ACTIVITY_MIN_SUBJECTS,
    foldRule: ACTIVITY_FOLD_RULE,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 관리자 화면이 읽는 값
// ═══════════════════════════════════════════════════════════════════════════

export type LedgerRow = {
  id: string;
  userId: string;
  eventName: string;
  surface: string;
  occurredAt: string;
  target: string | null;
  category: string | null;
  region: string | null;
  searchText: string | null;
  itemCount: number | null;
  step: number | null;
  /** 이 줄을 바로잡은 줄이 뒤에 있는가. */
  corrected: boolean;
};

export type ActivityOverview = {
  ledger: {
    rows: LedgerRow[];
    total: number;
    /** 서로 다른 회원 수. 최근 목록이 아니라 원장 전체 기준. */
    subjects: number;
    /** 가장 오래된 줄과 가장 최근 줄. 원장이 비어 있으면 둘 다 null. */
    firstAt: string | null;
    lastAt: string | null;
    /** 큐가 넘쳐 버려진 줄. 0이 아니면 원장이 온전하지 않다. */
    droppedInProcess: number;
  };
  rollup: {
    rows: {
      periodStart: string;
      periodDays: number;
      eventName: string;
      surface: string;
      region: string | null;
      category: string | null;
      budgetBracket: string | null;
      subjectCount: number;
      eventCount: number;
    }[];
    total: number;
    lastRun: {
      periodStart: string;
      builtAt: string;
      rowsWritten: number;
      rowsSuppressed: number;
      kThreshold: number;
      foldRule: string;
    } | null;
  };
  /** 화면이 숫자를 스스로 정하지 않게 기준을 함께 내려준다. */
  policy: {
    minSubjects: number;
    maxAxes: number;
    foldRule: string;
  };
};

const LEDGER_LIMIT = 200;
const ROLLUP_LIMIT = 200;

export async function activityOverview(
  pool: Pool,
  options: { userId?: string; droppedInProcess: number }
): Promise<ActivityOverview> {
  const filtered = options.userId ? [options.userId] : [];
  const where = options.userId ? 'WHERE e.user_id = $1' : '';

  const { rows: ledgerRows } = await pool.query<{
    id: string;
    user_id: string;
    event_name: string;
    surface: string;
    occurred_at: Date;
    target_kind: string | null;
    target_id: string | null;
    category: string | null;
    region: string | null;
    search_text: string | null;
    item_count: number | null;
    step: number | null;
    corrected: boolean;
  }>(
    `SELECT e.*, EXISTS (
       SELECT 1 FROM structured.activity_events c WHERE c.corrects_event_id = e.id
     ) AS corrected
     FROM structured.activity_events e
     ${where}
     ORDER BY e.occurred_at DESC
     LIMIT ${LEDGER_LIMIT}`,
    filtered
  );

  const { rows: summary } = await pool.query<{
    total: string;
    subjects: string;
    first_at: Date | null;
    last_at: Date | null;
  }>(
    `SELECT COUNT(*) AS total,
            COUNT(DISTINCT user_id) AS subjects,
            MIN(occurred_at) AS first_at,
            MAX(occurred_at) AS last_at
     FROM structured.activity_events`
  );

  const { rows: rollupRows } = await pool.query<{
    period_start: Date;
    period_days: number;
    event_name: string;
    surface: string;
    region: string | null;
    category: string | null;
    budget_bracket: string | null;
    subject_count: number;
    event_count: number;
  }>(
    `SELECT * FROM structured.activity_rollups
     ORDER BY period_start DESC, subject_count DESC
     LIMIT ${ROLLUP_LIMIT}`
  );

  const { rows: rollupTotal } = await pool.query<{ total: string }>(
    'SELECT COUNT(*) AS total FROM structured.activity_rollups'
  );

  const { rows: runs } = await pool.query<{
    period_start: Date;
    built_at: Date;
    rows_written: number;
    rows_suppressed: number;
    k_threshold: number;
    fold_rule: string;
  }>(
    `SELECT * FROM structured.activity_rollup_runs
     ORDER BY built_at DESC
     LIMIT 1`
  );

  const lastRun = runs[0];

  return {
    ledger: {
      rows: ledgerRows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        eventName: row.event_name,
        surface: row.surface,
        occurredAt: row.occurred_at.toISOString(),
        target: row.target_kind && row.target_id ? `${row.target_kind}#${row.target_id}` : null,
        category: row.category,
        region: row.region,
        searchText: row.search_text,
        itemCount: row.item_count,
        step: row.step,
        corrected: row.corrected,
      })),
      total: Number(summary[0]?.total ?? 0),
      subjects: Number(summary[0]?.subjects ?? 0),
      firstAt: summary[0]?.first_at?.toISOString() ?? null,
      lastAt: summary[0]?.last_at?.toISOString() ?? null,
      droppedInProcess: options.droppedInProcess,
    },
    rollup: {
      rows: rollupRows.map((row) => ({
        periodStart: row.period_start.toISOString().slice(0, 10),
        periodDays: row.period_days,
        eventName: row.event_name,
        surface: row.surface,
        region: row.region,
        category: row.category,
        budgetBracket: row.budget_bracket,
        subjectCount: row.subject_count,
        eventCount: row.event_count,
      })),
      total: Number(rollupTotal[0]?.total ?? 0),
      lastRun: lastRun
        ? {
            periodStart: lastRun.period_start.toISOString().slice(0, 10),
            builtAt: lastRun.built_at.toISOString(),
            rowsWritten: lastRun.rows_written,
            rowsSuppressed: lastRun.rows_suppressed,
            kThreshold: lastRun.k_threshold,
            foldRule: lastRun.fold_rule,
          }
        : null,
    },
    policy: {
      minSubjects: ACTIVITY_MIN_SUBJECTS,
      maxAxes: ACTIVITY_MAX_AXES,
      foldRule: ACTIVITY_FOLD_RULE,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 내보내기 — 파일까지다
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 2층만 내보낸다.
 *
 * **밖으로 자동 전송하는 길은 만들지 않는다**(2026-09-14 지시). 실제로 파는 것은
 * 계약·가격·상대가 정해져야 하고 그것은 대표님 결정이다. 여기서 하는 일은 파일로
 * 떨구는 것까지다.
 *
 * 1층을 내보내는 함수는 없다. 필요해 보이면 그것은 이 층을 잘못 쓰고 있다는 뜻이다.
 */
export async function exportRollups(
  pool: Pool,
  options: { from?: string; to?: string } = {}
): Promise<{ rows: Record<string, unknown>[]; kThreshold: number; foldRule: string }> {
  const conditions: string[] = [];
  const values: string[] = [];

  if (options.from) {
    values.push(options.from);
    conditions.push(`period_start >= $${values.length}::date`);
  }

  if (options.to) {
    values.push(options.to);
    conditions.push(`period_start <= $${values.length}::date`);
  }

  const { rows } = await pool.query<{
    period_start: Date;
    period_days: number;
    event_name: string;
    surface: string;
    region: string | null;
    category: string | null;
    budget_bracket: string | null;
    subject_count: number;
    event_count: number;
    fold_rule: string;
    k_threshold: number;
  }>(
    `SELECT period_start, period_days, event_name, surface, region, category, budget_bracket,
            subject_count, event_count, fold_rule, k_threshold
     FROM structured.activity_rollups
     ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY period_start, event_name, surface`,
    values
  );

  return {
    kThreshold: ACTIVITY_MIN_SUBJECTS,
    foldRule: ACTIVITY_FOLD_RULE,
    rows: rows.map((row) => ({
      periodStart: row.period_start.toISOString().slice(0, 10),
      periodDays: row.period_days,
      eventName: row.event_name,
      surface: row.surface,
      region: row.region,
      category: row.category,
      budgetBracket: row.budget_bracket,
      subjectCount: row.subject_count,
      eventCount: row.event_count,
      foldRule: row.fold_rule,
      kThreshold: row.k_threshold,
    })),
  };
}
