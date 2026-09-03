/**
 * WP-ADM-020 사용자 · 계정
 * 가입 · 상태 · 결제 확인 상태 · 탈퇴 · 재가입 이력
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { FontSize } from '@weddingpick/ui';
import { apiFetch } from './_api';

type UserStatus = 'active' | 'withdrawn' | 'suspended' | 'banned';
type VerificationStatus = 'none' | 'pending' | 'verified';
type UserRecord = {
  id: string;
  nickname: string;
  email: string;
  joinedAt: string;
  status: UserStatus;
  verificationStatus: VerificationStatus;
  withdrawnAt: string | null;
  rejoinCount: number;
};

type UserListData = { users: UserRecord[]; total: number };

const STATUS_LABEL: Record<UserStatus, string> = {
  active: '활성',
  withdrawn: '탈퇴',
  suspended: '정지',
  banned: '차단',
};
const STATUS_COLOR: Record<UserStatus, string> = {
  active: '#1aa174',
  withdrawn: '#868b94',
  suspended: '#805217',
  banned: '#e81607',
};
const VER_LABEL: Record<VerificationStatus, string> = {
  none: '미확인',
  pending: '검토 중',
  verified: 'Pick 인증',
};

export default function UsersScreen() {
  const [data, setData] = useState<UserListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UserRecord | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch('/v1/admin/users')
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
  }, [rev]);

  async function updateStatus(status: UserStatus) {
    if (!selected) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/users/${selected.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setSelected(null);
      setRev((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setActing(false);
    }
  }

  const filtered = data?.users.filter(
    (u) => !search || u.nickname.includes(search) || u.email.includes(search) || u.id.includes(search)
  ) ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>사용자 · 계정</Text>
        <Pressable style={styles.refreshBtn} onPress={() => setRev((r) => r + 1)}>
          <Text style={styles.refreshText}>새로 고침</Text>
        </Pressable>
      </View>

      {loading && <View style={styles.centered}><ActivityIndicator color="#ff6f61" size="large" /></View>}
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
              placeholder="닉네임 · 이메일 · ID 검색"
              value={search}
              onChangeText={setSearch}
            />
            <Text style={styles.totalText}>총 {data.total.toLocaleString()}명</Text>
          </View>
          <ScrollView>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colName]}>닉네임</Text>
              <Text style={[styles.th, styles.colEmail]}>이메일</Text>
              <Text style={[styles.th, styles.colStatus]}>상태</Text>
              <Text style={[styles.th, styles.colVer]}>인증</Text>
              <Text style={[styles.th, styles.colJoined]}>가입일</Text>
              <Text style={[styles.th, styles.colRejoin]}>재가입</Text>
            </View>
            {filtered.map((u, i) => (
              <Pressable
                key={u.id}
                style={[styles.tableRow, i % 2 === 1 && styles.tableRowZebra, selected?.id === u.id && styles.tableRowActive]}
                onPress={() => { setSelected(u); setActionError(null); }}
              >
                <Text style={[styles.td, styles.colName]} numberOfLines={1}>{u.nickname}</Text>
                <Text style={[styles.td, styles.colEmail]} numberOfLines={1}>{u.email}</Text>
                <Text style={[styles.td, styles.colStatus, { color: STATUS_COLOR[u.status] }]}>
                  {STATUS_LABEL[u.status]}
                </Text>
                <Text style={[styles.td, styles.colVer]}>{VER_LABEL[u.verificationStatus]}</Text>
                <Text style={[styles.td, styles.colJoined]}>
                  {new Date(u.joinedAt).toLocaleDateString('ko-KR')}
                </Text>
                <Text style={[styles.td, styles.colRejoin]}>{u.rejoinCount}회</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <Modal visible={selected !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{selected?.nickname}</Text>
            <Text style={styles.modalSub}>{selected?.email}</Text>
            <Text style={styles.modalSub}>
              상태: {selected ? STATUS_LABEL[selected.status] : ''}
              {' · '}인증: {selected ? VER_LABEL[selected.verificationStatus] : ''}
              {' · '}재가입: {selected?.rejoinCount}회
            </Text>
            {selected?.withdrawnAt && (
              <Text style={styles.modalSub}>
                탈퇴일: {new Date(selected.withdrawnAt).toLocaleDateString('ko-KR')}
              </Text>
            )}

            <Text style={styles.fieldLabel}>계정 상태 변경</Text>
            <View style={styles.statusRow}>
              {(['active', 'suspended', 'banned'] as UserStatus[]).map((s) => (
                <Pressable
                  key={s}
                  style={[styles.statusBtn, selected?.status === s && { borderColor: STATUS_COLOR[s] }]}
                  onPress={() => void updateStatus(s)}
                  disabled={acting}
                >
                  <Text style={[styles.statusBtnText, selected?.status === s && { color: STATUS_COLOR[s], fontWeight: '700' }]}>
                    {STATUS_LABEL[s]}
                  </Text>
                </Pressable>
              ))}
            </View>

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
  colStatus: { width: 50 },
  colVer: { width: 70 },
  colJoined: { width: 90 },
  colRejoin: { width: 50 },
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
