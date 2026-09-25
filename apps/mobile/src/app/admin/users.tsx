/**
 * WP-ADM-020 사용자 · 계정 — 이제 「계정·권한」 화면의 탭 하나(앱 회원)다.
 *
 * 가입 · 로그인 수단 · Pick 인증. 카카오 로그인을 거친 일반 회원만 보인다.
 * 관리자·운영 표본·신원 없는 탈퇴 실패 행은 앱 회원이 아니며 탈퇴 처리는 별도
 * 운영 큐에서 원인과 재시도를 관리한다.
 *
 * 정지·차단 같은 상태 변경은 없다 — 서버에 그런 상태가 없다. 없는 버튼을 두면
 * 눌러도 아무 일이 없고, 그게 «되는 줄» 알게 만든다.
 *
 * **관리자 계정(`admins.tsx`)과는 탭으로만 나란히 둔다, 표는 절대 합치지 않는다**
 * (대표 지시 — 「계정관리 → 앱 회원과 관리자 계정 화면 탭으로 나누던가 분리해」).
 * 여기는 서비스 이용자의 개인정보, 저기는 관리자 권한이다. 이 파일 맨 아래
 * `UsersShell`이 그 탭 껍데기고, 여기 있던 본문은 `UsersPanel`로 이름만 바꿨다.
 */
import { router, useLocalSearchParams } from 'expo-router';
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

import { Colors, FontSize } from '@weddingpick/ui';
import { AdminTabShell, type AdminTabDef } from './_ui';
import { AdminsPanel } from './admins';
import { formatCount } from '@weddingpick/domain';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { WritePressable } from './_role';
import { formatDateDot } from '@/features/common/format-date';

type WithdrawalStatus = 'hold' | 'failed' | 'pending' | 'deletion_pending';
type UserRecord = {
  id: string;
  displayName: string;
  provider: string | null;
  email: string | null;
  nickname: string | null;
  createdAt: string;
  activatedAt: string | null;
  lastLoginAt: string | null;
  deletedAt: string | null;
  isOperator: boolean;
  pickVerified: boolean;
  withdrawal: { status: WithdrawalStatus; failure: { message: string; attemptCount: number } | null } | null;
};

type UserListData = { users: UserRecord[]; total: number; hasMore: boolean; nextCursor: string | null };

/* withdrawal-admin.ts의 STATUS_LABEL과 같은 말을 쓴다. */
const WITHDRAWAL_LABEL: Record<WithdrawalStatus, string> = {
  hold: '삭제 보류',
  failed: '삭제 실패',
  pending: '원본 파기 대기',
  deletion_pending: '삭제 대기',
};
const WITHDRAWAL_COLOR: Record<WithdrawalStatus, string> = {
  hold: Colors.light.cautionary,
  failed: Colors.light.negative,
  pending: Colors.light.cautionary,
  deletion_pending: Colors.light.textAssistive,
};
const PROVIDER_LABEL: Record<string, string> = {
  kakao: '카카오',
};

function statusOf(u: UserRecord): { label: string; color: string } {
  if (u.withdrawal) {
    return { label: WITHDRAWAL_LABEL[u.withdrawal.status], color: WITHDRAWAL_COLOR[u.withdrawal.status] };
  }
  if (!u.activatedAt) return { label: '가입 미완료', color: Colors.light.textAssistive };
  return { label: '활성', color: Colors.light.positive };
}

function loginOf(u: UserRecord): string {
  const provider = u.provider ? (PROVIDER_LABEL[u.provider] ?? u.provider) : '';
  const who = u.email ?? u.nickname ?? '';
  return [provider, who].filter(Boolean).join(' · ') || '—';
}

const when = (iso: string | null) => (iso ? formatDateDot(iso) : '—');

