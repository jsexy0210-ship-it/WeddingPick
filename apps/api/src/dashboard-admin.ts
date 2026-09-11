import type { Pool } from 'pg';

import * as aiCostAdmin from './ai-cost-admin';
import * as objectionAdmin from './objection-admin';
import * as piiAdmin from './pii-admin';
import * as rebuttalAdmin from './rebuttal-admin';
import * as vendorClaimAdmin from './vendor-claim-admin';
import * as verificationAdmin from './verification-admin';

/**
 * 관리자 홈(WP-ADM-001) 요약 대시보드.
 *
 * 시안 `21-admin.dc.html`의 `dash` 화면이 요구하는 것을 그대로 낸다 — 「안대표가
 * 볼 일」(`humanQueue` · `humanTotal`) · 3열 카드 그리드(`dashCards`) · 자동 검토
 * 현황(`auto`) · 자동 판정 로그(`autoLog`).
 *
 * **건수는 전부 실제 큐에서 센다.** 이전 응답은 `reviewQueue: { total: 0 }` ·
 * `revenue.mrr: '₩0'`처럼 화면에 박아둔 값을 돌려줬다. 0이 「볼 일이 없다」인지
 * 「아직 세지 않았다」인지 화면이 구별할 수 없었고, 큐가 쌓여 있는 날에도 홈은
 * 빈 대시보드였다. 여기서 세는 다섯 큐는 각 화면이 이미 부르는 조회 함수와 같은
 * 것이다 — 홈의 숫자와 그 화면을 열었을 때의 줄 수가 어긋나지 않는다.
 *
 * **색은 여기서 정하지 않는다.** 서버는 `tone`·`mode` 같은 뜻만 보내고 화면이
 * 토큰으로 칠한다(CLAUDE.md: 값은 spec/tokens.json에서만).
 */

/** 얼마나 급한지. 화면이 점·숫자 색과 상단 배너 색을 이 값으로 고른다. */
export type QueueTone = 'danger' | 'caution';

export type HumanQueueItem = {
  /** 화면 키. 눌렀을 때 어디로 갈지는 화면이 정한다 — 서버는 경로를 모른다. */
  key: string;
  label: string;
  /** 왜 사람이 봐야 하는지. 자동으로 넘길 수 없는 이유를 적는다. */
  why: string;
  count: number;
  tone: QueueTone;
};

/**
 * 카드가 말하는 처리 방식. 시안 `dashCards`의 배지 그대로다.
 * 「자동」은 정상이면 눈에 띄지 않아야 하는 자리라 회색으로 간다(ADMIN.md WP-ADM-040).
 */
export type DashCardMode = '위험' | '비용' | '지표' | '자동';

export type DashCard = {
  key: string;
  label: string;
  mode: DashCardMode;
  value: string;
  unit: string;
  note: string;
};

/**
 * 자동 검토 현황의 막대 한 칸. 셋이 전체를 나눠 가진다 — 어느 칸에도 들지 않는
 * 결정이 있으면 「자동 처리율」이 실제와 어긋난다.
 */
export type AutoSegment = {
  key: 'concluded' | 'failed' | 'human';
  label: string;
  count: number;
};

/** 워크플로 한 줄. 시안의 「메뉴별 자동 처리 비중」 자리이고, 이름은 실제 워크플로다. */
export type AutoWorkflowRow = {
  workflow: string;
  concluded: number;
  failed: number;
  human: number;
  reverted: number;
  /** 사람 손을 타지 않고 끝난 비율. */
  autoPct: number;
};

export type AutoReview = {
  /** 자동 처리율 %. 최근 24시간에 결정이 하나도 없으면 null이다 — 0%와 다르다. */
  ratePct: number | null;
  segments: AutoSegment[];
  /** 판정 유지율 % — 되돌리지 않은 자동 결론의 비율. */
  keepRatePct: number | null;
  revertedCount: number;
  medianLatencyMs: number | null;
  byWorkflow: AutoWorkflowRow[];
};

