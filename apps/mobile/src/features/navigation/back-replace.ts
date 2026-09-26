import type { NavigationAction, Router, StackNavigationState, ParamListBase } from 'expo-router/build/react-navigation/routers';

/**
 * 웹 JS 스택 — «되돌아가려 했는데 갈 곳이 스택에 없어서 갈아끼운» 라우트를 표시한다.
 *
 * Depth Back · X 닫기는 `dismissToOrReplace` → `router.dismissTo`(POP_TO)다. 부모가 스택에 없으면
 * (다른 탭에서 들어온 업체 상세 · 딥링크 · 새로고침한 풀팝업) StackRouter는 현재 화면을 부모로
 * **갈아끼운다**. JS 스택은 갈아끼우기를 기본으로 «push»처럼 그려서, 뒤로를 눌렀는데 부모가
 * 오른쪽에서 밀려 들어왔다(2026-09-26 검수 반례).
 *
 * POP_TO는 이름 그대로 «거기까지 접는다»는 되돌아가기다. 그래서 POP_TO가 갈아끼우기로 끝나면
 * 새로 들어온 라우트 키를 여기 적고, 스택 화면 옵션(`transition-options.web.ts`)이 그 라우트만
 * `animationTypeForReplace: 'pop'`으로 그린다 — 떠나는 화면이 제 닫는 움직임(오른쪽 · 아래)으로
 * 빠지고 부모가 그 밑에 드러난다. **앞으로 가는 갈아끼우기(상담 → 상담 완료 등 `replace`)는
 * 그대로 push다** — 전역으로 'pop'을 걸면 그쪽이 거꾸로 움직인다.
 *
 * 라우트 키는 라우트마다 새로 만들어지는 값이라 표시는 그 라우트 한 번에만 걸린다.
 */
const BACK_REPLACED = new Set<string>();

export function isBackReplace(routeKey: string | undefined): boolean {
  return routeKey !== undefined && BACK_REPLACED.has(routeKey);
}

type StackState = StackNavigationState<ParamListBase>;

/**
 * 웹 스택 라우터 덮개. expo-router 기본 Stack이 쓰는 `stackRouterOverride`(같은 이름 · 다른 경로
 * 인자면 새 화면을 민다)를 먼저 씌우고, 그 위에 POP_TO 갈아끼우기 표시를 더한다.
 */
export function backAwareStackRouter(
  original: Router<StackState, NavigationAction>,
  base: (router: Router<StackState, NavigationAction>) => Partial<Router<StackState, NavigationAction>>
): Partial<Router<StackState, NavigationAction>> {
  const router = { ...original, ...base(original) };

  return {
    ...router,
    getStateForAction(state, action, options) {
      const next = router.getStateForAction(state, action, options);

      if (action.type === 'POP_TO' && next && next !== state && 'routes' in next && Array.isArray(next.routes)) {
        const key = next.routes[next.index ?? next.routes.length - 1]?.key;
        if (key && !state.routes.some((route) => route.key === key)) BACK_REPLACED.add(key);
      }

      return next;
    },
  };
}
