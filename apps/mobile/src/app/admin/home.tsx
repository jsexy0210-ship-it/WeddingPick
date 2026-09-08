/**
 * WP-ADM-001 관리자 홈
 * AI 운영현황 · 진짜 확인 필요 · 비용·수익 · AI 행동·변경 요약 · 긴급 중지
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';

type DashboardMetric = {
  label: string;
  value: string;
  delta?: string;
  deltaUp?: boolean;
  urgent?: boolean;
};

type DashboardData = {
  aiStatus: { healthy: boolean; successRate: number; pendingActions: number };
  reviewQueue: { total: number; urgent: number; oldest: string };
  revenue: { mrr: string; aiCost: string; contributionMargin: string };
  recentActions: { time: string; action: string; result: string }[];
  killSwitches: { id: string; label: string; active: boolean }[];
};

function MetricCard({ label, value, delta, deltaUp, urgent }: DashboardMetric) {
  return (
    <View style={[styles.metricCard, urgent && styles.metricCardUrgent]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, urgent && styles.metricValueUrgent]}>{value}</Text>
      {delta ? (
        <Text style={[styles.metricDelta, deltaUp ? styles.deltaUp : styles.deltaDown]}>
          {deltaUp ? '▲' : '▼'} {delta}
        </Text>
      ) : null}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function AdminHomeScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [toggling, setToggling] = useState<string | null>(null);

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

  function reload() { setRev((r) => r + 1); }

  async function toggleKillSwitch(id: string, currentActive: boolean) {
    setToggling(id);
    try {
      await apiFetch(`/v1/admin/kill-switches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !currentActive }),
      });
      reload();
    } catch {
      // 실패 시 무시 — 다음 새로고침에서 실제 상태 반영
    } finally {
      setToggling(null);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>관리자 홈</Text>
        <Pressable style={styles.refreshBtn} onPress={reload}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <DelayedLoader active={loading} size={40} style={styles.centered} />

      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={reload}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && data && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* AI 운영현황 */}
          <SectionHeader title="AI 운영현황" />
          <View style={styles.metricsRow}>
            <MetricCard
              label="AI 성공률"
              value={`${data.aiStatus.successRate.toFixed(1)}%`}
              deltaUp={data.aiStatus.successRate >= 95}
              delta={data.aiStatus.successRate < 95 ? '95% 미만' : undefined}
            />
            <MetricCard
              label="AI 상태"
              value={data.aiStatus.healthy ? '정상' : '이상'}
              urgent={!data.aiStatus.healthy}
            />
            <MetricCard
              label="대기 중인 AI 작업"
              value={String(data.aiStatus.pendingActions)}
              urgent={data.aiStatus.pendingActions > 100}
            />
          </View>

          {/* 진짜 확인 필요 */}
          <SectionHeader title="진짜 확인 필요" />
          <View style={styles.metricsRow}>
            <MetricCard
              label="검토 큐 총계"
              value={String(data.reviewQueue.total)}
              urgent={data.reviewQueue.total > 50}
            />
            <MetricCard
              label="긴급 건"
              value={String(data.reviewQueue.urgent)}
              urgent={data.reviewQueue.urgent > 0}
            />
            <MetricCard label="가장 오래된 건" value={data.reviewQueue.oldest} />
          </View>

          {/* 비용·수익 */}
          <SectionHeader title="비용 · 수익" />
          <View style={styles.metricsRow}>
            <MetricCard label="MRR" value={data.revenue.mrr} />
            <MetricCard label="AI 비용" value={data.revenue.aiCost} />
            <MetricCard label="기여이익" value={data.revenue.contributionMargin} />
          </View>

          {/* AI 행동 · 변경 요약 */}
          <SectionHeader title="AI 행동 · 변경 요약" />
          <View style={styles.card}>
            {data.recentActions.length === 0 ? (
              <Text style={styles.emptyText}>최근 AI 행동이 없어요.</Text>
            ) : (
              data.recentActions.map((action, i) => (
                <View key={i} style={[styles.actionRow, i < data.recentActions.length - 1 && styles.actionRowBorder]}>
                  <Text style={styles.actionTime}>{action.time}</Text>
                  <Text style={styles.actionLabel} numberOfLines={1}>{action.action}</Text>
                  <Text style={[styles.actionResult, action.result === '성공' ? styles.resultOk : styles.resultFail]}>
                    {action.result}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* 긴급 중지 (Kill Switches) */}
          <SectionHeader title="긴급 중지" />
          <View style={styles.card}>
            {data.killSwitches.map((ks) => (
              <View key={ks.id} style={styles.killSwitchRow}>
                <Text style={styles.killSwitchLabel}>{ks.label}</Text>
                <Pressable
                  style={[styles.killBtn, ks.active ? styles.killBtnActive : styles.killBtnInactive]}
                  onPress={() => void toggleKillSwitch(ks.id, ks.active)}
                  disabled={toggling === ks.id}
                >
                  <Text style={[styles.killBtnText, ks.active && styles.killBtnTextActive]}>
                    {toggling === ks.id ? '처리 중…' : ks.active ? '중지 중' : '정상'}
                  </Text>
                </Pressable>
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
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f2f3f6',
  },
  refreshText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  body: { flex: 1 },
  bodyContent: { padding: 24, gap: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: '#e53e3e', marginBottom: 16 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#ff6f61',
  },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  sectionHeader: {
    fontSize: FontSize.t7,
    fontWeight: '700',
    color: '#868b94',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
  },
  metricsRow: { flexDirection: 'row', gap: 12 },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e4e5ea',
  },
  metricCardUrgent: { borderColor: '#e81607', backgroundColor: '#fff5f5' },
  metricLabel: { fontSize: FontSize.t7, color: '#868b94', marginBottom: 6 },
  metricValue: { fontSize: FontSize.t4, fontWeight: '700', color: '#17181c' },
  metricValueUrgent: { color: '#e81607' },
  metricDelta: { fontSize: FontSize.tab, marginTop: 4 },
  deltaUp: { color: '#1aa174' },
  deltaDown: { color: '#e81607' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4e5ea',
    overflow: 'hidden',
  },
  emptyText: { fontSize: FontSize.t7, color: '#868b94', padding: 16 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  actionRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f1f4' },
  actionTime: { fontSize: FontSize.tab, color: '#868b94', width: 80 },
  actionLabel: { flex: 1, fontSize: FontSize.t7, color: '#3a3b40' },
  actionResult: { fontSize: FontSize.tab, fontWeight: '700' },
  resultOk: { color: '#1aa174' },
  resultFail: { color: '#e81607' },
  killSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f1f4',
  },
  killSwitchLabel: { flex: 1, fontSize: FontSize.t7, color: '#17181c' },
  killBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  killBtnActive: { backgroundColor: '#fff0ee', borderColor: '#ff6f61' },
  killBtnInactive: { backgroundColor: '#f2f3f6', borderColor: '#d1d3d8' },
  killBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: '#5a5d6a' },
  killBtnTextActive: { color: '#ff6f61' },
});
