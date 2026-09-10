/**
 * 관리자 계정
 *
 * 2026-09-10 사용자 요청 — 운영자가 직접 관리자 계정을 만들고, 실질 운영 권한과
 * 단순 뷰어 권한을 나눠 줄 수 있게 한다.
 *
 * ---------------------------------------------------------------------------
 * `users.tsx`(사용자 · 계정)와 다른 화면이다
 * ---------------------------------------------------------------------------
 *
 * 저기는 **서비스 이용자**, 여기는 **관리자**다. 이름이 둘 다 「계정」이라 헷갈리기
 * 쉬워서, 사이드바에서 두 화면을 다른 묶음에 떨어뜨려 놓았다 — 저기는 「사용자」,
 * 여기는 「시스템」. 이름만 다르게 하는 것보다 자리를 떼어놓는 편이 확실하다.
 *
 * ---------------------------------------------------------------------------
 * 단추를 숨기는 것은 권한이 아니다
 * ---------------------------------------------------------------------------
 *
 * 이 화면은 슈퍼 관리자만 연다. 그것을 정하는 곳은 **서버**이고(`requireSuperAdmin`),
 * 여기서는 403을 받아 그렇게 말해 줄 뿐이다. 화면이 막는 것으로 쳤다면 뷰어가
 * `PATCH`를 직접 부르는 순간 그대로 통했을 것이다.
 *
 * 시안이 없다(핸드오프 v3.27 26화면에 이 화면이 없다 · 2026-09-10 사용자 확인).
 * 그래서 지어내지 않고 `users.tsx`의 표·배지 꼴을 그대로 따른다.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { formatDateDot } from '@/features/common/format-date';

type Role = 'super' | 'operator' | 'viewer';

type AdminAccount = {
  id: string;
  loginId: string;
  role: Role;
  disabled: boolean;
  createdBy: string | null;
  createdAt: string;
};

type ListData = { accounts: AdminAccount[]; viewerIsStored: boolean };

/** 등급이 무엇을 뜻하는지 한 줄로. 이름만으로는 뷰어가 무엇을 못 하는지 알 수 없다. */
const ROLE_LABEL: Record<Role, string> = {
  super: '슈퍼 관리자',
  operator: '운영자',
  viewer: '뷰어',
};

const ROLE_NOTE: Record<Role, string> = {
  super: '계정 관리를 포함한 전부',
  operator: '운영 전부 · 계정 관리는 못 함',
  viewer: '읽기만',
};

const ROLE_COLOR: Record<Role, string> = {
  super: Colors.light.tint,
  operator: Colors.light.positive,
  viewer: Colors.light.textAssistive,
};

const ROLES: Role[] = ['super', 'operator', 'viewer'];

