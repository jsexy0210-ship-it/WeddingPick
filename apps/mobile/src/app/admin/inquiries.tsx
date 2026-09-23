import { Redirect } from 'expo-router';
/**
 * WP-ADM 문의 처리 — `/v1/admin/inquiries`.
 *
 * **2026-09-23 관리자-프론트 연결 재검증에서 찾은 빈 자리를 잇는다.** 서버 쪽은
 * 이미 완성돼 있었다(`inquiry-admin.ts`의 `list`/`show`/`moveStatus`, 라우트는
 * `apps/api/src/routes/admin.ts` 「── 문의 ──」). 문의하기(`my/contact.tsx`) ·
 * 고객지원(`my/support.tsx`) · 정보 오류 제보(`search/[vendorId]/fix-report.tsx`)가
 * 전부 같은 `structured.inquiries`로 모이는데, 그걸 읽어 답하는 화면이 하나도
 * 없었다 — 사람이 `npm run inquiries -- --answer`를 터미널에서 돌려야 했다.
 * 대표님이 「회원의 모든 활동과 모든 정보를 확인할 수 있어야 한다」고 확인한 자리다.
 *
 * `biz-queue.tsx`(업체 소유 확인)와 같은 골격이다 — 왼쪽 목록 · 오른쪽 상세 ·
 * 사유를 적고 결정한다. 다른 점은 결정이 둘(승인/반려)이 아니라 「확인 시작」과
 * 「답변 완료」 둘이고, 플래너를 가리키는 문의(등록 요청 · 노출 중단)에는 그 결정과
 * 함께 플래너 상태를 바꾸는 체크박스가 붙는다는 것뿐이다.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  INQUIRY_CATEGORY_RULES,
  type InquiryCategory,
  type InquiryStatus,
} from '@weddingpick/domain';
import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { formatDateTimeDot } from '@/features/common/format-date';
import { apiFetch } from './_api';

type PendingInquiry = {
  id: string;
  category: InquiryCategory;
  status: InquiryStatus;
  receivedAt: string;
  subjectKind: string | null;
  subjectId: string | null;
};

type InquiryEvent = {
  fromStatus: InquiryStatus | null;
  toStatus: InquiryStatus;
  note: string | null;
  createdAt: string;
};

type InquiryDetail = PendingInquiry & {
  body: string;
  contact: string | null;
  resolution: string | null;
  events: InquiryEvent[];
};

/*
 * 운영자가 읽는 말. `INQUIRY_STATUS_LABEL`은 사용자에게 나가는 말이라
 * `received`·`in_review`가 둘 다 「확인 중」으로 뭉친다 — 여기서는 둘을
 * 구별해야 「아직 손 안 댔다」와 「보고 있다」가 갈린다.
 */
const OPERATOR_STATUS_LABEL: Record<InquiryStatus, string> = {
  received: '접수',
  in_review: '확인 중',
  answered: '답변 완료',
  closed: '종료됨',
};
const STATUS_COLOR: Record<InquiryStatus, string> = {
  received: Colors.light.cautionary,
  in_review: Colors.light.cautionary,
  answered: Colors.light.positive,
  closed: Colors.light.textAssistive,
};

