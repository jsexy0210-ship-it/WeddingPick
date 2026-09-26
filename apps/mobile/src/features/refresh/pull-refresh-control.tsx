import { RefreshControl, type RefreshControlProps } from 'react-native';

import { useTheme } from '@weddingpick/ui';

export type PullRefreshControlProps = RefreshControlProps;

/**
 * 당겨서 새로 고침 — **네이티브**(iOS · 안드로이드). OS의 `RefreshControl` 그대로다.
 *
 * 당기는 몸짓 · 문턱 · 되돌아가는 움직임은 OS가 그리고, 여기서는 색만 스킨(`tint`, 기본 coral)에
 * 맞춘다. 웹은 같은 이름의 `pull-refresh-control.web.tsx`가 받는다 — react-native-web의
 * `RefreshControl`은 당기는 몸짓이 없는 빈 껍데기라서다.
 *
 * **정본과 다른 자리가 있다.** RN 정본 `common.js` 로더 표는 「당겨서 새로 고침 — 아이콘 순회 20」이고
 * 같은 표가 「원형 스피너를 쓰지 않아요」라고 적는다. OS의 당김 표시는 원형이고 앱이 모양을 바꿀 수
 * 없다(iOS UIRefreshControl · 안드로이드 SwipeRefreshLayout). 모양을 맞추려면 OS 컨트롤을 버리고 직접
 * 그려야 하는데, 그러면 OS 스크롤의 튕김 · 관성과 어긋난다 — DESIGN_UNRESOLVED(대표님 확인 전).
 *
 * 스크롤 목록의 `refreshControl`에 넣는다. 화면은 대개 `usePullRefresh`가 만든 것을 그대로 쓴다.
 */
export function PullRefreshControl(props: PullRefreshControlProps) {
  const theme = useTheme();

  return (
    <RefreshControl
      tintColor={theme.tint}
      colors={[theme.tint]}
      progressBackgroundColor={theme.background}
      {...props}
    />
  );
}
