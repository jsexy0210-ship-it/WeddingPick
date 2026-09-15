/**
 * WP-ADM-002 일일 브리핑 — 이제 「대시보드」 화면의 아래쪽 절반이다.
 *
 * 시안 `22-admin-ops.dc.html` 1번. 하루치 요약이고, 문제가 없으면 「오늘 사람이 볼 것은
 * 없어요」가 초록 배너로 맨 위에 온다 — 그것이 이 화면의 목적이다. 미해결 리스크가
 * 있을 때만 상단 색이 바뀐다.
 *
 * **2026-09-15 대표 확정 — 「대시보드」(옛 `/admin/home`)와 한 화면으로 묶였다**(위아래,
 * 탭이 아니다). 대시보드가 「지금 이 순간의 상태」고 브리핑이 「하루치 요약」이라 같은
 * 성격이라 굳이 갈라 둘 이유가 없다는 것이 대표님 판단이다. 이 파일의 본체는
 * `BriefingPanel`로 옮기고 `home.tsx`가 그 안에서 이어 그린다. 자체 서버 응답을
 * 쓰므로 새로고침은 이 패널 것만 따로 둔다.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, LineHeight } from '@weddingpick/ui';
import { Redirect } from 'expo-router';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import {
  Card,
  CardGrid,
  EmptyState,
  KpiRow,
  LoadError,
  Rows,
  StatusBanner,
  type RowItem,
  type Tone,
} from './_ui';
import { formatCount } from '@weddingpick/domain';

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

/**
 * 서버가 이 화면이 읽는 모양으로 답했는지 본다.
 *
 * **`GET /v1/admin/briefing`은 다른 모양을 준다** — `{ briefing: [...], budgetStatus }`다
 * (`apps/api/src/routes/admin.ts`). 이 화면은 `autoProcessed` · `successRate` ·
 * `unresolvedRisks`를 읽으므로 첫 줄에서 `undefined.length`로 죽었고, 운영자에게는
 * 스택 트레이스만 보였다(2026-09-10 검수에서 실제로 재현).
 *
 * 없는 값을 0으로 메우지 않는다 — 「자동처리 0건 · 확인할 것이 없어요」는 사실이
 * 아니라 지어낸 평온이다. 무엇이 어긋났는지 말하고 다시 시도를 준다.
 */
function isBriefingData(d: unknown): d is BriefingData {
  const o = d as Partial<BriefingData> | null;
  return (
    typeof o === 'object' &&
    o !== null &&
    typeof o.autoProcessed === 'number' &&
    typeof o.successRate === 'number' &&
    Array.isArray(o.unresolvedRisks) &&
    Array.isArray(o.anomalies)
  );
}

const SHAPE_ERROR = '서버가 이 화면이 읽는 모양으로 답하지 않았어요. 서버의 일일 브리핑 집계를 확인해주세요.';

/** 문제 없으면 초록, 확인할 것이 있으면 주황, 조치가 필요하면 빨강(ADMIN.md 공통 규칙). */
function bannerTone(risks: RiskItem[]): Tone {
  if (risks.length === 0) return 'ok';
  return risks.some((r) => r.severity === 'high') ? 'bad' : 'warn';
}

/** `/admin/home`(대시보드)이 위쪽 대시보드 아래에 이어 그리는 패널. */
export function BriefingPanel() {
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
        if (!isBriefingData(d)) {
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
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <View style={styles.panelHeadText}>
          <Text style={styles.panelTitle}>일일 브리핑</Text>
          {data ? <Text style={styles.panelSub}>{`${data.date} 기준`}</Text> : null}
        </View>
        <Pressable style={styles.panelAction} onPress={reload}>
          <Text style={styles.panelActionLabel}>새로 고침</Text>
        </Pressable>
      </View>

      <DelayedLoader active={loading} size={40} />
      {!loading && error ? <LoadError message={error} onRetry={reload} /> : null}

      {!loading && !error && data ? (
        <>
          <StatusBanner
            tone={tone}
            title={
              data.unresolvedRisks.length === 0
                ? '오늘 사람이 볼 것은 없어요'
                : `미해결 리스크 ${formatCount(data.unresolvedRisks.length)}건이 있어요`
            }
            detail={data.summary || undefined}
          />

          <KpiRow
            items={[
              { label: '자동처리', value: `${formatCount(data.autoProcessed)}건` },
              {
                /*
                 * `successRate`는 0~1 비율이다 — `admin-ops.ts`가
                 * `succeeded / settled`로 만들고 `automation.tsx`도 ×100으로 그린다.
                 * 여기만 그대로 찍어서 99.4%가 「1.0%」로 보였다(시안 1번은 99.4%).
                 */
                label: '성공률',
                value: `${(data.successRate * 100).toFixed(1)}%`,
                kind: data.successRate < 0.9 ? 'bad' : 'ok',
              },
              { label: '자동복구', value: `${formatCount(data.autoRecovered)}건`, kind: 'ok' },
              {
                label: '미해결 리스크',
                value: `${formatCount(data.unresolvedRisks.length)}건`,
                note: data.unresolvedRisks.length === 0 ? '확인할 것이 없어요' : '확인 필요',
                kind: data.unresolvedRisks.length === 0 ? 'ok' : 'bad',
              },
              { label: '분석 비용', value: data.aiCostToday, note: '오늘 사용분' },
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
                  { key: 'cost', name: '분석 비용', meta: '오늘 사용분', num: data.aiCostToday, numKind: 'bad' },
                ]}
              />
            </Card>
          </CardGrid>
        </>
      ) : null}
    </View>
  );
}

/**
 * 옛 주소(`/admin/briefing`)는 저장된 링크·딥링크가 있을 수 있어 남긴다. 실제 화면은
 * `/admin/home`(대시보드)에 있다 — 그 안의 `BriefingPanel`이 이 파일의 본체다.
 */
export default function BriefingRedirect() {
  return <Redirect href="/admin/home?tab=briefing" />;
}

const styles = StyleSheet.create({
  panel: { gap: 16 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  panelHeadText: { flex: 1, minWidth: 0, gap: 2 },
  panelTitle: { fontSize: FontSize.t6, fontWeight: '700', color: Colors.light.text },
  panelSub: { fontSize: FontSize.tab, lineHeight: LineHeight.adminMeta, color: Colors.light.textAssistive },
  panelAction: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 6,
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundSelected,
  },
  panelActionLabel: { fontSize: FontSize.micro, fontWeight: '700', color: Colors.light.textSecondary },
});
