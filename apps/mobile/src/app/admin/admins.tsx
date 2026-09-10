/**
 * 관리자 계정
 *
 * 2026-09-10 사용자 요청 — 운영자가 직접 관리자 계정을 만들고, 실질 운영 권한과
 * 단순 뷰어 권한을 나눠 줄 수 있게 한다.
 *
 * 핸드오프 v3.27(2026-09-10) 관리자 공통 규칙 4가지를 따른다.
 *
 * ---------------------------------------------------------------------------
 * 시안이 없다
 * ---------------------------------------------------------------------------
 *
 * `ADMIN.md` 26화면에 이 화면이 없고, `20-admin.dc.html` · `21-admin.dc.html`(둘은
 * 같은 파일이다) · `22-admin-ops.dc.html` 어디에도 없다. 지어내는 대신 v3.27의 공통
 * 규칙과 기존 관리자 표·배지 꼴을 그대로 따른다(2026-09-10 사용자 확인).
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

const ROLE_LABEL: Record<Role, string> = {
  super: '슈퍼 관리자',
  operator: '운영자',
  viewer: '뷰어',
};

/**
 * 등급이 실제로 할 수 있는 일. **한 곳에만 적는다.**
 *
 * 표의 설명과 확인 카드의 「무엇이 바뀌는가」가 각자 문구를 들고 있으면 언젠가
 * 어긋나고, 어긋난 쪽을 보고 등급을 정하게 된다.
 */
