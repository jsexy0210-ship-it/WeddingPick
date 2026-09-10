/**
 * WP-ADM-013 이상치 · 조작 탐지
 *
 * 시안 `22-admin-ops.dc.html` 2번. 자동으로 잡아 이미 차단한 뒤 목록으로 보여준다 —
 * 사람은 오탐만 풀어주면 된다. 그래서 카드 낱장이 아니라 한눈에 훑는 표다.
 */
import { useEffect, useState } from 'react';

import { VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';

import { apiFetch } from './_api';
import { Card, CardGrid, DataTable, KpiRow, LoadError, Page, StatusBanner, type Col, type TableRow } from './_ui';

type AnomalyItem = {
  vendorId: string;
  vendorName: string;
  category: string;
  amount: number;
  mean: number;
  stddev: number;
  detectedAt: string;
};

type PriceStatsResponse = {
  total: number;
  anomalies: AnomalyItem[];
};

function fmt(n: number) {
  return (n / 10000).toFixed(0) + '만원';
}

/**
 * 업종 이름은 domain 한 곳(`VENDOR_CATEGORY_LABEL`)에서만 가져온다. 서버가 아직
 * 모르는 값(DB enum에만 남은 옛 업종 등)이 오면 코드를 그대로 보여 준다 — 관리자
 * 화면이라 감추기보다 드러내는 쪽이 맞다.
 */
function formatCat(category: string) {
  return (VENDOR_CATEGORY_LABEL as Record<string, string>)[category] ?? category;
}

/** 구간 밖 몇 σ인지. 이것이 차단 근거라서 표에서 가장 긴 열이 된다. */
function sigma(item: AnomalyItem) {
  if (item.stddev === 0) return '—';
  return `${Math.abs((item.amount - item.mean) / item.stddev).toFixed(1)}σ`;
}

/** 시안의 열 폭(1920 기준). 남는 폭은 `근거`가 먹는다. */
const COLS: Col[] = [
  { key: 'vendor', label: '대상', width: 200 },
  { key: 'category', label: '업종', width: 110 },
  { key: 'detected', label: '감지', width: 130 },
  { key: 'reason', label: '근거', width: 320, grow: true },
  { key: 'sigma', label: '편차', width: 80, align: 'right' },
  { key: 'status', label: '상태', width: 90 },
];

export default function StatsScreen() {
  const [data, setData] = useState<PriceStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/v1/admin/price-stats')
      .then((res) => {
        if (cancelled) return;
        setData(res as PriceStatsResponse);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [rev]);

  const reload = () => setRev((r) => r + 1);
  const anomalies = data?.anomalies ?? [];

  const rows: TableRow[] = anomalies.map((item, i) => ({
    key: `${item.vendorId}-${i}`,
    cells: [
      { v: item.vendorName, bold: true, kind: 'none' },
      { v: formatCat(item.category) },
      { v: item.detectedAt.slice(0, 10) },
      { v: `제보 ${fmt(item.amount)} · 기준금액 ${fmt(item.mean)} · 표준편차 ${fmt(item.stddev)}` },
      { v: sigma(item), bold: true, kind: 'bad' },
      { v: '차단', badge: 'bad' },
    ],
  }));

  return (
    <Page title="이상치 · 조작 탐지" sub="자동 차단 후 목록 · 최근 7일">
      {loading ? null : error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner
            tone={anomalies.length === 0 ? 'ok' : 'warn'}
            title={
              anomalies.length === 0
                ? '차단된 것이 없어요'
                : `자동 차단 ${anomalies.length}건`
            }
            detail={
              anomalies.length === 0
                ? '최근 집계에서 구간 밖 금액이 나오지 않았어요.'
                : '차단은 이미 반영됐어요. 오탐으로 보이는 것만 풀어주면 돼요.'
            }
          />

          <KpiRow
            items={[
              { label: '자동 차단', value: `${anomalies.length}건`, note: '집계에서 제외 중', kind: anomalies.length === 0 ? 'ok' : 'bad' },
              { label: '전체 집계', value: `${data.total}건`, note: '가격 통계 대상' },
              {
                label: '대상 업체',
                value: `${new Set(anomalies.map((a) => a.vendorId)).size}곳`,
                note: '차단이 걸린 곳',
              },
            ]}
          />

          <CardGrid>
            <Card
              title="차단된 패턴"
              sub="자동 판단 · 되돌릴 수 있어요"
              full
              note="되돌리면 해당 제보가 다시 집계에 들어가고 변경 복구 관리에 기록돼요."
            >
              <DataTable cols={COLS} rows={rows} empty="차단된 것이 없어요" />
            </Card>
          </CardGrid>
        </>
      ) : null}
    </Page>
  );
}
