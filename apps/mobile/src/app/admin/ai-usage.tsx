/**
 * WP-ADM-050 시스템 · AI 사용량 · 비용
 * 모델별 호출 · 단가 · 성공률 · 상위 모델 전환율 · 사용자 수정률 · 처리시간
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
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
        <Text style={styles.title}>분석 비용</Text>
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
              <Text style={[styles.td, styles.colSuccess, m.successRate < 0.95 && { color: Colors.light.negative }]}>
                {(m.successRate * 100).toFixed(1)}%
              </Text>
              <Text style={[styles.td, styles.colLatency]}>{m.avgLatencyMs.toLocaleString()}</Text>
              <Text style={[styles.td, styles.colEdit, m.userEditRate > 0.3 && { color: Colors.light.cautionary }]}>
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
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text },
  headerCosts: { flexDirection: 'row', gap: 12 },
  costText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.positive },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.light.backgroundSelected },
  refreshText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.tint },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  tableRowZebra: { backgroundColor: Colors.light.backgroundElement },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive, textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: Colors.light.textStrong, fontVariant: ['tabular-nums'] },
  colModel: { flex: 2 },
  modelName: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.text },
  providerName: { fontSize: FontSize.tab, color: Colors.light.textAssistive },
  colCalls: { width: 60, textAlign: 'right' as const },
  colSuccess: { width: 56, textAlign: 'right' as const },
  colLatency: { width: 64, textAlign: 'right' as const },
  colEdit: { width: 56, textAlign: 'right' as const },
  colCost: { width: 72, textAlign: 'right' as const },
  colUnit: { width: 64, textAlign: 'right' as const },
});
