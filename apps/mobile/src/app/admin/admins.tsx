/**
 * 관리자 계정
 *
 * 2026-09-10 사용자 요청 — 운영자가 직접 관리자 계정을 만들고, 실질 운영 권한과
 * 단순 뷰어 권한을 나눠 줄 수 있게 한다.
 *
 * ---------------------------------------------------------------------------
 * 시안이 없다
 * ---------------------------------------------------------------------------
 *
 * `ADMIN.md` 26화면에 이 화면이 없고, `20-admin.dc.html` · `21-admin.dc.html`(둘은
 * 같은 파일이다) · `22-admin-ops.dc.html` 어디에도 없다. 맞출 목업이 없으므로
 * 지어내지 않고 **`_ui.tsx`가 그리는 그대로** 쓴다 — v3.27 시안에서 뽑아낸 그
 * 부품들이 이 화면에서도 시안과 어긋나지 않는 유일한 길이다. 값을 직접 적는 자리가
 * 없으니 토큰에 더할 값도 없다.
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
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontSize } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { formatDateDot } from '@/features/common/format-date';
import {
  Card,
  ConfirmCard,
  DataTable,
  type Kind,
  LoadError,
  Page,
  StatusBanner,
  type TableRow,
} from './_ui';

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

const ROLE_KIND: Record<Role, Kind> = { super: 'brand', operator: 'ok', viewer: 'dim' };

const ROLES: Role[] = ['super', 'operator', 'viewer'];

const COLS = [
  { key: 'id', label: '아이디', width: 200 },
  { key: 'role', label: '등급', width: 140 },
  { key: 'note', label: '할 수 있는 일', width: 280, grow: true },
  { key: 'status', label: '상태', width: 100 },
  { key: 'maker', label: '만든 사람', width: 180 },
  { key: 'date', label: '만든 날', width: 140 },
];

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

function confirmTitle(pending: Pending): string {
  if (pending.kind === 'create') return '관리자를 만들어요';
  if (pending.kind === 'role') return '등급을 바꿔요';

  return pending.disabled ? '계정을 꺼요' : '계정을 다시 켜요';
}

/** 무엇이 바뀌는가. `이전 → 이후` 꼴로 적어 바뀌지 않는 것도 눈에 보이게 한다. */
function confirmItems(pending: Pending): string[] {
  if (pending.kind === 'create') {
    const power = ROLE_POWER[pending.role];

    return [
      `아이디 ${pending.loginId}`,
      `등급 ${ROLE_LABEL[pending.role]}`,
      `관리자 쓰기 ${power.write}`,
      `계정 관리 ${power.accounts}`,
      '비밀번호는 해시만 저장해요 — 만든 뒤에는 다시 볼 수 없어요',
    ];
  }

  if (pending.kind === 'role') {
    const before = ROLE_POWER[pending.account.role];
    const after = ROLE_POWER[pending.role];

    return [
      `아이디 ${pending.account.loginId}`,
      `등급 ${ROLE_LABEL[pending.account.role]} → ${ROLE_LABEL[pending.role]}`,
      `관리자 쓰기 ${before.write} → ${after.write}`,
      `계정 관리 ${before.accounts} → ${after.accounts}`,
    ];
  }

  const power = ROLE_POWER[pending.account.role];

  return pending.disabled
    ? [
        `아이디 ${pending.account.loginId}`,
        '상태 켜짐 → 꺼짐',
        '로그인 가능 → 막힘',
        `관리자 쓰기 ${power.write} → 막힘`,
        `등급 ${ROLE_LABEL[pending.account.role]} (그대로 남아요)`,
      ]
    : [
        `아이디 ${pending.account.loginId}`,
        '상태 꺼짐 → 켜짐',
        '로그인 막힘 → 가능',
        `관리자 쓰기 막힘 → ${power.write}`,
        `등급 ${ROLE_LABEL[pending.account.role]}`,
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

  /** 확인 카드에서 진행을 눌렀을 때에만 서버로 간다. */
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

  if (loading) {
    return (
      <Page title="관리자 계정">
        <DelayedLoader active size={40} style={styles.centered} />
      </Page>
    );
  }

  if (error || !data) {
    return (
      <Page title="관리자 계정">
        <LoadError message={error ?? '불러오기 실패'} onRetry={() => setRev((r) => r + 1)} />
      </Page>
    );
  }

  const accounts = data.accounts;
  const supers = accounts.filter((a) => a.role === 'super' && !a.disabled);

  /*
   * 지금 사람이 봐야 할 것은 **콘솔이 잠길 수 있는 상태**다. 슈퍼 관리자가 하나뿐이면
   * 그 사람이 아이디를 잃는 순간 아무도 계정 관리에 들어갈 수 없다 — 세어 보면 알 수
   * 있는 일을 사람이 세게 두지 않는다.
   */
  const banner = !data.viewerIsStored
    ? {
        tone: 'warn' as const,
        title: '환경변수 계정으로 들어와 있어요',
        detail: '슈퍼 관리자를 하나 만들면 이 계정으로는 더 이상 들어올 수 없어요.',
      }
    : supers.length === 1
      ? {
          tone: 'warn' as const,
          title: '슈퍼 관리자가 한 명뿐이에요',
          detail: '이 계정을 잃으면 계정 관리에 아무도 들어올 수 없어요.',
        }
      : { tone: 'ok' as const, title: '확인할 것이 없어요' };

  const rows: TableRow[] = accounts.map((account) => ({
    key: account.id,
    cells: [
      { v: account.loginId, bold: true, onPress: () => open(account) },
      { v: ROLE_LABEL[account.role], badge: ROLE_KIND[account.role] },
      { v: ROLE_NOTE[account.role] },
      { v: account.disabled ? '꺼짐' : '켜짐', kind: account.disabled ? 'dim' : 'ok' },
      { v: account.createdBy ?? '—' },
      { v: formatDateDot(account.createdAt) },
    ],
  }));

  function open(account: AdminAccount) {
    setSelected(account);
    setActionError(null);
  }

  const canSubmitNew = loginId.trim().length >= 3 && password.length >= 12;

  return (
    <Page
      title="관리자 계정"
      sub="콘솔에 들어올 수 있는 사람과 등급"
      action={{ label: '관리자 추가', onPress: () => setCreating(true), kind: 'brand' }}
    >
      <StatusBanner {...banner} />

      <Card title={`관리자 ${accounts.length}개`} full note="끈 계정은 로그인이 막히고 등급은 그대로 남아요.">
        <DataTable
          cols={COLS}
          rows={rows}
          empty="아직 만든 관리자 계정이 없어요"
        />
      </Card>

      {creating && (
        <ConfirmCard
          title="관리자 추가"
          body="아이디와 첫 비밀번호를 정해 주세요. 비밀번호는 해시만 저장해서 나중에 다시 볼 수 없어요."
          items={[
            '아이디는 영문 소문자 · 숫자 · . _ - 만 쓸 수 있어요',
            '비밀번호는 12자 이상이어야 해요',
            `지금 고른 등급은 ${ROLE_LABEL[role]} — ${ROLE_NOTE[role]}`,
          ]}
          cta="다음"
          onCancel={() => {
            setCreating(false);
            setPassword('');
            setActionError(null);
          }}
          onConfirm={() => {
            if (!canSubmitNew) return;
            setPending({ kind: 'create', loginId: loginId.trim(), password, role });
          }}
        >
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="아이디"
              value={loginId}
              onChangeText={setLoginId}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="비밀번호 (12자 이상)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
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
          </View>
        </ConfirmCard>
      )}

      {selected && !pending && (
        <ConfirmCard
          title={selected.loginId}
          body={`${ROLE_LABEL[selected.role]} · ${ROLE_NOTE[selected.role]}`}
          items={[
            `만든 사람 ${selected.createdBy ?? '—'}`,
            `만든 날 ${formatDateDot(selected.createdAt)}`,
            `상태 ${selected.disabled ? '꺼짐' : '켜짐'}`,
          ]}
          cta={selected.disabled ? '다시 켜기' : '끄기'}
          danger={!selected.disabled}
          onCancel={() => {
            setSelected(null);
            setActionError(null);
          }}
          onConfirm={() =>
            setPending({ kind: 'disabled', account: selected, disabled: !selected.disabled })
          }
        >
          <View style={styles.form}>
            <Text style={styles.formLabel}>등급 바꾸기</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <Pressable
                  key={r}
                  style={[styles.roleBtn, selected.role === r && styles.roleBtnActive]}
                  onPress={() => setPending({ kind: 'role', account: selected, role: r })}
                  disabled={selected.role === r}
                >
                  <Text style={[styles.roleBtnText, selected.role === r && styles.roleBtnTextActive]}>
                    {ROLE_LABEL[r]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ConfirmCard>
      )}

      {pending && (
        <ConfirmCard
          title={confirmTitle(pending)}
          body={acting ? '바꾸는 중이에요…' : '이렇게 바뀌어요.'}
          items={confirmItems(pending)}
          cta={acting ? '바꾸는 중…' : '진행'}
          danger={pending.kind === 'disabled' && pending.disabled}
          onCancel={() => {
            setPending(null);
            setActionError(null);
          }}
          onConfirm={() => void commit()}
        >
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
        </ConfirmCard>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  form: { gap: 8, marginBottom: 4 },
  formLabel: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.textAssistive },
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
  error: { fontSize: FontSize.t7, color: Colors.light.negative, marginBottom: 8 },
});
