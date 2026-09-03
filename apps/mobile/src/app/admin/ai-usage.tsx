/**
 * WP-ADM-050 시스템 · AI 사용량 · 비용
 * 모델별 호출 · 단가 · 성공률 · 상위 모델 전환율 · 사용자 수정률 · 처리시간
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize } from '@weddingpick/ui';
import { apiFetch } from './_api';

type ModelStat = {
  model: string;
  provider: string;
  callCount: number;
  successRate: number;
  avgLatencyMs: number;
  costToday: string;
  costMonth: string;
  unitPrice: string;
  userEditRate: number;
  topModelConvRate: number | null;
};

type AiUsageData = {
  totalCostToday: string;
  totalCostMonth: string;
  models: ModelStat[];
};

export default function AiUsageScreen() {
  const [data, setData] = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/ai-usage')
      .then((d) => {
        if (cancelled) return;
        setData(d as AiUsageData);
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
        <Text style={styles.title}>AI 사용량 · 비용</Text>
        {data && (
          <View style={styles.headerCosts}>
            <Text style={styles.costText}>오늘 {data.totalCostToday}</Text>
            <Text style={styles.costText}>이달 {data.totalCostMonth}</Text>
          </View>
        )}
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
        <ScrollView>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colModel]}>모델</Text>
            <Text style={[styles.th, styles.colCalls]}>호출</Text>
            <Text style={[styles.th, styles.colSuccess]}>성공률</Text>
            <Text style={[styles.th, styles.colLatency]}>응답(ms)</Text>
            <Text style={[styles.th, styles.colEdit]}>수정률</Text>
            <Text style={[styles.th, styles.colCost]}>오늘 비용</Text>
            <Text style={[styles.th, styles.colUnit]}>단가</Text>
          </View>
          {data.models.map((m, i) => (
            <View key={m.model} style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra]}>
              <View style={styles.colModel}>
                <Text style={styles.modelName} numberOfLines={1}>{m.model}</Text>
                <Text style={styles.providerName}>{m.provider}</Text>
              </View>
              <Text style={[styles.td, styles.colCalls]}>{m.callCount.toLocaleString()}</Text>
              <Text style={[styles.td, styles.colSuccess, m.successRate < 0.95 && { color: '#e81607' }]}>
                {(m.successRate * 100).toFixed(1)}%
              </Text>
              <Text style={[styles.td, styles.colLatency]}>{m.avgLatencyMs.toLocaleString()}</Text>
              <Text style={[styles.td, styles.colEdit, m.userEditRate > 0.3 && { color: '#805217' }]}>
                {(m.userEditRate * 100).toFixed(1)}%
              </Text>
              <Text style={[styles.td, styles.colCost]}>{m.costToday}</Text>
              <Text style={[styles.td, styles.colUnit]}>{m.unitPrice}</Text>
            </View>
          ))}
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
    gap: 12,
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: '#17181c' },
  headerCosts: { flexDirection: 'row', gap: 12 },
  costText: { fontSize: FontSize.t7, fontWeight: '700', color: '#1aa174' },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f2f3f6' },
  refreshText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: '#e53e3e', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: '#ff6f61' },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f1f4',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  tableRowZebra: { backgroundColor: '#fafbfc' },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: '#868b94', textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: '#3a3b40', fontVariant: ['tabular-nums'] },
  colModel: { flex: 2 },
  modelName: { fontSize: FontSize.t7, fontWeight: '700', color: '#17181c' },
  providerName: { fontSize: FontSize.tab, color: '#868b94' },
  colCalls: { width: 60, textAlign: 'right' as const },
  colSuccess: { width: 56, textAlign: 'right' as const },
  colLatency: { width: 64, textAlign: 'right' as const },
  colEdit: { width: 56, textAlign: 'right' as const },
  colCost: { width: 72, textAlign: 'right' as const },
  colUnit: { width: 64, textAlign: 'right' as const },
});
