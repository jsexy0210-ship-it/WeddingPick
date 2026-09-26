import { Alert, Platform } from 'react-native';

import { confirm as confirmCopy, common as commonCopy } from '../../../../../spec/strings.ko.json';

/**
 * 관리자 로그아웃 — 한 번 묻고 나간다(2026-09-26 대표 지시).
 *
 * **OS 확인창을 쓴다.** 웹은 브라우저의 `window.confirm`, 네이티브는 `Alert.alert`다.
 * 앱의 공용 확인창(`components/confirm-alert.web.ts`)은 쓰지 않았다 — 그것은 OS 창이
 * 아니라 앱 정본(`docs/design/React_Native` WP-DLG)의 390 폭 코랄 모달을 페이지 안에
 * 그리는 부품이라, 「OS confirm」이라는 지시와도 관리자 정본과도 맞지 않는다.
 *
 * 정본 `docs/design/html/웨딩픽 관리자.dc.html`의 `doLogout`은 묻지 않고 바로 나간다 —
 * 확인 단계와 그 문구(「로그아웃할까요?」)는 정본에 없다(DESIGN_UNRESOLVED).
 * 문구는 `spec/strings.ko.json` `confirm.logout.*`에서 온다.
 */
export const LOGOUT_CONFIRM_TITLE: string = confirmCopy['logout.title'];

/** 「로그아웃할까요?」에 예/아니오를 받는다. 창을 띄울 수 없으면 나가지 않는다. */
export function askSignOut(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return Promise.resolve(false);
    return Promise.resolve(window.confirm(LOGOUT_CONFIRM_TITLE));
  }

  return new Promise((resolve) => {
    Alert.alert(
      LOGOUT_CONFIRM_TITLE,
      undefined,
      [
        { text: commonCopy['cta.cancel'], style: 'cancel', onPress: () => resolve(false) },
        { text: confirmCopy['logout.cta'], onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

/**
 * 묻고, 「확인」이면 토큰을 지우고 로그인으로 간다. 「취소」면 아무것도 하지 않는다 —
 * 세션도 화면도 그대로다. 나갔는지를 돌려준다.
 */
export async function signOutWithConfirm(deps: {
  ask: () => Promise<boolean>;
  clear: () => Promise<void>;
  go: () => void;
}): Promise<boolean> {
  if (!(await deps.ask())) return false;
  await deps.clear();
  deps.go();
  return true;
}
