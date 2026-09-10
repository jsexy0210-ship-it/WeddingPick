/**
 * WP-ADM-042 운영 · 롤백
 * 배포·정책 변경 이력 · 지표 이탈 감지 · 자동 롤백 · 사전승인 대상
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, LineHeight } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { OpsAlert, OpsConfirm, OpsEmpty } from '@/features/admin/ops-kit';
import { BACKEND_PENDING, PendingBackendNotice } from '@/features/admin/pending-backend';
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
  /* 시안 confirmCard — 되돌리기는 무엇이 바뀌는지 항목으로 보인 뒤 진행한다. */
  const [pending, setPending] = useState<{ item: RollbackItem; kind: 'approve' | 'trigger' } | null>(null);

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

  const waiting = data?.items.filter((it) => it.status === 'pending_approval') ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>변경 복구 관리</Text>
          <Text style={styles.subtitle}>되돌리기 전에 무엇이 바뀌는지 보여요</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <PendingBackendNotice actions="승인 · 실행" />
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
        <ScrollView contentContainerStyle={styles.scrollBody}>
          {/* 지금 봐야 할 것이 맨 위 — 승인을 기다리는 건이 있으면 그것부터 말한다. */}
          <View style={styles.bannerWrap}>
            {waiting.length > 0 ? (
              <OpsAlert kind="warn" title={`${waiting.length}건이 승인을 기다려요`} sub={waiting.map((w) => w.name).join(' · ')} />
            ) : (
              <OpsAlert kind="ok" title="확인할 것이 없어요" sub="되돌릴 변경이 없어요." />
            )}
          </View>

          {data.items.length === 0 ? (
            <View style={styles.bannerWrap}>
              <OpsEmpty title="확인할 것이 없어요" sub="최근 되돌린 변경이 없어요." />
            </View>
          ) : null}

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
                    style={[styles.approveBtn, (BACKEND_PENDING || acting === item.id + '_approve') && styles.btnDisabled]}
                    onPress={() => setPending({ item, kind: 'approve' })}
                    disabled={BACKEND_PENDING || acting !== null}
                  >
                    <Text style={styles.approveBtnText}>
                      {acting === item.id + '_approve' ? '처리 중…' : '롤백 승인'}
                    </Text>
                  </Pressable>
                )}
                {item.status === 'anomaly_detected' && !item.requiresApproval && (
                  <Pressable
                    style={[styles.triggerBtn, (BACKEND_PENDING || acting === item.id + '_trigger') && styles.btnDisabled]}
                    onPress={() => setPending({ item, kind: 'trigger' })}
                    disabled={BACKEND_PENDING || acting !== null}
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

      {/* 위험한 조작은 한 번 더. */}
      <OpsConfirm
        visible={pending !== null}
        title={pending ? `${pending.item.name}을(를) 되돌릴까요?` : ''}
        body="되돌리는 즉시 아래가 바뀌어요."
        items={
          pending
            ? [
                pending.item.type === 'deploy'
                  ? `${formatDateTimeDot(pending.item.deployedAt)} 배포 전으로 돌아가요 (${pending.item.deployedBy})`
                  : `${formatDateTimeDot(pending.item.deployedAt)} 정책 변경 전으로 돌아가요 (${pending.item.deployedBy})`,
                pending.item.anomalyMetric && pending.item.anomalyValue
                  ? `${pending.item.anomalyMetric} ${pending.item.anomalyValue}가 되돌린 뒤 값으로 다시 집계돼요`
                  : '되돌린 뒤 지표는 다음 집계부터 반영돼요',
                '기록은 감사 기록에 남고 다시 되돌릴 수 있어요',
              ]
            : []
        }
        confirmLabel={pending?.kind === 'approve' ? '되돌리기 승인' : '지금 되돌리기'}
        onConfirm={() => {
          const target = pending;
          setPending(null);
          if (!target) return;
          if (target.kind === 'approve') void approveRollback(target.item.id);
          else void triggerRollback(target.item.id);
        }}
        onCancel={() => setPending(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
  titleWrap: { flex: 1 },
  subtitle: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, color: Colors.light.textAssistive, marginTop: 2 },
  scrollBody: { paddingBottom: 24 },
  bannerWrap: { paddingHorizontal: 24, paddingTop: 16 },
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