export type AutoLogRow = {
  id: string;
  /** 무엇으로 정했는가(`decisions.decision`). */
  decision: string;
  /** 무엇에 대한 결정인가(`decisions.subject_kind`). */
  subject: string;
  /** 왜(`decisions.reason_code`) — 사람이 읽는 문장이 아니라 세는 코드다. */
  reasonCode: string;
  /** 0~1. 규칙 결정에는 없다. */
  confidence: number | null;
  decidedAt: string;
  tone: 'ok' | 'fail' | 'human';
};

export type Dashboard = {
  humanQueue: HumanQueueItem[];
  humanTotal: number;
  dashCards: DashCard[];
  auto: AutoReview;
  autoLog: AutoLogRow[];
};

/** 원 → 만원. 시안이 금액을 만원 한 자리로 적는다. */
function manwon(krw: number): string {
  return (krw / 10000).toFixed(1);
}

/**
 * 최근 24시간의 자동 검토 현황. 기간을 `decisionsAdmin.briefing`과 같은 하루로
 * 맞춘다 — 같은 화면의 두 숫자가 다른 창을 보면 맞춰볼 수 없다.
 *
 * **세 칸은 전체를 정확히 나눈다.** `rolled_back`을 어느 칸에도 넣지 않았던
 * 동안에는 막대 셋을 더해도 전체가 되지 않았다 — 되돌린 결정도 「자동이 한 번
 * 끝낸 것」이고, 되돌렸다는 사실은 유지율이 따로 말한다.
 */
async function autoReview(pool: Pool): Promise<AutoReview> {
  const WINDOW = "created_at >= now() - interval '1 day'";
  const BUCKETS = `
    count(*) FILTER (WHERE decider <> 'human' AND execution_status IN ('succeeded', 'rolled_back'))::text AS concluded,
    count(*) FILTER (WHERE decider <> 'human' AND execution_status IN ('failed', 'pending'))::text AS failed,
    count(*) FILTER (WHERE decider = 'human')::text AS human,
    count(*) FILTER (WHERE execution_status = 'rolled_back')::text AS reverted`;

  const [totals, byWorkflow] = await Promise.all([
    pool.query<{
      concluded: string;
      failed: string;
      human: string;
      reverted: string;
      median_latency: string | null;
    }>(
      `SELECT ${BUCKETS},
              percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)::text AS median_latency
         FROM structured.decisions
        WHERE ${WINDOW}`
    ),
    pool.query<{
      workflow: string;
      concluded: string;
      failed: string;
      human: string;
      reverted: string;
    }>(
      `SELECT workflow, ${BUCKETS}
         FROM structured.decisions
        WHERE ${WINDOW}
        GROUP BY workflow
        ORDER BY count(*) DESC, workflow
        LIMIT 8`
    ),
  ]);

  const row = totals.rows[0];
  const concluded = Number(row?.concluded ?? 0);
  const failed = Number(row?.failed ?? 0);
  const human = Number(row?.human ?? 0);
  const reverted = Number(row?.reverted ?? 0);
  const all = concluded + failed + human;

  return {
    /* 결정이 하나도 없는 것과 「0%가 자동으로 끝났다」는 다른 말이다. */
    ratePct: all === 0 ? null : Math.round((concluded / all) * 100),
    segments: [
      { key: 'concluded', label: '자동 결론', count: concluded },
      { key: 'failed', label: '자동 실패 · 대기', count: failed },
      { key: 'human', label: '사람이 결정', count: human },
    ],
    keepRatePct: concluded === 0 ? null : Math.round(((concluded - reverted) / concluded) * 1000) / 10,
    revertedCount: reverted,
    medianLatencyMs: row?.median_latency == null ? null : Math.round(Number(row.median_latency)),
    byWorkflow: byWorkflow.rows.map((w) => {
      const wConcluded = Number(w.concluded);
      const wFailed = Number(w.failed);
      const wHuman = Number(w.human);
      const wAll = wConcluded + wFailed + wHuman;
      return {
        workflow: w.workflow,
        concluded: wConcluded,
        failed: wFailed,
        human: wHuman,
        reverted: Number(w.reverted),
        autoPct: wAll === 0 ? 0 : Math.round((wConcluded / wAll) * 100),
      };
    }),
  };
}

