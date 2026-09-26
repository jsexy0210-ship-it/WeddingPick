import { router, useNavigationContainerRef } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

import strings from '../../../../../spec/strings.ko.json';
import { backTo, focusedStackState } from './depth-back';
import { resolveBackAction } from './depth-back-rules';

/** 홈에서 두 번째 Back을 기다리는 시간. 이 안에 한 번 더 누르면 앱을 끝낸다. */
export const EXIT_CONFIRM_MS = 2_000;

/** 홈 첫 Back의 안내 — `spec/strings.ko.json` `common.back.exitConfirm`. */
export const EXIT_CONFIRM_MESSAGE = strings.common['back.exitConfirm'];

/**
 * 안드로이드 하드웨어 Back의 기본 정책 — `app/(tabs)/_layout.tsx` **한 곳**에서 듣는다.
 * 화면마다 `BackHandler`를 달지 않는다. 목적지는 헤더 Back과 같은 `resolveBackAction`이
 * 정한다 — 두 길이 서로 다른 곳으로 가지 않게 한다. (예외는 작성 중 이탈을 묻는 화면뿐이다 —
 * 상담 예약 `search/[vendorId]/consult.tsx`와 `(tabs)` 밖의 온보딩 `setup.tsx`가 자기 것을 먼저 건다.)
 *
 *   하위 화면     논리 부모(Depth Back). MY 하위는 MY 부모로, 출처(`from`)가 있으면 출처로
 *                 (연결관리 → MY · 리얼후기 → 업체 상세 → 리얼후기).
 *   Root 탭      검색 · Pick · 웨딩노트 · MY는 홈으로.
 *   홈           첫 Back은 안내만(`onExitHint`), 2초 안의 두 번째 Back만 `BackHandler.exitApp()`.
 *   History 예외 피드 상세처럼 목록 상태를 되살려야 하는 화면은 기본 처리(스택 pop)에 맡긴다.
 *
 * `backPathname`은 `withBackOrigin(pathname, from)` — 출처가 빠지면 연결관리의 Back이 웨딩노트로
 * 떨어진다. 화면이 바뀌면 두 번 누르기 기록을 지운다.
 */
export function useHardwareBackPolicy(backPathname: string, onExitHint: (message: string) => void): void {
  const lastExitBackAt = useRef(0);
  /* 레이아웃에는 화면의 `navigation`이 없다 — 지금 화면이 든 스택은 앱 전체 상태에서 찾는다(`backTo`). */
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    lastExitBackAt.current = 0;
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const action = resolveBackAction(backPathname, router.canGoBack());

      /* 같은 목록 안에서만 History를 허용한다. 기본 처리에 맡겨 스크롤·탭 상태를 살린다. */
      if (action.kind === 'history') return false;

      /* 하위 화면은 논리 부모로, 홈이 아닌 Root 탭은 홈으로 간다. */
      if (action.kind === 'depth') {
        backTo(action.target, backPathname, focusedStackState(navigationRef?.getRootState?.()));
        return true;
      }

      const now = Date.now();
      if (lastExitBackAt.current !== 0 && now - lastExitBackAt.current <= EXIT_CONFIRM_MS) {
        BackHandler.exitApp();
        return true;
      }

      lastExitBackAt.current = now;
      onExitHint(EXIT_CONFIRM_MESSAGE);
      return true;
    });

    return () => subscription.remove();
  }, [backPathname, navigationRef, onExitHint]);
}