const ROLE_POWER: Record<Role, { write: string; accounts: string }> = {
  super: { write: '허용', accounts: '생성 · 등급 변경 · 끄기' },
  operator: { write: '허용', accounts: '못 함' },
  viewer: { write: '막힘', accounts: '못 함' },
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

/**
 * 지금 사람이 봐야 할 것.
 *
 * v3.27 공통 규칙 1 — 상단 배너가 상태를 먼저 말한다. 문제 없으면 초록, 확인할 것이
 * 있으면 주황.
 *
 * 이 화면에서 「확인할 것」은 **콘솔이 잠길 수 있는 상태**다. 슈퍼 관리자가 하나뿐이면
 * 그 사람이 아이디를 잃는 순간 아무도 계정 관리에 들어갈 수 없다 — 숫자를 세어 보면
 * 알 수 있는 일을 사람이 세게 두지 않는다.
 */
function banner(data: ListData): { tone: 'ok' | 'warn'; text: string } {
  const supers = data.accounts.filter((a) => a.role === 'super' && !a.disabled);

  if (!data.viewerIsStored) {
    return {
      tone: 'warn',
      text: '지금은 환경변수 계정으로 들어와 있어요. 슈퍼 관리자를 하나 만들면 이 계정으로는 더 이상 들어올 수 없어요.',
    };
  }

  if (supers.length === 1) {
    return {
      tone: 'warn',
      text: '슈퍼 관리자가 한 명뿐이에요. 이 계정을 잃으면 계정 관리에 아무도 들어올 수 없어요.',
    };
  }

  return { tone: 'ok', text: '확인할 것이 없어요' };
}

/**
 * 하려는 일. **누른 즉시 보내지 않는다.**
 *
 * v3.27 공통 규칙 4 — 위험한 조작은 무엇이 바뀌는지 항목으로 보여준 뒤 진행한다.
 * 계정 생성 · 등급 변경 · 끄기가 전부 여기 해당한다. 「정말 하시겠어요?」는 무엇이
 * 바뀌는지 말해 주지 않아서, 읽는 사람이 자기가 무엇을 누르는지 모른 채 누른다.
 */
type Pending =
  | { kind: 'create'; loginId: string; password: string; role: Role }
  | { kind: 'role'; account: AdminAccount; role: Role }
  | { kind: 'disabled'; account: AdminAccount; disabled: boolean };

type Change = { label: string; value: string };

function title(pending: Pending): string {
  if (pending.kind === 'create') return '관리자를 만들어요';
  if (pending.kind === 'role') return '등급을 바꿔요';

  return pending.disabled ? '계정을 꺼요' : '계정을 다시 켜요';
}

/** 무엇이 바뀌는가. `이전 → 이후` 꼴로 적어 바뀌지 않는 것도 눈에 보이게 한다. */
function changes(pending: Pending): Change[] {
  if (pending.kind === 'create') {
    const power = ROLE_POWER[pending.role];

    return [
      { label: '아이디', value: pending.loginId },
      { label: '등급', value: ROLE_LABEL[pending.role] },
      { label: '관리자 쓰기', value: power.write },
      { label: '계정 관리', value: power.accounts },
      { label: '비밀번호', value: '해시만 저장 — 만든 뒤에는 다시 볼 수 없어요' },
    ];
  }

  if (pending.kind === 'role') {
    const before = ROLE_POWER[pending.account.role];
    const after = ROLE_POWER[pending.role];

    return [
      { label: '아이디', value: pending.account.loginId },
      {
        label: '등급',
        value: `${ROLE_LABEL[pending.account.role]} → ${ROLE_LABEL[pending.role]}`,
      },
      { label: '관리자 쓰기', value: `${before.write} → ${after.write}` },
      { label: '계정 관리', value: `${before.accounts} → ${after.accounts}` },
    ];
  }

  const power = ROLE_POWER[pending.account.role];

  return pending.disabled
    ? [
        { label: '아이디', value: pending.account.loginId },
        { label: '상태', value: '켜짐 → 꺼짐' },
        { label: '로그인', value: '가능 → 막힘' },
        { label: '관리자 쓰기', value: `${power.write} → 막힘` },
        { label: '등급', value: `${ROLE_LABEL[pending.account.role]} (그대로 남아요)` },
      ]
    : [
        { label: '아이디', value: pending.account.loginId },
        { label: '상태', value: '꺼짐 → 켜짐' },
        { label: '로그인', value: '막힘 → 가능' },
        { label: '관리자 쓰기', value: `막힘 → ${power.write}` },
        { label: '등급', value: ROLE_LABEL[pending.account.role] },
      ];
}

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
  const [pending, setPending] = useState<Pending | null>(null);
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

  /** 확인 카드에서 「진행」을 눌렀을 때에만 서버로 간다. */
  async function commit() {
    if (!pending) return;
    setActing(true);
    setActionError(null);

    try {
      if (pending.kind === 'create') {
        await apiFetch('/v1/admin/accounts', {
          method: 'POST',
          body: JSON.stringify({
            loginId: pending.loginId,
            password: pending.password,
            role: pending.role,
          }),
        });
        /*
         * **비밀번호를 화면에 남기지 않는다.** 만든 사람이 정한 값이라 되돌려 보여줄
         * 이유가 없고, 남겨 두면 자리를 비운 사이 화면에 그대로 떠 있다.
         */
        setLoginId('');
        setPassword('');
        setRole('viewer');
        setCreating(false);
      } else if (pending.kind === 'role') {
        await apiFetch(`/v1/admin/accounts/${pending.account.id}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role: pending.role }),
        });
        setSelected(null);
      } else {
        await apiFetch(`/v1/admin/accounts/${pending.account.id}/disabled`, {
          method: 'PATCH',
          body: JSON.stringify({ disabled: pending.disabled }),
        });
        setSelected(null);
      }

      setPending(null);
      setRev((r) => r + 1);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : '바꾸지 못했어요');
    } finally {
      setActing(false);
    }
  }

  const accounts = data?.accounts ?? [];
  const notice = data ? banner(data) : null;

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

      {!loading && !error && data && notice && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner}>
          {/* v3.27 규칙 1 — 상태를 먼저 말한다. */}
          <View style={[styles.banner, notice.tone === 'warn' ? styles.bannerWarn : styles.bannerOk]}>
            <Text
              style={[
                styles.bannerText,
                notice.tone === 'warn' ? styles.bannerTextWarn : styles.bannerTextOk,
              ]}
            >
              {notice.text}
            </Text>
          </View>

          {/* v3.27 규칙 3 — 표는 카드 안에서만 스크롤한다. */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>관리자 {accounts.length}개</Text>
              <Pressable style={styles.primaryBtn} onPress={() => setCreating(true)}>
                <Text style={styles.primaryBtnText}>관리자 추가</Text>
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.table}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, styles.colId]}>아이디</Text>
                  <Text style={[styles.th, styles.colRole]}>등급</Text>
                  <Text style={[styles.th, styles.colNote]}>할 수 있는 일</Text>
                  <Text style={[styles.th, styles.colStatus]}>상태</Text>
                  <Text style={[styles.th, styles.colMaker]}>만든 사람</Text>
                  <Text style={[styles.th, styles.colDate]}>만든 날</Text>
                </View>

                {accounts.length === 0 && (
                  /* v3.27 규칙 2 — 빈 상태가 정상 상태다. */
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>
                      아직 만든 관리자 계정이 없어요. 「관리자 추가」로 첫 계정을 만들어 주세요.
                    </Text>
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
                        {
                          color: account.disabled
                            ? Colors.light.textAssistive
                            : Colors.light.positive,
                        },
                      ]}
                    >
                      {account.disabled ? '꺼짐' : '켜짐'}
                    </Text>
                    <Text style={[styles.td, styles.colMaker]} numberOfLines={1}>
                      {account.createdBy ?? '—'}
                    </Text>
                    <Text style={[styles.td, styles.colDate]}>
                      {formatDateDot(account.createdAt)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      )}

      <Modal visible={creating} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>관리자 추가</Text>

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

            <Pressable
              style={styles.primaryAction}
              onPress={() =>
                setPending({
                  kind: 'create',
                  loginId: loginId.trim(),
                  password,
                  role,
                })
              }
              disabled={loginId.trim().length < 3 || password.length < 12}
            >
              <Text style={styles.primaryActionText}>다음</Text>
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

      <Modal visible={selected !== null && pending === null} transparent animationType="fade">
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
                  onPress={() =>
                    selected && setPending({ kind: 'role', account: selected, role: r })
                  }
                  disabled={selected?.role === r}
                >
                  <Text
                    style={[styles.roleBtnText, selected?.role === r && styles.roleBtnTextActive]}
                  >
                    {ROLE_LABEL[r]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>상태</Text>
            <Pressable
              style={styles.statusBtn}
              onPress={() =>
                selected &&
                setPending({ kind: 'disabled', account: selected, disabled: !selected.disabled })
              }
            >
              <Text style={styles.statusBtnText}>{selected?.disabled ? '다시 켜기' : '끄기'}</Text>
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

      {/* v3.27 규칙 4 — 무엇이 바뀌는지 항목으로 보여준 뒤 진행한다. */}
      <Modal visible={pending !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{pending ? title(pending) : ''}</Text>
            <Text style={styles.modalSub}>이렇게 바뀌어요.</Text>

            <View style={styles.changeList}>
              {(pending ? changes(pending) : []).map((change) => (
                <View key={change.label} style={styles.changeRow}>
                  <Text style={styles.changeLabel}>{change.label}</Text>
                  <Text style={styles.changeValue}>{change.value}</Text>
                </View>
              ))}
            </View>

            {actionError && <Text style={styles.actionError}>{actionError}</Text>}

            <Pressable style={styles.primaryAction} onPress={() => void commit()} disabled={acting}>
              <Text style={styles.primaryActionText}>{acting ? '바꾸는 중…' : '진행'}</Text>
            </Pressable>
            <Pressable
              style={styles.closeBtn}
              onPress={() => {
                setPending(null);
                setActionError(null);
              }}
            >
              <Text style={styles.closeBtnText}>취소</Text>
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
  bodyInner: { padding: 24, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
  },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  banner: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1 },
  bannerOk: { backgroundColor: 'rgba(52,199,89,0.08)', borderColor: 'rgba(52,199,89,0.35)' },
  bannerWarn: { backgroundColor: 'rgba(255,192,65,0.12)', borderColor: 'rgba(255,192,65,0.45)' },
  bannerText: { fontSize: FontSize.t7 },
  bannerTextOk: { color: Colors.light.positive, fontWeight: '700' },
  bannerTextWarn: { color: Colors.light.textStrong },
  card: {
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  cardTitle: { flex: 1, fontSize: FontSize.t6, fontWeight: '700', color: Colors.light.text },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
  },
  primaryBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  table: { minWidth: 900 },
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
  colId: { width: 180 },
  colRole: { width: 110 },
  colNote: { width: 260 },
  colStatus: { width: 80 },
  colMaker: { width: 160 },
  colDate: { width: 110 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: FontSize.t7, color: Colors.light.textAssistive },
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
  changeList: {
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
    gap: 12,
  },
  changeLabel: { width: 100, fontSize: FontSize.t7, color: Colors.light.textAssistive },
  changeValue: { flex: 1, fontSize: FontSize.t7, color: Colors.light.textStrong, fontWeight: '700' },
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