export default function AdminAccountsScreen() {
  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  const [creating, setCreating] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('viewer');

  const [selected, setSelected] = useState<AdminAccount | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    apiFetch('/v1/admin/accounts')
      .then((d) => {
        if (cancelled) return;
        setData(d as ListData);
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

  async function submitNew() {
    setActing(true);
    setActionError(null);
    try {
      await apiFetch('/v1/admin/accounts', {
        method: 'POST',
        body: JSON.stringify({ loginId: loginId.trim(), password, role }),
      });
      /*
       * **비밀번호를 화면에 남기지 않는다.** 만든 사람이 정한 값이라 되돌려 보여줄
       * 이유가 없고, 남겨 두면 자리를 비운 사이 화면에 그대로 떠 있다.
       */
      setLoginId('');
      setPassword('');
      setRole('viewer');
      setCreating(false);
      setRev((r) => r + 1);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : '만들지 못했어요');
    } finally {
      setActing(false);
    }
  }

  async function change(path: string, body: Record<string, unknown>) {
    if (!selected) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/v1/admin/accounts/${selected.id}/${path}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setSelected(null);
      setRev((r) => r + 1);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : '바꾸지 못했어요');
    } finally {
      setActing(false);
    }
  }

  const accounts = data?.accounts ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>관리자 계정</Text>
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
          <View style={styles.toolbar}>
            <Text style={styles.totalText}>총 {accounts.length}개</Text>
            <Pressable style={styles.primaryBtn} onPress={() => setCreating(true)}>
              <Text style={styles.primaryBtnText}>관리자 추가</Text>
            </Pressable>
          </View>

          {!data.viewerIsStored && (
            /*
             * 부트스트랩 계정으로 들어와 있다. 이 계정은 표에 없고, 진짜 슈퍼
             * 관리자가 하나 생기면 더 이상 들어올 수 없다 — 그 사실을 지금 말해야
             * 나중에 「왜 안 들어가지」가 되지 않는다.
             */
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                지금은 환경변수 계정으로 들어와 있어요. 슈퍼 관리자를 하나 만들면 이 계정으로는 더 이상
                들어올 수 없어요.
              </Text>
            </View>
          )}

          <ScrollView>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colId]}>아이디</Text>
              <Text style={[styles.th, styles.colRole]}>등급</Text>
              <Text style={[styles.th, styles.colNote]}>할 수 있는 일</Text>
              <Text style={[styles.th, styles.colStatus]}>상태</Text>
              <Text style={[styles.th, styles.colMaker]}>만든 사람</Text>
              <Text style={[styles.th, styles.colDate]}>만든 날</Text>
            </View>

            {accounts.length === 0 && (
              <View style={styles.centered}>
                <Text style={styles.totalText}>아직 만든 관리자 계정이 없어요</Text>
              </View>
            )}

            {accounts.map((account, i) => (
              <Pressable
                key={account.id}
                style={[
                  styles.tableRow,
                  i % 2 === 1 && styles.tableRowZebra,
                  selected?.id === account.id && styles.tableRowActive,
                ]}
                onPress={() => {
                  setSelected(account);
                  setActionError(null);
                }}
              >
                <Text style={[styles.td, styles.colId]} numberOfLines={1}>
                  {account.loginId}
                </Text>
                <Text style={[styles.td, styles.colRole, { color: ROLE_COLOR[account.role] }]}>
                  {ROLE_LABEL[account.role]}
                </Text>
                <Text style={[styles.td, styles.colNote]} numberOfLines={1}>
                  {ROLE_NOTE[account.role]}
                </Text>
                <Text
                  style={[
                    styles.td,
                    styles.colStatus,
                    { color: account.disabled ? Colors.light.textAssistive : Colors.light.positive },
                  ]}
                >
                  {account.disabled ? '꺼짐' : '켜짐'}
                </Text>
                <Text style={[styles.td, styles.colMaker]} numberOfLines={1}>
                  {account.createdBy ?? '—'}
                </Text>
                <Text style={[styles.td, styles.colDate]}>{formatDateDot(account.createdAt)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <Modal visible={creating} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>관리자 추가</Text>
            <Text style={styles.modalSub}>
              비밀번호는 저장하지 않고 해시만 남겨요. 만든 뒤에는 다시 볼 수 없으니 지금 전달해 주세요.
            </Text>

            <Text style={styles.fieldLabel}>아이디</Text>
            <TextInput
              style={styles.input}
              placeholder="영문 소문자 · 숫자 · . _ -"
              value={loginId}
              onChangeText={setLoginId}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>비밀번호</Text>
            <TextInput
              style={styles.input}
              placeholder="12자 이상"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>등급</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <Pressable
                  key={r}
                  style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                    {ROLE_LABEL[r]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalSub}>{ROLE_NOTE[role]}</Text>

            {actionError && <Text style={styles.actionError}>{actionError}</Text>}

            <Pressable
              style={styles.primaryAction}
              onPress={() => void submitNew()}
              disabled={acting}
            >
              <Text style={styles.primaryActionText}>{acting ? '만드는 중…' : '만들기'}</Text>
            </Pressable>
            <Pressable
              style={styles.closeBtn}
              onPress={() => {
                setCreating(false);
                setPassword('');
                setActionError(null);
              }}
            >
              <Text style={styles.closeBtnText}>취소</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={selected !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{selected?.loginId}</Text>
            <Text style={styles.modalSub}>
              {selected ? `${ROLE_LABEL[selected.role]} · ${ROLE_NOTE[selected.role]}` : ''}
            </Text>
            <Text style={styles.modalSub}>
              만든 사람 {selected?.createdBy ?? '—'} · {formatDateDot(selected?.createdAt ?? '')}
            </Text>

            <Text style={styles.fieldLabel}>등급 바꾸기</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <Pressable
                  key={r}
                  style={[styles.roleBtn, selected?.role === r && styles.roleBtnActive]}
                  onPress={() => void change('role', { role: r })}
                  disabled={acting || selected?.role === r}
                >
                  <Text style={[styles.roleBtnText, selected?.role === r && styles.roleBtnTextActive]}>
                    {ROLE_LABEL[r]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>상태</Text>
            <Pressable
              style={styles.statusBtn}
              onPress={() => void change('disabled', { disabled: !selected?.disabled })}
              disabled={acting}
            >
              <Text style={styles.statusBtnText}>
                {selected?.disabled ? '다시 켜기' : '끄기'}
              </Text>
            </Pressable>

            {actionError && <Text style={styles.actionError}>{actionError}</Text>}

            <Pressable
              style={styles.closeBtn}
              onPress={() => {
                setSelected(null);
                setActionError(null);
              }}
            >
              <Text style={styles.closeBtnText}>닫기</Text>
            </Pressable>
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
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.light.backgroundSelected,
  },
  refreshText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
  },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  totalText: { flex: 1, fontSize: FontSize.t7, color: Colors.light.textAssistive },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
  },
  primaryBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  notice: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  noticeText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
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
  th: {
    fontSize: FontSize.tab,
    fontWeight: '700',
    color: Colors.light.textAssistive,
    textTransform: 'uppercase' as const,
  },
  td: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  colId: { flex: 2 },
  colRole: { width: 110 },
  colNote: { flex: 3 },
  colStatus: { width: 70 },
  colMaker: { width: 120 },
  colDate: { width: 90 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: { backgroundColor: Colors.light.background, borderRadius: 14, padding: 24, width: 440 },
  modalTitle: { fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  modalSub: { fontSize: FontSize.t7, color: Colors.light.textAssistive, marginBottom: 2 },
  fieldLabel: {
    fontSize: FontSize.t7,
    fontWeight: '700',
    color: Colors.light.textAssistive,
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    height: 36,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: FontSize.t7,
    backgroundColor: Colors.light.backgroundElement,
  },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
  },
  roleBtnActive: { borderColor: Colors.light.tint, backgroundColor: 'rgba(255,111,97,0.08)' },
  roleBtnText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  roleBtnTextActive: { color: Colors.light.tint, fontWeight: '700' },
  statusBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    alignSelf: 'flex-start',
  },
  statusBtnText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  primaryAction: {
    marginTop: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
  },
  primaryActionText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  actionError: { fontSize: FontSize.t7, color: Colors.light.negative, marginTop: 8 },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: Colors.light.backgroundSelected,
    alignItems: 'center',
  },
  closeBtnText: { fontSize: FontSize.t7, color: Colors.light.textStrong },
});
