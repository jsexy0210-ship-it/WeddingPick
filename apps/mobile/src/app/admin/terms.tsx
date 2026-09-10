/**
 * WP-ADM-036 약관 · 방침 관리
 * 조문 단위 편집, 저장하면 새 버전. 공개는 별도 단추
 */
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, FontSize, LineHeight } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { formatDateDot } from '@/features/common/format-date';
import { ConfirmCard } from './_ui';

type DocType = 'terms' | 'privacy' | 'marketing';
type TermsVersion = {
  version: string;
  publishedAt: string | null;
  isDraft: boolean;
};
type TermsClause = {
  id: string;
  articleNumber: string;
  title: string;
  body: string;
};
type TermsDoc = {
  type: DocType;
  label: string;
  currentVersion: string;
  latestDraftVersion: string | null;
  publishedAt: string | null;
  versions: TermsVersion[];
  clauses: TermsClause[];
};

type TermsData = { documents: TermsDoc[] };

const DOC_LABEL: Record<DocType, string> = {
  terms: '이용약관',
  privacy: '개인정보처리방침',
  marketing: '마케팅 정보 수신 동의',
};

export default function TermsScreen() {
  const [data, setData] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [activeDoc, setActiveDoc] = useState<DocType>('terms');
  const [editingClause, setEditingClause] = useState<TermsClause | null>(null);
  const [clauseBody, setClauseBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  /** 공개를 확인받는 중. 공개한 판은 다시 고칠 수 없어 한 번 더 묻는다(v3.27). */
  const [askingPublish, setAskingPublish] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/terms')
      .then((d) => {
        if (cancelled) return;
        setData(d as TermsData);
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

  const activeDocData = data?.documents.find((d) => d.type === activeDoc);

  function openClause(clause: TermsClause) {
    setEditingClause(clause);
    setClauseBody(clause.body);
    setActionError(null);
  }

  async function saveClause() {
    if (!editingClause) return;
    setSaving(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/terms/${activeDoc}/clauses/${editingClause.id}`, {
        method: 'PUT',
        body: JSON.stringify({ body: clauseBody }),
      });
      setEditingClause(null);
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!activeDocData?.latestDraftVersion) return;
    setPublishing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/terms/${activeDoc}/publish`, { method: 'POST' });
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '공개 실패');
    } finally {
      setPublishing(false);
      // 실패해도 닫는다 — 창이 떠 있으면 오류 문구가 창에 가린다.
      setAskingPublish(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>약관 · 방침 관리</Text>
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
          {/* 문서 탭 */}
          <View style={styles.docTabs}>
            {data.documents.map((doc) => (
              <Pressable
                key={doc.type}
                style={[styles.docTab, activeDoc === doc.type && styles.docTabActive]}
                onPress={() => setActiveDoc(doc.type)}
              >
                <Text style={[styles.docTabText, activeDoc === doc.type && styles.docTabTextActive]}>
                  {DOC_LABEL[doc.type]}
                </Text>
                {doc.latestDraftVersion && (
                  <View style={styles.draftDot} />
                )}
              </Pressable>
            ))}
          </View>

          {activeDocData && (
            <View style={styles.docBody}>
              <View style={styles.docMeta}>
                <View>
                  <Text style={styles.versionText}>
                    현재 공개 버전: {activeDocData.currentVersion}
                  </Text>
                  {activeDocData.publishedAt && (
                    <Text style={styles.dateText}>
                      공개일: {formatDateDot(activeDocData.publishedAt)}
                    </Text>
                  )}
                  {activeDocData.latestDraftVersion && (
                    <Text style={styles.draftText}>
                      미공개 초안: {activeDocData.latestDraftVersion}
                    </Text>
                  )}
                </View>
                {activeDocData.latestDraftVersion && (
                  <Pressable
                    style={[styles.publishBtn, publishing && styles.btnDisabled]}
                    onPress={() => { setActionError(null); setAskingPublish(true); }}
                    disabled={publishing}
                  >
                    <Text style={styles.publishBtnText}>
                      {publishing ? '공개 중…' : '초안 공개'}
                    </Text>
                  </Pressable>
                )}
              </View>

              {actionError && (
                <Text style={styles.actionError}>{actionError}</Text>
              )}

              <ScrollView>
                {activeDocData.clauses.map((clause, i) => (
                  <View key={clause.id} style={[styles.clauseRow, i % 2 === 1 && styles.clauseRowZebra]}>
                    <View style={styles.clauseMain}>
                      <Text style={styles.clauseArticle}>{clause.articleNumber}. {clause.title}</Text>
                      <Text style={styles.clauseBody} numberOfLines={3}>{clause.body}</Text>
                    </View>
                    <Pressable style={styles.editBtn} onPress={() => openClause(clause)}>
                      <Text style={styles.editBtnText}>수정</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* 조문 편집 모달 */}
      <Modal visible={editingClause !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editingClause?.articleNumber}. {editingClause?.title}
            </Text>
            <Text style={styles.modalSub}>저장하면 새 초안 버전이 만들어져요.</Text>
            <TextInput
              style={styles.clauseInput}
              multiline
              value={clauseBody}
              onChangeText={setClauseBody}
              textAlignVertical="top"
            />
            {actionError && <Text style={styles.saveError}>{actionError}</Text>}
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditingClause(null)} disabled={saving}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                onPress={() => void saveClause()}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? '저장 중…' : '저장'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/*
        공개한 판은 얼어붙는다 — 사용자가 동의한 글이라 나중에 고칠 수 없다.
        무엇이 바뀌는지 항목으로 보인 뒤 한 번 더 확인한다(v3.27).
      */}
      {/*
        공개한 판은 얼어붙는다 — 사용자가 동의한 글이라 나중에 고칠 수 없다.
        무엇이 바뀌는지 항목으로 보인 뒤 진행한다(v3.27).
      */}
      {askingPublish && activeDocData ? (
        <ConfirmCard
          title="초안을 공개할까요?"
          body="공개한 판의 조문은 다시 고칠 수 없어요."
          items={[
            `${activeDocData.label} ${activeDocData.latestDraftVersion ?? ''} 판이 공개돼요`,
            '공개된 조문은 잠기고, 이어서 고칠 새 초안이 만들어져요',
            '사용자에게 이 판이 현행으로 보여요',
            '공개한 사람과 시각이 감사 기록에 남아요',
          ]}
          cta="초안 공개"
          danger
          onConfirm={() => void publish()}
          onCancel={() => setAskingPublish(false)}
        />
      ) : null}

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
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.tint },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  docTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingHorizontal: 16,
  },
  docTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  docTabActive: { borderBottomColor: Colors.light.tint },
  docTabText: { fontSize: FontSize.t7, color: Colors.light.textAssistive },
  docTabTextActive: { color: Colors.light.tint, fontWeight: '700' },
  draftDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.light.cautionary },
  docBody: { flex: 1 },
  docMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.light.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  versionText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.text },
  dateText: { fontSize: FontSize.tab, color: Colors.light.textAssistive, marginTop: 2 },
  draftText: { fontSize: FontSize.tab, color: Colors.light.cautionary, marginTop: 2 },
  publishBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
  },
  publishBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  actionError: { fontSize: FontSize.t7, color: Colors.light.negative, padding: 12 },
  clauseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  clauseRowZebra: { backgroundColor: Colors.light.backgroundElement },
  clauseMain: { flex: 1, marginRight: 12 },
  clauseArticle: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  clauseBody: { fontSize: FontSize.t7, color: Colors.light.textSecondary, lineHeight: LineHeight.t7 },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: Colors.light.backgroundSelected,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    flexShrink: 0,
  },
  editBtnText: { fontSize: FontSize.tab, color: Colors.light.textStrong },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: Colors.light.background, borderRadius: 14, padding: 24, width: 600, maxHeight: '85%' },
  modalTitle: { fontSize: FontSize.t6, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  modalSub: { fontSize: FontSize.t7, color: Colors.light.textAssistive, marginBottom: 12 },
  clauseInput: {
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    padding: 12,
    fontSize: FontSize.t7,
    minHeight: 240,
    lineHeight: LineHeight.t6,
  },
  saveError: { fontSize: FontSize.t7, color: Colors.light.negative, marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center', backgroundColor: Colors.light.backgroundSelected },
  cancelBtnText: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  saveBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center', backgroundColor: Colors.light.tint },
  saveBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  btnDisabled: { opacity: 0.5 },
});
