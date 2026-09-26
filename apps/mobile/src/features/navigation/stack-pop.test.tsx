import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';

import { stackPopCount, type StackStateLike } from './depth-back-rules';
import { backTo, focusedStackState, readStackState, useDepthBack } from './depth-back';

/**
 * Depth Back의 목적지가 **같은 스택 아래에 이미 있으면 꺼낸다(POP)** — `dismissTo`(POP_TO)는 그 화면의
 * params를 목적지 주소 값으로 갈아끼워 들어온 출처(`from`)를 지운다(React Navigation StackRouter,
 * merge 없음). 2026-09-26 대표 감사: Pick → 내 조건에 맞는 곳 → 업체 상세(from=pick) → 사진 → Back →
 * 업체 상세 → Back이 Pick이 아니라 검색으로 갔다.
 */

let mockPathname = '/search/v-1/images';
let mockFrom: string | undefined;
let mockState: unknown = null;

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    dismiss: jest.fn(),
    dismissTo: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  usePathname: () => mockPathname,
  useLocalSearchParams: () => ({ from: mockFrom }),
  useNavigation: () => ({
    setOptions: jest.fn(),
    dispatch: jest.fn(),
    getState: () => mockState,
    addListener: () => () => undefined,
  }),
}));

/** 검색 스택 — [검색 · 업체 상세(출처) · 사진]. */
const SEARCH_STACK: StackStateLike = {
  index: 2,
  routes: [
    { name: 'index' },
    { name: '[vendorId]/index', params: { vendorId: 'v-1', from: 'pick/sdm' } },
    { name: '[vendorId]/images', params: { vendorId: 'v-1', index: '2' } },
  ],
};

describe('stackPopCount — 목적지가 스택 아래에 있는가', () => {
  it('사진 → 업체 상세: 한 장 아래에 있다', () => {
    expect(stackPopCount(SEARCH_STACK, '/search/v-1/images', '/search/v-1')).toBe(1);
  });

  it('사진 → 검색: 두 장 아래', () => {
    expect(stackPopCount(SEARCH_STACK, '/search/v-1/images', '/search')).toBe(2);
  });

  it('다른 업체의 상세는 아래에 없다 → null(전처럼 dismissTo)', () => {
    expect(stackPopCount(SEARCH_STACK, '/search/v-1/images', '/search/v-2')).toBeNull();
  });

  it('스택 한 장뿐(딥링크)이면 null', () => {
    expect(stackPopCount({ index: 0, routes: [SEARCH_STACK.routes[2]!] }, '/search/v-1/images', '/search/v-1')).toBeNull();
  });

  it('상태를 모르면 null', () => {
    expect(stackPopCount(null, '/search/v-1/images', '/search/v-1')).toBeNull();
    expect(stackPopCount(undefined, '/search/v-1/images', '/search/v-1')).toBeNull();
  });

  it('지금 주소와 스택 맨 위가 맞지 않으면 추측하지 않는다', () => {
    expect(stackPopCount(SEARCH_STACK, '/search/v-9/images', '/search/v-9')).toBeNull();
  });

  it('목적지 쿼리가 그 화면의 params와 같을 때만 — 비교 목록이 같으면 꺼낸다', () => {
    const stack: StackStateLike = {
      index: 1,
      routes: [
        { name: 'compare', params: { ids: 'v-1,v-2' } },
        { name: '[vendorId]/consult', params: { vendorId: 'v-1', from: 'compare/v-1,v-2' } },
      ],
    };
    expect(stackPopCount(stack, '/search/v-1/consult', '/search/compare?ids=v-1,v-2')).toBe(1);
    expect(stackPopCount(stack, '/search/v-1/consult', '/search/compare?ids=v-1,v-3')).toBeNull();
  });

  it('쿼리가 다르면(예산 탭) null — dismissTo가 값을 새로 넣는다', () => {
    const stack: StackStateLike = {
      index: 1,
      routes: [
        { name: 'index', params: {} },
        { name: '[id]/expenses/list', params: { id: 'w-1' } },
      ],
    };
    expect(stackPopCount(stack, '/wedding/w-1/expenses/list', '/wedding?tab=budget')).toBeNull();
    expect(stackPopCount({ ...stack, routes: [{ name: 'index', params: { tab: 'budget' } }, stack.routes[1]!] }, '/wedding/w-1/expenses/list', '/wedding?tab=budget')).toBe(1);
  });

  it('MY 하위 → MY(스택 뿌리 index)', () => {
    const stack: StackStateLike = { index: 1, routes: [{ name: 'index' }, { name: 'reviews' }] };
    expect(stackPopCount(stack, '/my/reviews', '/my')).toBe(1);
  });

  it('초대 수락 → 연결관리(from=my): 연결관리가 들고 있던 출처를 그대로 둔다', () => {
    const stack: StackStateLike = {
      index: 2,
      routes: [{ name: 'index' }, { name: 'partner', params: { from: 'my' } }, { name: 'join', params: { from: 'partner.my' } }],
    };
    expect(stackPopCount(stack, '/wedding/join', '/wedding/partner?from=my')).toBe(1);
  });

  it('홈 스택의 (group) 조각은 주소에 없다', () => {
    const stack: StackStateLike = { index: 1, routes: [{ name: 'index' }, { name: '(detail)/notice' }] };
    expect(stackPopCount(stack, '/notice', '/')).toBe(1);
  });
});

