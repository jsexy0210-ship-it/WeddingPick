/**
 * 웹 — 공통 바텀시트 · 풀팝업이 **기본으로** 브라우저 뒤로가기에 자기만 닫힌다(2026-09-26 대표 「진행해」).
 *
 *   - 상태형 시트: 열리면 칸 하나, 닫히면 그 칸을 뺀다.
 *   - 시트형 «라우트»가 처음부터 띄운 자기 시트는 빠진다(라우트의 뒤로가기가 이미 닫는다 — 이중 처리 금지).
 *     그 라우트 안에서 나중에 여는 시트(날짜 휠 등)는 켜진다.
 *   - 닫을 수 없는 시트는 뒤로가기에 닫히지 않는다.
 *   - 입력 중 확인으로 닫지 않았으면 칸을 다시 쥔다(다음 뒤로가기가 화면째 떠나지 않게).
 *   - `closeOnBrowserBack={false}`로 끌 수 있다.
 *   - 공통 풀팝업(`FullPopupModal`, 약관 상세 등)도 같다.
 *
 * 이 파일만 플랫폼을 웹으로 두고, 브라우저 히스토리를 흉내 낸 창을 준다.
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationRouteContext } from 'expo-router/build/react-navigation/core';

import { FullPopupModal } from '@/components/full-popup-modal';

import { BottomSheet, SheetPanel } from './bottom-sheet';
import { RELEASE_SETTLE, SHEET_HISTORY_KEY } from './sheet-browser-back';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  Object.defineProperty(RN.Platform, 'OS', { configurable: true, get: () => 'web' });
  return RN;
});
jest.mock('@weddingpick/ui', () => ({ ...jest.requireActual('@weddingpick/ui'), USE_NATIVE_DRIVER: false }));

type Entry = Record<string, unknown> | null;
type Listener = (event: Event) => void;

/* 브라우저 히스토리 흉내 — 모듈 하나가 창 하나를 쥐므로 파일 전체가 같은 창을 쓴다. */
const entries: Entry[] = [];
let index = 0;
const capture: Listener[] = [];
const router = jest.fn();
let pushes = 0;
const fire = () => {
  let stopped = false;
  const event = { stopImmediatePropagation: () => (stopped = true) } as unknown as Event;
  for (const listener of [...capture]) {
    listener(event);
    if (stopped) return;
  }
  router();
};
const history = {
  get state() {
    return entries[index];
  },
  pushState(state: Entry) {
    pushes += 1;
    entries.splice(index + 1);
    entries.push(state);
    index += 1;
  },
  replaceState: (state: Entry) => {
    entries[index] = state;
  },
  go: (delta: number) => move(delta),
};
/* 브라우저 자신의 이동(뒤로 단추) — 관리자가 감싼 history.go를 거치지 않는다. */
function move(delta: number) {
  setTimeout(() => {
    const next = index + delta;
    if (next < 0 || next >= entries.length) return;
    index = next;
    fire();
  }, 0);
}
const g = globalThis as unknown as { window: Record<string, unknown> };
Object.assign(g.window, {
  history,
  location: { href: 'https://example.test/search' },
  addEventListener: (_type: string, listener: Listener, useCapture: boolean) => {
    if (useCapture) capture.push(listener);
  },
  removeEventListener: () => undefined,
});

let tree: ReactTestRenderer | null = null;
const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const inApp = (element: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICS}>{element}</SafeAreaProvider>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise<boolean>(() => undefined));
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: () => undefined } as never);
  entries.splice(0, entries.length, { id: 'route-1' });
  index = 0;
  pushes = 0;
  router.mockClear();
});

afterEach(() => {
  if (tree) act(() => tree?.unmount());
  tree = null;
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  jest.useRealTimers();
});

function render(element: React.ReactElement) {
  act(() => {
    if (tree) tree.update(inApp(element));
    else tree = create(inApp(element));
  });
}

const browserBack = () =>
  act(() => {
    move(-1);
    jest.advanceTimersByTime(1);
  });
const settle = () =>
  act(() => {
    jest.advanceTimersByTime(RELEASE_SETTLE + 2);
  });
const ownEntries = () => entries.slice(0, index + 1).filter((entry) => typeof entry?.[SHEET_HISTORY_KEY] === 'string').length;

function Sheet(props: { visible: boolean; onRequestClose: () => void; dismissible?: boolean; closeOnBrowserBack?: boolean }) {
  return (
    <BottomSheet {...props}>
      <SheetPanel>
        <Text>시트</Text>
      </SheetPanel>
    </BottomSheet>
  );
}

