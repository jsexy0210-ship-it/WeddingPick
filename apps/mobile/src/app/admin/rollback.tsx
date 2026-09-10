/**
 * WP-ADM-042 운영 · 롤백
 * 배포·정책 변경 이력 · 지표 이탈 감지 · 자동 롤백 · 사전승인 대상
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { formatDateTimeDot } from '@/features/common/format-date';
import { DangerConfirm } from '@/features/admin/danger-confirm';

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
  stable: Colors.light.positive,
  anomaly_detected: Colors.light.cautionary,
  rolling_back: Colors.light.accent,
  rolled_back: Colors.light.textAssistive,
  pending_approval: Colors.light.negative,
};

export default function RollbackScreen() {
  const [data, setData] = useState<RollbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [acting, setActing] = useState<string | null>(null);
  /* 단추를 눌러 실패한 것. 목록 조회 오류와 자리를 나눈다 — 같은 칸을 쓰면
     버튼 한 번에 표가 통째로 사라져, 무엇에 실패했는지 보려다 보던 것을 잃는다. */
  const [actionError, setActionError] = useState<string | null>(null);
  /** 실행을 확인받는 중인 대상. v3.27 «위험한 조작은 한 번 더 확인». */
  const [confirming, setConfirming] = useState<RollbackItem | null>(null);

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

  /*
   * 실패를 삼키지 않는다. 예전에는 빈 `catch`가 404를 먹어 **눌러도 아무 일이
   * 없는데 성공한 것처럼 보였다.** 무엇이 안 됐는지 관리자가 알아야 다음 판단을 한다.
   */
  async function act(id: string, path: 'approve' | 'trigger') {
    setActing(id + '_' + path);
    try {
      await apiFetch(`/v1/admin/rollback/${id}/${path}`, { method: 'POST' });
      setActionError(null);
      setRev((r) => r + 1);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : '요청 실패');
    } finally {
      setActing(null);
      /*
       * 실패해도 확인창을 닫는다. 오류 문구는 화면 위쪽에 뜨는데, 창이 떠 있으면
       * 그 자리가 창에 가려 **무엇이 잘못됐는지 볼 수 없다.**
       */
      setConfirming(null);
    }
  }

  /** 승인은 되돌릴 것이 없다 — 다음 단계를 열 뿐이라 확인창 없이 바로 간다. */
  const approveRollback = (id: string) => act(id, 'approve');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>롤백 관리</Text>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      {actionError && <Text style={styles.actionError}>{actionError}</Text>}

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
                <Text style={[styles.infoText, { color: item.autoRollbackEnabled ? Colors.light.positive : Colors.light.textAssistive }]}>
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
                    style={[styles.approveBtn, (acting === item.id + '_approve') && styles.btnDisabled]}
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
                    style={[styles.triggerBtn, (acting === item.id + '_trigger') && styles.btnDisabled]}
                    onPress={() => { setActionError(null); setConfirming(item); }}
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

      {/*
        무엇이 바뀌는지 항목으로 보인 뒤 한 번 더 확인한다(v3.27). 롤백 실행은
        사용자 화면이 바로 바뀌는 조작이라 「정말요?」 한 줄로 끝내지 않는다.
      */}
      <DangerConfirm
        visible={confirming !== null}
        title="롤백을 실행할까요?"
        description="되돌린 뒤에는 이 화면에서 다시 앞으로 감을 수 없어요."
        changes={
          confirming
            ? [
                `대상: ${confirming.name}`,
                confirming.type === 'policy'
                  ? '정책 값이 변경 직전 값으로 되돌아가요'
                  : '배포 되돌리기 요청만 기록돼요. 실제 되돌리기는 사람이 이어받아요',
                confirming.anomalyMetric
                  ? `근거: ${confirming.anomalyMetric} ${confirming.anomalyValue ?? ''} (기준 ${confirming.threshold ?? ''})`
                  : '이상 지표 없이 실행해요',
                '실행 기록이 감사 기록에 남아요',
              ]
            : []
        }
        confirmLabel="롤백 실행"
        busy={acting !== null}
        onConfirm={() => { if (confirming) void act(confirming.id, 'trigger'); }}
        onCancel={() => setConfirming(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
  actionError: {
    color: Colors.light.negative,
    fontSize: FontSize.t7,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
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
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.light.backgroundSelected },
  refreshText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.tint },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  itemCard: {
    backgroundColor: Colors.light.background,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  itemCardZebra: { backgroundColor: Colors.light.backgroundElement },
  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  itemMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeDeploy: { backgroundColor: Colors.light.accentBackground },
  typePolicy: { backgroundColor: Colors.light.negativeBoxBackground },
  typeBadgeText: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.text },
  itemName: { flex: 1, fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.text },
  statusLabel: { fontSize: FontSize.t7, fontWeight: '700', flexShrink: 0 },
  itemInfo: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  infoText: { fontSize: FontSize.tab, color: Colors.light.textAssistive },
  anomalyBox: {
    backgroundColor: Colors.light.cautionaryBoxBackground,
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.light.cautionaryBorder,
  },
  anomalyText: { fontSize: FontSize.tab, color: Colors.light.cautionary },
  actions: { flexDirection: 'row', gap: 8 },
  approveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
  },
  approveBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.background },
  triggerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.light.negative,
  },
  triggerBtnText: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.background },
  btnDisabled: { opacity: 0.5 },
});