/**
 * 자동 판정 로그. 시안이 「판정 근거가 함께 기록돼요」라고 적은 자리다 —
 * `decision`(무엇으로) · `reason_code`(왜) · `confidence`(얼마나 확신)를 같이 낸다.
 *
 * **`evidence_refs`는 내보내지 않는다.** 그 안은 가리키는 id뿐이고(0033), 여기서
 * 풀어 실으면 요약 화면이 원본을 들고 다니게 된다.
 */
async function recentDecisions(pool: Pool): Promise<AutoLogRow[]> {
  const { rows } = await pool.query<{
    id: string;
    decision: string;
    subject_kind: string;
    reason_code: string;
    confidence: string | null;
    decider: string;
    execution_status: string;
    created_at: Date;
  }>(
    `SELECT id, decision, subject_kind, reason_code, confidence::text,
            decider::text, execution_status::text, created_at
       FROM structured.decisions
      ORDER BY created_at DESC
      LIMIT 8`
  );

  return rows.map((r) => ({
    id: r.id,
    decision: r.decision,
    subject: r.subject_kind,
    reasonCode: r.reason_code,
    confidence: r.confidence === null ? null : Number(r.confidence),
    decidedAt: r.created_at.toISOString(),
    tone:
      r.decider === 'human'
        ? 'human'
        : r.execution_status === 'failed' || r.execution_status === 'pending'
          ? 'fail'
          : 'ok',
  }));
}

async function countRows(pool: Pool, sql: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(sql);
  return Number(rows[0]?.n ?? 0);
}

