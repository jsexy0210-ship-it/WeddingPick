import { createContext, useContext } from 'react';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';

/**
 * 관리자 등급을 화면이 아는 자리(2026-09-25 대표 지시 — 「관리자 계정 뷰어 권한은
 * 모든 등록, 수정, 삭제 버튼 비활성화다. 전체 화면 조회 기능만 가능한것이다」).
 *
 * **막는 것은 서버다.** `requireOperatorUser`가 뷰어의 GET 외 요청을 전부 403으로
 * 돌려보낸다(`apps/api/src/auth/plugin.ts`). 화면이 단추를 잠그는 것은 권한이 아니라
 * 안내다 — 누르고 나서야 「읽기 전용이에요」를 보는 대신, 누르기 전에 흐린 단추로 안다.
 *
 * 등급은 `_layout.tsx`가 `GET /v1/admin/me`로 읽어 내린다. 새로고침에도 그 자리에서
 * 다시 읽으므로 로그인 응답을 따로 저장하지 않는다.
 */
export type AdminRole = 'super' | 'operator' | 'viewer';

const AdminRoleContext = createContext<AdminRole | null>(null);

export const AdminRoleProvider = AdminRoleContext.Provider;

export function useAdminRole(): AdminRole | null {
  return useContext(AdminRoleContext);
}

/**
 * 뷰어만 `false`. 등급을 아직 모르면(읽는 중 · 읽기 실패) `true`로 둔다 — 운영자
 * 화면이 한 번 흐려졌다 돌아오는 것보다 낫고, 그 사이 뷰어가 눌러도 서버가 막는다.
 */
export function useAdminCanWrite(): boolean {
  return useContext(AdminRoleContext) !== 'viewer';
}

/**
 * 서버에 GET 외 요청을 보내는 단추. 뷰어에게는 **보이되 눌리지 않는다.**
 *
 * 이름·자리는 그대로 두고 흐리게만 한다 — `features/admin/pending-backend`와 같은
 * 이유다. 단추를 숨기면 그 화면에서 무엇을 할 수 있는 자리인지가 사라진다.
 */
export function WritePressable({ disabled, style, accessibilityState, ...rest }: PressableProps) {
  const canWrite = useAdminCanWrite();
  const locked = !canWrite;
  const off = Boolean(disabled) || locked;

  return (
    <Pressable
      {...rest}
      disabled={off}
      accessibilityState={{ ...accessibilityState, disabled: off }}
      style={
        locked
          ? (state) => [typeof style === 'function' ? style(state) : style, styles.locked]
          : style
      }
    />
  );
}

const styles = StyleSheet.create({
  /* `_ui.tsx` `topActionDisabled`와 같은 값 — 서버 연결 전 단추와 같은 흐림이다. */
  locked: { opacity: 0.4 },
});