describe('focusedStackState · readStackState', () => {
  it('앱 전체 상태에서 지금 보이는 화면이 든 가장 안쪽 스택', () => {
    const root = {
      type: 'stack',
      index: 0,
      routes: [{ name: '(tabs)', state: { type: 'tab', index: 1, routes: [{ name: '(home)' }, { name: 'search', state: { type: 'stack', ...SEARCH_STACK } }] } }],
    };
    expect(focusedStackState(root)).toMatchObject({ index: 2, routes: SEARCH_STACK.routes });
    expect(focusedStackState(undefined)).toBeNull();
  });

  it('탭 상태 · 모양이 틀린 값은 스택이 아니다', () => {
    expect(readStackState({ getState: () => ({ type: 'tab', index: 0, routes: [] }) })).toBeNull();
    expect(readStackState({ getState: () => ({ type: 'stack', routes: [] }) })).toBeNull();
    expect(readStackState({ getState: () => { throw new Error('no'); } })).toBeNull();
    expect(readStackState(null)).toBeNull();
    expect(readStackState({ getState: () => ({ type: 'stack', ...SEARCH_STACK }) })).toMatchObject({ index: 2 });
  });
});

describe('backTo — 같은 스택은 꺼내기, 다른 탭은 navigate', () => {
  afterEach(() => jest.clearAllMocks());

  it('목적지가 아래에 있으면 dismiss(n) — dismissTo를 부르지 않는다', () => {
    backTo('/search/v-1', '/search/v-1/images', SEARCH_STACK);
    expect(router.dismiss).toHaveBeenCalledWith(1);
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('스택을 모르면 전처럼 dismissTo', () => {
    backTo('/search/v-1', '/search/v-1/images');
    expect(router.dismissTo).toHaveBeenCalledWith('/search/v-1');
    expect(router.dismiss).not.toHaveBeenCalled();
  });

  it('다른 탭(출처 Pick)이면 스택과 무관하게 navigate', () => {
    backTo('/pick?group=sdm', '/search/v-1?from=pick%2Fsdm', SEARCH_STACK);
    expect(router.navigate).toHaveBeenCalledWith('/pick?group=sdm');
    expect(router.dismiss).not.toHaveBeenCalled();
  });
});

describe('useDepthBack — 헤더 Back이 화면의 스택 상태를 쓴다', () => {
  const handle: { back: () => void } = { back: () => undefined };
  let tree: ReactTestRenderer | null = null;

  function Probe() {
    const depthBack = useDepthBack();
    useEffect(() => {
      handle.back = depthBack;
    }, [depthBack]);
    return null;
  }

  afterEach(async () => {
    if (tree) await act(async () => tree?.unmount());
    tree = null;
    jest.clearAllMocks();
  });

  it('업체 상세(from=pick/sdm) → 사진 → 헤더 Back: 업체 상세를 꺼낸다(출처 유지)', async () => {
    mockPathname = '/search/v-1/images';
    mockFrom = undefined;
    mockState = { type: 'stack', key: 'search-stack', ...SEARCH_STACK };
    await act(async () => {
      tree = create(<Probe />);
    });

    handle.back();
    expect(router.dismiss).toHaveBeenCalledWith(1);
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('그다음 업체 상세의 헤더 Back은 출처(Pick 스드메)로 간다', async () => {
    mockPathname = '/search/v-1';
    mockFrom = 'pick/sdm';
    mockState = { type: 'stack', key: 'search-stack', index: 1, routes: SEARCH_STACK.routes.slice(0, 2) };
    await act(async () => {
      tree = create(<Probe />);
    });

    handle.back();
    expect(router.navigate).toHaveBeenCalledWith('/pick?group=sdm');
    expect(router.dismiss).not.toHaveBeenCalled();
  });
});
