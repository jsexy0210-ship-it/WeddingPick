/**
 * WP-ADM-035 FAQ 관리 — 이제 「사이트·기록」 화면의 탭 하나(FAQ 관리 자신)다.
 * 운영자가 직접 등록·수정·삭제. 카테고리·노출 순서·공개 여부
 *
 * **2026-09-15 대표 확정 — 약관·방침 · 링크 미리보기 · 감사 기록과 탭으로 묶였다**
 * (넷 다 사용자에게 노출되는 문구·카드 또는 그 기록). 이 파일 맨 아래
 * `SiteContentShell`이 그 껍데기고, 여기 있던 본문은 `FaqPanel`로 이름만 바꿨다.
 *
 * **웨딩피드 관리는 2026-09-15에 다섯 번째 탭으로 붙었다.** `main`이 그 화면을
 * FAQ·링크 미리보기와 같은 「문구 · 카드」 묶음에 두고 있었고, 운영자가 직접 쓰고
 * 고치는 노출 콘텐츠라는 성격도 같아 이 탭 묶음에 넣었다.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FAQ_PLACEHOLDER_LABEL, FAQ_PLACEHOLDER_NAMES } from '@weddingpick/domain';
import { Colors, FontSize, LineHeight } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { AdminTabShell, ConfirmCard, type AdminTabDef } from './_ui';
import { TermsPanel } from './terms';
import { OgCardPanel } from './og-card';
import { AuditLogPanel } from './audit-log';
import { WeddingFeedPanel } from './wedding-feed';

type FaqItem = {
  id: string;
  /**
   * 코드에서 옮겨 온 항목의 고정 이름. 사용자 화면의 주소가 이 값이다.
   * 운영자가 새로 등록한 항목은 `null`이고, 그때는 행의 id가 주소가 된다.
   */
  key: string | null;
  category: string;
  question: string;
  /** 자리를 채운 글. 목록에 보여주는 것은 이쪽 — 사용자가 읽을 문장이다. */
  answer: string;
  /** 채우기 «전» 글. 고치는 것은 이쪽이다. */
  answerSource: string;
  order: number;
  published: boolean;
};

type FaqData = { items: FaqItem[]; categories: string[] };

const BLANK_FAQ: Omit<FaqItem, 'id'> = {
  key: null,
  category: '',
  question: '',
  answer: '',
  answerSource: '',
  order: 0,
  published: false,
};

/**
 * 답에 쓸 수 있는 자리.
 *
 * **적어 두지 않으면 외워야 한다.** 이름은 `packages/domain/src/faq.ts` 한 곳에서
 * 오고, 여기 적히는 설명도 같은 파일에서 온다 — 두 군데에 적으면 화면이 「쓸 수
 * 있다」고 말한 이름을 서버가 모르는 날이 온다.
 */
function PlaceholderHelp() {
  return (
    <View style={styles.helpBox}>
      <Text style={styles.helpTitle}>답변에 쓸 수 있는 자리</Text>
      {FAQ_PLACEHOLDER_NAMES.map((name) => (
        <Text key={name} style={styles.helpLine}>
          {`{{${name}}}`} — {FAQ_PLACEHOLDER_LABEL[name]}
        </Text>
      ))}
      <Text style={styles.helpNote}>
        이대로 적어두면 보여줄 때 지금 기준 건수로 바뀌어요. 기준이 바뀌어도 문장을 다시
        고치지 않아도 돼요. 목록에 없는 이름은 저장할 때 알려드려요.
      </Text>
    </View>
  );
}

