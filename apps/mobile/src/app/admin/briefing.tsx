/**
 * WP-ADM-002 일일 브리핑
 *
 * 시안 `22-admin-ops.dc.html` 1번. 하루치 요약이고, 문제가 없으면 「오늘 사람이 볼 것은
 * 없어요」가 초록 배너로 맨 위에 온다 — 그것이 이 화면의 목적이다. 미해결 리스크가
 * 있을 때만 상단 색이 바뀐다.
 */
import { useEffect, useState } from 'react';

import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import {
  Card,
  CardGrid,
  EmptyState,
  KpiRow,
  LoadError,
  Page,
  Rows,
  StatusBanner,
  type RowItem,
  type Tone,
} from './_ui';

type RiskItem = { id: string; category: string; description: string; severity: 'high' | 'medium' | 'low' };
type Anomaly = { time: string; description: string };

type BriefingData = {
  date: string;
  autoProcessed: number;
  successRate: number;
  autoRecovered: number;
  unresolvedRisks: RiskItem[];
  aiCostToday: string;
  revenueToday: string;
  anomalies: Anomaly[];
  summary: string;
};

/** 리스크 심각도 → 행 앞 점. 배너 색도 가장 높은 심각도를 따른다. */
const SEVERITY_TONE: Record<RiskItem['severity'], Tone> = {
  high: 'bad',
  medium: 'warn',
  low: 'ok',
};

const SEVERITY_LABEL: Record<RiskItem['severity'], string> = {
  high: '높음',
  medium: '중간',
  low: '낮음',
};

/** 문제 없으면 초록, 확인할 것이 있으면 주황, 조치가 필요하면 빨강(ADMIN.md 공통 규칙). */
function bannerTone(risks: RiskItem[]): Tone {
  if (risks.length === 0) return 'ok';
  return risks.some((r) => r.severity === 'high') ? 'bad' : 'warn';
}

export default function BriefingScreen() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/briefing')
      .then((d) => {
        if (cancelled) return;
        setData(d as BriefingData);
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

  const riskRows: RowItem[] = (data?.unresolvedRisks ?? []).map((r) => ({
    key: r.id,
    dot: SEVERITY_TONE[r.severity],
    name: r.category,
    meta: r.description,
    tail: SEVERITY_LABEL[r.severity],
    tailKind: SEVERITY_TONE[r.severity],
  }));

  const anomalyRows: RowItem[] = (data?.anomalies ?? []).map((a, i) => ({
    key: `${a.time}-${i}`,
    dot: 'none',
    name: a.description,
    meta: a.time,
  }));

  const tone = bannerTone(data?.unresolvedRisks ?? []);

  return (
    <Page
      title="일일 브리핑"
      sub={data ? `${data.date} 기준` : undefined}
      action={{ label: '새로 고침', onPress: reload }}
    >
      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner
            tone={tone}
            title={
              data.unresolvedRisks.length === 0
                ? '오늘 사람이 볼 것은 없어요'
                : `미해결 리스크 ${data.unresolvedRisks.length}건이 있어요`
            }
            detail={data.summary || undefined}
          />

          <KpiRow
            items={[
              { label: '자동처리', value: `${data.autoProcessed.toLocaleString()}건` },
              {
                label: '성공률',
                value: `${data.successRate.toFixed(1)}%`,
                kind: data.successRate < 90 ? 'bad' : 'ok',
              },
              { label: '자동복구', value: `${data.autoRecovered.toLocaleString()}건`, kind: 'ok' },
              {
                label: '미해결 리스크',
                value: `${data.unresolvedRisks.length}건`,
                note: data.unresolvedRisks.length === 0 ? '확인할 것이 없어요' : '확인 필요',
                kind: data.unresolvedRisks.length === 0 ? 'ok' : 'bad',
              },
              { label: 'AI 비용', value: data.aiCostToday, note: '오늘 사용분' },
            ]}
          />

          <CardGrid>
            <Card title="미해결 리스크" sub="사람이 봐야 하는 것">
              {riskRows.length === 0 ? (
                <EmptyState title="확인할 것이 없어요" detail="미해결 리스크가 없어요. 개별 큐를 열지 않아도 괜찮아요." />
              ) : (
                <Rows items={riskRows} />
              )}
            </Card>

            <Card title="특이사항" sub="사람이 알아두면 좋은 것">
              {anomalyRows.length === 0 ? (
                <EmptyState title="특이사항이 없어요" />
              ) : (
                <Rows items={anomalyRows} />
              )}
            </Card>

            <Card
              title="수익"
              sub="오늘"
              note="월 단위 추이는 수익 현황(WP-ADM-032)에서 볼 수 있어요."
            >
              <Rows
                items={[
                  { key: 'revenue', name: '수익', meta: '광고 · 제휴', num: data.revenueToday },
                  { key: 'cost', name: 'AI 비용', meta: '오늘 사용분', num: data.aiCostToday, numKind: 'bad' },
                ]}
              />
            </Card>
          </CardGrid>
        </>
      ) : null}
    </Page>
  );
}