export function InquiryPanel() {
  const [items, setItems] = useState<PendingInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InquiryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resolution, setResolution] = useState('');
  const [withdrawPlanner, setWithdrawPlanner] = useState(false);
  const [listPlanner, setListPlanner] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/inquiries')
      .then((data) => {
        if (cancelled) return;
        setItems((data as { inquiries: PendingInquiry[] }).inquiries);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rev]);

  useEffect(() => {
    if (!selectedId) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetailLoading(true);
    apiFetch(`/v1/admin/inquiries/${selectedId}`)
      .then((data) => {
        if (cancelled) return;
        setDetail(data as InquiryDetail);
        setDetailLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setActionError(e instanceof Error ? e.message : '상세 불러오기 실패');
        setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function select(item: PendingInquiry) {
    setSelectedId(item.id);
    setResolution('');
    setWithdrawPlanner(false);
    setListPlanner(false);
    setActionError(null);
  }

  function reload() {
    setRev((r) => r + 1);
  }

  async function startReview() {
    if (!detail) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/inquiries/${detail.id}/review`, { method: 'POST' });
      setDetail({ ...detail, status: 'in_review' });
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  async function answer() {
    if (!detail || resolution.trim().length === 0) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/inquiries/${detail.id}/answer`, {
        method: 'POST',
        body: JSON.stringify({
          resolution: resolution.trim(),
          withdrawPlanner: withdrawPlanner || undefined,
          listPlanner: listPlanner || undefined,
        }),
      });
      setSelectedId(null);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  const pending = items.filter((i) => i.status === 'received' || i.status === 'in_review');
  const done = items.filter((i) => i.status === 'answered' || i.status === 'closed');
  const isPlannerSubject = detail?.subjectKind === 'planner';
  const canAnswer = !acting && resolution.trim().length > 0;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>문의</Text>
        <Pressable style={styles.refreshBtn} onPress={reload}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      <DelayedLoader active={loading} size={40} style={styles.centered} />
      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={reload}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && (
        <View style={styles.body}>
          <View style={styles.listPanel}>
            <ScrollView>
              {pending.length > 0 && (
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>확인 필요 ({pending.length})</Text>
                </View>
              )}
              {[...pending, ...done].map((item, i) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.tableRow,
                    i % 2 === 1 && styles.tableRowZebra,
                    selectedId === item.id && styles.tableRowActive,
                  ]}
                  onPress={() => select(item)}>
                  <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {INQUIRY_CATEGORY_RULES[item.category].label}
                      </Text>
                      <Text style={[styles.statusTag, { color: STATUS_COLOR[item.status] }]}>
                        {OPERATOR_STATUS_LABEL[item.status]}
                      </Text>
                    </View>
                    <Text style={styles.rowSub}>{formatDateTimeDot(item.receivedAt)}</Text>
                  </View>
                </Pressable>
              ))}
              {items.length === 0 && <Text style={styles.emptyText}>확인할 문의가 없어요.</Text>}
            </ScrollView>
          </View>

          <View style={styles.detailPanel}>
            {!selectedId ? (
              <View style={styles.detailEmpty}>
                <Text style={styles.emptyText}>왼쪽에서 항목을 선택하세요</Text>
              </View>
            ) : detailLoading || !detail ? (
              <DelayedLoader active size={40} style={styles.centered} />
            ) : (
              <ScrollView>
                <Text style={styles.detailTitle}>{INQUIRY_CATEGORY_RULES[detail.category].label}</Text>
                <Text style={styles.detailSub}>
                  {OPERATOR_STATUS_LABEL[detail.status]} · {formatDateTimeDot(detail.receivedAt)}
                </Text>

                <Text style={styles.fieldLabel}>내용</Text>
                <Text style={styles.fieldValue}>{detail.body}</Text>

                <Text style={styles.fieldLabel}>회신처</Text>
                <Text style={styles.fieldValue}>{detail.contact ?? '(앱 알림으로 답해요)'}</Text>

                {detail.subjectKind && (
                  <>
                    <Text style={styles.fieldLabel}>가리키는 대상</Text>
                    <Text style={styles.fieldValue}>
                      {detail.subjectKind}:{detail.subjectId}
                    </Text>
                  </>
                )}

                {detail.events.length > 0 && (
                  <>
                    <Text style={[styles.fieldLabel, { marginTop: 20 }]}>처리 이력</Text>
                    {detail.events.map((event, i) => (
                      <Text key={i} style={styles.historyLine}>
                        {formatDateTimeDot(event.createdAt)} · {event.fromStatus ? OPERATOR_STATUS_LABEL[event.fromStatus] : '접수'} →{' '}
                        {OPERATOR_STATUS_LABEL[event.toStatus]}
                        {event.note ? ` (${event.note})` : ''}
                      </Text>
                    ))}
                  </>
                )}

                {detail.status === 'answered' || detail.status === 'closed' ? (
                  <>
                    <Text style={[styles.fieldLabel, { marginTop: 20 }]}>보낸 답변</Text>
                    <Text style={styles.fieldValue}>{detail.resolution ?? '(없어요)'}</Text>
                  </>
                ) : (
                  <>
                    {detail.status === 'received' && (
                      <Pressable
                        style={[styles.reviewBtn, acting && styles.btnDisabled]}
                        onPress={() => void startReview()}
                        disabled={acting}>
                        <Text style={styles.reviewBtnText}>확인 시작</Text>
                      </Pressable>
                    )}

                    <Text style={[styles.fieldLabel, { marginTop: 20 }]}>답변</Text>
                    <TextInput
                      style={styles.noteInput}
                      multiline
                      numberOfLines={4}
                      value={resolution}
                      onChangeText={setResolution}
                      placeholder="처리 결과를 적어주세요"
                    />
                    <Text style={styles.fieldHint}>문의하신 분에게 그대로 전해져요.</Text>

                    {detail.category === 'planner_delisting' && isPlannerSubject && (
                      <Pressable
                        style={styles.checkboxRow}
                        onPress={() => setWithdrawPlanner((v) => !v)}>
                        <View style={[styles.checkbox, withdrawPlanner && styles.checkboxOn]} />
                        <Text style={styles.checkboxLabel}>플래너를 검색에서 내린다(되돌릴 수 없어요)</Text>
                      </Pressable>
                    )}
                    {detail.category === 'planner_listing' && isPlannerSubject && (
                      <Pressable style={styles.checkboxRow} onPress={() => setListPlanner((v) => !v)}>
                        <View style={[styles.checkbox, listPlanner && styles.checkboxOn]} />
                        <Text style={styles.checkboxLabel}>플래너를 검색에 올린다</Text>
                      </Pressable>
                    )}

                    {actionError && <Text style={styles.actionError}>{actionError}</Text>}

                    <Pressable
                      style={[styles.answerBtn, !canAnswer && styles.btnDisabled]}
                      onPress={() => void answer()}
                      disabled={!canAnswer}>
                      <Text style={styles.answerBtnText}>{acting ? '처리 중…' : '답변 완료'}</Text>
                    </Pressable>
                  </>
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
  detailPanel: { width: 420, backgroundColor: Colors.light.background, padding: 20 },
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
  rowTitle: { flex: 1, fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.text },
  statusTag: { fontSize: FontSize.tab, fontWeight: '700' },
  rowSub: { fontSize: FontSize.tab, color: Colors.light.textAssistive },
  emptyText: { fontSize: FontSize.t7, color: Colors.light.textAssistive, padding: 16 },
  detailTitle: { fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  detailSub: { fontSize: FontSize.t7, color: Colors.light.textAssistive, marginBottom: 16 },
  fieldLabel: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive, marginTop: 12, marginBottom: 3 },
  fieldValue: { fontSize: FontSize.t7, color: Colors.light.text },
  fieldHint: { fontSize: FontSize.tab, color: Colors.light.textAssistive, marginTop: 4 },
  historyLine: { fontSize: FontSize.tab, color: Colors.light.textSecondary, marginTop: 4 },
  noteInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    padding: 10,
    fontSize: FontSize.t7,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  actionError: { fontSize: FontSize.t7, color: Colors.light.negative, marginTop: 8 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: Colors.light.fieldBorder },
  checkboxOn: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  checkboxLabel: { fontSize: FontSize.tab, color: Colors.light.textSecondary, flex: 1 },
  reviewBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSelected,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
  },
  reviewBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textStrong },
  answerBtn: { marginTop: 16, paddingVertical: 10, borderRadius: 6, alignItems: 'center', backgroundColor: Colors.light.tint },
  answerBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  btnDisabled: { opacity: 0.5 },
});

/** 딥링크·저장된 링크를 위해 주소를 남긴다. 실제 화면은 `/admin/queue`(확인 필요)의 탭이다. */
export default function InquiriesRedirect() {
  return <Redirect href="/admin/queue?tab=inquiries" />;
}
