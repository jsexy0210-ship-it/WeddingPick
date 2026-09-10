/**
 * WP-ADM-040 운영 · 자동화 상태
 * Workflow별 상태 · 성공률 · 재시도 · Dead-letter Queue · 자기복구
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { BACKEND_PENDING, PendingBackendNotice } from '@/features/admin/pending-backend';

type WorkflowStatus = 'healthy' | 'degraded' | 'down' | 'recovering';
type Workflow = {
  id: string;
  name: string;
  status: WorkflowStatus;
  successRate: number;
  execToday: number;
  retryCount: number;
  dlqSize: number;
  lastRecoveredAt: string | null;
  selfHealEnabled: boolean;
};

type AutomationData = {
  overall: { healthyCount: number; degradedCount: number; downCount: number };
  workflows: Workflow[];
};

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  healthy: '정상',
  degraded: '저하',
  down: '중단',
  recovering: '복구 중',
};
const STATUS_COLOR: Record<WorkflowStatus, string> = {
  healthy: '#1aa174',
  degraded: '#805217',
  down: '#e81607',
  recovering: '#0088cc',
};

export default function AutomationScreen() {
  const [data, setData] = useState<AutomationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/automation')
      .then((d) => {
        if (cancelled) return;
        setData(d as AutomationData);
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

  async function triggerRecovery(workflowId: string) {
    setTriggering(workflowId);
    try {
      await apiFetch(`/v1/admin/automation/${workflowId}/recover`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setTriggering(null); }
  }

  async function drainDlq(workflowId: string) {
    setTriggering(workflowId + '_dlq');
    try {
      await apiFetch(`/v1/admin/automation/${workflowId}/drain-dlq`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setTriggering(null); }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>운영 · 자동화 상태</Text>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <PendingBackendNotice actions="복구 실행 · DLQ 재처리" />
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
        <View style={styles.body}>
          <View style={styles.overallRow}>
            <View style={[styles.overallCell, { borderColor: '#1aa174' }]}>
              <Text style={[styles.overallValue, { color: '#1aa174' }]}>{data.overall.healthyCount}</Text>
              <Text style={styles.overallLabel}>정상</Text>
            </View>
            <View style={[styles.overallCell, { borderColor: data.overall.degradedCount > 0 ? '#805217' : '#e4e5ea' }]}>
              <Text style={[styles.overallValue, { color: data.overall.degradedCount > 0 ? '#805217' : '#868b94' }]}>
                {data.overall.degradedCount}
              </Text>
              <Text style={styles.overallLabel}>저하</Text>
            </View>
            <View style={[styles.overallCell, { borderColor: data.overall.downCount > 0 ? '#e81607' : '#e4e5ea' }]}>
              <Text style={[styles.overallValue, { color: data.overall.downCount > 0 ? '#e81607' : '#868b94' }]}>
                {data.overall.downCount}
              </Text>
              <Text style={styles.overallLabel}>중단</Text>
            </View>
          </View>

          <ScrollView>
            {data.workflows.map((wf, i) => (
              <View key={wf.id} style={[styles.wfCard, i < data.workflows.length - 1 && styles.wfCardBorder]}>
                <View style={styles.wfHeader}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[wf.status] }]} />
                  <Text style={styles.wfName}>{wf.name}</Text>
                  <Text style={[styles.wfStatus, { color: STATUS_COLOR[wf.status] }]}>
                    {STATUS_LABEL[wf.status]}
                  </Text>
                </View>
                <View style={styles.wfMetrics}>
                  <View style={styles.metricPair}>
                    <Text style={styles.metricLabel}>성공률</Text>
                    <Text style={[styles.metricValue, wf.successRate < 0.9 && { color: '#e81607' }]}>
                      {(wf.successRate * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.metricPair}>
                    <Text style={styles.metricLabel}>오늘 실행</Text>
                    <Text style={styles.metricValue}>{wf.execToday.toLocaleString()}</Text>
                  </View>
                  <View style={styles.metricPair}>
                    <Text style={styles.metricLabel}>재시도</Text>
                    <Text style={[styles.metricValue, wf.retryCount > 0 && { color: '#805217' }]}>
                      {wf.retryCount}
                    </Text>
                  </View>
                  <View style={styles.metricPair}>
                    <Text style={styles.metricLabel}>DLQ</Text>
                    <Text style={[styles.metricValue, wf.dlqSize > 0 && { color: '#e81607' }]}>
                      {wf.dlqSize}
                    </Text>
                  </View>
                  <View style={styles.metricPair}>
                    <Text style={styles.metricLabel}>자기복구</Text>
                    <Text style={[styles.metricValue, { color: wf.selfHealEnabled ? '#1aa174' : '#868b94' }]}>
                      {wf.selfHealEnabled ? '켜짐' : '꺼짐'}
                    </Text>
                  </View>
                </View>
                <View style={styles.wfActions}>
                  {wf.status === 'down' && (
                    <Pressable
                      style={[styles.recoverBtn, (BACKEND_PENDING || triggering === wf.id) && styles.btnDisabled]}
                      onPress={() => void triggerRecovery(wf.id)}
                      disabled={BACKEND_PENDING || triggering !== null}
                    >
                      <Text style={styles.recoverBtnText}>{triggering === wf.id ? '복구 중…' : '복구 실행'}</Text>
                    </Pressable>
                  )}
                  {wf.dlqSize > 0 && (
                    <Pressable
                      style={[styles.dlqBtn, (BACKEND_PENDING || triggering === wf.id + '_dlq') && styles.btnDisabled]}
                      onPress={() => void drainDlq(wf.id)}
                      disabled={BACKEND_PENDING || triggering !== null}
                    >
                      <Text style={styles.dlqBtnText}>
                        {triggering === wf.id + '_dlq' ? '처리 중…' : `DLQ 재처리 (${wf.dlqSize})`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
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
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f2f3f6' },
  refreshText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: '#e53e3e', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: '#ff6f61' },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  overallRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 16,
  },
  overallCell: {
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  overallValue: { fontSize: FontSize.t2, fontWeight: '700', fontVariant: ['tabular-nums'] },
  overallLabel: { fontSize: FontSize.tab, color: '#868b94', marginTop: 2 },
  wfCard: { backgroundColor: '#fff', padding: 16 },
  wfCardBorder: { borderBottomWidth: 1, borderBottomColor: '#e4e5ea' },
  wfHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  wfName: { flex: 1, fontSize: FontSize.t7, fontWeight: '700', color: '#17181c' },
  wfStatus: { fontSize: FontSize.t7, fontWeight: '700' },
  wfMetrics: { flexDirection: 'row', gap: 24, marginBottom: 12 },
  metricPair: {},
  metricLabel: { fontSize: FontSize.tab, color: '#868b94', marginBottom: 2 },
  metricValue: { fontSize: FontSize.t7, fontWeight: '700', color: '#17181c', fontVariant: ['tabular-nums'] },
  wfActions: { flexDirection: 'row', gap: 8 },
  recoverBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#0088cc',
  },
  recoverBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: '#fff' },
  dlqBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fff0ee',
    borderWidth: 1,
    borderColor: '#ff6f61',
  },
  dlqBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: '#ff6f61' },
  btnDisabled: { opacity: 0.5 },
});
