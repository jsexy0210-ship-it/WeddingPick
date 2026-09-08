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

import { FontSize, LineHeight } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { formatDateDot } from '@/features/common/format-date';

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
                    onPress={() => void publish()}
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
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: '#e53e3e', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: '#ff6f61' },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  docTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
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
  docTabActive: { borderBottomColor: '#ff6f61' },
  docTabText: { fontSize: FontSize.t7, color: '#868b94' },
  docTabTextActive: { color: '#ff6f61', fontWeight: '700' },
  draftDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#805217' },
  docBody: { flex: 1 },
  docMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
  },
  versionText: { fontSize: FontSize.t7, fontWeight: '700', color: '#17181c' },
  dateText: { fontSize: FontSize.tab, color: '#868b94', marginTop: 2 },
  draftText: { fontSize: FontSize.tab, color: '#805217', marginTop: 2 },
  publishBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#ff6f61',
  },
  publishBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  actionError: { fontSize: FontSize.t7, color: '#e53e3e', padding: 12 },
  clauseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f1f4',
  },
  clauseRowZebra: { backgroundColor: '#fafbfc' },
  clauseMain: { flex: 1, marginRight: 12 },
  clauseArticle: { fontSize: FontSize.t7, fontWeight: '700', color: '#17181c', marginBottom: 4 },
  clauseBody: { fontSize: FontSize.t7, color: '#5a5d6a', lineHeight: LineHeight.t7 },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#f2f3f6',
    borderWidth: 1,
    borderColor: '#d1d3d8',
    flexShrink: 0,
  },
  editBtnText: { fontSize: FontSize.tab, color: '#3a3b40' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 14, padding: 24, width: 600, maxHeight: '85%' },
  modalTitle: { fontSize: FontSize.t6, fontWeight: '700', color: '#17181c', marginBottom: 4 },
  modalSub: { fontSize: FontSize.t7, color: '#868b94', marginBottom: 12 },
  clauseInput: {
    borderWidth: 1,
    borderColor: '#d1d3d8',
    borderRadius: 6,
    padding: 12,
    fontSize: FontSize.t7,
    minHeight: 240,
    lineHeight: LineHeight.t6,
  },
  saveError: { fontSize: FontSize.t7, color: '#e53e3e', marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center', backgroundColor: '#f2f3f6' },
  cancelBtnText: { fontSize: FontSize.t7, color: '#3a3b40' },
  saveBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center', backgroundColor: '#ff6f61' },
  saveBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  btnDisabled: { opacity: 0.5 },
});
