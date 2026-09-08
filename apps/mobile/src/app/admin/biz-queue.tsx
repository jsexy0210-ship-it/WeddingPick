/**
 * WP-ADM-023 사용자 · 업체 문의 큐
 * WP-BIZ 접수 건 · 자동 분류 · 소속 검증 결과 · 승인 반려
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';

type BizStatus = 'pending' | 'auto_approved' | 'approved' | 'rejected' | 'escalated';
type BizItem = {
  id: string;
  companyName: string;
  contactEmail: string;
  inquiryType: string;
  autoClassification: string;
  affiliationVerified: boolean | null;
  trustScore: number;
  legalRisk: boolean;
  status: BizStatus;
  receivedAt: string;
  reviewNote: string | null;
};

type BizData = { items: BizItem[]; total: number };

const STATUS_LABEL: Record<BizStatus, string> = {
  pending: '대기',
  auto_approved: '자동승인',
  approved: '승인',
  rejected: '반려',
  escalated: '에스컬레이션',
};
const STATUS_COLOR: Record<BizStatus, string> = {
  pending: '#805217',
  auto_approved: '#0088cc',
  approved: '#1aa174',
  rejected: '#e81607',
  escalated: '#e81607',
};

export default function BizQueueScreen() {
  const [data, setData] = useState<BizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [selected, setSelected] = useState<BizItem | null>(null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/biz-queue')
      .then((d) => {
        if (cancelled) return;
        setData(d as BizData);
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

  async function decide(action: 'approve' | 'reject') {
    if (!selected) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/biz-queue/${selected.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      setSelected(null);
      setNote('');
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  const needsReview = data?.items.filter((i) => i.status === 'pending' || i.legalRisk || i.trustScore < 0.5) ?? [];
  const others = data?.items.filter((i) => !needsReview.includes(i)) ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>사용자 · 업체 문의 큐</Text>
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
        <View style={styles.body}>
          <View style={styles.listPanel}>
            <ScrollView>
              {needsReview.length > 0 && (
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>검토 필요 ({needsReview.length})</Text>
                </View>
              )}
              {[...needsReview, ...others].map((item, i) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.tableRow,
                    i % 2 === 1 && styles.tableRowZebra,
                    selected?.id === item.id && styles.tableRowActive,
                    item.legalRisk && styles.tableRowRisk,
                  ]}
                  onPress={() => { setSelected(item); setNote(item.reviewNote ?? ''); setActionError(null); }}
                >
                  <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                      <Text style={styles.companyName} numberOfLines={1}>{item.companyName}</Text>
                      {item.legalRisk && (
                        <Text style={styles.legalBadge}>법적 위험</Text>
                      )}
                      <Text style={[styles.statusTag, { color: STATUS_COLOR[item.status] }]}>
                        {STATUS_LABEL[item.status]}
                      </Text>
                    </View>
                    <Text style={styles.rowSub}>
                      {item.inquiryType} · {item.autoClassification} · 신뢰도 {(item.trustScore * 100).toFixed(0)}%
                    </Text>
                  </View>
                </Pressable>
              ))}
              {data.items.length === 0 && (
                <Text style={styles.emptyText}>접수 건이 없어요.</Text>
              )}
            </ScrollView>
          </View>

          <View style={styles.detailPanel}>
            {!selected ? (
              <View style={styles.detailEmpty}>
                <Text style={styles.emptyText}>왼쪽에서 항목을 선택하세요</Text>
              </View>
            ) : (
              <ScrollView>
                <Text style={styles.detailTitle}>{selected.companyName}</Text>
                <Text style={styles.detailSub}>{selected.contactEmail}</Text>

                <Text style={styles.fieldLabel}>문의 유형</Text>
                <Text style={styles.fieldValue}>{selected.inquiryType}</Text>

                <Text style={styles.fieldLabel}>AI 자동 분류</Text>
                <Text style={styles.fieldValue}>{selected.autoClassification}</Text>

                <Text style={styles.fieldLabel}>소속 검증</Text>
                <Text style={styles.fieldValue}>
                  {selected.affiliationVerified === null ? '검증 전'
                    : selected.affiliationVerified ? '확인됨' : '미확인'}
                </Text>

                <Text style={styles.fieldLabel}>신뢰도</Text>
                <Text style={[styles.fieldValue, selected.trustScore < 0.5 && { color: '#e81607' }]}>
                  {(selected.trustScore * 100).toFixed(0)}%
                </Text>

                <Text style={styles.fieldLabel}>법적 위험</Text>
                <Text style={[styles.fieldValue, selected.legalRisk && { color: '#e81607', fontWeight: '700' }]}>
                  {selected.legalRisk ? '해당됨' : '없음'}
                </Text>

                <Text style={styles.fieldLabel}>검토 메모</Text>
                <TextInput
                  style={styles.noteInput}
                  multiline
                  numberOfLines={3}
                  value={note}
                  onChangeText={setNote}
                  placeholder="승인 메모 또는 반려 사유"
                />

                {actionError && <Text style={styles.actionError}>{actionError}</Text>}

                {selected.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.approveBtn, acting && styles.btnDisabled]}
                      onPress={() => void decide('approve')}
                      disabled={acting}
                    >
                      <Text style={styles.approveBtnText}>{acting ? '처리 중…' : '승인'}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.rejectBtn, acting && styles.btnDisabled]}
                      onPress={() => void decide('reject')}
                      disabled={acting}
                    >
                      <Text style={styles.rejectBtnText}>{acting ? '처리 중…' : '반려'}</Text>
                    </Pressable>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
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
  body: { flex: 1, flexDirection: 'row' },
  listPanel: { flex: 1, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e4e5ea' },
  detailPanel: { width: 400, backgroundColor: '#fff', padding: 20 },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: '#e53e3e', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: '#ff6f61' },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  groupHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
  },
  groupTitle: { fontSize: FontSize.tab, fontWeight: '700', color: '#868b94', textTransform: 'uppercase' as const },
  tableRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f1f4',
  },
  tableRowZebra: { backgroundColor: '#fafbfc' },
  tableRowActive: { backgroundColor: 'rgba(255,111,97,0.08)' },
  tableRowRisk: { borderLeftWidth: 3, borderLeftColor: '#e81607' },
  rowMain: {},
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  companyName: { flex: 1, fontSize: FontSize.t7, fontWeight: '700', color: '#17181c' },
  legalBadge: {
    fontSize: FontSize.tab,
    fontWeight: '700',
    color: '#e81607',
    backgroundColor: '#fff0ee',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTag: { fontSize: FontSize.tab, fontWeight: '700' },
  rowSub: { fontSize: FontSize.tab, color: '#868b94' },
  emptyText: { fontSize: FontSize.t7, color: '#868b94', padding: 16 },
  detailTitle: { fontSize: FontSize.t5, fontWeight: '700', color: '#17181c', marginBottom: 4 },
  detailSub: { fontSize: FontSize.t7, color: '#868b94', marginBottom: 16 },
  fieldLabel: { fontSize: FontSize.tab, fontWeight: '700', color: '#868b94', marginTop: 12, marginBottom: 3 },
  fieldValue: { fontSize: FontSize.t7, color: '#17181c' },
  noteInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#d1d3d8',
    borderRadius: 6,
    padding: 10,
    fontSize: FontSize.t7,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  actionError: { fontSize: FontSize.t7, color: '#e53e3e', marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  approveBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center', backgroundColor: '#ff6f61' },
  approveBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  rejectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#f0f1f4',
    borderWidth: 1,
    borderColor: '#d0d3dc',
  },
  rejectBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: '#3a3b40' },
  btnDisabled: { opacity: 0.5 },
});
