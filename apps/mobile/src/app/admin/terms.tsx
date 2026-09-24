import { Redirect } from 'expo-router';
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

/*
 * **2026-09-16에 이 화면이 열렸다.** 대표 지시 — 「개인정보처리방침 이용약관 마케팅
 * 약관도 동일하게 내가 수정가능하도록 하고」.
 *
 * 전까지 이 화면에는 화면 안쪽 잠금 상수가 켜져 있었고, 서버도 `termsUnavailable()`로
 * 막고 있었다. 그 문구가 적은 「앱 약관·동의 기록에 연결한 뒤」가 0422이다 —
 * 본문이 표로 왔고 동의 기록이 판을 가리킨다.
 *
 * **이 주석에 그 상수 이름을 적지 않는다.** `test/admin-read-only-pairing.test.ts`가
 * 화면 파일에서 그 글자를 «글자 그대로» 찾아 「아직 잠긴 화면」을 센다 — 지나간
 * 이야기를 적어 둔 줄 하나 때문에 이 화면이 다시 잠긴 것으로 세어진다.
 *
 * **사이드바의 「조회만」 딱지도 같이 뗐다**(`faq.tsx`의 `TABS`). 한쪽만 지우면
 * 말이 어긋난다 — 목록은 「조회만」이라 적고 화면은 저장되는 상태가 된다.
 */

type DocType =
  | 'terms'
  | 'privacy'
  | 'marketing'
  | 'pick_verification'
  | 'consultation_recording'
  | 'contact_sharing';
type TermsVersion = {
  version: string;
  publishedAt: string | null;
  effectiveOn: string | null;
  isDraft: boolean;
};
type TermsClauseTable = { lead: string | null; cols: { label: string }[]; rows: string[][] };
type TermsClause = {
  id: string;
  articleNumber: string;
  title: string;
  body: string;
  /** 표 모양 조문이면 채워져 있다. 방침의 세 절이 그렇다. */
  bodyTable: TermsClauseTable | null;
  /** 지우거나 비울 때 한 번 더 확인받을 절이면 그 사유(0422). */
  removalWarning: string | null;
};
type TermsDoc = {
  type: DocType;
  label: string;
  currentVersion: string;
  latestDraftVersion: string | null;
  publishedAt: string | null;
  effectiveOn: string | null;
  versions: TermsVersion[];
  clauses: TermsClause[];
};

type TermsData = { documents: TermsDoc[] };

const DOC_LABEL: Record<DocType, string> = {
  terms: '이용약관',
  privacy: '개인정보처리방침',
  marketing: '마케팅 정보 수신 동의',
  pick_verification: 'Pick 인증 자료 수집·이용 동의',
  consultation_recording: '상담 녹음 수집·이용 동의',
  contact_sharing: '상담 예약 시 업체 연락처 제공 동의',
};

/** 시안(WP-ADM-036)의 버전 상태 셋. 초안은 아직 공개 전, 공개 중은 지금 사용자가 보는 판이다. */
type VersionState = '공개 중' | '초안' | '지난 버전';

function versionState(v: TermsVersion, currentVersion: string): VersionState {
  if (v.isDraft) return '초안';
  return v.version === currentVersion ? '공개 중' : '지난 버전';
}

