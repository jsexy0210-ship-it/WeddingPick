/**
 * 회원 활동 — 원장과 집계.
 *
 * 대표 지시(2026-09-14) — 회원들의 활동을 대표님이 확인하실 수 있어야 한다.
 *
 * **한 화면에 두 층을 함께 둔다.** 위는 회원 한 사람 한 사람의 줄이고, 아래는
 * 밖으로 나갈 수 있는 묶음이다. 나가는 쪽을 따로 열어야 하면 아무도 열지 않고,
 * 그러면 무엇이 나가는지 모르는 채로 나간다.
 *
 * 관리자 공통 규칙 넷을 지킨다 — 지금 봐야 할 것이 맨 위 · 빈 상태가 정상 상태 ·
 * 표는 카드 안에서만 스크롤 · 기준 해상도 1920×1080.
 */
import { useEffect, useState } from 'react';

import { formatMonthDayTimeDot } from '@/features/common/format-date';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import {
  ACTIVITY_EVENT_LABEL,
  ACTIVITY_SURFACE_LABEL,
  BUDGET_BRACKET_LABEL,
  VENDOR_CATEGORY_LABEL,
  type ActivityEventName,
  type ActivitySurface,
  type WeddingBudgetBracket,
  type VendorCategory,
} from '@weddingpick/domain';

import { apiFetch } from './_api';
import {
  Card,
  CardGrid,
  DataTable,
  KpiRow,
  LoadError,
  Page,
  StatusBanner,
  type Col,
  type TableRow,
} from './_ui';

type LedgerRow = {
  id: string;
  userId: string;
  eventName: ActivityEventName;
  surface: ActivitySurface;
  occurredAt: string;
  target: string | null;
  category: VendorCategory | null;
  region: string | null;
  searchText: string | null;
  itemCount: number | null;
  step: number | null;
  corrected: boolean;
};

type RollupRow = {
  periodStart: string;
  periodDays: number;
  eventName: ActivityEventName;
  surface: ActivitySurface;
  region: string | null;
  category: VendorCategory | null;
  budgetBracket: WeddingBudgetBracket | null;
  subjectCount: number;
  eventCount: number;
};

