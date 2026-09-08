/**
 * WP-ADM-042 운영 · 롤백
 * 배포·정책 변경 이력 · 지표 이탈 감지 · 자동 롤백 · 사전승인 대상
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { formatDateTimeDot } from '@/features/common/format-date';

type RollbackStatus = 'stable' | 'anomaly_detected' | 'rolling_back' | 'rolled_back' | 'pending_approval';
type RollbackItem = {
  id: string;
  name: string;
  type: 'deploy' | 'policy';
  deployedAt: string;
  deployedBy: string;
  status: RollbackStatus;
  anomalyMetric: string | null;
  anomalyValue: string | null;
  threshold: string | null;
  requiresApproval: boolean;
  autoRollbackEnabled: boolean;
};

type RollbackData = { items: RollbackItem[] };

const STATUS_LABEL: Record<RollbackStatus, string> = {
  stable: '안정',
  anomaly_detected: '이상 감지',
  rolling_back: '롤백 중',
  rolled_back: '롤백 완료',
  pending_approval: '승인 대기',
};
const STATUS_COLOR: Record<RollbackStatus, string> = {
  stable: '#1aa174',
  anomaly_detected: '#805217',
  rolling_back: '#0088cc',
  rolled_back: '#868b94',
  pending_approval: '#e81607',
};

export default function RollbackScreen() {
  const [data, setData] = useState<RollbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/rollback')
      .then((d) => {
        if (cancelled) return;
        setData(d as RollbackData);
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

  async function approveRollback(id: string) {
    setActing(id + '_approve');
    try {
      await apiFetch(`/v1/admin/rollback/${id}/approve`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setActing(null); }
  }

  async function triggerRollback(id: string) {
    setActing(id + '_trigger');
    try {
      await apiFetch(`/v1/admin/rollback/${id}/trigger`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setActing(null); }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>롤백 관리</Text>
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
          {data.items.map((item, i) => (
            <View key={item.id} style={[styles.itemCard, i % 2 === 1 && styles.itemCardZebra]}>
              <View style={styles.itemHeader}>
                <View style={styles.itemMeta}>
                  <View style={[styles.typeBadge, item.type === 'deploy' ? styles.typeDeploy : styles.typePolicy]}>
                    <Text style={styles.typeBadgeText}>{item.type === 'deploy' ? '배포' : '정책'}</Text>
                  </View>
                  <Text style={styles.itemName}>{item.name}</Text>
                </View>
                <Text style={[styles.statusLabel, { color: STATUS_COLOR[item.status] }]}>
                  {STATUS_LABEL[item.status]}
                </Text>
              </View>

              <View style={styles.itemInfo}>
                <Text style={styles.infoText}>
                  {formatDateTimeDot(item.deployedAt)} · {item.deployedBy}
                </Text>
                <Text style={[styles.infoText, { color: item.autoRollbackEnabled ? '#1aa174' : '#868b94' }]}>
                  자동 롤백: {item.autoRollbackEnabled ? '켜짐' : '꺼짐'}
                </Text>
              </View>

              {item.anomalyMetric && (
                <View style={styles.anomalyBox}>
                  <Text style={styles.anomalyText}>
                    이상 지표: {item.anomalyMetric} = {item.anomalyValue} (기준: {item.threshold})
                  </Text>
                </View>
              )}

              <View style={styles.actions}>
                {item.status === 'pending_approval' && (
                  <Pressable
                    style={[styles.approveBtn, acting === item.id + '_approve' && styles.btnDisabled]}
                    onPress={() => void approveRollback(item.id)}
                    disabled={acting !== null}
                  >
                    <Text style={styles.approveBtnText}>
                      {acting === item.id + '_approve' ? '처리 중…' : '롤백 승인'}
                    </Text>
                  </Pressable>
                )}
                {item.status === 'anomaly_detected' && !item.requiresApproval && (
                  <Pressable
                    style={[styles.triggerBtn, acting === item.id + '_trigger' && styles.btnDisabled]}
                    onPress={() => void triggerRollback(item.id)}
                    disabled={acting !== null}
                  >
                    <Text style={styles.triggerBtnText}>
                      {acting === item.id + '_trigger' ? '처리 중…' : '즉시 롤백'}
                    </Text>
                  </Pressable>
                )}
              </View>
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
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: '#17181c' },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f2f3f6' },
  refreshText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: '#e53e3e', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: '#ff6f61' },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  itemCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f1f4',
  },
  itemCardZebra: { backgroundColor: '#fafbfc' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  itemMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeDeploy: { backgroundColor: '#ebf5ff' },
  typePolicy: { backgroundColor: '#fff0ee' },
  typeBadgeText: { fontSize: FontSize.tab, fontWeight: '700', color: '#17181c' },
  itemName: { flex: 1, fontSize: FontSize.t7, fontWeight: '700', color: '#17181c' },
  statusLabel: { fontSize: FontSize.t7, fontWeight: '700', flexShrink: 0 },
  itemInfo: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  infoText: { fontSize: FontSize.tab, color: '#868b94' },
  anomalyBox: {
    backgroundColor: '#fff8ec',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f5c842',
  },
  anomalyText: { fontSize: FontSize.tab, color: '#805217' },
  actions: { flexDirection: 'row', gap: 8 },
  approveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ff6f61',
  },
  approveBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: '#fff' },
  triggerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#e81607',
  },
  triggerBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
});
