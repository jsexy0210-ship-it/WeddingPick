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
 * 2026-09-27 기본 로더로 통일 지시가 있지만 이 표시는 아직 OS 원형이다. iOS UIRefreshControl과
 * 안드로이드 SwipeRefreshLayout은 색·크기만 받아 사용자 지정 표시를 넣을 수 없다. 표시를 숨긴 뒤
 * 앱 뿌리에 로더 하나를 띄우면 화면마다 다른 스크롤 시작 위치와 맞지 않는다. 별도 화면 위치 계약과
 * 실기기 검증을 마련할 때까지 OS 제스처와 표시를 함께 유지한다.
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
