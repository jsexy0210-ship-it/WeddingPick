/**
 * WP-ADM-002 일일 브리핑
 * 자동처리 · 성공률 · 자동복구 · 미해결 리스크 · AI비용 · 수익 · 특이사항
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize, LineHeight, Spinner } from '@weddingpick/ui';
import { apiFetch } from './_api';

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
  high: '#e81607',
  medium: '#805217',
  low: '#1aa174',
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

      {loading && (
        <View style={styles.centered}>
          <Spinner size={40} />
        </View>
      )}
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
          {/* 요약 문구 */}
          {data.summary ? (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{data.summary}</Text>
            </View>
          ) : null}

          {/* 핵심 지표 */}
          <Text style={styles.sectionTitle}>핵심 지표</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{data.autoProcessed.toLocaleString()}</Text>
              <Text style={styles.statLabel}>자동 처리 건</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, data.successRate < 90 && styles.valueDanger]}>
                {data.successRate.toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>성공률</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{data.autoRecovered.toLocaleString()}</Text>
              <Text style={styles.statLabel}>자동 복구 건</Text>
            </View>
          </View>

          {/* 비용 · 수익 */}
          <Text style={styles.sectionTitle}>비용 · 수익</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{data.aiCostToday}</Text>
              <Text style={styles.statLabel}>오늘 AI 비용</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{data.revenueToday}</Text>
              <Text style={styles.statLabel}>오늘 수익</Text>
            </View>
          </View>

          {/* 미해결 리스크 */}
          <Text style={styles.sectionTitle}>미해결 리스크</Text>
          <View style={styles.card}>
            {data.unresolvedRisks.length === 0 ? (
              <Text style={styles.emptyText}>미해결 리스크 없음</Text>
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
              <Text style={styles.emptyText}>특이사항 없음</Text>
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
  root: { flex: 1, backgroundColor: '#f2f3f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: '#17181c' },
  subtitle: { fontSize: FontSize.t7, color: '#868b94', marginTop: 2 },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f2f3f6',
  },
  refreshText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  body: { flex: 1 },
  bodyContent: { padding: 24, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: '#e53e3e', marginBottom: 16 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#ff6f61',
  },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  summaryBox: {
    backgroundColor: '#ebf7fa',
    borderRadius: 10,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0088cc',
  },
  summaryText: { fontSize: FontSize.t6, color: '#17181c', lineHeight: LineHeight.t6 },
  sectionTitle: {
    fontSize: FontSize.t7,
    fontWeight: '700',
    color: '#868b94',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginTop: 8,
  },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statCell: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e4e5ea',
  },
  statValue: { fontSize: FontSize.t4, fontWeight: '700', color: '#17181c', fontVariant: ['tabular-nums'] },
  valueDanger: { color: '#e81607' },
  statLabel: { fontSize: FontSize.tab, color: '#868b94', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4e5ea',
    overflow: 'hidden',
  },
  emptyText: { fontSize: FontSize.t7, color: '#868b94', padding: 16 },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  riskRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f1f4' },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  severityText: { fontSize: FontSize.tab, fontWeight: '700' },
  riskContent: { flex: 1 },
  riskCategory: { fontSize: FontSize.t7, fontWeight: '700', color: '#3a3b40', marginBottom: 2 },
  riskDesc: { fontSize: FontSize.t7, color: '#868b94' },
  anomalyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  anomalyTime: { fontSize: FontSize.t7, color: '#868b94', width: 88 },
  anomalyDesc: { flex: 1, fontSize: FontSize.t7, color: '#3a3b40' },
});