function FaqPanel() {
  const [data, setData] = useState<FaqData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [editing, setEditing] = useState<(FaqItem | Omit<FaqItem, 'id'>) | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /*
   * 지우기 전에 무엇이 사라지는지 보여준다(CLAUDE.md 관리자 공통 규칙 — 「위험한
   * 조작은 무엇이 바뀌는지 항목으로 보여준 뒤 한 번 더 확인」). 전에는 단추 한 번에
   * 바로 지워졌고, 코드에서 옮겨 온 항목까지 지울 수 있게 되면서 그 한 번이 사용자
   * 화면에서 질문 하나를 없애는 일이 됐다.
   */
  const [asking, setAsking] = useState<FaqItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/faq')
      .then((d) => {
        if (cancelled) return;
        setData(d as FaqData);
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

  function openNew() {
    setEditing({ ...BLANK_FAQ });
    setIsNew(true);
    setSaveError(null);
  }

  function openEdit(item: FaqItem) {
    /* 고치는 것은 «채우기 전» 글이다. 채운 글을 되돌려 저장하면 숫자가 글자로 굳는다. */
    setEditing({ ...item, answer: item.answerSource });
    setIsNew(false);
    setSaveError(null);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (isNew) {
        await apiFetch('/v1/admin/faq', {
          method: 'POST',
          body: JSON.stringify(editing),
        });
      } else {
        const item = editing as FaqItem;
        await apiFetch(`/v1/admin/faq/${item.id}`, {
          method: 'PUT',
          body: JSON.stringify(editing),
        });
      }
      setEditing(null);
      setRev((r) => r + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function deleteFaq(item: FaqItem) {
    setAsking(null);
    setDeleting(item.id);
    setDeleteError(null);
    try {
      await apiFetch(`/v1/admin/faq/${item.id}`, { method: 'DELETE' });
      setRev((r) => r + 1);
    } catch (e) {
      /*
       * 삼키지 않는다. 지우지 못했는데 목록이 그대로면 운영자에게는 「눌렀는데
       * 아무 일도 안 일어난다」로만 보인다 — 서버가 거절한 것인지 내가 잘못 본
       * 것인지 알 수가 없다. 이유를 그대로 적는다.
       */
      setDeleteError(e instanceof Error ? e.message : '삭제 실패');
    } finally { setDeleting(null); }
  }

  /*
   * 고를 수 있는 묶음. 서버가 준 목록에 지금 화면에 떠 있는 묶음을 합친다.
   *
   * **예전에는 「코드에 있는 항목」 묶음을 여기서 뺐다.** 코드에 든 FAQ가 그 이름으로
   * 겹쳐 오고 거기에는 새로 넣을 수 없었기 때문이다. 2026-09-16 대표 지시로 그 항목이
   * 전부 표로 내려와서 **뺄 묶음이 없다** — 보이는 묶음은 전부 실제로 넣을 수 있다.
   */
  const categoryChoices = Array.from(
    new Set([...(data?.categories ?? []), ...(data?.items ?? []).map((i) => i.category)])
  ).filter(Boolean);

  const grouped = data?.items.reduce<Record<string, FaqItem[]>>((acc, item) => {
    const cat = item.category || '기타';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {}) ?? {};

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>FAQ 관리</Text>
        <Pressable style={styles.addBtn} onPress={openNew}>
          <Text style={styles.addBtnText}>+ 새 FAQ</Text>
        </Pressable>
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

      {deleteError && (
        <View style={styles.actionErrorBox}>
          <Text style={styles.actionErrorText}>{deleteError}</Text>
        </View>
      )}

      {!loading && !error && data && (
        <ScrollView>
          {Object.entries(grouped).map(([cat, items]) => (
            <View key={cat}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryLabel}>{cat}</Text>
              </View>
              {items.sort((a, b) => a.order - b.order).map((item, i) => (
                <View key={item.id} style={[styles.faqRow, i % 2 === 1 && styles.faqRowZebra]}>
                  <View style={styles.faqMain}>
                    <View style={styles.faqTopRow}>
                      <Text style={styles.faqQ} numberOfLines={1}>{item.question}</Text>
                      <Text style={[styles.faqPublished, { color: item.published ? Colors.light.positive : Colors.light.textAssistive }]}>
                        {item.published ? '공개' : '비공개'}
                      </Text>
                      <Text style={styles.faqOrder}>순서 {item.order}</Text>
                    </View>
                    <Text style={styles.faqA} numberOfLines={2}>{item.answer}</Text>
                  </View>
                  <View style={styles.faqActions}>
                    <Pressable style={styles.editBtn} onPress={() => openEdit(item)}>
                      <Text style={styles.editBtnText}>수정</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.deleteBtn, deleting === item.id && styles.btnDisabled]}
                      onPress={() => setAsking(item)}
                      disabled={deleting !== null}
                    >
                      <Text style={styles.deleteBtnText}>{deleting === item.id ? '…' : '삭제'}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* 편집 모달 */}
      <Modal visible={editing !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{isNew ? '새 FAQ 추가' : 'FAQ 수정'}</Text>
            {editing && (
              <>
                <Text style={styles.fieldLabel}>카테고리</Text>
                {/*
                  * **이미 있는 묶음에서 고른다.** 예전에는 빈 칸에 직접 적었는데,
                  * 이 화면도 사용자 FAQ도 이 «글자»로 묶는다 — 「예약」을 「예약 」이나
                  * 「에약」으로 적으면 그 글이 아무 묶음에도 들어가지 않고 혼자 새
                  * 묶음을 만든다. 웨딩피드 카테고리가 같은 꼴로 사고를 냈다.
                  *
                  * 목록은 서버가 이미 보내준다(`categories`) — 화면이 안 쓰고 있었다.
                  * 새 묶음이 필요한 때는 있으므로 직접 적는 길은 남기되, 고르는 쪽을
                  * 먼저 보여준다.
                  */}
                {categoryChoices.length > 0 && (
                  <View style={styles.categoryChips}>
                    {categoryChoices.map((c) => {
                      const on = editing.category === c;
                      return (
                        <Pressable
                          key={c}
                          style={[styles.categoryChip, on && styles.categoryChipOn]}
                          onPress={() => setEditing((prev) => prev ? { ...prev, category: c } : prev)}
                        >
                          <Text style={[styles.categoryChipText, on && styles.categoryChipTextOn]}>{c}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                <TextInput
                  style={styles.fieldInput}
                  value={editing.category}
                  onChangeText={(v) => setEditing((prev) => prev ? { ...prev, category: v } : prev)}
                  placeholder="위에서 고르거나, 새 묶음이면 직접 적어주세요"
                />
                <Text style={styles.fieldLabel}>질문</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editing.question}
                  onChangeText={(v) => setEditing((prev) => prev ? { ...prev, question: v } : prev)}
                  placeholder="질문을 입력하세요"
                />
                <Text style={styles.fieldLabel}>답변</Text>
                <TextInput
                  style={[styles.fieldInput, styles.multilineInput]}
                  multiline
                  numberOfLines={4}
                  value={editing.answer}
                  onChangeText={(v) => setEditing((prev) => prev ? { ...prev, answer: v } : prev)}
                  placeholder="답변을 입력하세요"
                  textAlignVertical="top"
                />
                <Text style={styles.fieldLabel}>노출 순서</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={String(editing.order)}
                  onChangeText={(v) => {
                    const n = parseInt(v, 10);
                    setEditing((prev) => prev ? { ...prev, order: isNaN(n) ? 0 : n } : prev);
                  }}
                  keyboardType="numeric"
                />
                <View style={styles.publishRow}>
                  <Text style={styles.publishLabel}>공개 여부</Text>
                  <Switch
                    value={editing.published}
                    onValueChange={(v) => setEditing((prev) => prev ? { ...prev, published: v } : prev)}
                    trackColor={{ true: Colors.light.tint }}
                  />
                </View>
                <PlaceholderHelp />
                {saveError && <Text style={styles.saveError}>{saveError}</Text>}
                <View style={styles.modalActions}>
                  <Pressable
                    style={[styles.cancelBtn]}
                    onPress={() => setEditing(null)}
                    disabled={saving}
                  >
                    <Text style={styles.cancelBtnText}>취소</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.saveBtn, saving && styles.btnDisabled]}
                    onPress={() => void save()}
                    disabled={saving}
                  >
                    <Text style={styles.saveBtnText}>{saving ? '저장 중…' : '저장'}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 지우기 전 확인. 무엇이 사라지는지 항목으로 적는다. */}
      <Modal visible={asking !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {asking ? (
            <ConfirmCard
              title="이 질문을 지울까요?"
              body={`「${asking.question}」 — 지우면 되돌릴 수 없어요.`}
              items={[
                asking.published
                  ? '사용자 화면의 자주 묻는 것에서 바로 사라져요'
                  : '비공개 항목이라 사용자 화면은 그대로예요',
                '이 질문의 답도 함께 지워져요',
                asking.key
                  ? `이 질문으로 가는 주소(/my/faq/${asking.key})가 「찾는 질문이 없어요」로 바뀌어요`
                  : '이 질문으로 가는 주소가 「찾는 질문이 없어요」로 바뀌어요',
                '지운 뒤에는 다시 등록해야 해요 — 되살리는 단추가 없어요',
              ]}
              cta="지우기"
              danger
              onConfirm={() => void deleteFaq(asking)}
              onCancel={() => setAsking(null)}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const TABS: AdminTabDef[] = [
  { key: 'faq', label: 'FAQ 관리' },
  { key: 'terms', label: '약관 · 방침' },
  { key: 'og-card', label: '링크 미리보기' },
  { key: 'audit-log', label: '감사 기록' },
  { key: 'wedding-feed', label: '웨딩피드 관리' },
];

/**
 * 「사이트·기록」 — FAQ 관리 · 약관·방침 · 링크 미리보기 · 감사 기록 · 웨딩피드
 * 관리를 탭 다섯으로 묶는다.
 *
 * **약관·방침의 「조회만」 딱지는 2026-09-16에 뗐다** — 대표 지시 「개인정보처리방침
 * 이용약관 마케팅 약관도 동일하게 내가 수정가능하도록 하고」. 본문이 표로 왔고
 * (마이그레이션 0422) 서버가 편집·공개를 받는다.
 *
 * **정본이 웹사이트라는 규칙은 그대로다.** 여기서 고친 것을 웹이 읽어 그린다 —
 * 사본이 둘이 되는 것이 아니라, 그 하나가 코드에서 표로 옮겨간 것이다.
 * 딱지를 뗄 때 화면 안쪽 잠금도 같이 지웠다(`terms.tsx`). 한쪽만 지우면 말이
 * 어긋나고, `test/admin-read-only-pairing.test.ts`가 그 어긋남을 잡는다.
 */
export default function SiteContentShell() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initial = TABS.some((t) => t.key === tab) ? (tab as string) : 'faq';
  const [active, setActive] = useState(initial);

  return (
    <AdminTabShell tabs={TABS} active={active} onChange={setActive}>
      {active === 'faq' && <FaqPanel />}
      {active === 'terms' && <TermsPanel />}
      {active === 'og-card' && <OgCardPanel />}
      {active === 'audit-log' && <AuditLogPanel />}
      {active === 'wedding-feed' && <WeddingFeedPanel />}
    </AdminTabShell>
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
    gap: 8,
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, backgroundColor: Colors.light.tint },
  addBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.light.backgroundSelected },
  refreshText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.tint },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  categoryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.light.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  categoryLabel: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textSecondary },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  faqRowZebra: { backgroundColor: Colors.light.backgroundElement },
  faqMain: { flex: 1, marginRight: 12 },
  faqTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  faqQ: { flex: 1, fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.text },
  faqPublished: { fontSize: FontSize.tab, fontWeight: '700' },
  faqOrder: { fontSize: FontSize.tab, color: Colors.light.textAssistive },
  faqA: { fontSize: FontSize.tab, color: Colors.light.textAssistive, lineHeight: LineHeight.micro },
  faqActions: { flexDirection: 'row', gap: 6 },
  helpBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 6,
    backgroundColor: Colors.light.backgroundSelected,
    gap: 4,
  },
  helpTitle: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textStrong },
  helpLine: { fontSize: FontSize.tab, color: Colors.light.textSecondary },
  helpNote: {
    fontSize: FontSize.tab,
    color: Colors.light.textAssistive,
    lineHeight: LineHeight.micro,
    marginTop: 4,
  },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: Colors.light.backgroundSelected,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
  },
  editBtnText: { fontSize: FontSize.tab, color: Colors.light.textStrong },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: Colors.light.negativeBoxBackground,
    borderWidth: 1,
    borderColor: Colors.light.negativeBorder,
  },
  deleteBtnText: { fontSize: FontSize.tab, color: Colors.light.negative, fontWeight: '700' },
  /* 삭제 실패를 적는 자리. 목록 위에 걸려 무엇이 안 됐는지 먼저 읽힌다. */
  actionErrorBox: {
    marginHorizontal: 24,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: Colors.light.negativeBoxBackground,
    borderWidth: 1,
    borderColor: Colors.light.negativeBorder,
  },
  actionErrorText: { fontSize: FontSize.t7, color: Colors.light.negative, fontWeight: '600' },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.track,
    backgroundColor: Colors.light.background,
  },
  categoryChipOn: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  categoryChipText: { fontSize: FontSize.tab, color: Colors.light.textSecondary },
  categoryChipTextOn: { color: Colors.light.onTint, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: Colors.light.background, borderRadius: 14, padding: 24, width: 520, maxHeight: '85%' },
  modalTitle: { fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text, marginBottom: 16 },
  fieldLabel: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textAssistive, marginBottom: 6, marginTop: 12 },
  fieldInput: {
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 40,
    fontSize: FontSize.t7,
  },
  multilineInput: { height: 96, paddingTop: 10 },
  publishRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 12 },
  publishLabel: { flex: 1, fontSize: FontSize.t7, color: Colors.light.text },
  saveError: { fontSize: FontSize.t7, color: Colors.light.negative, marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSelected,
  },
  cancelBtnText: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  saveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: Colors.light.tint,
  },
  saveBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  btnDisabled: { opacity: 0.5 },
});
