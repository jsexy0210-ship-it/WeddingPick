/**
 * WP-ADM-032 수익 현황
 *
 * 시안 `22-admin-ops.dc.html` 6번. ADMIN.md — **수익 · AI 비용 · 순을 한 줄에** 놓아
 * 순수익이 바로 보이게 한다. 광고는 아직 테스트 단계라 규모가 작다.
 */
import { useEffect, useState } from 'react';

import { BACKEND_PENDING, PendingBackendNotice } from '@/features/admin/pending-backend';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import {
  Bars,
  Card,
  CardGrid,
  EmptyState,
  KpiRow,
  LoadError,
  Page,
  Rows,
  StatusBanner,
  type BarItem,
  type RowItem,
} from './_ui';

type FunnelStep = {
  label: string;
  value: string;
  count: number;
  conversionRate: number | null;
};

type RevenueData = {
  period: string;
  funnel: FunnelStep[];
  summary: {
    mrr: string;
    arr: string;
    aiCost: string;
    rewardCost: string;
    contributionMargin: string;
    contributionMarginRate: number;
  };
};

/**
 * 서버가 이 화면이 읽는 모양으로 답했는지 본다.
 *
 * **`GET /v1/admin/revenue`는 다른 모양을 준다** —
 * `{ mrr, arr, activeSubscriptions, churnRate, planBreakdown }`이다
 * (`apps/api/src/routes/admin.ts`). 이 화면은 `summary.contributionMarginRate`와
 * `funnel`을 읽으므로 `summary`가 없어 첫 줄에서 죽었고, 운영자에게는 스택
 * 트레이스만 보였다(2026-09-10 검수에서 실제로 재현).
 *
 * 없는 값을 0원으로 메우지 않는다 — 집계가 없는 것과 수익이 0인 것은 다른
 * 사실이고, 「0원」으로 적으면 측정값처럼 읽힌다.
 */
function isRevenueData(d: unknown): d is RevenueData {
  const o = d as Partial<RevenueData> | null;
  return (
    typeof o === 'object' &&
    o !== null &&
    Array.isArray(o.funnel) &&
    typeof o.summary === 'object' &&
    o.summary !== null &&
    typeof o.summary.contributionMarginRate === 'number'
  );
}

const SHAPE_ERROR = '서버가 이 화면이 읽는 모양으로 답하지 않았어요. 서버의 수익 집계를 확인해주세요.';

export default function RevenueScreen() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/revenue')
      .then((d) => {
        if (cancelled) return;
        if (!isRevenueData(d)) {
          setData(null);
          setError(SHAPE_ERROR);
          setLoading(false);
          return;
        }
        setData(d);
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

  const reload = () => setRev((r) => r + 1);
  const funnel = data?.funnel ?? [];

  /** 퍼널 막대는 가장 큰 단계를 100으로 잡는다 — 절대 수는 옆의 행이 말한다. */
  const peak = funnel.reduce((max, f) => Math.max(max, f.count), 0);
  const bars: BarItem[] = funnel.map((f, i) => ({
    label: f.label,
    pct: peak === 0 ? 0 : (f.count / peak) * 100,
    kind: i === funnel.length - 1 ? 'brand' : 'plain',
  }));

  const funnelRows: RowItem[] = funnel.map((f) => ({
    key: f.label,
    name: f.label,
    meta: f.conversionRate === null ? '유입' : `직전 대비 ${(f.conversionRate * 100).toFixed(1)}%`,
    num: f.value,
  }));

  return (
    <Page
      title="수익 현황"
      sub={data?.period}
      action={{ label: '새로 고침', onPress: reload }}
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          {/*
            * **지금 이 화면의 숫자는 집계에서 온 것이 아니다.** 서버가 0을 고정으로
            * 돌려준다(`routes/admin.ts`) — 구독·결제를 담는 표가 DB에 없다. 0을 그냥
            * 그리면 「이번 달 수익이 0」으로 읽히고, 그것은 거짓이 아니라 **모르는
            * 것을 아는 것처럼** 말하는 쪽이라 더 나쁘다.
            *
            * 사이드바의 「조회만」과 짝이다(`_layout.tsx`의 `READ_ONLY`).
            */}
          {BACKEND_PENDING ? (
            <PendingBackendNotice
              actions="수익 집계"
              reason="구독 · 매출을 담는 곳이 아직 없어서 이 화면의 수는 모두 0으로 나와요. 집계가 붙으면 실제 수로 바뀌어요."
            />
          ) : null}
          {/*
            시안 6번에는 배너가 없지만 ADMIN.md 공통 규칙은 「상단 배너가 상태를 먼저
            말한다」이다. 규칙이 시안보다 넓으므로 규칙을 따른다 — 순이 마이너스로
            돌아선 달을 표에서 읽어내게 두면 늦는다.
          */}
          {/*
            아직 셀 것이 없는 기간에 「순이 플러스예요」로 말하지 않는다. 0은 플러스가
            아니고, 집계가 비어 있는 것은 「빈 상태가 정상 상태」(v3.27)로 말해야 한다.
          */}
          <StatusBanner
            tone={data.summary.contributionMarginRate < 0 ? 'bad' : 'ok'}
            title={
              data.summary.contributionMarginRate < 0
                ? '이번 기간은 순이 마이너스예요'
                : funnel.length === 0
                  ? '이번 기간에 집계된 것이 없어요'
                  : '순이 플러스예요'
            }
            detail={`수익 ${data.summary.mrr} · 분석 비용 ${data.summary.aiCost} · 순 ${data.summary.contributionMargin}`}
          />

          {/* 수익 · 분석 비용 · 순이 한 줄에 온다(ADMIN.md WP-ADM-032). */}
          <KpiRow
            items={[
              { label: '수익', value: data.summary.mrr, note: `연 환산 ${data.summary.arr}` },
              { label: '분석 비용', value: data.summary.aiCost, note: '이번 기간 사용분', kind: 'bad' },
              { label: '보상 비용', value: data.summary.rewardCost, note: 'Npay 지급분', kind: 'bad' },
              {
                label: '순',
                value: data.summary.contributionMargin,
                note: `마진율 ${(data.summary.contributionMarginRate * 100).toFixed(1)}%`,
                kind: data.summary.contributionMarginRate < 0 ? 'bad' : 'ok',
              },
            ]}
          />

          <CardGrid>
            <Card
              title="퍼널"
              sub={data.period}
              full
              note="막대는 가장 큰 단계를 기준으로 그린 모양이에요. 실제 수는 아래 목록에 있어요."
            >
              {funnel.length === 0 ? (
                <EmptyState title="집계된 퍼널이 없어요" detail="이번 기간에 셀 것이 아직 없어요." />
              ) : (
                <>
                  <Bars items={bars} />
                  <Rows items={funnelRows} />
                </>
              )}
            </Card>
          </CardGrid>
        </>
      ) : null}
    </Page>
  );
}
