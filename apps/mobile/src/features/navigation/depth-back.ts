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
 * Depth Back 실행 — 규칙은 `depth-back-rules.ts`에 있고, 여기서는 옮기기만 한다.
 *
 * `router.dismissTo`를 쓴다. 부모가 이미 스택에 있으면 **그 화면으로 되돌아가고**(스크롤·
 * 입력값이 그대로 남는다), 없으면 현재 화면을 부모로 갈아끼운다. 링크로 곧장 들어온
 * 사람과 세 화면을 거쳐 온 사람이 같은 곳에 도착한다.
 *
 * 안드로이드 하드웨어 뒤로가기 · 웹 브라우저 뒤로가기는 건드리지 않는다 — 그쪽은
 * History Back이고, 방문 순서를 되짚는 것이 맞다.
 */
export function useDepthBack(): () => void {
  const pathname = usePathname();

  return useCallback(() => {
    goUp(depthBackTarget(pathname));
  }, [pathname]);
}

/** 훅을 쓸 수 없는 자리(이벤트 핸들러 안 등)를 위한 같은 동작. */
export function goDepthBack(pathname: string): void {
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
