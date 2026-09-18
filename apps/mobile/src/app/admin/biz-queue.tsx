import { Redirect } from 'expo-router';
/**
 * WP-ADM-023 업체 소유 확인 큐
 * WP-BIZ 관계자 인증 신청 · 확인 방법 · 승인 반려
 *
 * **이 화면이 읽는 것은 `structured.vendor_claims`다.** 이름이 「업체 문의」라
 * 오래 헷갈렸는데, 대시보드는 진작부터 이 자리를 「업체 소유 확인 대기」로 세고
 * 있었다(`dashboard-admin.ts`). 숫자가 가리키는 표에 화면을 맞췄다.
 *
 * **자동 분류 · 신뢰도 · 법적 위험 칸을 뺐다.** 명세(WP-ADM-023)의
 * 「저신뢰·법적 위험 건만 관리자 확인」은 채점기를 전제하는데 그런 것이 저장소에
 * 없고, 담을 칸도 DB에 없다. 없는 값을 0%로 그리면 운영자는 그것을 «신뢰도가
 * 낮다»로 읽는다 — 그리지 않는 편이 낫다. 「자동승인」 상태도 같은 이유로 뺐다.
 * 스키마가 그것을 일부러 막아 뒀다(0038 — 「자동 승인이 없다」).
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CLAIM_METHOD_RULES, type ClaimMethod } from '@weddingpick/domain';
import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';

type BizStatus = 'pending' | 'approved' | 'rejected';
type BizItem = {
  id: string;
  status: BizStatus;
  vendorName: string;
  officialDomain: string | null;
  claimedRole: string;
  method: ClaimMethod;
  contactEmail: string | null;
  listedAt: string | null;
  hasDocument: boolean;
  decisionNote: string | null;
  createdAt: string;
  /** 낸 주소가 공식 도메인과 같은가. **재료지 결론이 아니다**(0038). */
  domainMatches: boolean | null;
};

type BizData = { items: BizItem[]; total: number };

/*
 * 운영자가 읽는 말이다. 신청한 사람이 보는 `CLAIM_STATUS_LABEL`(「확인 중」 ·
 * 「확인 완료」)과 일부러 다르게 쓴다 — 여기서는 내가 무엇을 «했는가»가 보여야 한다.
 */
const STATUS_LABEL: Record<BizStatus, string> = {
  pending: '확인 대기',
  approved: '승인',
  rejected: '반려',
};
const STATUS_COLOR: Record<BizStatus, string> = {
  pending: Colors.light.cautionary,
  approved: Colors.light.positive,
  rejected: Colors.light.negative,
};

