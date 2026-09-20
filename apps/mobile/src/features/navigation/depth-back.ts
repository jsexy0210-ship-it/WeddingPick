import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useCallback } from 'react';

import { resolveBackAction } from './depth-back-rules';

export {
  DEPTH_BACK_EXCEPTIONS,
  HISTORY_BACK_ROUTES,
  NO_BACK_ROUTES,
  ROUTES,
  TAB_ROOTS,
  depthBackTarget,
  hasDepthBack,
  hasHistoryBack,
  matchRoute,
  resolveBackAction,
} from './depth-back-rules';

/** `usePathname()`에서 빠지는 안전한 진입 출처만 Depth 계산에 다시 붙인다. */
export function withBackOrigin(pathname: string, from?: string | string[]): string {
  const value = Array.isArray(from) ? from[0] : from;

  return value ? `${pathname}?from=${encodeURIComponent(value)}` : pathname;
}

/**
 * 좌상단 뒤로가기 실행 — **Depth Back이 기본**이다(SPEC §14.5).
 * 규칙은 `depth-back-rules.ts`에 있고, 여기서는 옮기기만 한다.
 *
 *   1. `HISTORY_BACK_ROUTES`에 적힌 시트·같은 계층 상세이고 현재 스택에 방문 기록이
 *      있을 때만 `router.back()`으로 탭·스크롤 상태를 복원한다.
 *   2. 그 외에는 방문 기록을 보지 않고 `depthBackTarget`이 계산한 부모로 간다.
 *      부모가 스택에 있으면 `dismissTo`로 그 화면까지 접고, 직접 진입이라 부모가
 *      없으면 현재 화면을 부모로 갈아끼운다.
 *
 * 화면마다 `if (canGoBack) back() else fallback`을 따로 적던 것(`pick/compare.tsx`
 * `pick/confirm.tsx` `wedding/[id]/expenses/add.tsx` `wedding/[id]/events/new.tsx`
 * `search/index.tsx`)을 여기 한 곳으로 모았다.
 *
 * 이 함수는 공용 화면 Back 계약이다. 작성 중 확인이나 완료 CTA처럼 별도 행동이 필요한
 * 화면은 이 함수를 거치지 않고 화면이 직접 처리한다.
 */
export function useDepthBack(): () => void {
  const pathname = usePathname();
  const { from } = useLocalSearchParams<{ from?: string | string[] }>();
  const backPathname = withBackOrigin(pathname, from);

  return useCallback(() => {
    const action = resolveBackAction(backPathname, router.canGoBack());
    if (action.kind === 'history') {
      router.back();
      return;
    }
    if (action.kind === 'depth') dismissToOrReplace(action.target);
  }, [backPathname]);
}

/** 훅을 쓸 수 없는 자리(이벤트 핸들러 안 등)를 위한 같은 동작. */
export function goDepthBack(pathname: string): void {
  const action = resolveBackAction(pathname, router.canGoBack());
  if (action.kind === 'history') {
    router.back();
    return;
  }
  if (action.kind === 'depth') dismissToOrReplace(action.target);
}

/**
 * 완료 CTA처럼 목적지가 이미 정해진 자리에서 History를 되짚지 않고 그 화면으로 끝낸다.
 * 대상이 스택에 있으면 거기까지 접고, 직접 진입이라 대상이 없으면 현재 화면을 교체한다.
 */
export function dismissToOrReplace(target: string): void {
  try {
    router.dismissTo(target as never);
  } catch {
    // 스택 밖(탭 루트로 건너뛸 때)에서는 dismissTo가 설 자리가 없다. 갈아끼운다.
    router.replace(target as never);
  }
}
