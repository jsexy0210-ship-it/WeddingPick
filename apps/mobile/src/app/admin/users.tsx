/**
 * WP-ADM-020 사용자 · 계정
 *
 * 가입 · 로그인 수단 · Pick 인증 · 탈퇴 상태. **탈퇴를 접수한 계정도 보인다** —
 * 이 화면의 첫 번째 쓰임이 «탈퇴했는데 회원정보가 남았는가»를 확인하는 것이다.
 * 삭제가 끝난 계정은 행이 없어 안 보인다 — 그것이 정상이다.
 *
 * 정지·차단 같은 상태 변경은 없다 — 서버에 그런 상태가 없다. 없는 버튼을 두면
 * 눌러도 아무 일이 없고, 그게 «되는 줄» 알게 만든다.
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

import { FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
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
type Filter = 'all' | 'active' | 'withdrawn';

const FILTER_LABEL: Record<Filter, string> = { all: '전체', active: '활성', withdrawn: '탈퇴 접수' };

/* withdrawal-admin.ts의 STATUS_LABEL과 같은 말을 쓴다. */
const WITHDRAWAL_LABEL: Record<WithdrawalStatus, string> = {
  hold: '삭제 보류',
  failed: '삭제 실패',
  pending: '원본 파기 대기',
  deletion_pending: '삭제 대기',
};
const WITHDRAWAL_COLOR: Record<WithdrawalStatus, string> = {
  hold: '#805217',
  failed: '#e81607',
  pending: '#805217',
  deletion_pending: '#868b94',
};
const PROVIDER_LABEL: Record<string, string> = {
  kakao: '카카오', apple: '애플', google: '구글', naver: '네이버', email: '이메일',
};

function statusOf(u: UserRecord): { label: string; color: string } {
  if (u.withdrawal) {
    return { label: WITHDRAWAL_LABEL[u.withdrawal.status], color: WITHDRAWAL_COLOR[u.withdrawal.status] };
  }
  if (!u.activatedAt) return { label: '가입 미완료', color: '#868b94' };
  return { label: '활성', color: '#1aa174' };
}

function loginOf(u: UserRecord): string {
  const provider = u.provider ? (PROVIDER_LABEL[u.provider] ?? u.provider) : '';
  const who = u.email ?? u.nickname ?? '';
  return [provider, who].filter(Boolean).join(' · ') || '—';
}

const when = (iso: string | null) => (iso ? formatDateDot(iso) : '—');

export default function UsersScreen() {
  const [data, setData] = useState<UserListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<UserRecord | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    if (filter !== 'all') params.set('status', filter);
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
  }, [rev, query, filter]);

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
              placeholder="이름 · 이메일 · 닉네임 · ID 검색 (Enter)"
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => setQuery(search.trim())}
              returnKeyType="search"
            />
            <View style={styles.filterRow}>
              {(['all', 'active', 'withdrawn'] as Filter[]).map((f) => (
                <Pressable
                  key={f}
                  style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{FILTER_LABEL[f]}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.totalText}>총 {data.total.toLocaleString()}명</Text>
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
          <View style={styles.modalBox}>
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
                  삭제 실패 {selected.withdrawal.failure.attemptCount}회
                </Text>
                <Text style={styles.modalSub}>{selected.withdrawal.failure.message}</Text>
                <Pressable style={styles.retryAction} onPress={() => void retryDeletion()} disabled={acting}>
                  <Text style={styles.retryActionText}>{acting ? '지우는 중…' : '삭제 다시 시도'}</Text>
                </Pressable>
              </>
            )}

            {actionNote && <Text style={styles.actionNote}>{actionNote}</Text>}
            {actionError && <Text style={styles.actionError}>{actionError}</Text>}

            <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
              <Text style={styles.closeBtnText}>닫기</Text>
            </Pressable>
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#d1d3d8',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
    backgroundColor: '#f7f8fa',
  },
  totalText: { fontSize: FontSize.t7, color: '#868b94' },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e5ea',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f1f4',
    alignItems: 'center',
  },
  tableRowZebra: { backgroundColor: '#fafbfc' },
  tableRowActive: { backgroundColor: 'rgba(255,111,97,0.08)' },
  th: { fontSize: FontSize.tab, fontWeight: '700', color: '#868b94', textTransform: 'uppercase' as const },
  td: { fontSize: FontSize.t7, color: '#3a3b40' },
  colName: { flex: 2 },
  colEmail: { flex: 3 },
  colStatus: { width: 110 },
  colVer: { width: 70 },
  colJoined: { width: 90 },
  colDeleted: { width: 90 },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#d1d3d8' },
  filterBtnActive: { borderColor: '#ff6f61', backgroundColor: 'rgba(255,111,97,0.08)' },
  filterText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  filterTextActive: { color: '#ff6f61', fontWeight: '700' },
  retryAction: { marginTop: 12, paddingVertical: 10, borderRadius: 6, backgroundColor: '#ff6f61', alignItems: 'center' },
  retryActionText: { fontSize: FontSize.t7, fontWeight: '700', color: '#fff' },
  actionNote: { fontSize: FontSize.t7, color: '#1aa174', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 14, padding: 24, width: 440 },
  modalTitle: { fontSize: FontSize.t5, fontWeight: '700', color: '#17181c', marginBottom: 4 },
  modalSub: { fontSize: FontSize.t7, color: '#868b94', marginBottom: 2 },
  fieldLabel: { fontSize: FontSize.t7, fontWeight: '700', color: '#868b94', marginTop: 18, marginBottom: 8 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d3d8',
  },
  statusBtnText: { fontSize: FontSize.t7, color: '#5a5d6a' },
  actionError: { fontSize: FontSize.t7, color: '#e53e3e', marginTop: 8 },
  closeBtn: { marginTop: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: '#f2f3f6', alignItems: 'center' },
  closeBtnText: { fontSize: FontSize.t7, color: '#3a3b40' },
});