export async function dashboard(pool: Pool): Promise<Dashboard> {
  const [
    verifications,
    backlog,
    rebuttals,
    objections,
    piiReviews,
    vendorClaims,
    budgets,
    proofCount,
    proofVendorCount,
    memberCount,
    newMemberCount,
    pendingReward,
    auto,
    autoLog,
  ] = await Promise.all([
    verificationAdmin.list(pool),
    verificationAdmin.backlog(pool),
    rebuttalAdmin.list(pool),
    objectionAdmin.list(pool),
    piiAdmin.list(pool),
    vendorClaimAdmin.list(pool),
    aiCostAdmin.status(pool),
    countRows(pool, 'SELECT count(*)::text AS n FROM structured.usable_payment_proofs'),
    countRows(pool, 'SELECT count(DISTINCT vendor_id)::text AS n FROM structured.usable_payment_proofs'),
    countRows(pool, 'SELECT count(*)::text AS n FROM structured.users WHERE deleted_at IS NULL'),
    countRows(
      pool,
      `SELECT count(*)::text AS n FROM structured.users
        WHERE deleted_at IS NULL AND created_at >= date_trunc('month', now())`
    ),
    pool
      .query<{ amount: string | null; n: string }>(
        `SELECT sum(amount_krw)::text AS amount, count(*)::text AS n
           FROM structured.reward_grants WHERE status = 'earned'`
      )
      .then(({ rows }) => ({
        amountKrw: Number(rows[0]?.amount ?? 0),
        count: Number(rows[0]?.n ?? 0),
      })),
    autoReview(pool),
    recentDecisions(pool),
  ]);

  /*
   * 「안대표가 볼 일」. 사람이 결정해야만 진행되는 것만 넣는다 — 자동으로 도는
   * 것은 `auto`와 카드 쪽에 있다. 순서는 시안의 화면 순서와 같다.
   */
  const humanQueue: HumanQueueItem[] = [
    {
      key: 'queue',
      label: '결제인증 심사 대기',
      why: '증빙을 확인해야 등급이 올라가요',
      count: verifications.length,
      tone: 'caution',
    },
    {
      key: 'rebuttal',
      label: '후기 반론 확인 대기',
      why: '게시하면 후기 옆에 그대로 남아요',
      count: rebuttals.length,
      tone: 'caution',
    },
    {
      key: 'objections',
      label: '후기 이의 확인 중',
      /* 기한이 지난 건이 있으면 그것부터 말한다 — 그냥 두면 보류가 저절로 풀린다. */
      why: objections.some((o) => o.expired)
        ? '보류 기한이 지난 건이 있어요'
        : '보류 기한 안에 결론을 내야 해요',
      count: objections.length,
      tone: objections.some((o) => o.expired) ? 'danger' : 'caution',
    },
    {
      key: 'pii-reviews',
      label: '개인정보 검토 대기',
      why: '가린 뒤에는 되돌릴 수 없어요',
      count: piiReviews.length,
      tone: 'danger',
    },
    {
      key: 'biz-queue',
      label: '업체 소유 확인 대기',
      why: '승인하면 업체 정보를 고칠 수 있게 돼요',
      count: vendorClaims.length,
      tone: 'danger',
    },
  ];

  const humanTotal = humanQueue.reduce((sum, item) => sum + item.count, 0);

  const heldDocuments = backlog.reduce((sum, row) => sum + row.heldDocumentCount, 0);
  const spentUsd = budgets.reduce((sum, b) => sum + b.spentUsd, 0);
  const budgetUsd = budgets.reduce((sum, b) => sum + (b.budgetUsd ?? 0), 0);
  /* 같은 화면의 두 숫자가 어긋나지 않게, 판정 건수는 `autoReview`가 센 것만 쓴다. */
  const decided = auto.segments.reduce((sum, seg) => sum + seg.count, 0);

  /*
   * 카드 순서가 곧 설계다 — 내가 돈을 쓰는 것 → 내가 봐야 하는 지표 → 자동으로
   * 도는 것. 맨 앞의 적체만 「위험」인 이유는 원본 파기 기한이 함께 걸려 있어서다.
   */
  const dashCards: DashCard[] = [
    {
      key: 'queue',
      label: '7일 초과 적체',
      mode: '위험',
      value: String(backlog.length),
      unit: '건',
      note: `원본 ${heldDocuments}건 파기 대기 중`,
    },
    {
      key: 'ai-usage',
      label: 'AI 사용량 · 비용',
      mode: '비용',
      value: `$${spentUsd.toFixed(2)}`,
      unit: '이번 달',
      note: budgetUsd > 0 ? `예산 $${budgetUsd.toFixed(2)}` : '예산을 정한 기능이 없어요',
    },
    {
      key: 'campaigns',
      label: '보상 지급 대기',
      mode: '비용',
      value: manwon(pendingReward.amountKrw),
      unit: '만원',
      note: `확인 대기 ${pendingReward.count}건`,
    },
    {
      key: 'price-stats',
      label: '가격 통계',
      mode: '지표',
      value: proofCount.toLocaleString('ko-KR'),
      unit: '건 데이터',
      note: `업체 ${proofVendorCount.toLocaleString('ko-KR')}곳`,
    },
    {
      key: 'users',
      label: '회원',
      mode: '지표',
      value: memberCount.toLocaleString('ko-KR'),
      unit: '명',
      note: `이번 달 신규 ${newMemberCount.toLocaleString('ko-KR')}명`,
    },
    {
      key: 'decisions',
      label: '자동 판정',
      mode: '자동',
      value: auto.ratePct === null ? '—' : `${auto.ratePct}%`,
      unit: auto.ratePct === null ? '최근 24시간 판정 없음' : '자동 처리율',
      note: `최근 24시간 ${decided}건 · 되돌림 ${auto.revertedCount}건`,
    },
  ];

  return { humanQueue, humanTotal, dashCards, auto, autoLog };
}

