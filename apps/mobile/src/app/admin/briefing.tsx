/**
 * WP-ADM-002 일일 브리핑
 * 자동처리 · 성공률 · 자동복구 · 미해결 리스크 · AI비용 · 수익 · 특이사항
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, LineHeight } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { OpsAlert, OpsEmpty } from '@/features/admin/ops-kit';

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

const SEVERITY_COLOR: Record<RiskItem['severity'], string> = {
  high: Colors.light.negative,
  medium: Colors.light.cautionary,
  low: Colors.light.positive,
};

const SEVERITY_LABEL: Record<RiskItem['severity'], string> = {
  high: '높음',
  medium: '중간',
  low: '낮음',
};

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

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>일일 브리핑</Text>
          {data && <Text style={styles.subtitle}>{data.date} 기준</Text>}
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <DelayedLoader active={loading} size={40} style={styles.centered} />
      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => setRev((r) => r + 1)}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && data && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* 지금 봐야 할 것이 맨 위 — 배너가 오늘 상태를 먼저 말한다. */}
          {data.unresolvedRisks.length > 0 ? (
            <OpsAlert
              kind={data.unresolvedRisks.some((r) => r.severity === 'high') ? 'bad' : 'warn'}
              title={`미해결 리스크가 ${data.unresolvedRisks.length}건 있어요`}
              sub={data.summary || undefined}
            />
          ) : (
            <OpsAlert kind="ok" title="확인할 것이 없어요" sub={data.summary || '미해결 리스크가 없어요.'} />
          )}

          {/* 핵심 지표 */}
          <Text style={styles.sectionTitle}>핵심 지표</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>자동 처리 건</Text>
              <Text style={styles.statValue}>{data.autoProcessed.toLocaleString()}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>성공률</Text>
              <Text style={[styles.statValue, data.successRate < 90 && styles.valueDanger]}>
                {data.successRate.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>자동 복구 건</Text>
              <Text style={styles.statValue}>{data.autoRecovered.toLocaleString()}</Text>
            </View>
          </View>

          {/* 비용 · 수익 */}
          <Text style={styles.sectionTitle}>비용 · 수익</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>오늘 AI 비용</Text>
              <Text style={styles.statValue}>{data.aiCostToday}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>오늘 수익</Text>
              <Text style={styles.statValue}>{data.revenueToday}</Text>
            </View>
          </View>

          {/* 미해결 리스크 */}
          <Text style={styles.sectionTitle}>미해결 리스크</Text>
          <View style={styles.card}>
            {data.unresolvedRisks.length === 0 ? (
              <OpsEmpty title="확인할 것이 없어요" sub="미해결 리스크가 없어요." />
            ) : (
              data.unresolvedRisks.map((risk, i) => (
                <View
                  key={risk.id}
                  style={[styles.riskRow, i < data.unresolvedRisks.length - 1 && styles.riskRowBorder]}
                >
                  <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLOR[risk.severity] + '22' }]}>
                    <Text style={[styles.severityText, { color: SEVERITY_COLOR[risk.severity] }]}>
                      {SEVERITY_LABEL[risk.severity]}
                    </Text>
                  </View>
                  <View style={styles.riskContent}>
                    <Text style={styles.riskCategory}>{risk.category}</Text>
                    <Text style={styles.riskDesc}>{risk.description}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* 특이사항 */}
          <Text style={styles.sectionTitle}>특이사항</Text>
          <View style={styles.card}>
            {data.anomalies.length === 0 ? (
              <OpsEmpty title="확인할 것이 없어요" sub="오늘 특이사항이 없어요." />
            ) : (
              data.anomalies.map((a, i) => (
                <View key={i} style={[styles.anomalyRow, i < data.anomalies.length - 1 && styles.riskRowBorder]}>
                  <Text style={styles.anomalyTime}>{a.time}</Text>
                  <Text style={styles.anomalyDesc}>{a.description}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text },
  subtitle: { fontSize: FontSize.t7, color: Colors.light.textAssistive, marginTop: 2 },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.light.backgroundSelected,
  },
  refreshText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  body: { flex: 1 },
  bodyContent: { padding: 24, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
  },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  summaryBox: {
    backgroundColor: Colors.light.accentBackground,
    borderRadius: 10,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.accent,
  },
  summaryText: { fontSize: FontSize.t6, color: Colors.light.text, lineHeight: LineHeight.t6 },
  sectionTitle: {
    fontSize: FontSize.t7,
    fontWeight: '700',
    color: Colors.light.textAssistive,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginTop: 8,
  },
  statsGrid: { flexDirection: 'row', gap: 12 },
  /* 시안 kpiCard — 왼쪽 정렬 · padding 20 · gap 5. 가운데 정렬은 라벨과 값이 같은 축에 서지 않는다. */
  statCell: {
    flex: 1,
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    padding: 20,
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  /* 시안 kpiVal 30/38 — 8단 스케일 밖이라 t1(32/43)로 앉힌다. */
  statValue: { fontSize: FontSize.t1, lineHeight: LineHeight.t1, fontWeight: '700', color: Colors.light.text, fontVariant: ['tabular-nums'] },
  valueDanger: { color: Colors.light.negative },
  statLabel: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: Colors.light.textAssistive },
  card: {
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  emptyText: { fontSize: FontSize.t7, color: Colors.light.textAssistive, padding: 16 },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  riskRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.light.backgroundSelected },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  severityText: { fontSize: FontSize.tab, fontWeight: '700' },
  riskContent: { flex: 1 },
  riskCategory: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textStrong, marginBottom: 2 },
  riskDesc: { fontSize: FontSize.t7, color: Colors.light.textAssistive },
  anomalyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  anomalyTime: { fontSize: FontSize.t7, color: Colors.light.textAssistive, width: 88 },
  anomalyDesc: { flex: 1, fontSize: FontSize.t7, color: Colors.light.textStrong },
});
