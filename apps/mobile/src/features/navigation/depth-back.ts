import { router, useLocalSearchParams, useNavigation, usePathname } from 'expo-router';
import { useCallback, useEffect } from 'react';

import {
  crossesStack,
  crossesStackOnBack,
  depthBackTarget,
  resolveBackAction,
  stackPopCount,
  type StackStateLike,
} from './depth-back-rules';

export {
  DEPTH_BACK_EXCEPTIONS,
  HISTORY_BACK_ROUTES,
  NO_BACK_ROUTES,
  ROUTES,
  TAB_ROOTS,
  chainOrigin,
  compareOrigin,
  crossesStack,
  crossesStackOnBack,
  depthBackTarget,
  hasDepthBack,
  hasHistoryBack,
  matchRoute,
  pickOrigin,
  resolveBackAction,
  stackPopCount,
} from './depth-back-rules';
export type { StackStateLike } from './depth-back-rules';

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
  const navigation = useNavigation();

  useCrossStackBack(backPathname, pathname);

  return useCallback(() => {
    const action = resolveBackAction(backPathname, router.canGoBack());
    if (action.kind === 'history') {
      router.back();
      return;
    }
    if (action.kind === 'depth') backTo(action.target, backPathname, readStackState(navigation));
  }, [backPathname, navigation]);
}

/**
 * 화면의 `navigation`에서 **그 화면이 든 스택**의 상태를 읽는다. 읽을 수 없으면(시험 목 · 스택 밖)
 * null — 그때 `backTo`는 전처럼 `dismissTo`로 간다.
 */
export function readStackState(navigation: { getState?: () => unknown } | null | undefined): StackStateLike | null {
  try {
    const state = navigation?.getState?.() as Partial<StackStateLike> & { type?: string } | undefined;
    if (!state || !Array.isArray(state.routes) || typeof state.index !== 'number') return null;
    return state.type === undefined || state.type === 'stack' ? (state as StackStateLike) : null;
  } catch {
    return null;
  }
}

/**
 * 앱 전체 상태(`navigationRef.getRootState()`)에서 **지금 보이는 화면이 든 가장 안쪽 스택**을 찾는다.
 * 안드로이드 하드웨어 Back은 탭 레이아웃에서 듣기 때문에 화면의 `navigation`이 없다 — 이 값으로
 * 헤더 Back과 같은 계산(`stackPopCount`)을 한다.
 */
export function focusedStackState(root: unknown): StackStateLike | null {
  type Node = { type?: string; index?: number; routes?: { state?: Node }[] };
  let node = root as Node | undefined;
  let stack: StackStateLike | null = null;

  for (let depth = 0; node && Array.isArray(node.routes) && typeof node.index === 'number' && depth < 8; depth += 1) {
    if (node.type === 'stack') stack = node as unknown as StackStateLike;
    node = node.routes[node.index]?.state;
  }

  return stack;
}

/**
 * 헤더 Back 말고 **자기 닫기**를 가진 화면(상담 예약 풀팝업)이 `backTo`로 다른 탭 출처에 돌아갈 때
 * `useDepthBack`과 같은 뒷정리를 건다 — 스와이프 끄기 · 떠난 스택 접기.
 */
export function useCrossStackBack(backPathname: string, pathname: string): void {
  useOriginBackGesture(backPathname);
  useCrossStackCleanup(pathname, backPathname);
}

/**
 * 출처가 다른 탭에 있을 때(MY → 연결관리 · MY 후기 → 업체 상세 · 리얼후기 → 업체 상세)는 그
 * 화면이 **출처의 스택이 아니라 제 탭의 스택**에 쌓인다. iOS 가장자리 스와이프는 스택 아래
 * 화면을 드러낼 뿐이라 출처가 아니라 웨딩노트 · 검색 홈이 나온다. 그 경우에만 제스처를 끄고
 * 헤더 Back(= 출처)만 남긴다. 같은 스택으로 돌아가는 뒤로(`partner.my` → 초대 수락 → 연결관리)는
 * 건드리지 않는다.
 */
function useOriginBackGesture(backPathname: string): void {
  const navigation = useNavigation();
  const crossing = crossesStackOnBack(backPathname);

  useEffect(() => {
    if (crossing) navigation.setOptions({ gestureEnabled: false });
  }, [crossing, navigation]);
}

/** 훅을 쓸 수 없는 자리(이벤트 핸들러 안 등)를 위한 같은 동작. */
export function goDepthBack(pathname: string, stack?: StackStateLike | null): void {
  const action = resolveBackAction(pathname, router.canGoBack());
  if (action.kind === 'history') {
    router.back();
    return;
  }
  if (action.kind === 'depth') backTo(action.target, pathname, stack);
}