/**
 * 회원 추이 — 일 · 주 · 월 · 년.
 *
 * 2026-09-11 대표 지시 — 「주요 정보 특히 회원은 차트를 활용해 시각화 한다」.
 *
 * **가입 수와 누적 회원을 함께 준다.** 가입 수만 그리면 「지난주보다 적다」는 것은
 * 보이지만 지금 회원이 몇인지는 알 수 없고, 누적만 그리면 언제 늘었는지가 보이지
 * 않는다. 차트 하나로 둘을 읽게 한다.
 *
 * **탈퇴한 계정은 누적에서 뺀다.** 지운 계정을 계속 세면 누적은 영원히 우상향하고,
 * 그 선은 아무것도 말해주지 않는다. 가입 수는 그때 실제로 들어온 수이므로 그대로
 * 센다 — 나중에 탈퇴했다고 그날의 가입이 없던 일이 되지는 않는다.
 *
 * 시각은 **KST 기준으로 자른다.** UTC로 자르면 한국의 하루가 두 칸에 걸쳐 나뉘고,
 * 아침 9시 전의 가입이 전날 칸에 들어간다.
 */
export type MemberBucket = 'day' | 'week' | 'month' | 'year';

export type MemberTrendPoint = {
  /** 칸의 시작 시각(ISO). 화면이 라벨을 만든다 — 서버가 말로 적으면 서식이 두 곳에 생긴다. */
  at: string;
  /** 그 칸에 새로 들어온 계정 수. */
  signups: number;
  /** 그 칸이 끝난 시점의 살아 있는 계정 수. */
  total: number;
};

export type MemberTrend = {
  bucket: MemberBucket;
  points: MemberTrendPoint[];
  /** 지금 살아 있는 계정 수. 마지막 칸의 `total`과 같다. */
  current: number;
};

const BUCKET_SPAN: Record<MemberBucket, { unit: string; count: number }> = {
  day: { unit: 'day', count: 14 },
  week: { unit: 'week', count: 12 },
  month: { unit: 'month', count: 12 },
  year: { unit: 'year', count: 5 },
};

export function isMemberBucket(value: string): value is MemberBucket {
  return value === 'day' || value === 'week' || value === 'month' || value === 'year';
}

export async function memberTrend(pool: Pool, bucket: MemberBucket): Promise<MemberTrend> {
  const { unit, count } = BUCKET_SPAN[bucket];

  /*
   * 칸을 `generate_series`로 먼저 만든다. 가입이 0인 날을 빼면 차트에서 그 칸이
   * 사라져 이틀이 붙어 보이고, 「조용한 날」이 없던 날이 된다.
   *
   * 누적은 각 칸의 끝까지 살아 있는 계정을 센다. 창 밖(첫 칸보다 이른) 가입도
   * 들어가야 하므로 가입 수를 더해 올라가는 방식으로는 구하지 않는다.
   */
  const { rows } = await pool.query<{ at: Date; signups: string; total: string }>(
    `WITH spans AS (
       SELECT generate_series(
                date_trunc($1, now() AT TIME ZONE 'Asia/Seoul') - ($2::int - 1) * $3::interval,
                date_trunc($1, now() AT TIME ZONE 'Asia/Seoul'),
                $3::interval
              ) AS bucket_start
     )
     SELECT (s.bucket_start AT TIME ZONE 'Asia/Seoul') AS at,
            (SELECT count(*) FROM structured.users u
              WHERE u.created_at AT TIME ZONE 'Asia/Seoul' >= s.bucket_start
                AND u.created_at AT TIME ZONE 'Asia/Seoul' < s.bucket_start + $3::interval
            ) AS signups,
            (SELECT count(*) FROM structured.users u
              WHERE u.created_at AT TIME ZONE 'Asia/Seoul' < s.bucket_start + $3::interval
                AND (u.deleted_at IS NULL
                     OR u.deleted_at AT TIME ZONE 'Asia/Seoul' >= s.bucket_start + $3::interval)
            ) AS total
       FROM spans s
      ORDER BY s.bucket_start`,
    [unit, count, `1 ${unit}`]
  );

  const points = rows.map((row) => ({
    at: row.at.toISOString(),
    signups: Number(row.signups),
    total: Number(row.total),
  }));

  return { bucket, points, current: points.at(-1)?.total ?? 0 };
}
