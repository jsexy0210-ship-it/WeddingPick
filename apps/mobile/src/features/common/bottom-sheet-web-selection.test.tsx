/**
 * 웹 — 닫을 수 있는 시트의 본문 글자를 고르고 복사할 수 있어야 한다(2026-09-26 검수 반례).
 *
 * 끌어닫기 때문에 패널 전체에 `user-select: none`을 걸어 두었더니 상담 기록 · 안내 시트의 글자를
 * 고를 수 없었다. 선택은 **끄는 동안에만** 막는다 — 끌기가 시작되면 문서 전체를 잠그고, 놓으면 푼다.
 *
 * 이 파일만 플랫폼을 웹으로 둔다. 시트 모듈이 읽히는 순간의 값이 중요해서(옛 구현은 모듈을 읽을 때
 * 스타일을 정했다) `react-native`를 읽는 자리에서 바꾼다.
 */
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, PanResponder, StyleSheet, Text, type PanResponderCallbacks } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomSheet, SheetHeader, SheetPanel } from './bottom-sheet';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  Object.defineProperty(RN.Platform, 'OS', { configurable: true, get: () => 'web' });
  return RN;
});

type FakeStyle = { userSelect?: string; webkitUserSelect?: string };
const body = { style: {} as FakeStyle };
const removeAllRanges = jest.fn();
const g = globalThis as unknown as { document?: unknown; window: { getSelection?: () => unknown } };

let configs: PanResponderCallbacks[] = [];
let tree: ReactTestRenderer | null = null;

beforeEach(() => {
  body.style = {};
  g.document = { body };
  g.window.getSelection = () => ({ removeAllRanges });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise<boolean>(() => undefined));
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: () => undefined } as never);
  configs = [];
  const original = PanResponder.create.bind(PanResponder);
  jest.spyOn(PanResponder, 'create').mockImplementation((config) => {
    configs.push(config);
    return original(config);
  });
});

afterEach(() => {
  if (tree) act(() => tree?.unmount());
  tree = null;
  delete g.document;
  delete g.window.getSelection;
});

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const EVENT = { nativeEvent: {}, touchHistory: {} } as never;
const down = (dy: number) => ({ dx: 0, dy, vx: 0, vy: 0, moveX: 0, moveY: 0, x0: 0, y0: 0, numberActiveTouches: 1, stateID: 1, _accountsForMovesUpTo: 0 });

function mountConsultationSheet() {
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <BottomSheet visible onRequestClose={jest.fn()}>
          <SheetPanel>
            <SheetHeader title="강남 A 웨딩홀" onClose={jest.fn()} />
            <Text testID="summary">토요일 12시 홀로 보고 왔고, 보증인원 250명 기준으로 안내받았어요.</Text>
          </SheetPanel>
        </BottomSheet>
      </SafeAreaProvider>
    );
  });
  return tree as ReactTestRenderer;
}

function selfAndAncestors(node: ReactTestInstance): ReactTestInstance[] {
  const path: ReactTestInstance[] = [];
  for (let at: ReactTestInstance | null = node; at; at = at.parent) path.push(at);
  return path;
}

describe('웹 시트 본문 글자 선택', () => {
  it('끌지 않을 때는 본문 위 어디에도 user-select: none이 없다', () => {
    const root = mountConsultationSheet();
    const summary = root.root.find((node) => node.props.testID === 'summary' && typeof node.type === 'string');

    const locked = selfAndAncestors(summary)
      .filter((node) => typeof node.type === 'string')
      .filter((node) => (StyleSheet.flatten(node.props.style) as FakeStyle | undefined)?.userSelect === 'none');
    expect(locked).toHaveLength(0);
    expect(body.style.userSelect ?? '').toBe('');
  });

  it('끄는 동안에만 문서의 선택을 잠그고 이미 생긴 선택을 지운다 — 놓으면 되돌린다', () => {
    mountConsultationSheet();
    const drag = configs[configs.length - 1]!;

    act(() => {
      drag.onPanResponderGrant?.(EVENT, down(0));
    });
    expect(body.style.userSelect).toBe('none');
    expect(removeAllRanges).toHaveBeenCalled();
    /* 끄는 도중 글자 선택(selectionchange)이 끌기를 끊지 못한다. */
    expect(drag.onPanResponderTerminationRequest?.(EVENT, down(10))).toBe(false);

    act(() => {
      drag.onPanResponderRelease?.(EVENT, down(10));
    });
    expect(body.style.userSelect).toBe('');

    act(() => {
      drag.onPanResponderGrant?.(EVENT, down(0));
      drag.onPanResponderTerminate?.(EVENT, down(0));
    });
    expect(body.style.userSelect).toBe('');
  });
});
