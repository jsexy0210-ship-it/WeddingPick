/**
 * WP-ADM-001 관리자 홈 — 대시보드
 *
 * **이름이 「AI 운영현황」이었다**(2026-09-11 대표 지시로 「대시보드」가 됐다).
 * 관리자 화면에서도 AI 용어를 쓰지 않는다 — 그 지시가 이전 규칙을 뒤집었다.
 *
 * 시안 `21-admin.dc.html`의 `dash` 화면. 네 덩어리다.
 *
 *   1. 안대표가 볼 일    사람이 결정해야만 진행되는 것. 한 줄을 누르면 그 화면으로 간다.
 *   2. 자동 검토 현황    자동이 끝낸 것 · 못 끝낸 것 · 사람에게 넘어간 것.
 *   3. 3열 카드 그리드   `dashCards` — 라벨 + 처리 방식 배지 · 큰 숫자 + 단위 · 한 줄 설명.
 *   4. 자동 판정 로그    무엇으로 · 왜 · 얼마나 확신했는지.
 *
 * **화면 순서가 곧 설계다** — 내가 결정해야만 진행되는 것 → 내가 돈을 쓰는 것 →
 * 내가 봐야 하는 지표 → 자동으로 도는 것.
 *
 * 뼈대와 규칙은 `_ui.tsx`가 든다(배너 · 빈 상태 · tabular-nums · 카드 안 표 스크롤).
 * 숫자는 전부 `GET /v1/admin/dashboard`가 실제 큐에서 세어 보내고, 서버는 `tone` ·
 * `mode` 같은 뜻만 보낸다 — 색은 여기서 토큰으로 고른다.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AdminSpacing as A, Colors, FontSize, LineHeight, Radius } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import {
  Bars,
  Card,
  CardGrid,
  DataTable,
  EmptyState,
  KpiRow,
  LoadError,
  Page,
  Rows,
  StatusBanner,
  type BarItem,
  type Col,
  type Kind,
  type KpiItem,
  type RowItem,
  type TableRow,
  type Tone,
} from './_ui';

/** 회원 추이. `GET /v1/admin/members-trend`가 구간별로 준다. */
type MemberBucket = 'day' | 'week' | 'month' | 'year';
type MemberTrendPoint = { at: string; signups: number; total: number };
type MemberTrend = { bucket: MemberBucket; points: MemberTrendPoint[]; current: number };

type QueueTone = 'danger' | 'caution';
type DashCardMode = '위험' | '비용' | '지표' | '자동';

type HumanQueueItem = { key: string; label: string; why: string; count: number; tone: QueueTone };
type DashCard = { key: string; label: string; mode: DashCardMode; value: string; unit: string; note: string };

type AutoSegmentKey = 'concluded' | 'failed' | 'human';
type AutoSegment = { key: AutoSegmentKey; label: string; count: number };

type AutoWorkflowRow = {
  workflow: string;
  concluded: number;
  failed: number;
  human: number;
  reverted: number;
  autoPct: number;
};

type AutoReview = {
  ratePct: number | null;
  segments: AutoSegment[];
  keepRatePct: number | null;
  revertedCount: number;
  medianLatencyMs: number | null;
  byWorkflow: AutoWorkflowRow[];
};

type AutoLogRow = {
  id: string;
  decision: string;
  subject: string;
  reasonCode: string;
  confidence: number | null;
  decidedAt: string;
  tone: 'ok' | 'fail' | 'human';
};

type DashboardData = {
  humanQueue: HumanQueueItem[];
  humanTotal: number;
  dashCards: DashCard[];
  auto: AutoReview;
  autoLog: AutoLogRow[];
};

/** 서버가 보내는 급한 정도 → 공용 부품의 상태 셋. */
const QUEUE_TONE: Record<QueueTone, Tone> = { danger: 'bad', caution: 'warn' };

/**
 * 처리 방식 배지. 「자동」이 회색인 것은 의도다 — 정상으로 도는 것은 눈에 띄면
 * 안 된다(ADMIN.md WP-ADM-040 「정상이면 전부 회색」).
 */
const MODE_KIND: Record<DashCardMode, Kind> = {
  위험: 'bad',
  비용: 'cost',
  지표: 'none',
  자동: 'dim',
};

/** 자동 검토 막대 세 칸. 셋이 전체를 정확히 나눈다. */
const SEGMENT_KIND: Record<AutoSegmentKey, Kind> = {
  concluded: 'ok',
  failed: 'bad',
  human: 'warn',
};

const LOG_KIND: Record<AutoLogRow['tone'], Kind> = { ok: 'ok', fail: 'bad', human: 'warn' };