export function BizQueuePanel() {
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

  const canDecide = !acting && note.trim().length > 0;

  /* 할 일이 맨 위다. 처리가 끝난 것은 아래에 남겨 둔다 — 사라지면 놓친 것과 구별이 안 된다. */
  const needsReview = data?.items.filter((i) => i.status === 'pending') ?? [];
  const others = data?.items.filter((i) => i.status !== 'pending') ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>업체 소유 확인</Text>
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
                  ]}
                  onPress={() => { setSelected(item); setNote(''); setActionError(null); }}
                >
                  <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                      <Text style={styles.companyName} numberOfLines={1}>{item.vendorName}</Text>
                      <Text style={[styles.statusTag, { color: STATUS_COLOR[item.status] }]}>
                        {STATUS_LABEL[item.status]}
                      </Text>
                    </View>
                    <Text style={styles.rowSub}>
                      {item.claimedRole} · {CLAIM_METHOD_RULES[item.method].label}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {data.items.length === 0 && (
                <Text style={styles.emptyText}>확인할 신청이 없어요.</Text>
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
                <Text style={styles.detailTitle}>{selected.vendorName}</Text>
                <Text style={styles.detailSub}>
                  {selected.claimedRole} · {STATUS_LABEL[selected.status]}
                </Text>

                <Text style={styles.fieldLabel}>낸 때</Text>
                <Text style={styles.fieldValue}>
                  {selected.createdAt.slice(0, 16).replace('T', ' ')}
                </Text>

                <Text style={styles.fieldLabel}>확인 방법</Text>
                <Text style={styles.fieldValue}>{CLAIM_METHOD_RULES[selected.method].label}</Text>

                <Text style={styles.fieldLabel}>낸 주소</Text>
                <Text style={styles.fieldValue}>
                  {selected.contactEmail ?? '주소 없이 증빙으로 냈어요'}
                </Text>

                {selected.listedAt !== null && (
                  <>
                    <Text style={styles.fieldLabel}>어디에 적혀 있는지</Text>
                    <Text style={styles.fieldValue}>{selected.listedAt}</Text>
                  </>
                )}

                <Text style={styles.fieldLabel}>증빙</Text>
                <Text style={styles.fieldValue}>
                  {selected.hasDocument ? '받아 뒀어요' : '없어요'}
                </Text>

                {/*
                  * 도메인이 같다는 것은 «그 회사의 주소»라는 뜻이지 «신청한 사람이
                  * 그 주소를 쓴다»는 뜻이 아니다(0038). 그래서 「확인됨」이라고
                  * 적지 않는다 — 그렇게 적으면 읽는 사람이 결론으로 읽는다.
                  */}
                <Text style={styles.fieldLabel}>공식 도메인과 견주면</Text>
                <Text style={styles.fieldValue}>
                  {selected.domainMatches === null
                    ? '견줄 주소가 없어요'
                    : selected.domainMatches
                      ? `같아요 (${selected.officialDomain ?? ''})`
                      : '달라요'}
                </Text>
                <Text style={styles.fieldHint}>
                  회사 주소라는 것까지만 알 수 있어요. 신청한 분이 그 주소를 쓰는지는 연락해서 확인해요.
                </Text>

                {selected.status === 'pending' ? (
                  <>
                    <Text style={styles.fieldLabel}>사유</Text>
                    <TextInput
                      style={styles.noteInput}
                      multiline
                      numberOfLines={3}
                      value={note}
                      onChangeText={setNote}
                      placeholder="승인 · 반려 사유를 적어주세요"
                    />
                    {/* 신청한 사람이 이 글을 읽는다. 그래서 비워 둘 수 없다. */}
                    <Text style={styles.fieldHint}>신청하신 분에게 그대로 전해져요.</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>처리 사유</Text>
                    <Text style={styles.fieldValue}>{selected.decisionNote ?? '(없어요)'}</Text>
                  </>
                )}

                {actionError && <Text style={styles.actionError}>{actionError}</Text>}

                {/*
                  * 사유가 비면 잠근다. 서버도 같은 것을 요구하므로(`note` 최소 1자)
                  * 눌렀다가 400을 받는 대신 누르기 전에 알려준다.
                  */}
                {selected.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.approveBtn, !canDecide && styles.btnDisabled]}
                      onPress={() => void decide('approve')}
                      disabled={!canDecide}
                    >
                      <Text style={styles.approveBtnText}>{acting ? '처리 중…' : '승인'}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.rejectBtn, !canDecide && styles.btnDisabled]}
                      onPress={() => void decide('reject')}
                      disabled={!canDecide}
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
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
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
  body: { flex: 1, flexDirection: 'row' },
  listPanel: { flex: 1, backgroundColor: Colors.light.background, borderRightWidth: 1, borderRightColor: Colors.light.border },
  detailPanel: { width: 400, backgroundColor: Colors.light.background, padding: 20 },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.tint },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  groupHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.light.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  groupTitle: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive, textTransform: 'uppercase' as const },
  tableRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  tableRowZebra: { backgroundColor: Colors.light.backgroundElement },
  tableRowActive: { backgroundColor: 'rgba(255,111,97,0.08)' },
  rowMain: {},
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  companyName: { flex: 1, fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.text },
  statusTag: { fontSize: FontSize.tab, fontWeight: '700' },
  rowSub: { fontSize: FontSize.tab, color: Colors.light.textAssistive },
  emptyText: { fontSize: FontSize.t7, color: Colors.light.textAssistive, padding: 16 },
  detailTitle: { fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  detailSub: { fontSize: FontSize.t7, color: Colors.light.textAssistive, marginBottom: 16 },
  fieldLabel: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive, marginTop: 12, marginBottom: 3 },
  fieldValue: { fontSize: FontSize.t7, color: Colors.light.text },
  fieldHint: { fontSize: FontSize.tab, color: Colors.light.textAssistive, marginTop: 4 },
  noteInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    padding: 10,
    fontSize: FontSize.t7,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  actionError: { fontSize: FontSize.t7, color: Colors.light.negative, marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  approveBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center', backgroundColor: Colors.light.tint },
  approveBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  rejectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSelected,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
  },
  rejectBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textStrong },
  btnDisabled: { opacity: 0.5 },
});

/**
 * 옛 주소는 저장된 링크·딥링크가 있을 수 있어 남긴다. **대시보드의 「업체 소유 확인 대기」 줄도 이 주소로 온다**
 * (`admin/home.tsx`의 `SCREEN_PATH`). 실제 화면은 `/admin/vendors`(업체·행사)의 탭에 있다 —
 * `BizQueuePanel`이 이 파일의 본체다.
 */
export default function BizQueueRedirect() {
  return <Redirect href="/admin/vendors?tab=biz-queue" />;
}
