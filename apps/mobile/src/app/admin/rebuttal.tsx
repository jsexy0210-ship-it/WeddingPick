import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { ConfirmDecision } from '@/features/admin/confirm-decision';
import { formatDateDot, formatDateTimeDot } from '@/features/common/format-date';

type PendingRebuttal = {
  id: string;
  claimedRole: string;
  vendorName: string;
  createdAt: string;
};

/**
 * `GET /v1/admin/rebuttals/:id`가 주는 상세.
 *
 * **목록만으로는 판단할 수 없다.** 목록에는 업체명 · 본인이 밝힌 소속 · 접수일뿐이라,
 * 정작 무엇이라고 반박했는지와 어떤 후기에 붙는지가 화면에 없었다. 읽지 않고 누르는
 * 단추는 동작하는 것이 아니다.
 *
 * `verifiedRole`은 **승인된 관계자 인증**에서 온다. 이게 없으면 서버가 게시를 거절한다 —
 * 소속을 무엇으로 확인했는지가 글이 아니라 구조로 남아야 하기 때문이다.
 */
type RebuttalDetail = {
  id: string;
  claimedRole: string;
  body: string;
  vendorName: string;
  reviewTitle: string;
  reviewBody: string;
  reviewOverall: number;
  /** 승인된 관계자 인증에 적힌 소속. 없으면 인증이 없다는 뜻이다. */
  verifiedRole: string | null;
};


