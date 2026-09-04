/**
 * WP-ADM-032 성장 · Revenue
 * 획득비용 → 유입 → 데이터 기여 → 비교 → 리드 → 수익 → 보상비 → AI비용 → 기여이익
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize } from '@weddingpick/ui';
import { apiFetch } from './_api';

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
        setData(d as RevenueData);
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
          <Text style={styles.title}>성장 · Revenue</Text>
          {data && <Text style={styles.subtitle}>{data.period}</Text>}
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      {loading && <View style={styles.centered}><ActivityIndicator color="#ff6f61" size="large" /></View>}
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
          {/* 핵심 지표 */}
          <Text style={styles.sectionTitle}>핵심 지표</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>MRR</Text>
              <Text style={styles.metricValue}>{data.summary.mrr}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>ARR</Text>
              <Text style={styles.metricValue}>{data.summary.arr}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>AI 비용</Text>
              <Text style={[styles.metricValue, { color: '#e81607' }]}>{data.summary.aiCost}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>보상 비용</Text>
              <Text style={[styles.metricValue, { color: '#e81607' }]}>{data.summary.rewardCost}</Text>
            </View>
            <View style={[styles.metricCard, styles.metricCardWide]}>
              <Text style={styles.metricLabel}>기여이익</Text>
              <Text style={[styles.metricValue, { color: '#1aa174' }]}>{data.summary.contributionMargin}</Text>
              <Text style={styles.metricSub}>
                마진율 {(data.summary.contributionMarginRate * 100).toFixed(1)}%
              </Text>
            </View>
          </View>

          {/* 퍼널 */}
          <Text style={styles.sectionTitle}>퍼널</Text>
          <View style={styles.card}>
            {data.funnel.map((step, i) => (
              <View key={step.label} style={[styles.funnelRow, i < data.funnel.length - 1 && styles.funnelRowBorder]}>
                <View style={styles.funnelLeft}>
                  <Text style={styles.funnelLabel}>{step.label}</Text>
                  {step.conversionRate !== null && (
                    <Text style={styles.funnelConversion}>
                      전환 {(step.conversionRate * 100).toFixed(1)}%
                    </Text>
                  )}
                </View>
                <View style={styles.funnelRight}>
                  <Text style={styles.funnelCount}>{step.count.toLocaleString()}</Text>
                  <Text style={styles.funnelValue}>{step.value}</Text>
                </View>
                {/* 시각적 바 */}
                <View style={styles.funnelBarBg}>
                  <View
                    style={[
                      styles.funnelBar,
                      {
                        width: `${Math.min(
                          100,
                          step.conversionRate !== null ? step.conversionRate * 100 : 100
                        )}%` as unknown as number,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
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
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f2f3f6' },
  refreshText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  body: { flex: 1 },
  bodyContent: { padding: 24, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: '#e53e3e', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: '#ff6f61' },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  sectionTitle: {
    fontSize: FontSize.t7,
    fontWeight: '700',
    color: '#868b94',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginTop: 8,
  },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: 160,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e4e5ea',
  },
  metricCardWide: { flex: 1 },
  metricLabel: { fontSize: FontSize.t7, color: '#868b94', marginBottom: 4 },
  metricValue: { fontSize: FontSize.t4, fontWeight: '700', color: '#17181c', fontVariant: ['tabular-nums'] },
  metricSub: { fontSize: FontSize.tab, color: '#868b94', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4e5ea',
    overflow: 'hidden',
  },
  funnelRow: {
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  funnelRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f1f4' },
  funnelLeft: { marginBottom: 4 },
  funnelLabel: { fontSize: FontSize.t7, fontWeight: '700', color: '#17181c' },
  funnelConversion: { fontSize: FontSize.tab, color: '#868b94', marginTop: 2 },
  funnelRight: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  funnelCount: { fontSize: FontSize.t6, fontWeight: '700', color: '#17181c', fontVariant: ['tabular-nums'] },
  funnelValue: { fontSize: FontSize.t7, color: '#868b94' },
  funnelBarBg: {
    height: 4,
    backgroundColor: '#eaebee',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  funnelBar: {
    height: 4,
    backgroundColor: '#ff6f61',
    borderRadius: 2,
  },
});
