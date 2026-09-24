import { Redirect } from 'expo-router';
/**
 * WP-ADM-050 시스템 · AI 사용량 · 비용
 * 월·기능·모델별 호출 · 성공률 · 수정률 · 처리시간 · 추정 비용
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { formatCount } from '@weddingpick/domain';

type ModelStat = {
  feature: string;
  month: string;
  model: string;
  requestCount: number;
  successRate: number;
  medianLatencyMs: number | null;
  estimatedCostUsd: number | null;
  userCorrectionRate: number | null;
};

type AiUsageData = {
  usage: ModelStat[];
  budgetStatus: { spentUsd: number; uncostedCount: number }[];
};

function readAiUsageData(value: unknown): AiUsageData {
  if (!value || typeof value !== 'object') throw new Error('사용량 데이터를 읽지 못했어요.');
  const data = value as Partial<AiUsageData>;
  if (!Array.isArray(data.usage) || !Array.isArray(data.budgetStatus)) {
    throw new Error('사용량 데이터 형식을 확인해주세요.');
  }
  if (!data.usage.every((item) => item && typeof item.month === 'string' && typeof item.feature === 'string' &&
    typeof item.model === 'string' && typeof item.requestCount === 'number' && typeof item.successRate === 'number' &&
    (item.medianLatencyMs === null || typeof item.medianLatencyMs === 'number') &&
    (item.userCorrectionRate === null || typeof item.userCorrectionRate === 'number') &&
    (item.estimatedCostUsd === null || typeof item.estimatedCostUsd === 'number')) ||
    !data.budgetStatus.every((item) => item && typeof item.spentUsd === 'number')) {
    throw new Error('사용량 데이터 형식을 확인해주세요.');
  }
  return data as AiUsageData;
}

export function AiUsagePanel() {
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
        setData(readAiUsageData(d));
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
            <Text style={styles.costText}>이번 달 추정 ${data.budgetStatus.reduce((sum, item) => sum + item.spentUsd, 0).toFixed(4)}</Text>
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
        <ScrollView horizontal>
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colMonth]}>월</Text>
              <Text style={[styles.th, styles.colFeature]}>기능</Text>
              <Text style={[styles.th, styles.colModel]}>모델</Text>
              <Text style={[styles.th, styles.colCalls]}>호출</Text>
              <Text style={[styles.th, styles.colSuccess]}>성공률</Text>
              <Text style={[styles.th, styles.colLatency]}>응답(ms)</Text>
              <Text style={[styles.th, styles.colEdit]}>수정률</Text>
              <Text style={[styles.th, styles.colCost]}>추정 비용</Text>
            </View>
            {data.usage.map((m, i) => (
              <View key={`${m.month}-${m.feature}-${m.model}`} style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra]}>
                <Text style={[styles.td, styles.colMonth]}>{m.month.slice(0, 7)}</Text>
                <Text style={[styles.td, styles.colFeature]}>{m.feature}</Text>
                <View style={styles.colModel}>
                  <Text style={styles.modelName} numberOfLines={1}>{m.model}</Text>
                </View>
                <Text style={[styles.td, styles.colCalls]}>{formatCount(m.requestCount)}</Text>
                <Text style={[styles.td, styles.colSuccess, m.successRate < 0.95 && { color: Colors.light.negative }]}>
                  {(m.successRate * 100).toFixed(1)}%
                </Text>
                <Text style={[styles.td, styles.colLatency]}>{m.medianLatencyMs === null ? '—' : formatCount(m.medianLatencyMs)}</Text>
                <Text style={[styles.td, styles.colEdit, m.userCorrectionRate !== null && m.userCorrectionRate > 0.3 && { color: Colors.light.cautionary }]}>
                  {m.userCorrectionRate === null ? '—' : `${(m.userCorrectionRate * 100).toFixed(1)}%`}
                </Text>
                <Text style={[styles.td, styles.colCost]}>{m.estimatedCostUsd === null ? '미산정' : `$${m.estimatedCostUsd.toFixed(4)}`}</Text>
              </View>
            ))}
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
    flexWrap: 'wrap',
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
  table: { minWidth: 760 },
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
  colMonth: { width: 64 },
  colFeature: { width: 92 },
  modelName: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.text },
  colCalls: { width: 60, textAlign: 'right' as const },
  colSuccess: { width: 56, textAlign: 'right' as const },
  colLatency: { width: 64, textAlign: 'right' as const },
  colEdit: { width: 56, textAlign: 'right' as const },
  colCost: { width: 72, textAlign: 'right' as const },
});

/**
 * 옛 주소는 저장된 링크·딥링크가 있을 수 있어 남긴다. 실제 화면은 `/admin/stats`(통계·수익)의 분석 비용 탭에 있다 —
 * `AiUsagePanel`이 이 파일의 본체다.
 */
export default function AiUsageRedirect() {
  return <Redirect href="/admin/stats?tab=ai-usage" />;
}
