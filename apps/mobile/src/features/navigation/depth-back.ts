import { router, usePathname } from 'expo-router';
import { useCallback } from 'react';

import { depthBackTarget } from './depth-back-rules';

export {
  DEPTH_BACK_EXCEPTIONS,
  NO_BACK_ROUTES,
  ROUTES,
  TAB_ROOTS,
  depthBackTarget,
  hasDepthBack,
  matchRoute,
} from './depth-back-rules';

/**
 * 좌상단 뒤로가기 실행 — **History 우선, 없으면 Depth Back**(2026-09-15 대표 지시로
 * 정책 변경). 규칙은 `depth-back-rules.ts`에 있고, 여기서는 옮기기만 한다.
 *
 *   1. 현재 스택에 방문 기록이 있으면(`router.canGoBack()`) `router.back()` — 실제
 *      직전 화면으로 되돌아간다. 탭은 각자 독립된 스택이라(`app/(tabs)/_layout.tsx`
 *      아래 탭마다 자기 `<Stack>`) 탭을 넘나든 이동은 여기 걸리지 않는다 — 탭 전환은
 *      Back 히스토리가 아니다.
 *   2. 기록이 없으면(딥링크·알림 등 직접 진입) `depthBackTarget`이 계산한 부모로
 *      간다 — `router.dismissTo`를 쓴다. 부모가 이미 스택에 있으면 그 화면으로
 *      되돌아가고(스크롤·입력값이 남는다), 없으면 현재 화면을 부모로 갈아끼운다.
 *
 * 화면마다 `if (canGoBack) back() else fallback`을 따로 적던 것(`pick/compare.tsx`
 * `pick/confirm.tsx` `wedding/[id]/expenses/add.tsx` `wedding/[id]/events/new.tsx`
 * `search/index.tsx`)을 여기 한 곳으로 모았다.
 *
 * 안드로이드 하드웨어 뒤로가기 · 웹 브라우저 뒤로가기는 건드리지 않는다 — 그쪽은
 * 원래부터 History Back이고, 방문 순서를 되짚는 것이 맞다.
 */
export function useDepthBack(): () => void {
  const pathname = usePathname();

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    goUp(depthBackTarget(pathname));
  }, [pathname]);
}

/** 훅을 쓸 수 없는 자리(이벤트 핸들러 안 등)를 위한 같은 동작. */
export function goDepthBack(pathname: string): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  goUp(depthBackTarget(pathname));
}

function goUp(target: string): void {
  try {
    router.dismissTo(target as never);
  } catch {
    // 스택 밖(탭 루트로 건너뛸 때)에서는 dismissTo가 설 자리가 없다. 갈아끼운다.
    router.replace(target as never);
  }
}
