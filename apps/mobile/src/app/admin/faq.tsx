/**
 * WP-ADM-035 FAQ 관리
 * 운영자가 직접 등록·수정·삭제. 카테고리·노출 순서·공개 여부
 */
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

import { Colors, FontSize, LineHeight } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';

type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
  order: number;
  published: boolean;
};

type FaqData = { items: FaqItem[]; categories: string[] };

const BLANK_FAQ: Omit<FaqItem, 'id'> = {
  category: '',
  question: '',
  answer: '',
  order: 0,
  published: false,
};

export default function FaqScreen() {
  const [data, setData] = useState<FaqData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [editing, setEditing] = useState<(FaqItem | Omit<FaqItem, 'id'>) | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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
    setEditing({ ...item });
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

  async function deleteFaq(id: string) {
    setDeleting(id);
    try {
      await apiFetch(`/v1/admin/faq/${id}`, { method: 'DELETE' });
      setRev((r) => r + 1);
    } catch { /* 무시 */ } finally { setDeleting(null); }
  }

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
                      onPress={() => void deleteFaq(item.id)}
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
                <TextInput
                  style={styles.fieldInput}
                  value={editing.category}
                  onChangeText={(v) => setEditing((prev) => prev ? { ...prev, category: v } : prev)}
                  placeholder="카테고리명"
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