export default function RebuttalScreen() {
  const [items, setItems] = useState<PendingRebuttal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [selected, setSelected] = useState<PendingRebuttal | null>(null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** 확인을 기다리는 결정. 누른 즉시 보내지 않는다 — 둘 다 되돌릴 수 없다. */
  const [pending, setPending] = useState<'publish' | 'reject' | null>(null);
  const [detail, setDetail] = useState<RebuttalDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  /** 관계자 인증 없이, 앱 밖에서 소속을 확인했다고 운영자가 밝힌 경우. */
  const [offlineCheck, setOfflineCheck] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/v1/admin/rebuttals')
      .then((data) => {
        if (cancelled) return;
        const raw = data as { rebuttals?: PendingRebuttal[] } | PendingRebuttal[];
        setItems(Array.isArray(raw) ? raw : (raw.rebuttals ?? []));
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
   * 고른 항목의 상세를 따로 불러온다. 목록 응답에는 반론 본문도, 어떤 후기에 붙는지도,
   * 관계자 인증이 있는지도 없다.
   */
  useEffect(() => {
    if (!selected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(null);
      return;
    }

    let cancelled = false;

    apiFetch(`/v1/admin/rebuttals/${selected.id}`)
      .then((data) => {
        if (cancelled) return;
        setDetail(data as RebuttalDetail);
        setDetailError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setDetailError(e instanceof Error ? e.message : '상세 불러오기 실패');
      });

    return () => { cancelled = true; };
  }, [selected]);

  function reload() { setLoading(true); setRev((r) => r + 1); }

  /**
   * 결정을 확인 단계로 넘긴다. 메모가 비었는지는 여기서 먼저 본다 — 확인
   * 화면까지 갔다가 「사유를 입력해주세요」로 돌아오면 두 번 눌러야 한다.
   */
  function ask(action: 'publish' | 'reject') {
    if (!note.trim()) {
      setActionError('사유(메모)를 입력해주세요.');
      return;
    }

    /*
     * 인증도 없고 밖에서 확인했다는 표시도 없으면 서버가 거절한다. 눌러서 실패를
     * 보여주는 대신 여기서 무엇이 모자란지 말한다.
     */
    if (action === 'publish') {
      if (detail === null) {
        setActionError('반론 상세를 아직 못 읽었어요. 잠시 뒤에 다시 눌러주세요.');
        return;
      }

      if (detail.verifiedRole === null && !offlineCheck) {
        setActionError(
          '관계자 인증이 없어요. 밖에서 확인했다면 아래를 표시하고 무엇으로 확인했는지 메모에 적어주세요.'
        );
        return;
      }
    }

    setActionError(null);
    setPending(action);
  }

  async function act(action: 'publish' | 'reject') {
    if (!selected) return;
    if (!note.trim()) {
      setActionError('사유(메모)를 입력해주세요.');
      return;
    }
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/rebuttals/${selected.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(
          action === 'publish' && offlineCheck
            ? { note: note.trim(), withoutClaim: true }
            : { note: note.trim() }
        ),
      });
      setPending(null);
      setSelected(null);
      setNote('');
      setOfflineCheck(false);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>후기 · 반론</Text>
        <Pressable style={styles.refreshBtn} onPress={reload}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.list}>
          <DelayedLoader active={loading} size={40} style={styles.centered} />
          {!loading && error && <Text style={styles.errorText}>{error}</Text>}
          {!loading && !error && (
            <ScrollView>
              <View style={styles.tableHead}>
                <Text style={[styles.th, styles.colId]}>ID</Text>
                <Text style={[styles.th, styles.colVendor]}>업체명</Text>
                <Text style={[styles.th, styles.colRole]}>소속</Text>
                <Text style={[styles.th, styles.colDate]}>접수일</Text>
              </View>
              {items.length === 0 && (
                <Text style={styles.emptyText}>확인 대기 반론이 없어요.</Text>
              )}
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.tableRow, selected?.id === item.id && styles.tableRowActive]}
                  onPress={() => {
                    setSelected(item);
                    setNote('');
                    setActionError(null);
                    setPending(null);
                    setOfflineCheck(false);
                    setDetailError(null);
                  }}
                >
                  <Text style={[styles.td, styles.colId, styles.monoText]} numberOfLines={1}>
                    {item.id.slice(0, 8)}…
                  </Text>
                  <Text style={[styles.td, styles.colVendor]} numberOfLines={1}>
                    {item.vendorName}
                  </Text>
                  <Text style={[styles.td, styles.colRole]} numberOfLines={1}>
                    {item.claimedRole}
                  </Text>
                  <Text style={[styles.td, styles.colDate]}>
                    {formatDateDot(item.createdAt)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.detail}>
          {!selected ? (
            <View style={styles.detailEmpty}>
              <Text style={styles.emptyText}>왼쪽에서 항목을 선택하세요</Text>
            </View>
          ) : (
            <ScrollView>
              <Text style={styles.detailSectionTitle}>반론 정보</Text>

              <Text style={styles.detailLabel}>반론 ID</Text>
              <Text style={styles.detailValue}>{selected.id}</Text>

              <Text style={styles.detailLabel}>업체명</Text>
              <Text style={styles.detailValue}>{selected.vendorName}</Text>

              <Text style={styles.detailLabel}>본인이 밝힌 소속</Text>
              <Text style={styles.detailValue}>{selected.claimedRole}</Text>

              <Text style={styles.detailLabel}>관계자 인증</Text>
              <Text
                style={[
                  styles.detailValue,
                  detail?.verifiedRole == null && styles.unverifiedText,
                ]}
              >
                {detail === null
                  ? '불러오는 중'
                  : detail.verifiedRole !== null
                    ? `승인됨 · ${detail.verifiedRole}`
                    : '없음 · 이대로는 실을 수 없어요'}
              </Text>

              <Text style={styles.detailLabel}>접수일</Text>
              <Text style={styles.detailValue}>
                {formatDateTimeDot(selected.createdAt)}
              </Text>

              {detailError && <Text style={styles.actionErrorText}>{detailError}</Text>}

              {detail && (
                <>
                  <Text style={[styles.detailSectionTitle, { marginTop: 24 }]}>이의가 걸린 후기</Text>

                  <Text style={styles.detailLabel}>제목 · 별점</Text>
                  <Text style={styles.detailValue}>
                    {detail.reviewTitle} · {detail.reviewOverall}점
                  </Text>

                  <Text style={styles.detailLabel}>후기 본문</Text>
                  <Text style={styles.longText}>{detail.reviewBody}</Text>

                  <Text style={[styles.detailSectionTitle, { marginTop: 24 }]}>업체가 보낸 반론</Text>
                  <Text style={styles.longText}>{detail.body}</Text>
                </>
              )}

              <Text style={[styles.detailSectionTitle, { marginTop: 24 }]}>결정</Text>
              <Text style={styles.detailHint}>
                게시 시 소속을 무엇으로 확인했는지, 게시 불가 시 그 사유를 적어주세요.
                적은 글은 반론을 보낸 쪽에 그대로 전달됩니다.
              </Text>

              <Text style={styles.detailLabel}>메모 / 사유 (필수)</Text>
              <TextInput
                style={styles.noteInput}
                multiline
                numberOfLines={3}
                placeholder="소속 확인 방법 또는 게시 불가 사유"
                value={note}
                onChangeText={setNote}
              />

              {detail?.verifiedRole === null && (
                <Pressable
                  style={styles.offlineRow}
                  onPress={() => setOfflineCheck((on) => !on)}
                  disabled={acting}
                >
                  <View style={[styles.checkbox, offlineCheck && styles.checkboxOn]}>
                    {offlineCheck && <Text style={styles.checkboxMark}>✓</Text>}
                  </View>
                  <Text style={styles.offlineText}>
                    관계자 인증 없이, 앱 밖에서 소속을 확인했어요
                  </Text>
                </Pressable>
              )}

              {actionError && <Text style={styles.actionErrorText}>{actionError}</Text>}

              {pending === null ? (
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.publishBtn, acting && styles.btnDisabled]}
                    onPress={() => ask('publish')}
                    disabled={acting}
                  >
                    <Text style={styles.publishBtnText}>게시</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.rejectBtn, acting && styles.btnDisabled]}
                    onPress={() => ask('reject')}
                    disabled={acting}
                  >
                    <Text style={styles.rejectBtnText}>게시 불가</Text>
                  </Pressable>
                </View>
              ) : (
                <ConfirmDecision
                  question={
                    pending === 'publish'
                      ? '이 반론을 후기 옆에 실을까요?'
                      : '이 반론을 싣지 않기로 할까요?'
                  }
                  changes={
                    pending === 'publish'
                      ? [
                          `${selected.vendorName} 후기 옆에 이 반론이 나란히 보입니다.`,
                          offlineCheck
                            ? '소속을 앱 밖에서 확인한 것으로 기록됩니다.'
                            : '소속을 관계자 인증으로 확인한 것으로 기록됩니다.',
                          '반론을 보낸 쪽과 후기를 쓴 쪽 모두에게 알림이 갑니다.',
                          '큐에서 빠지고 되돌릴 수 없어요.',
                        ]
                      : [
                          '이 반론은 어디에도 실리지 않습니다.',
                          '적은 사유가 반론을 보낸 쪽에 그대로 전달됩니다.',
                          '큐에서 빠지고 되돌릴 수 없어요.',
                        ]
                  }
                  confirmLabel={pending === 'publish' ? '게시' : '게시 불가'}
                  tone={pending === 'publish' ? 'primary' : 'danger'}
                  busy={acting}
                  onConfirm={() => void act(pending)}
                  onCancel={() => setPending(null)}
                />
              )}
            </ScrollView>
          )}
        </View>
      </View>
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
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.light.backgroundSelected,
  },
  refreshText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  body: { flex: 1, flexDirection: 'row' },
  list: { flex: 1, backgroundColor: Colors.light.background, borderRightWidth: 1, borderRightColor: Colors.light.border },
  detail: { width: 428, backgroundColor: Colors.light.background, padding: 24 },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centered: { marginTop: 40 },
  emptyText: { color: Colors.light.textAssistive, fontSize: FontSize.t7, padding: 24 },
  errorText: { color: Colors.light.negative, fontSize: FontSize.t7, padding: 24 },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  tableRowActive: { backgroundColor: 'rgba(255,111,97,0.08)' },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive, textTransform: 'uppercase' },
  td: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  colId: { width: 96 },
  colVendor: { flex: 1 },
  colRole: { width: 120 },
  colDate: { width: 100 },
  monoText: { color: Colors.light.textSecondary },
  detailSectionTitle: { fontSize: FontSize.badge, fontWeight: '700', color: Colors.light.textAssistive, marginBottom: 12 },
  detailLabel: { fontSize: FontSize.tab, fontWeight: '600', color: Colors.light.textAssistive, marginBottom: 3, marginTop: 14 },
  detailValue: { fontSize: FontSize.t7, color: Colors.light.text },
  detailHint: { fontSize: FontSize.badge, color: Colors.light.textAssistive, marginBottom: 8 },
  noteInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    padding: 10,
    fontSize: FontSize.t7,
    color: Colors.light.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionErrorText: { color: Colors.light.negative, fontSize: FontSize.t7, marginTop: 8 },
  unverifiedText: { color: Colors.light.negative, fontWeight: '600' },
  longText: { fontSize: FontSize.t7, color: Colors.light.text, lineHeight: 20 },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  checkboxMark: { color: Colors.light.background, fontSize: FontSize.tab, fontWeight: '700' },
  offlineText: { flex: 1, fontSize: FontSize.t7, color: Colors.light.textStrong },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  publishBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: Colors.light.tint,
  },
  publishBtnText: { fontSize: FontSize.t7, fontWeight: '600', color: Colors.light.background },
  rejectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSelected,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
  },
  rejectBtnText: { fontSize: FontSize.t7, fontWeight: '600', color: Colors.light.textStrong },
  btnDisabled: { opacity: 0.5 },
});