describe('상태형 시트 — 기본으로 켜져 있다', () => {
  it('열리면 칸 하나, 뒤로가기는 시트만 닫는다(라우터에 넘기지 않는다)', () => {
    const onRequestClose = jest.fn();
    render(<Sheet visible={false} onRequestClose={onRequestClose} />);
    expect(pushes).toBe(0);

    render(<Sheet visible onRequestClose={onRequestClose} />);
    expect(ownEntries()).toBe(1);

    browserBack();
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(router).not.toHaveBeenCalled();
    render(<Sheet visible={false} onRequestClose={onRequestClose} />);
    settle();
    expect(index).toBe(0);
  });

  it('X · 딤 등 다른 길로 닫히면 쌓은 칸을 뺀다', () => {
    render(<Sheet visible onRequestClose={jest.fn()} />);
    expect(index).toBe(1);
    render(<Sheet visible={false} onRequestClose={jest.fn()} />);
    settle();
    expect(index).toBe(0);
    expect(router).not.toHaveBeenCalled();
  });

  it('입력 중 확인으로 닫지 않았으면 칸을 다시 쥔다 — 다음 뒤로가기도 시트만 건드린다', () => {
    const onRequestClose = jest.fn(); // 닫지 않는다(확인창을 띄웠다고 치자)
    render(<Sheet visible onRequestClose={onRequestClose} />);
    browserBack();
    settle();
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(ownEntries()).toBe(1);

    browserBack();
    settle();
    expect(onRequestClose).toHaveBeenCalledTimes(2);
    expect(router).not.toHaveBeenCalled();
  });

  it('닫을 수 없는 시트는 뒤로가기에 닫히지 않고 화면째 떠나지도 않는다', () => {
    const onRequestClose = jest.fn();
    render(<Sheet visible dismissible={false} onRequestClose={onRequestClose} />);
    browserBack();
    expect(onRequestClose).not.toHaveBeenCalled();
    expect(router).not.toHaveBeenCalled();
    expect(ownEntries()).toBe(1);
  });

  it('closeOnBrowserBack={false}면 쌓지 않는다', () => {
    render(<Sheet visible closeOnBrowserBack={false} onRequestClose={jest.fn()} />);
    expect(pushes).toBe(0);
  });
});

describe('시트형 라우트 — 이중 처리 금지', () => {
  const inRoute = (name: string, element: React.ReactElement) => (
    <NavigationRouteContext.Provider value={{ key: `${name}-key`, name } as never}>{element}</NavigationRouteContext.Provider>
  );

  it('라우트가 처음부터 띄운 자기 시트는 쌓지 않는다(라우트의 뒤로가기가 닫는다)', () => {
    render(inRoute('[id]/events/new', <Sheet visible onRequestClose={jest.fn()} />));
    expect(pushes).toBe(0);
  });

  it('시트형 라우트라도 closeOnBrowserBack을 true로 주면 쌓는다(입력 중 확인을 먼저 타게)', () => {
    render(inRoute('[vendorId]/write-review', <Sheet visible closeOnBrowserBack onRequestClose={jest.fn()} />));
    expect(pushes).toBe(1);
  });

  it('그 라우트 안에서 나중에 여는 시트(날짜 휠 등)는 쌓는다', () => {
    const tree = (open: boolean) =>
      inRoute(
        '[id]/events/new',
        <>
          <Sheet visible onRequestClose={jest.fn()} />
          <Sheet visible={open} onRequestClose={jest.fn()} />
        </>
      );
    render(tree(false));
    render(tree(true));
    expect(pushes).toBe(1);
  });

  it('시트형이 아닌 라우트(검색 등)에서 처음부터 떠 있는 상태형 시트는 쌓는다', () => {
    render(inRoute('index', <Sheet visible onRequestClose={jest.fn()} />));
    expect(pushes).toBe(1);
  });
});

describe('중첩 시트', () => {
  it('뒤로가기 한 번에 위 시트만 닫힌다', () => {
    const outer = jest.fn();
    const inner = jest.fn();
    const both = (innerOpen: boolean) => (
      <>
        <Sheet visible onRequestClose={outer} />
        <Sheet visible={innerOpen} onRequestClose={inner} />
      </>
    );
    render(both(false));
    render(both(true));
    expect(ownEntries()).toBe(2);

    browserBack();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    render(both(false));
    settle();
    expect(ownEntries()).toBe(1);
  });
});

describe('공통 풀팝업', () => {
  it('약관 상세 같은 풀팝업도 뒤로가기에 자기만 닫힌다', () => {
    const onRequestClose = jest.fn();
    render(
      <FullPopupModal visible onRequestClose={onRequestClose}>
        <Text>약관</Text>
      </FullPopupModal>
    );
    expect(ownEntries()).toBe(1);
    browserBack();
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(router).not.toHaveBeenCalled();
  });

  it('라우트가 처음부터 띄운 풀팝업(개인정보처리방침 라우트)은 쌓지 않는다 — 닫기가 곧 라우트 뒤로다', () => {
    render(
      <NavigationRouteContext.Provider value={{ key: 'privacy-policy-key', name: 'privacy-policy' } as never}>
        <FullPopupModal visible onRequestClose={jest.fn()}>
          <Text>방침</Text>
        </FullPopupModal>
      </NavigationRouteContext.Provider>
    );
    expect(pushes).toBe(0);
  });
});