type Overview = {
  ledger: {
    rows: LedgerRow[];
    total: number;
    subjects: number;
    firstAt: string | null;
    lastAt: string | null;
    droppedInProcess: number;
  };
  rollup: {
    rows: RollupRow[];
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
  policy: { minSubjects: number; maxAxes: number; foldRule: string };
};

/** 원장 여덟 컬럼. 남는 폭은 검색어가 먹는다. */
const LEDGER_COLS: Col[] = [
  { key: 'occurredAt', label: '시각', width: 130 },
  { key: 'userId', label: '회원', width: 130 },
  { key: 'eventName', label: '한 일', width: 120 },
  { key: 'surface', label: '자리', width: 110 },
  { key: 'category', label: '업종', width: 100 },
  { key: 'region', label: '지역', width: 80 },
  { key: 'detail', label: '남긴 말·수', width: 240, grow: true },
  { key: 'target', label: '대상', width: 200 },
];

/** 집계 일곱 컬럼. 회원 칸은 없다 — 그 표에는 사람이 없다. */
const ROLLUP_COLS: Col[] = [
  { key: 'periodStart', label: '기간', width: 140 },
  { key: 'eventName', label: '한 일', width: 120 },
  { key: 'surface', label: '자리', width: 110 },
  { key: 'region', label: '지역', width: 90 },
  { key: 'category', label: '업종', width: 110 },
  { key: 'budgetBracket', label: '준비 예산', width: 150, grow: true },
  { key: 'subjectCount', label: '사람', width: 90, align: 'right' },
  { key: 'eventCount', label: '건', width: 90, align: 'right' },
];

/** 회원 식별자는 통째로 두면 표가 밀린다. 누구인지 가려낼 만큼만 적는다. */
function shortId(id: string): string {
  return id.slice(0, 8);
}

function ledgerDetail(row: LedgerRow): string {
  if (row.searchText) return row.searchText;
  if (row.itemCount !== null) return `${row.itemCount}곳`;
  if (row.step !== null) return `${row.step}단계`;

  return '—';
}

export default function ActivityScreen() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/activity')
      .then((d) => {
        if (cancelled) return;
        setData(d as Overview);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rev]);

  const reload = () => setRev((r) => r + 1);

  /**
   * 지난 주를 다시 묶는다. **원장은 건드리지 않는다** — 다시 뽑아 덮이는 것은
   * 집계뿐이라 되돌릴 것이 없고, 그래서 한 번 더 묻지 않는다.
   */
  const rebuild = () => {
    if (busy) return;
    setBusy(true);
    apiFetch('/v1/admin/activity/rollup', { method: 'POST', body: JSON.stringify({}) })
      .then(() => {
        setBusy(false);
        reload();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : '다시 묶기 실패');
        setBusy(false);
      });
  };

  const ledger = data?.ledger;
  const rollup = data?.rollup;
  const policy = data?.policy;

  const ledgerRows: TableRow[] = (ledger?.rows ?? []).map((row) => ({
    key: row.id,
    cells: [
      { v: formatMonthDayTimeDot(row.occurredAt), kind: 'dim' },
      { v: shortId(row.userId), mono: true },
      {
        /*
         * 바로잡힌 줄은 지워지지 않고 그대로 남는다. 그 사실을 줄 안에서 말해야
         * 아래 숫자를 두 번 세지 않는다 — 집계는 바로잡힌 쪽만 센다.
         */
        v: row.corrected
          ? `${ACTIVITY_EVENT_LABEL[row.eventName] ?? row.eventName} · 바로잡음`
          : (ACTIVITY_EVENT_LABEL[row.eventName] ?? row.eventName),
        kind: row.corrected ? 'dim' : 'none',
      },
      { v: ACTIVITY_SURFACE_LABEL[row.surface] ?? row.surface, kind: 'dim' },
      row.category
        ? { v: VENDOR_CATEGORY_LABEL[row.category] ?? row.category }
        : { v: '—', kind: 'dim' },
      row.region ? { v: row.region } : { v: '—', kind: 'dim' },
      { v: ledgerDetail(row), kind: row.searchText ? 'none' : 'dim' },
      row.target ? { v: row.target, mono: true } : { v: '—', kind: 'dim' },
    ],
  }));

  const rollupRows: TableRow[] = (rollup?.rows ?? []).map((row) => ({
    key: `${row.periodStart}-${row.periodDays}-${row.eventName}-${row.surface}-${row.region ?? ''}-${row.category ?? ''}-${row.budgetBracket ?? ''}`,
    cells: [
      { v: `${row.periodStart} · ${row.periodDays}일`, kind: 'dim' },
      { v: ACTIVITY_EVENT_LABEL[row.eventName] ?? row.eventName },
      { v: ACTIVITY_SURFACE_LABEL[row.surface] ?? row.surface, kind: 'dim' },
      row.region ? { v: row.region } : { v: '전체', kind: 'dim' },
      row.category
        ? { v: VENDOR_CATEGORY_LABEL[row.category] ?? row.category }
        : { v: '전체', kind: 'dim' },
      row.budgetBracket
        ? { v: BUDGET_BRACKET_LABEL[row.budgetBracket] ?? row.budgetBracket }
        : { v: '전체', kind: 'dim' },
      { v: `${row.subjectCount.toLocaleString()}명`, bold: true },
      { v: row.eventCount.toLocaleString(), kind: 'dim' },
    ],
  }));

  /*
   * 맨 위에서 먼저 말하는 것은 **원장이 온전한가**다. 큐가 넘쳐 버려진 줄이 있으면
   * 그 수만큼 원장이 비어 있고, 그것을 모르면 아래의 모든 수를 사실로 읽게 된다.
   */
  const dropped = ledger?.droppedInProcess ?? 0;
  const empty = (ledger?.total ?? 0) === 0;

  return (
    <Page
      title="회원 활동"
      sub={`원장 ${ledger?.total.toLocaleString() ?? 0}줄 · 묶음 ${rollup?.total.toLocaleString() ?? 0}행`}
      action={{ label: busy ? '묶는 중' : '지난 주 다시 묶기', onPress: rebuild, disabled: busy }}
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner
            tone={dropped > 0 ? 'bad' : 'ok'}
            title={
              dropped > 0
                ? `담기지 못한 줄 ${dropped.toLocaleString()}개가 있어요`
                : empty
                  ? '확인할 것이 없어요'
                  : '원장이 온전해요'
            }
            detail={
              dropped > 0
                ? '서버가 붐벼 줄이 밀렸어요. 그만큼 원장이 비어 있어요.'
                : empty
                  ? '아직 남은 활동이 없어요. 회원이 앱을 쓰기 시작하면 여기에 쌓여요.'
                  : `회원 ${ledger?.subjects.toLocaleString()}명의 활동이 쌓여 있어요.`
            }
          />

          <KpiRow
            items={[
              {
                label: '원장',
                value: `${ledger?.total.toLocaleString() ?? 0}줄`,
                note: `회원 ${ledger?.subjects.toLocaleString() ?? 0}명`,
              },
              {
                label: '가장 오래된 줄',
                value: ledger?.firstAt ? formatMonthDayTimeDot(ledger.firstAt) : '—',
                note: ledger?.lastAt ? `마지막 ${formatMonthDayTimeDot(ledger.lastAt)}` : '아직 없어요',
              },
              {
                label: '내보낼 묶음',
                value: `${rollup?.total.toLocaleString() ?? 0}행`,
                note: rollup?.lastRun
                  ? `${rollup.lastRun.periodStart} 기준`
                  : '아직 묶은 적이 없어요',
              },
              {
                label: '묶음 최소 인원',
                value: `${policy?.minSubjects ?? 0}명`,
                note: rollup?.lastRun
                  ? `미달로 뺀 묶음 ${rollup.lastRun.rowsSuppressed.toLocaleString()}개`
                  : '미달인 묶음은 아예 빠져요',
              },
            ]}
          />

          <CardGrid>
            <Card
              title="원장"
              sub="최근 순 · 회원 한 사람의 한 사건이 한 줄"
              full
              note="고치거나 지우지 않아요. 틀린 줄은 그대로 두고 바로잡은 줄이 뒤에 붙어요."
            >
              <DataTable cols={LEDGER_COLS} rows={ledgerRows} empty="확인할 것이 없어요" />
            </Card>
          </CardGrid>

          <CardGrid>
            <Card
              title="내보낼 묶음"
              sub={`사람 칸이 없는 표 · 최소 ${policy?.minSubjects ?? 0}명 · 접는 규칙 ${policy?.foldRule ?? '—'}`}
              full
              note={`한 사람이 드러나지 않게 ${policy?.minSubjects ?? 0}명 미만인 묶음은 행 자체를 빼요. 지역·업종·준비 예산은 한 번에 ${policy?.maxAxes ?? 0}칸까지만 겹쳐요.`}
            >
              <DataTable cols={ROLLUP_COLS} rows={rollupRows} empty="아직 묶은 것이 없어요" />
            </Card>
          </CardGrid>
        </>
      ) : null}
    </Page>
  );
}