export function TermsPanel() {
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
  /** 공개할 판의 시행일. 저장한 날과 효력이 생기는 날은 다르다. */
  const [effectiveOn, setEffectiveOn] = useState('');
  /**
   * 국외 이전 · 수탁자 절에서 무엇이 사라지는지 서버가 보내온 것.
   *
   * 막는 것이 아니라 가르는 것이다 — 알고 지우는 것과 모르고 지우는 것(0422).
   */
  const [askingRemoval, setAskingRemoval] = useState<{ warning: string; removing: string[] } | null>(null);
  /** 표 모양 조문을 고치는 중이면 그 표. 방침의 세 절이 여기에 해당한다. */
  const [clauseTable, setClauseTable] = useState<TermsClauseTable | null>(null);
  /**
   * 조문을 새로 더하는 중.
   *
   * **마케팅 정보 수신 동의가 이 길로 시작한다** — 저장소에 본문이 한 번도 없어서
   * 빈 초안만 있다. 더하는 자리가 없으면 「수정 가능하도록」이 반만 열린 셈이다.
   */
  const [addingClause, setAddingClause] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  /** 지우려는 조문. 보호 표시가 붙었으면 서버가 무엇이 사라지는지 먼저 보낸다. */
  const [deletingClause, setDeletingClause] = useState<TermsClause | null>(null);
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
    setClauseTable(clause.bodyTable);
    setActionError(null);
  }

  /**
   * 표의 한 줄을 지운다.
   *
   * 지우는 순간 저장하지 않는다 — 저장할 때 서버가 무엇이 사라지는지 세어
   * 한 번 더 묻는다. 여기서 바로 보내면 그 관문을 화면이 건너뛰게 된다.
   */
  function dropTableRow(index: number) {
    setClauseTable((table) =>
      table === null ? null : { ...table, rows: table.rows.filter((_, i) => i !== index) }
    );
  }

  /**
   * 새 초안을 만든다.
   *
   * **0422가 심은 판은 공개돼 있다** — 이미 웹사이트에 나가 있던 글이라 「아직 공개
   * 전」이 아니다. 공개된 판의 조문은 얼어 있으므로, 고치려면 먼저 초안을 만든다.
   * 공개된 판의 조문을 그대로 물려받아 시작한다.
   */
  async function createDraft() {
    setSaving(true);
    setActionError(null);
    try {
      await apiFetch('/v1/admin/terms', {
        method: 'POST',
        body: JSON.stringify({ doc: activeDoc }),
      });
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '초안 만들기 실패');
    } finally {
      setSaving(false);
    }
  }

  async function addClause() {
    setSaving(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/terms/${activeDoc}/clauses`, {
        method: 'POST',
        body: JSON.stringify({ title: newTitle, body: clauseBody }),
      });
      setAddingClause(false);
      setNewTitle('');
      setClauseBody('');
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '추가 실패');
    } finally {
      setSaving(false);
    }
  }

  /** 조문을 지운다. 보호 표시가 붙은 절은 서버가 한 번 더 묻는다(0422). */
  async function deleteClause(clause: TermsClause, confirm = false) {
    setSaving(true);
    setActionError(null);
    try {
      const result = (await apiFetch(
        `/v1/admin/terms/${activeDoc}/clauses/${clause.id}?confirm=${confirm ? 'true' : 'false'}`,
        { method: 'DELETE' }
      )) as { saved: boolean; warning?: string; removing?: string[] };

      if (!result.saved) {
        setDeletingClause(clause);
        setAskingRemoval({ warning: result.warning ?? '', removing: result.removing ?? [] });
        return;
      }

      setDeletingClause(null);
      setAskingRemoval(null);
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setSaving(false);
    }
  }

  /**
   * 조문을 저장한다.
   *
   * 국외 이전 · 수탁자 절에서 항목이 사라지면 서버가 저장하지 않고
   * `{ saved: false, removing }`을 돌려준다. 그때 무엇이 사라지는지 항목으로
   * 보인 뒤 `confirm`을 붙여 다시 보낸다(v3.27 · 0422).
   */
  async function saveClause(confirm = false) {
    if (!editingClause) return;
    setSaving(true);
    setActionError(null);
    try {
      const result = (await apiFetch(`/v1/admin/terms/${activeDoc}/clauses/${editingClause.id}`, {
        method: 'PUT',
        body: JSON.stringify({ body: clauseBody, bodyTable: clauseTable, confirm }),
      })) as { saved: boolean; warning?: string; removing?: string[] };

      if (!result.saved) {
        setAskingRemoval({ warning: result.warning ?? '', removing: result.removing ?? [] });
        return;
      }

      setAskingRemoval(null);
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
      await apiFetch(`/v1/admin/terms/${activeDoc}/publish`, {
        method: 'POST',
        body: JSON.stringify({ effectiveOn }),
      });
      setEffectiveOn('');
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
        {activeDocData && !activeDocData.latestDraftVersion && (
          <Pressable
            style={[styles.addBtn, saving && styles.btnDisabled]}
            disabled={saving}
            onPress={() => void createDraft()}
          >
            <Text style={styles.addBtnText}>{saving ? '만드는 중…' : '새 초안 만들기'}</Text>
          </Pressable>
        )}
        {activeDocData?.latestDraftVersion && (
          <Pressable
            style={styles.addBtn}
            onPress={() => { setNewTitle(''); setClauseBody(''); setClauseTable(null); setActionError(null); setAddingClause(true); }}
          >
            <Text style={styles.addBtnText}>조문 추가</Text>
          </Pressable>
        )}
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      {/*
        * **정본은 여전히 하나다.** CLAUDE.md의 「약관과 개인정보처리방침의 정본은
        * 웹사이트다」(2026-09-11 대표 지시)가 막는 것은 사본이 둘이 되는 것이고,
        * 그 위험은 그대로다. 2026-09-16 지시로 바뀐 것은 그 하나가 코드가 아니라
        * 표라는 것뿐이다 — 여기서 고치면 웹이 그것을 읽어 그린다.
        */}
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
                  {activeDocData.effectiveOn && (
                    <Text style={styles.dateText}>
                      시행일: {formatDateDot(activeDocData.effectiveOn)}
                    </Text>
                  )}
                  {activeDocData.latestDraftVersion && (
                    <Text style={styles.draftText}>
                      미공개 초안: {activeDocData.latestDraftVersion}
                    </Text>
                  )}
                </View>
                {activeDocData.latestDraftVersion && (
                  <View style={styles.publishGroup}>
                    {/*
                      저장한 날과 효력이 생기는 날은 다르다. 약관 변경은 시행일을
                      미리 알리고 그날부터 적용한다(이용약관 제3조 · 방침 제13항).
                    */}
                    <View>
                      <Text style={styles.effectiveLabel}>시행일</Text>
                      <TextInput
                        style={styles.effectiveInput}
                        value={effectiveOn}
                        onChangeText={setEffectiveOn}
                        placeholder="2026-10-01"
                        placeholderTextColor={Colors.light.textAssistive}
                      />
                    </View>
                    <Pressable
                      style={[styles.publishBtn, (publishing || effectiveOn.trim() === '') && styles.btnDisabled]}
                      onPress={() => { setActionError(null); setAskingPublish(true); }}
                      disabled={publishing || effectiveOn.trim() === ''}
                    >
                      <Text style={styles.publishBtnText}>
                        {publishing ? '공개 중…' : '초안 공개'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {actionError && (
                <Text style={styles.actionError}>{actionError}</Text>
              )}

              <View style={styles.docSplit}>
              <ScrollView style={styles.clauseScroll}>
                {/*
                  빈 상태가 정상 상태다(v3.27). 마케팅 동의는 저장소에 본문이 한 번도
                  없었다 — 「고장 났다」가 아니라 「아직 안 쓰셨다」이고, 다음에 무엇을
                  하면 되는지를 말한다.
                */}
                {activeDocData.clauses.length === 0 && (
                  <Text style={styles.emptyText}>
                    {activeDocData.latestDraftVersion
                      ? '아직 조문이 없어요. 위의 「조문 추가」로 첫 조문을 넣어주세요.'
                      : '아직 조문이 없어요. 위의 「새 초안 만들기」부터 눌러주세요.'}
                  </Text>
                )}
                {activeDocData.clauses.map((clause, i) => (
                  <View key={clause.id} style={[styles.clauseRow, i % 2 === 1 && styles.clauseRowZebra]}>
                    <View style={styles.clauseMain}>
                      <Text style={styles.clauseArticle}>{clause.title}</Text>
                      {clause.bodyTable ? (
                        <Text style={styles.clauseBody} numberOfLines={2}>
                          표 {clause.bodyTable.rows.length}줄 · {clause.bodyTable.cols.map((c) => c.label).join(' · ')}
                        </Text>
                      ) : (
                        <Text style={styles.clauseBody} numberOfLines={3}>{clause.body}</Text>
                      )}
                      {/* 지우면 고지가 빠지는 절. 목록에서부터 보인다 — 열고 나서 알면 늦다. */}
                      {clause.removalWarning && (
                        <Text style={styles.protectedNote}>{clause.removalWarning}</Text>
                      )}
                    </View>
                    {/*
                      공개된 판을 보고 있으면 고칠 수 없다 — 단추를 눌러도 서버가
                      거절하므로, 눌리지 않게 두고 위의 「새 초안 만들기」로 보낸다.
                    */}
                    <Pressable
                      style={[styles.editBtn, !activeDocData.latestDraftVersion && styles.btnDisabled]}
                      disabled={!activeDocData.latestDraftVersion}
                      onPress={() => openClause(clause)}
                    >
                      <Text style={styles.editBtnText}>수정</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.editBtn, !activeDocData.latestDraftVersion && styles.btnDisabled]}
                      disabled={!activeDocData.latestDraftVersion}
                      onPress={() => void deleteClause(clause)}
                    >
                      <Text style={styles.deleteBtnText}>삭제</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>

              {/*
                버전 이력. 서버가 `versions`를 내려주는데 화면이 버리고 있었다 —
                v3.28 시안(WP-ADM-036)은 이 자리를 오른쪽 기둥으로 그린다.
                상태 셋은 시안 그대로 «공개 중 · 초안 · 지난 버전»이고, 색은
                SEED 토큰이 시안 값과 같다(positive #1aa174 · cautionary #805217).
              */}
              <View style={styles.versionAside}>
                <Text style={styles.versionAsideLabel}>버전 이력</Text>
                <ScrollView>
                  {activeDocData.versions.map((v) => {
                    const state = versionState(v, activeDocData.currentVersion);
                    return (
                      <View key={`${v.version}-${v.publishedAt ?? 'draft'}`} style={styles.versionRow}>
                        <View style={[styles.versionDot, VERSION_DOT[state]]} />
                        <View style={styles.versionRowMain}>
                          <Text style={[styles.versionRowTitle, state === '지난 버전' && styles.versionRowTitleMuted]}>
                            {v.version}
                          </Text>
                          <Text style={styles.versionRowWhen}>
                            {v.publishedAt ? formatDateDot(v.publishedAt) : '공개 전'}
                            {v.effectiveOn ? ` · 시행 ${formatDateDot(v.effectiveOn)}` : ''}
                          </Text>
                        </View>
                        <Text style={[styles.versionBadge, VERSION_BADGE[state]]}>{state}</Text>
                      </View>
                    );
                  })}
                  {activeDocData.versions.length === 0 && (
                    <Text style={styles.versionEmpty}>아직 만들어진 판이 없어요.</Text>
                  )}
                </ScrollView>
                <Text style={styles.versionAsideNote}>
                  공개된 버전은 수정하지 않고 새 버전으로 올려요. 이전 버전은 사용자도 볼 수 있게 남겨둬요.
                </Text>
              </View>
              </View>{/* docSplit — 조문 목록 + 버전 이력 */}
            </View>
          )}
        </View>
      )}

      {/* 조문 편집 모달 */}
      <Modal visible={editingClause !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox} contentContainerStyle={styles.modalBoxContent}>
            <Text style={styles.modalTitle}>{editingClause?.title}</Text>
            <Text style={styles.modalSub}>
              {clauseTable
                ? '표 앞에 붙는 설명이에요. 줄은 아래에서 지울 수 있어요.'
                : '엔터로 줄을 나누면 조항이 나뉘어요. 지금 보고 있는 초안에 저장돼요.'}
            </Text>
            <TextInput
              style={styles.clauseInput}
              multiline
              value={clauseBody}
              onChangeText={setClauseBody}
              textAlignVertical="top"
            />
            {/*
              표 모양 조문. 수탁자 한 곳이 목록에서 빠지는 것이 가장 위험하고 가장
              눈에 안 띄어서, 줄마다 무엇인지를 적고 지우는 단추를 따로 둔다.
            */}
            {clauseTable && (
              <ScrollView style={styles.tableBox}>
                {clauseTable.rows.map((row, i) => (
                  <View key={`${row[0] ?? ''}-${i}`} style={styles.tableRow}>
                    <Text style={styles.tableCell} numberOfLines={2}>{row.join(' · ')}</Text>
                    <Pressable style={styles.rowDropBtn} onPress={() => dropTableRow(i)}>
                      <Text style={styles.rowDropText}>줄 지우기</Text>
                    </Pressable>
                  </View>
                ))}
                {clauseTable.rows.length === 0 && (
                  <Text style={styles.tableEmpty}>줄이 하나도 없어요.</Text>
                )}
              </ScrollView>
            )}
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
          </ScrollView>
        </View>
      </Modal>

      {/* 조문 더하기. 제목은 화면에 그대로 그려진다 — 「제1조 목적」처럼 번호를 안에 적는다. */}
      <Modal visible={addingClause} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox} contentContainerStyle={styles.modalBoxContent}>
            <Text style={styles.modalTitle}>조문 추가</Text>
            <Text style={styles.modalSub}>
              제목은 화면에 그대로 나와요 — 「제1조 목적」처럼 번호를 안에 적어주세요.
            </Text>
            <TextInput
              style={styles.titleInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="제1조 목적"
              placeholderTextColor={Colors.light.textAssistive}
            />
            <TextInput
              style={styles.clauseInput}
              multiline
              value={clauseBody}
              onChangeText={setClauseBody}
              textAlignVertical="top"
              placeholder="엔터로 줄을 나누면 조항이 나뉘어요."
              placeholderTextColor={Colors.light.textAssistive}
            />
            {actionError && <Text style={styles.saveError}>{actionError}</Text>}
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setAddingClause(false)} disabled={saving}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                onPress={() => void addClause()}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? '추가 중…' : '추가'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/*
        **국외 이전 · 수탁자 절에서 항목이 사라질 때.**

        고지가 이전보다 먼저다(개인정보보호법 제28조의8 · 제26조). 막지는 않는다 —
        대표님이 고치실 수 있어야 한다. 가르는 것은 알고 지우는 것과 모르고 지우는
        것이고, 그래서 무엇이 사라지는지 항목으로 먼저 보인다(v3.27).
      */}
      {askingRemoval ? (
        <ConfirmCard
          title="이 항목들이 방침에서 빠져요"
          body={askingRemoval.warning}
          items={askingRemoval.removing}
          cta={deletingClause ? '알겠어요, 지울게요' : '알겠어요, 저장할게요'}
          danger
          onConfirm={() =>
            void (deletingClause ? deleteClause(deletingClause, true) : saveClause(true))
          }
          onCancel={() => { setAskingRemoval(null); setDeletingClause(null); }}
        />
      ) : null}

      {/*
        공개한 판은 얼어붙는다 — 사용자가 동의한 글이라 나중에 고칠 수 없다.
        무엇이 바뀌는지 항목으로 보인 뒤 한 번 더 확인한다(v3.27).
      */}
      {askingPublish && activeDocData ? (
        <ConfirmCard
          title="초안을 공개할까요?"
          body="공개한 판의 조문은 다시 고칠 수 없어요."
          items={[
            `${activeDocData.label} ${activeDocData.latestDraftVersion ?? ''} 판이 공개돼요`,
            `시행일은 ${effectiveOn.trim()}이에요`,
            '공개된 조문은 잠기고, 이어서 고칠 새 초안이 만들어져요',
            '웹사이트를 다시 배포하면 사용자에게 이 판이 보여요',
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
  publishGroup: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  effectiveLabel: { fontSize: FontSize.tab, color: Colors.light.textAssistive, marginBottom: 4 },
  effectiveInput: {
    width: 120,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    backgroundColor: Colors.light.background,
    fontSize: FontSize.t7,
    color: Colors.light.text,
  },
  protectedNote: { fontSize: FontSize.tab, color: Colors.light.cautionary, marginTop: 6 },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
    marginRight: 8,
  },
  addBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  deleteBtnText: { fontSize: FontSize.tab, color: Colors.light.negative },
  emptyText: {
    fontSize: FontSize.t7,
    color: Colors.light.textAssistive,
    padding: 24,
    textAlign: 'center',
  },
  titleInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    backgroundColor: Colors.light.background,
    fontSize: FontSize.t7,
    color: Colors.light.text,
    marginBottom: 10,
  },
  tableBox: { maxHeight: 220, marginTop: 12 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
    gap: 12,
  },
  tableCell: { flex: 1, fontSize: FontSize.tab, color: Colors.light.textSecondary },
  rowDropBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    flexShrink: 0,
  },
  rowDropText: { fontSize: FontSize.tab, color: Colors.light.negative },
  tableEmpty: { fontSize: FontSize.tab, color: Colors.light.textAssistive, paddingVertical: 12 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  modalBox: { backgroundColor: Colors.light.background, borderRadius: 14, width: '100%', maxWidth: 600, maxHeight: '85%' },
  modalBoxContent: { padding: 24 },
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
  docSplit: { flex: 1, flexDirection: 'row' },
  clauseScroll: { flex: 1 },
  versionAside: {
    width: 380,
    flexShrink: 0,
    padding: 28,
    borderLeftWidth: 1,
    borderLeftColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  versionAsideLabel: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textSecondary, marginBottom: 6 },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 56,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  versionDot: { width: 8, height: 8, borderRadius: 4, marginTop: 8, flexShrink: 0 },
  versionRowMain: { flex: 1, minWidth: 0, gap: 2 },
  versionRowTitle: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.text },
  versionRowTitleMuted: { color: Colors.light.textAssistive },
  versionRowWhen: { fontSize: FontSize.tab, color: Colors.light.textAssistive },
  versionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: FontSize.tab,
    fontWeight: '700',
    overflow: 'hidden',
  },
  versionEmpty: { fontSize: FontSize.tab, color: Colors.light.textAssistive, paddingVertical: 12 },
  versionAsideNote: { fontSize: FontSize.tab, color: Colors.light.textAssistive, marginTop: 10, lineHeight: LineHeight.t7Loose },
});

/** 시안의 점·배지 색. SEED 토큰이 시안 hex와 같은 값이라 토큰으로 적는다. */
const VERSION_DOT: Record<VersionState, { backgroundColor: string }> = {
  '공개 중': { backgroundColor: Colors.light.positive },
  '초안': { backgroundColor: Colors.light.cautionary },
  '지난 버전': { backgroundColor: Colors.light.fieldBorder },
};

const VERSION_BADGE: Record<VersionState, { backgroundColor: string; color: string }> = {
  '공개 중': { backgroundColor: Colors.light.positiveBackground, color: Colors.light.positive },
  '초안': { backgroundColor: Colors.light.cautionaryBackground, color: Colors.light.cautionary },
  '지난 버전': { backgroundColor: Colors.light.backgroundSelected, color: Colors.light.textAssistive },
};

/**
 * 옛 주소는 저장된 링크·딥링크가 있을 수 있어 남긴다. 실제 화면은 `/admin/faq`(사이트·기록)의 약관·방침 탭에 있다 —
 * `TermsPanel`이 이 파일의 본체다.
 */
export default function TermsRedirect() {
  return <Redirect href="/admin/faq?tab=terms" />;
}
