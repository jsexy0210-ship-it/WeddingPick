/**
 * WP-ADM-010 데이터 · 제보 처리 현황
 * 자동 처리 건수 · 단계별 적체 · 실패 큐 · 재처리
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize } from '@weddingpick/ui';
import { apiFetch } from './_api';

type StageCount = { stage: string; count: number; avgWaitMin: number };
type FailedItem = { id: string; stage: string; error: string; failedAt: string; retryCount: number };

type PipelineData = {
  today: { received: number; autoProcessed: number; manualRequired: number; failed: number };
  stages: StageCount[];
  failedQueue: FailedItem[];
};

export default function DataPipelineScreen() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/data/pipeline')
      .then((d) => {
        if (cancelled) return;
        setData(d as PipelineData);
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

  async function retryItem(id: string) {
    setRetrying(id);
    try {
      await apiFetch(`/v1/admin/data/pipeline/retry/${id}`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch {
      // 실패 무시
    } finally {
      setRetrying(null);
    }
  }

  async function retryAll() {
    setRetrying('all');
    try {
      await apiFetch('/v1/admin/data/pipeline/retry-all', { method: 'POST' });
      setRev((r) => r + 1);
    } catch {
      // 실패 무시
    } finally {
      setRetrying(null);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>데이터 · 제보 처리 현황</Text>
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
          {/* 오늘 처리 현황 */}
          <Text style={styles.sectionTitle}>오늘 처리 현황</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{data.today.received.toLocaleString()}</Text>
              <Text style={styles.statLabel}>접수</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, styles.valueOk]}>{data.today.autoProcessed.toLocaleString()}</Text>
              <Text style={styles.statLabel}>자동 처리</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, data.today.manualRequired > 0 && styles.valueWarn]}>
                {data.today.manualRequired.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>수동 필요</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, data.today.failed > 0 && styles.valueDanger]}>
                {data.today.failed.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>실패</Text>
            </View>
          </View>

          {/* 단계별 적체 */}
          <Text style={styles.sectionTitle}>단계별 적체</Text>
          <View style={styles.card}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colStage]}>단계</Text>
              <Text style={[styles.th, styles.colCount]}>적체 건수</Text>
              <Text style={[styles.th, styles.colWait]}>평균 대기</Text>
            </View>
            {data.stages.map((s, i) => (
              <View key={s.stage} style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra]}>
                <Text style={[styles.td, styles.colStage]}>{s.stage}</Text>
                <Text style={[styles.td, styles.colCount, s.count > 100 && styles.valueDanger]}>
                  {s.count.toLocaleString()}
                </Text>
                <Text style={[styles.td, styles.colWait]}>
                  {s.avgWaitMin < 60 ? `${s.avgWaitMin}분` : `${(s.avgWaitMin / 60).toFixed(1)}시간`}
                </Text>
              </View>
            ))}
          </View>

          {/* 실패 큐 */}
          <View style={styles.failQueueHeader}>
            <Text style={styles.sectionTitle}>실패 큐</Text>
            {data.failedQueue.length > 0 && (
              <Pressable
                style={[styles.retryAllBtn, retrying === 'all' && styles.btnDisabled]}
                onPress={() => void retryAll()}
                disabled={retrying !== null}
              >
                <Text style={styles.retryAllText}>
                  {retrying === 'all' ? '처리 중…' : '전체 재처리'}
                </Text>
              </Pressable>
            )}
          </View>
          <View style={styles.card}>
            {data.failedQueue.length === 0 ? (
              <Text style={styles.emptyText}>실패 큐 비어 있어요.</Text>
            ) : (
              <>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, styles.colId]}>ID</Text>
                  <Text style={[styles.th, styles.colFailStage]}>단계</Text>
                  <Text style={[styles.th, styles.colError]}>오류</Text>
                  <Text style={[styles.th, styles.colRetry]}>재시도</Text>
                  <Text style={[styles.th, styles.colAction]} />
                </View>
                {data.failedQueue.map((item, i) => (
                  <View key={item.id} style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra]}>
                    <Text style={[styles.td, styles.colId, styles.monoText]} numberOfLines={1}>
                      {item.id.slice(0, 8)}…
                    </Text>
                    <Text style={[styles.td, styles.colFailStage]}>{item.stage}</Text>
                    <Text style={[styles.td, styles.colError]} numberOfLines={1}>{item.error}</Text>
                    <Text style={[styles.td, styles.colRetry]}>{item.retryCount}회</Text>
                    <View style={[styles.colAction]}>
                      <Pressable
                        style={[styles.inlineBtn, retrying === item.id && styles.btnDisabled]}
                        onPress={() => void retryItem(item.id)}
                        disabled={retrying !== null}
                      >
                        <Text style={styles.inlineBtnText}>
                          {retrying === item.id ? '…' : '재처리'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </>
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
  sectionTitle: {
    fontSize: FontSize.t7,
    fontWeight: '700',
    color: '#868b94',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginTop: 8,
  },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCell: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e4e5ea',
  },
  statValue: { fontSize: FontSize.t4, fontWeight: '700', color: '#17181c', fontVariant: ['tabular-nums'] },
  valueOk: { color: '#1aa174' },
  valueWarn: { color: '#805217' },
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
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f1f4',
  },
  tableRowZebra: { backgroundColor: '#fafbfc' },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: '#868b94', textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: '#3a3b40' },
  monoText: { color: '#5a5d6a' },
  colStage: { flex: 2 },
  colCount: { width: 80, textAlign: 'right' as const },
  colWait: { width: 80, textAlign: 'right' as const },
  colId: { width: 80 },
  colFailStage: { width: 100 },
  colError: { flex: 1 },
  colRetry: { width: 50 },
  colAction: { width: 60, alignItems: 'flex-end' },
  failQueueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  retryAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ff6f61',
  },
  retryAllText: { fontSize: FontSize.tab, fontWeight: '700', color: '#fff' },
  inlineBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f2f3f6',
    borderWidth: 1,
    borderColor: '#d1d3d8',
  },
  inlineBtnText: { fontSize: FontSize.tab, color: '#5a5d6a' },
  btnDisabled: { opacity: 0.5 },
});