function UsersPanel() {
  const [data, setData] = useState<UserListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<UserRecord | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);
  /** 대신 탈퇴시키기 — 확인 단계와 사유. 되돌릴 수 없어 한 번 더 묻는다. */
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    const qs = params.toString();
    apiFetch(`/v1/admin/users${qs ? `?${qs}` : ''}`)
      .then((d) => {
        if (cancelled) return;
        setData(d as UserListData);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [rev, query]);

  /* 삭제에 실패한 탈퇴 계정을 다시 지운다 — withdrawal-admin retry와 같은 길. */
  async function retryDeletion() {
    if (!selected) return;
    setActing(true);
    setActionError(null);
    setActionNote(null);
    try {
      const result = (await apiFetch(`/v1/admin/withdrawals/${selected.id}/retry`, { method: 'POST' })) as {
        completed: boolean;
        note: string;
      };
      setActionNote(result.completed ? `지웠다. ${result.note}` : `아직 못 지웠다: ${result.note}`);
      if (result.completed) {
        setSelected(null);
        setRev((r) => r + 1);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  /**
   * 운영자가 대신 탈퇴시킨다(2026-09-10 대표 지시).
   *
   * **두 단계로 나눈다**(v3.27 관리자 공통 규칙 — 위험한 조작은 무엇이 바뀌는지
   * 항목으로 보여준 뒤 한 번 더 확인). 첫 단추는 확인 화면을 열기만 하고, 실제
   * 요청은 사유를 적은 뒤에야 나간다.
   *
   * 되돌릴 수 없다. 사유는 감사 기록에 그대로 남는다.
   */
  async function forceWithdraw() {
    if (!selected) return;
    const reason = withdrawReason.trim();

    if (reason === '') {
      setActionError('사유를 적어주세요. 기록에 남습니다.');

      return;
    }

    setActing(true);
    setActionError(null);
    setActionNote(null);
    try {
      const result = (await apiFetch(`/v1/admin/users/${selected.id}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })) as { completed: boolean; note: string };

      setActionNote(result.note);
      setConfirmWithdraw(false);
      setWithdrawReason('');
      setRev((r) => r + 1);
      if (result.completed) setSelected(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  const users = data?.users ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>사용자 · 계정</Text>
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
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="카카오 회원 이름 · 이메일 · 닉네임 · ID 검색 (Enter)"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => setQuery(search.trim())}
              returnKeyType="search"
            />
            <Text style={styles.totalText}>총 {formatCount(data.total)}명</Text>
          </View>
          <ScrollView>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colName]}>이름</Text>
              <Text style={[styles.th, styles.colEmail]}>로그인</Text>
              <Text style={[styles.th, styles.colStatus]}>상태</Text>
              <Text style={[styles.th, styles.colVer]}>인증</Text>
              <Text style={[styles.th, styles.colJoined]}>가입일</Text>
              <Text style={[styles.th, styles.colDeleted]}>탈퇴 요청</Text>
            </View>
            {users.length === 0 && (
              <View style={styles.centered}><Text style={styles.totalText}>해당하는 계정이 없어요</Text></View>
            )}
            {users.map((u, i) => {
              const status = statusOf(u);
              return (
                <Pressable
                  key={u.id}
                  style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra, selected?.id === u.id && styles.tableRowActive]}
                  onPress={() => { setSelected(u); setActionError(null); setActionNote(null); }}
                >
                  <Text style={[styles.td, styles.colName]} numberOfLines={1}>
                    {u.displayName || '(이름 없음)'}{u.isOperator ? ' · 운영자' : ''}
                  </Text>
                  <Text style={[styles.td, styles.colEmail]} numberOfLines={1}>{loginOf(u)}</Text>
                  <Text style={[styles.td, styles.colStatus, { color: status.color }]}>{status.label}</Text>
                  <Text style={[styles.td, styles.colVer]}>{u.pickVerified ? 'Pick 인증' : '미확인'}</Text>
                  <Text style={[styles.td, styles.colJoined]}>{when(u.createdAt)}</Text>
                  <Text style={[styles.td, styles.colDeleted]}>{when(u.deletedAt)}</Text>
                </Pressable>
              );
            })}
            {data.hasMore && (
              <View style={styles.centered}>
                <Text style={styles.totalText}>25명까지만 보여요 — 검색으로 좁혀 주세요</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      <Modal visible={selected !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox} contentContainerStyle={styles.modalBoxContent}>
            <Text style={styles.modalTitle}>{selected?.displayName || '(이름 없음)'}</Text>
            <Text style={styles.modalSub}>{selected ? loginOf(selected) : ''}</Text>
            <Text style={styles.modalSub}>ID {selected?.id}</Text>
            <Text style={styles.modalSub}>
              상태: {selected ? statusOf(selected).label : ''}
              {' · '}인증: {selected?.pickVerified ? 'Pick 인증' : '미확인'}
            </Text>
            <Text style={styles.modalSub}>
              가입 {when(selected?.createdAt ?? null)} · 가입 완료 {when(selected?.activatedAt ?? null)} · 마지막 로그인 {when(selected?.lastLoginAt ?? null)}
            </Text>
            {selected?.deletedAt && (
              <Text style={styles.modalSub}>탈퇴 요청: {when(selected.deletedAt)}</Text>
            )}
            {selected?.withdrawal?.failure && (
              <>
                <Text style={styles.fieldLabel}>
                  삭제 실패 {formatCount(selected.withdrawal.failure.attemptCount)}회
                </Text>
                <Text style={styles.modalSub}>{selected.withdrawal.failure.message}</Text>
                <WritePressable style={styles.retryAction} onPress={() => void retryDeletion()} disabled={acting}>
                  <Text style={styles.retryActionText}>{acting ? '지우는 중…' : '삭제 다시 시도'}</Text>
                </WritePressable>
              </>
            )}

            {/*
              대신 탈퇴시키기. 아직 탈퇴하지 않은 계정에만 뜬다 — 이미 접수된 계정은
              위의 «삭제 다시 시도»가 맡는다. 운영자 계정에는 두지 않는다(서버도
              막지만, 눌러도 안 되는 단추를 보여줄 이유가 없다).
            */}
            {selected && !selected.deletedAt && !selected.isOperator && !confirmWithdraw && (
              <WritePressable
                style={styles.withdrawAction}
                onPress={() => { setConfirmWithdraw(true); setActionError(null); setActionNote(null); }}
              >
                <Text style={styles.withdrawActionText}>이 계정 탈퇴시키기</Text>
              </WritePressable>
            )}

            {confirmWithdraw && (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>탈퇴시키면 이렇게 됩니다</Text>
                <Text style={styles.confirmItem}>· 로그인 수단과 세션이 곧바로 끊깁니다</Text>
                <Text style={styles.confirmItem}>· 올린 원본 자료가 파기 대상이 됩니다</Text>
                <Text style={styles.confirmItem}>· 파기가 끝나면 계정이 지워집니다</Text>
                <Text style={styles.confirmItem}>· 되돌릴 수 없습니다</Text>
                <Text style={styles.fieldLabel}>사유 (감사 기록에 남습니다)</Text>
                <TextInput
                  style={styles.reasonInput}
                  value={withdrawReason}
                  onChangeText={setWithdrawReason}
                  placeholder="예: 본인 요청 · 전화 접수"
                  placeholderTextColor={Colors.light.textAssistive}
                />
                <View style={styles.confirmRow}>
                  <Pressable
                    style={styles.confirmCancel}
                    onPress={() => { setConfirmWithdraw(false); setWithdrawReason(''); }}
                    disabled={acting}
                  >
                    <Text style={styles.confirmCancelText}>취소</Text>
                  </Pressable>
                  <WritePressable
                    style={styles.confirmGo}
                    onPress={() => void forceWithdraw()}
                    disabled={acting}
                  >
                    <Text style={styles.confirmGoText}>{acting ? '처리 중…' : '탈퇴시키기'}</Text>
                  </WritePressable>
                </View>
              </View>
            )}

            {actionNote && <Text style={styles.actionNote}>{actionNote}</Text>}
            {actionError && <Text style={styles.actionError}>{actionError}</Text>}

            {/*
              여기 모달은 요약이다. 이 회원이 실제로 무엇을 했는지(웨딩 · Pick ·
              후기 · 결제 제보 · 업체 소유 확인 · 문의 · 리워드)는 표가 스무 개를
              넘어 모달에 다 못 담는다 — 새 라우트 페이지로 넘긴다.
            */}
            {selected && (
              <Pressable
                style={styles.detailLink}
                onPress={() => router.push(`/admin/user-detail?id=${selected.id}` as never)}
              >
                <Text style={styles.detailLinkText}>이 회원의 모든 활동 보기 →</Text>
              </Pressable>
            )}

            <Pressable
              style={styles.closeBtn}
              onPress={() => { setSelected(null); setConfirmWithdraw(false); setWithdrawReason(''); }}
            >
              <Text style={styles.closeBtnText}>닫기</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const TABS: AdminTabDef[] = [
  { key: 'users', label: '앱 회원' },
  { key: 'admins', label: '관리자 계정' },
];

/**
 * 「계정·권한」 — 앱 회원과 관리자 계정을 탭 둘로 나눈다. **표는 절대 하나로
 * 합치지 않는다**(대표 지시) — 여기는 개인정보, 저기는 권한이다.
 */
export default function UsersShell() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initial = TABS.some((t) => t.key === tab) ? (tab as string) : 'users';
  const [active, setActive] = useState(initial);

  return (
    <AdminTabShell tabs={TABS} active={active} onChange={setActive}>
      {active === 'users' ? <UsersPanel /> : <AdminsPanel />}
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
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.light.backgroundSelected },
  refreshText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.tint },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
    backgroundColor: Colors.light.backgroundElement,
  },
  totalText: { fontSize: FontSize.t7, color: Colors.light.textAssistive },
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
    alignItems: 'center',
  },
  tableRowZebra: { backgroundColor: Colors.light.backgroundElement },
  tableRowActive: { backgroundColor: 'rgba(255,111,97,0.08)' },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: Colors.light.textAssistive, textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  colName: { flex: 2 },
  colEmail: { flex: 3 },
  colStatus: { width: 110 },
  colVer: { width: 70 },
  colJoined: { width: 90 },
  colDeleted: { width: 90 },
  retryAction: { marginTop: 12, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.tint, alignItems: 'center' },
  retryActionText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  actionNote: { fontSize: FontSize.t7, color: Colors.light.positive, marginTop: 8 },
  /*
   * 위험한 조작은 위험해 보이게 둔다 — 지우는 단추는 테두리만 두고 채우지 않는다.
   * 채운 단추는 「추천하는 다음 걸음」으로 읽히는데, 이건 그런 자리가 아니다.
   */
  withdrawAction: {
    marginTop: 18,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.negative,
    alignItems: 'center',
  },
  withdrawActionText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.negative },
  confirmBox: {
    marginTop: 18,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.negative,
    backgroundColor: Colors.light.backgroundSelected,
  },
  confirmTitle: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.negative, marginBottom: 10 },
  confirmItem: { fontSize: FontSize.t7, color: Colors.light.textSecondary, marginBottom: 4 },
  reasonInput: {
    height: 36,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  confirmRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  confirmCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
  },
  confirmCancelText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textSecondary },
  confirmGo: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: Colors.light.negative,
    alignItems: 'center',
  },
  confirmGoText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  modalBox: { backgroundColor: Colors.light.background, borderRadius: 14, width: '100%', maxWidth: 440, maxHeight: '85%' },
  modalBoxContent: { padding: 24 },
  modalTitle: { fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  modalSub: { fontSize: FontSize.t7, color: Colors.light.textAssistive, marginBottom: 2 },
  fieldLabel: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textAssistive, marginTop: 18, marginBottom: 8 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
  },
  statusBtnText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  actionError: { fontSize: FontSize.t7, color: Colors.light.negative, marginTop: 8 },
  detailLink: { marginTop: 18, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  detailLinkText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.tint },
  closeBtn: { marginTop: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.backgroundSelected, alignItems: 'center' },
  closeBtnText: { fontSize: FontSize.t7, color: Colors.light.textStrong },
});
