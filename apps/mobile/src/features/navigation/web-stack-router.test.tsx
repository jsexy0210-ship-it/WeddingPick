/**
 * 웹 JS 스택의 라우터 — 2026-09-26 검수 반례 둘.
 *
 *   1. 같은 라우트를 다른 경로 인자로 열면(Pick → 업체 B 상세, 검색 스택 맨 위는 업체 C 상세) 새 화면을
 *      밀지 않고 C 화면을 그 자리에서 B로 바꿨다 — B가 C의 「후기」 탭 · C의 내용으로 열렸다.
 *      기본 expo-router Stack이 쓰는 `stackRouterOverride`가 JS 스택에 빠져 있었다.
 *   2. 부모가 스택에 없을 때 Depth Back · X(POP_TO)가 갈아끼우기로 끝나는데, 그 움직임이 push였다 —
 *      뒤로를 눌렀는데 부모가 오른쪽에서 밀려 들어왔다.
 */
import { act, create } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { StackRouter, type NavigationAction, type ParamListBase, type Router, type StackNavigationState } from 'expo-router/build/react-navigation/routers';

import { AppStack, webStackRouter } from './app-stack.web';
import { isBackReplace } from './back-replace';
import { useStackScreenOptions } from './screen-options';
import { stackScreenOptions } from './transition-options.web';

const mockJSStack = jest.fn((_props: Record<string, unknown>) => null);
jest.mock('expo-router/js-stack', () => ({
  Stack: Object.assign((props: Record<string, unknown>) => mockJSStack(props), { Screen: 'Screen', Protected: 'Protected' }),
}));

/* 화면 옵션 훅이 넘기는 문맥만 본다 — 플랫폼 옵션 자체는 아래에서 웹 판을 직접 부른다. */
jest.mock('./transition-options', () => ({ stackScreenOptions: jest.fn((_kind: string, context: object) => context) }));

type State = StackNavigationState<ParamListBase>;

const ROUTE_NAMES = ['index', '[vendorId]/index', '[vendorId]/consult'];
const OPTIONS = { routeNames: ROUTE_NAMES, routeParamList: {}, routeGetIdList: {} };

function searchStack(routes: { key: string; name: string; params?: object }[]): State {
  return { stale: false, type: 'stack', key: 'stack-search', index: routes.length - 1, routeNames: ROUTE_NAMES, preloadedRoutes: [], routes } as State;
}

function webRouter(): Router<State, NavigationAction> {
  const original = StackRouter({}) as unknown as Router<State, NavigationAction>;
  return { ...original, ...(webStackRouter as unknown as (router: typeof original) => Partial<typeof original>)(original) } as Router<State, NavigationAction>;
}

describe('웹 JS 스택 라우터', () => {
  it('AppStack(웹)은 JS 스택에 기본 Stack과 같은 라우터 덮개를 넘긴다', () => {
    act(() => {
      create(<AppStack />);
    });

    expect(mockJSStack).toHaveBeenCalled();
    expect(mockJSStack.mock.calls[0]![0].UNSTABLE_router).toBe(webStackRouter);
  });

  it('맨 위가 업체 C 상세일 때 업체 B 상세로 가면 새 화면을 민다 — C 화면을 B로 바꿔 쓰지 않는다', () => {
    const state = searchStack([
      { key: 'index-a', name: 'index' },
      { key: 'vendor-c', name: '[vendorId]/index', params: { vendorId: 'C' } },
    ]);

    const next = webRouter().getStateForAction(
      state,
      { type: 'NAVIGATE', payload: { name: '[vendorId]/index', params: { vendorId: 'B' } } } as NavigationAction,
      OPTIONS
    ) as State;

    expect(next.routes.map((route) => route.key).slice(0, 2)).toEqual(['index-a', 'vendor-c']);
    expect(next.routes).toHaveLength(3);
    expect(next.routes[2]!.key).not.toBe('vendor-c');
    expect(next.routes[2]!.params).toEqual({ vendorId: 'B' });
  });

  it('부모 없이 Depth Back(POP_TO)이 갈아끼우면 그 라우트는 pop으로 그린다', () => {
    const state = searchStack([{ key: 'vendor-b', name: '[vendorId]/index', params: { vendorId: 'B' } }]);

    const next = webRouter().getStateForAction(state, { type: 'POP_TO', payload: { name: 'index' } } as NavigationAction, OPTIONS) as State;

    expect(next.routes).toHaveLength(1);
    const parent = next.routes[0]!;
    expect(parent.name).toBe('index');
    expect(isBackReplace(parent.key)).toBe(true);

    const context = { background: '#FFFFFF', reduceMotion: false };
    const options = stackScreenOptions('push', { ...context, replacedByBack: isBackReplace(parent.key) }) as { animationTypeForReplace?: string };
    expect(options.animationTypeForReplace).toBe('pop');
  });

  it('앞으로 가는 갈아끼우기(replace)와 스택 안의 되돌아가기는 표시하지 않는다', () => {
    const inStack = searchStack([
      { key: 'index-a', name: 'index' },
      { key: 'vendor-b', name: '[vendorId]/index', params: { vendorId: 'B' } },
    ]);
    const popped = webRouter().getStateForAction(inStack, { type: 'POP_TO', payload: { name: 'index' } } as NavigationAction, OPTIONS) as State;
    expect(popped.routes.map((route) => route.key)).toEqual(['index-a']);
    expect(isBackReplace('index-a')).toBe(false);

    const replaced = webRouter().getStateForAction(
      inStack,
      { type: 'REPLACE', payload: { name: '[vendorId]/consult', params: { vendorId: 'B' } } } as NavigationAction,
      OPTIONS
    ) as State;
    const forward = replaced.routes[replaced.routes.length - 1]!;
    expect(forward.name).toBe('[vendorId]/consult');
    expect(isBackReplace(forward.key)).toBe(false);

    const context = { background: '#FFFFFF', reduceMotion: false };
    expect((stackScreenOptions('push', { ...context, replacedByBack: false }) as { animationTypeForReplace?: string }).animationTypeForReplace).toBe('push');
  });

  it('스택 화면 옵션 훅이 그 표시를 라우트 키로 읽어 넘긴다', () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise<boolean>(() => undefined));
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: () => undefined } as never);
    const mocked = jest.requireMock('./transition-options') as { stackScreenOptions: jest.Mock };
    mocked.stackScreenOptions.mockImplementation((_kind: string, context: object) => context);

    const state = searchStack([{ key: 'vendor-x', name: '[vendorId]/index', params: { vendorId: 'X' } }]);
    const next = webRouter().getStateForAction(state, { type: 'POP_TO', payload: { name: 'index' } } as NavigationAction, OPTIONS) as State;
    const parentKey = next.routes[0]!.key;

    let options: ReturnType<typeof useStackScreenOptions> | null = null;
    function Probe() {
      options = useStackScreenOptions();
      return null;
    }
    act(() => {
      create(<Probe />);
    });

    const read = options as unknown as ReturnType<typeof useStackScreenOptions>;
    expect(read({ route: { name: 'index', key: parentKey } })).toMatchObject({ replacedByBack: true });
    expect(read({ route: { name: 'index', key: 'index-other' } })).toMatchObject({ replacedByBack: false });
  });
});