/**
 * 계산한 부모로 간다. **같은 스택**이면 `dismissToOrReplace`로 그 화면까지 접고, **다른 탭의
 * 스택**이면(출처가 MY · 리얼후기 · 홈인 연결관리 · 업체 상세, Root 탭 → 홈) `navigate`로 그 탭의
 * 그 화면을 연다.
 *
 * `dismissTo`(POP_TO)는 탭 내비게이터가 받지 못한다 — 목적지가 다른 탭이면 Expo Router가 그
 * 액션을 탭에 보내고, 탭은 처리하지 못한 채 **아무 일도 일어나지 않는다**(던지지도 않아
 * `replace`로도 넘어가지 않는다). 2026-09-26 웹 빌드에서 `/wedding/partner?from=my`의 헤더
 * Back이 제자리였다.
 */
export function backTo(target: string, currentPathname: string, stack?: StackStateLike | null): void {
  if (crossesStack(currentPathname, target)) {
    pendingStackCleanup = { path: pathOnly(currentPathname), at: Date.now() };
    router.navigate(target as never);
    return;
  }
  /*
   * 목적지가 이 스택 아래에 이미 있으면 그만큼 꺼낸다(POP) — `dismissTo`는 그 화면의 params를
   * 갈아끼워 들어온 출처(`from`)를 지운다(`stackPopCount`). 업체 상세(from=pick) → 사진 → Back →
   * 업체 상세 → Back이 Pick으로 가는 것은 이 한 줄 덕이다.
   */
  const count = stackPopCount(stack, pathOnly(currentPathname), target);
  if (count !== null) {
    router.dismiss(count);
    return;
  }
  dismissToOrReplace(target);
}

/** 다른 탭으로 돌아간 뒤 떠난 스택을 접을 화면 — 그 화면이 blur될 때 한 번 쓰고 비운다. */
let pendingStackCleanup: { path: string; at: number } | null = null;

/** 이 시간 안에 blur되지 않으면 버린다 — 오래된 표시가 나중의 다른 이동에 걸리지 않게. */
const CLEANUP_WINDOW_MS = 2_000;

function pathOnly(path: string): string {
  return path.split('?')[0]!.split('#')[0]!;
}

/**
 * 다른 탭으로 돌아간 뒤(`backTo`의 navigate) **떠난 스택을 뿌리로 접는다.** 접지 않으면 그 탭을
 * 다시 눌렀을 때 방금 나온 화면이 그대로 떠 있다 — MY → 연결관리 → Back(MY) → 웨딩노트 탭 =
 * 연결관리(2026-09-26 웹 빌드 실측). 목적지로 옮겨 간 **뒤에**(blur) 접어서 접히는 모습이 보이지
 * 않는다. 스택이 이 화면 하나뿐이면(딥링크) 그 탭의 첫 화면(`index`)으로 갈아끼운다.
 *
 * 웹 브라우저 Back은 `backTo`를 거치지 않는다 — 출처가 다른 탭인 화면(`from=pick` 업체 상세 등)이
 * **그 출처 탭으로 옮겨 가며** blur되면 같은 정리를 한다(2026-09-26 웹 빌드 실측: Pick → 업체 상세 →
 * 브라우저 Back → 검색 탭 = 그 업체 상세). 출처가 아닌 다른 탭으로 옮겨 간 것은 탭 상태 그대로 둔다.
 */
function useCrossStackCleanup(pathname: string, backPathname: string = pathname): void {
  const navigation = useNavigation();
  const originTab = crossesStackOnBack(backPathname) ? tabNameOf(depthBackTarget(backPathname)) : null;

  useEffect(() => navigation.addListener('blur', () => {
    const pending = pendingStackCleanup;
    const viaBackTo = pending !== null && pending.path === pathOnly(pathname) && Date.now() - pending.at <= CLEANUP_WINDOW_MS;
    const toOriginTab = !viaBackTo && originTab !== null && focusedTabName(navigation) === originTab;
    if (!viaBackTo && !toOriginTab) return;
    if (viaBackTo) pendingStackCleanup = null;

    const state = navigation.getState();
    if (!state || state.type !== 'stack') return;
    if (state.routes.length > 1) {
      navigation.dispatch({ type: 'POP_TO_TOP', target: state.key } as never);
    } else if (state.routeNames.includes('index')) {
      navigation.dispatch({ type: 'REPLACE', payload: { name: 'index' }, target: state.key } as never);
    }
  }), [navigation, pathname, originTab]);
}

/** 주소의 첫 조각 → 그 주소가 사는 탭의 라우트 이름(`app/(tabs)`). 홈(`/`)은 `index`다. */
function tabNameOf(path: string): string {
  return pathOnly(path).split('/').filter(Boolean)[0] ?? 'index';
}

/** 지금 켜진 탭의 라우트 이름 — 화면의 부모(탭 내비게이터) 상태에서 읽는다. 모르면 null. */
function focusedTabName(navigation: { getParent?: () => unknown }): string | null {
  try {
    const parent = navigation.getParent?.() as { getState?: () => { index?: number; routes?: { name?: string }[] } } | undefined;
    const tabs = parent?.getState?.();
    return typeof tabs?.index === 'number' ? (tabs.routes?.[tabs.index]?.name ?? null) : null;
  } catch {
    return null;
  }
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