/** 큐·카드 키 → 그 일을 처리하는 화면. 서버는 경로를 모른다. */
const SCREEN_PATH: Record<string, string> = {
  queue: '/admin/queue',
  rebuttal: '/admin/rebuttal',
  objections: '/admin/objections',
  'pii-reviews': '/admin/pii-reviews',
  'biz-queue': '/admin/biz-queue',
  'ai-usage': '/admin/ai-usage',
  campaigns: '/admin/campaigns',
  'price-stats': '/admin/price-stats',
  users: '/admin/users',
  decisions: '/admin/decisions',
};

/**
 * 판정 시각. **KST로 적는다** — DB의 timestamptz는 UTC로 담기고, 그대로 옮기면
 * 아홉 시간 어긋난 시각을 보게 된다(CLAUDE.md).
 */
function hhmmKst(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** 워크플로별 표의 열. 폭은 1920 기준이고 이름 열이 남는 폭을 먹는다. */
const WORKFLOW_COLS: Col[] = [
  { key: 'workflow', label: '워크플로', width: 220, grow: true },
  { key: 'rate', label: '자동 처리 비중', width: 120, align: 'right' },
  { key: 'concluded', label: '자동', width: 80, align: 'right' },
  { key: 'failed', label: '실패', width: 80, align: 'right' },
  { key: 'human', label: '사람', width: 80, align: 'right' },
  { key: 'reverted', label: '되돌림', width: 88, align: 'right' },
];

const LOG_COLS: Col[] = [
  { key: 'verdict', label: '판정', width: 76 },
  { key: 'subject', label: '대상', width: 180 },
  { key: 'reason', label: '근거', width: 260, grow: true },
  { key: 'confidence', label: '확신', width: 76, align: 'right' },
  { key: 'when', label: '시각', width: 76, align: 'right' },
];

/** 구간 단추. 대표 지시의 「일, 주, 월, 년」 그대로다. */
const BUCKETS: { key: MemberBucket; label: string }[] = [
  { key: 'day', label: '일' },
  { key: 'week', label: '주' },
  { key: 'month', label: '월' },
  { key: 'year', label: '년' },
];

/**
 * 막대 아래 라벨. **KST로 적는다** — 서버가 준 ISO는 UTC 표기이고, 그대로 쓰면
 * 한국의 하루가 한 칸 밀려 보인다(CLAUDE.md).
 */
function bucketLabel(iso: string, bucket: MemberBucket): string {
  const at = new Date(iso);
  const parts = (options: Intl.DateTimeFormatOptions) =>
    at.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', ...options });

  if (bucket === 'year') return parts({ year: 'numeric' });
  if (bucket === 'month') return parts({ month: 'numeric' });

  return parts({ month: 'numeric', day: 'numeric' });
}

export default function AdminHomeScreen() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [bucket, setBucket] = useState<MemberBucket>('month');
  const [trend, setTrend] = useState<MemberTrend | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/dashboard')
      .then((d) => {
        if (cancelled) return;
        setData(d as DashboardData);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [rev]);

  /*
   * 회원 추이는 따로 받아온다. 구간을 바꿀 때 대시보드 전체를 다시 부르면 큐·로그까지
   * 다시 세게 되고, 단추를 눌렀을 때 화면이 통째로 비었다 다시 그려진다.
   */
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/v1/admin/members-trend?bucket=${bucket}`)
      .then((d) => {
        if (cancelled) return;
        setTrend(d as MemberTrend);
        setTrendError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setTrendError(e instanceof Error ? e.message : '회원 추이를 불러오지 못했어요');
      });
    return () => { cancelled = true; };
  }, [bucket, rev]);

  const reload = () => setRev((r) => r + 1);

  function open(key: string) {
    const path = SCREEN_PATH[key];
    if (path) router.push(path as never);
  }

  const auto = data?.auto;
  const total = data?.humanTotal ?? 0;
  const urgent = data?.humanQueue.some((q) => q.tone === 'danger' && q.count > 0) ?? false;
  const decided = auto?.segments.reduce((sum, seg) => sum + seg.count, 0) ?? 0;

  /*
   * 지금 봐야 할 것을 맨 위에서 먼저 말한다(ADMIN.md 공통 규칙). 빨강은 되돌릴 수
   * 없는 결정이 걸려 있을 때만이다 — 모든 대기를 빨강으로 칠하면 색이 뜻을 잃는다.
   */
  const bannerTone: Tone = urgent ? 'bad' : total > 0 ? 'warn' : 'ok';
  const bannerTitle = urgent
    ? '되돌릴 수 없는 결정이 기다리고 있어요'
    : total > 0
      ? `확인할 것이 ${total}건 있어요`
      : '확인할 것이 없어요';

  const queueRows: RowItem[] = (data?.humanQueue ?? [])
    .filter((item) => item.count > 0)
    .map((item) => ({
      key: item.key,
      dot: QUEUE_TONE[item.tone],
      name: item.label,
      meta: item.why,
      bold: true,
      num: `${item.count}건`,
      numKind: QUEUE_TONE[item.tone],
      onPress: () => open(item.key),
    }));

  const segmentRows: RowItem[] = (auto?.segments ?? []).map((seg) => ({
    key: seg.key,
    dot: seg.key === 'concluded' ? 'ok' : seg.key === 'failed' ? 'bad' : 'warn',
    name: seg.label,
    num: `${seg.count}건`,
    numKind: SEGMENT_KIND[seg.key],
  }));

  const cards: KpiItem[] = (data?.dashCards ?? []).map((c) => ({
    label: c.label,
    value: c.value,
    unit: c.unit,
    note: c.note,
    badge: c.mode,
    badgeKind: MODE_KIND[c.mode],
    kind: MODE_KIND[c.mode] === 'none' ? 'none' : MODE_KIND[c.mode],
    onPress: () => open(c.key),
  }));

  const workflowRows: TableRow[] = (auto?.byWorkflow ?? []).map((w) => ({
    key: w.workflow,
    cells: [
      { v: w.workflow, bold: true },
      { v: `${w.autoPct}%`, mono: true },
      { v: w.concluded === 0 ? '—' : String(w.concluded), kind: 'ok', mono: true },
      { v: w.failed === 0 ? '—' : String(w.failed), kind: 'bad', mono: true },
      { v: w.human === 0 ? '—' : String(w.human), kind: 'warn', mono: true },
      { v: w.reverted === 0 ? '—' : String(w.reverted), kind: 'dim', mono: true },
    ],
  }));

  /*
   * 막대 높이는 그 구간의 **최대 가입 수**를 100으로 놓고 잡는다. 누적 회원과 같은
   * 자를 쓰면 가입 수 막대가 전부 바닥에 붙어 아무것도 읽히지 않는다 — 누적은
   * 숫자로 말하고 막대는 가입 수만 그린다.
   */
  const trendMax = Math.max(1, ...(trend?.points ?? []).map((p) => p.signups));
  const trendBars: BarItem[] = (trend?.points ?? []).map((point) => ({
    label: bucketLabel(point.at, bucket),
    pct: (point.signups / trendMax) * 100,
    kind: 'brand',
    value: String(point.signups),
  }));
  const trendSignups = (trend?.points ?? []).reduce((sum, point) => sum + point.signups, 0);

  const logRows: TableRow[] = (data?.autoLog ?? []).map((r) => ({
    key: r.id,
    cells: [
      { v: r.decision, badge: LOG_KIND[r.tone] },
      { v: r.subject },
      { v: r.reasonCode },
      { v: r.confidence === null ? '—' : `${Math.round(r.confidence * 100)}%`, mono: true },
      { v: hhmmKst(r.decidedAt), mono: true, kind: 'dim' },
    ],
  }));

  return (
    <Page
      title="대시보드"
      sub="지금 봐야 할 것 · 회원 추이 · 처리 현황"
      action={{ label: '새로 고침', onPress: reload }}
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data && auto ? (
        <>
          <StatusBanner
            tone={bannerTone}
            title={bannerTitle}
            detail={
              total === 0
                ? '사람이 결정해야 하는 건을 모두 끝냈어요.'
                : `모두 ${total}건 · 최근 24시간 판정 ${decided}건 중 ${auto.ratePct ?? 0}%가 자동으로 끝났어요.`
            }
          />

          <CardGrid>
            {/* 1. 사람이 결정해야만 진행되는 것. 한 줄을 누르면 그 화면으로 간다. */}
            <Card title="안대표가 볼 일" sub={`모두 ${total}건`}>
              {total === 0 ? (
                /* 빈 큐는 실패가 아니라 목표다(ADMIN.md 공통 규칙). */
                <EmptyState
                  title="확인할 것이 없어요"
                  detail="사람이 결정해야 하는 건을 모두 끝냈어요."
                />
              ) : (
                <Rows items={queueRows} />
              )}
            </Card>

            {/* 2. 자동이 끝낸 것과 사람에게 남은 것. */}
            <Card
              title="자동 검토 현황"
              sub="최근 24시간 · 리스크가 큰 건만 사람이 봐요"
              note="되돌림은 자동 판정을 사람이 취소한 건이에요. 같은 워크플로에서 되돌림이 늘면 그 기준부터 손봐요."
            >
              {decided === 0 ? (
                <EmptyState
                  title="최근 24시간에 판정이 없어요"
                  detail="건이 들어오면 자동 검토가 먼저 돌아요."
                />
              ) : (
                <>
                  {/* 시안 dash의 대표 수치 — 40/700(typography.scale adminHero). */}
                  <View style={styles.rateRow}>
                    <Text style={styles.rateValue}>{auto.ratePct}</Text>
                    <Text style={styles.rateUnit}>%</Text>
                    <Text style={styles.rateLabel}>자동 처리율</Text>
                  </View>
                  <Rows items={segmentRows} />
                </>
              )}
            </Card>
          </CardGrid>

          {/*
            3. 회원 추이(2026-09-11 대표 지시 — 「회원은 차트를 활용해 시각화 한다」).

            **차트 라이브러리를 들이지 않았다.** 이 저장소에 차트 의존성이 없고, 막대
            추이를 그리는 `Bars`가 이미 `_ui.tsx`에 있다. 의존성 하나는 관리자 화면만
            쓰더라도 앱 번들 전체에 실린다.
          */}
          <Card
            title="회원"
            sub={
              trend === null
                ? '불러오는 중'
                : `지금 ${trend.current.toLocaleString('ko-KR')}명 · 이 구간 가입 ${trendSignups.toLocaleString('ko-KR')}명`
            }
            note="누적은 탈퇴한 계정을 뺀 수예요. 가입 수는 그 칸에 실제로 들어온 수라서 나중에 탈퇴해도 줄지 않아요."
            full
          >
            <View style={styles.bucketRow}>
              {BUCKETS.map((item) => (
                <Text
                  key={item.key}
                  style={[styles.bucketTab, bucket === item.key && styles.bucketTabOn]}
                  onPress={() => setBucket(item.key)}
                >
                  {item.label}
                </Text>
              ))}
            </View>
            {trendError ? (
              <EmptyState title="회원 추이를 불러오지 못했어요" detail={trendError} />
            ) : trendSignups === 0 && (trend?.current ?? 0) === 0 ? (
              /* 빈 상태가 정상 상태다(ADMIN.md 공통 규칙). 0을 고장으로 보이게 하지 않는다. */
              <EmptyState title="아직 가입이 없어요" detail="가입이 들어오면 이 자리에 쌓여요." />
            ) : (
              <Bars items={trendBars} />
            )}
          </Card>

          {/*
            4. 3열 × 2줄. 시안의 카드 순서가 곧 설계다 —
            내가 돈을 쓰는 것 → 내가 봐야 하는 지표 → 자동으로 도는 것.
          */}
          <KpiRow items={cards.slice(0, 3)} />
          <KpiRow items={cards.slice(3, 6)} />

          <Card
            title="워크플로별 자동 처리"
            sub={`판정 유지율 ${auto.keepRatePct === null ? '—' : `${auto.keepRatePct}%`} · 되돌림 ${auto.revertedCount}건 · 판정 시간 중앙값 ${
              auto.medianLatencyMs === null ? '—' : `${(auto.medianLatencyMs / 1000).toFixed(1)}초`
            }`}
            full
          >
            <DataTable cols={WORKFLOW_COLS} rows={workflowRows} empty="최근 24시간에 판정이 없어요" />
          </Card>

          {/* 4. 판정 근거가 함께 기록돼요. */}
          <Card title="자동 판정 로그" sub="무엇으로 · 왜 · 얼마나 확신했는지" full>
            <DataTable cols={LOG_COLS} rows={logRows} empty="기록된 판정이 없어요" />
          </Card>
        </>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  /* 구간 단추. 22-admin-ops.dc.html의 필터 칩과 같은 모양이다. */
  bucketRow: { flexDirection: 'row', gap: A.stackGap, marginBottom: A.stackGap },
  bucketTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.badge,
    borderWidth: 1,
    borderColor: Colors.light.border,
    fontSize: FontSize.tab,
    lineHeight: LineHeight.adminMeta,
    color: Colors.light.textAssistive,
  },
  bucketTabOn: {
    borderColor: Colors.light.tint,
    color: Colors.light.tint,
    fontWeight: '700',
  },
  rateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: A.stackGap },
  /* 21-admin.dc.html dash — «font-size:40px;letter-spacing:-1.4px;line-height:1». */
  rateValue: {
    fontSize: FontSize.adminHero,
    lineHeight: LineHeight.adminHero,
    fontWeight: '700',
    letterSpacing: -1.4,
    color: Colors.light.text,
    fontVariant: ['tabular-nums'],
  },
  rateUnit: {
    fontSize: FontSize.t6,
    lineHeight: LineHeight.t6,
    fontWeight: '700',
    color: Colors.light.textAssistive,
  },
  rateLabel: {
    fontSize: FontSize.t7,
    lineHeight: LineHeight.t7,
    color: Colors.light.textAssistive,
    paddingLeft: A.stackGap,
  },
});
