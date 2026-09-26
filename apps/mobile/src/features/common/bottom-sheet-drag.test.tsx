/**
 * 공통 바텀시트 끌어닫기 — 2026-09-26 독립 검수가 확인한 반례 넷을 막는다.
 *
 *   1. 날짜 · 시간 휠을 아래로 굴리면 시트째 끌리거나 닫혀 고른 값이 사라졌다(웹 · 네이티브).
 *   2. iOS에서 시트 안 폼 · 목록을 아래로 굴리면 패널 끌기가 스크롤을 빼앗았다.
 *      → 끌기는 손잡이(그래버 줄 · 머리 줄)에서만 시작한다. 휠 · 스크롤의 조상 어디에도
 *        응답자 처리기가 없어야 한다 — 네이티브 응답자 협상은 조상에서 자손으로 되돌아가지 않는다.
 *   3. 닫히며 내려가는 시트를 한 번 더 잡으면 닫는 움직임이 끊겨 보이지 않는 Modal이 화면을 덮었다.
 *   4. 중첩 시트(일정 추가 안의 날짜 휠)의 딤을 쓸면 바깥 시트가 끌려 닫혔다(네이티브).
 */
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, Modal, PanResponder, StyleSheet, ScrollView, Text, View, type PanResponderCallbacks } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomSheet, SheetHeader, SheetPanel } from './bottom-sheet';
import { DateWheelSheet } from './wheel-picker-sheet';

/*
 * 애니메이션을 JS로 돌린다 — 네이티브 드라이버는 jest에서 끝 신호를 주지 않아 «닫는 움직임이 끝나면
 * 내린다»를 볼 수 없다. 값 · 곡선 · 시간은 그대로다.
 */
jest.mock('@weddingpick/ui', () => ({ ...jest.requireActual('@weddingpick/ui'), USE_NATIVE_DRIVER: false }));

let configs: PanResponderCallbacks[] = [];
let tree: ReactTestRenderer | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  /* jest 설정이 목을 비운다(resetMocks) — 「움직임 줄이기」는 꺼진 채로 둔다. */
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
  jest.useRealTimers();
});

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const inApp = (element: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICS}>{element}</SafeAreaProvider>;

function mount(element: React.ReactElement) {
  act(() => {
    tree = create(inApp(element));
  });
  return tree as ReactTestRenderer;
}

/** 이 노드부터 루트까지 — 네이티브 응답자 협상이 «끌기 시작»을 묻는 조상 길. */
function ancestors(node: ReactTestInstance): ReactTestInstance[] {
  const path: ReactTestInstance[] = [];
  for (let at: ReactTestInstance | null = node.parent; at; at = at.parent) path.push(at);
  return path;
}

function claimsMoves(node: ReactTestInstance): boolean {
  return typeof node.props.onMoveShouldSetResponder === 'function' || typeof node.props.onMoveShouldSetResponderCapture === 'function';
}

const EVENT = { nativeEvent: {}, touchHistory: {} } as never;
const down = (dy: number, vy = 0) => ({ dx: 0, dy, vx: 0, vy, moveX: 0, moveY: 0, x0: 0, y0: 0, numberActiveTouches: 1, stateID: 1, _accountsForMovesUpTo: 0 });

/** 패널을 재고(onLayout) 여는 움직임을 끝낸다. */
function layoutAndOpen(root: ReactTestRenderer, height = 400) {
  /* 패널 — 최대 높이 90%를 가진 판(스크림 · 키보드 회피 틀이 아니라). */
  const panel = root.root.findAll(
    (node) => typeof node.type === 'string' && typeof node.props.onLayout === 'function' && StyleSheet.flatten(node.props.style)?.maxHeight === '90%'
  )[0]!;
  act(() => {
    panel.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } });
  });
  act(() => {
    jest.advanceTimersByTime(1000);
  });
}

describe('끌어닫기는 손잡이에서만 시작한다', () => {
  it('폼 스크롤의 조상에는 끌기 처리기가 없고, 그래버 줄 · 머리 줄에만 있다', () => {
    const root = mount(
      <BottomSheet visible onRequestClose={jest.fn()}>
        <SheetPanel>
          <SheetHeader title="일정 추가" onClose={jest.fn()} />
          <ScrollView testID="form-scroll">
            <Text>메모</Text>
          </ScrollView>
        </SheetPanel>
      </BottomSheet>
    );

    const scroll = root.root.findByProps({ testID: 'form-scroll' });
    expect(ancestors(scroll).filter(claimsMoves)).toHaveLength(0);

    const grabber = root.root.find((node) => node.props.testID === 'sheet-grabber' && claimsMoves(node));
    const header = root.root.find((node) => node.props.testID === 'sheet-header' && claimsMoves(node));
    expect(grabber).toBeTruthy();
    expect(header).toBeTruthy();
  });

  it('날짜 휠(연 · 월 · 일)을 아래로 굴려도 시트가 응답자가 될 자리가 없다', () => {
    const onDismiss = jest.fn();
    const root = mount(
      <DateWheelSheet visible title="예식일 선택" value="2027-04-17" onConfirm={jest.fn()} onDismiss={onDismiss} today={new Date(2026, 8, 26)} />
    );

    const wheels = root.root.findAll((node) => node.type === ScrollView);
    expect(wheels.length).toBe(3);
    for (const wheel of wheels) {
      expect({ wheel: wheel.props.accessibilityLabel, claimers: ancestors(wheel).filter(claimsMoves).length }).toEqual({
        wheel: wheel.props.accessibilityLabel,
        claimers: 0,
      });
    }
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('닫을 수 없는 시트는 손잡이도 끌리지 않는다', () => {
    const root = mount(
      <BottomSheet visible dismissible={false} onRequestClose={jest.fn()}>
        <SheetPanel>
          <SheetHeader title="이름" />
        </SheetPanel>
      </BottomSheet>
    );

    expect(root.root.findAll(claimsMoves)).toHaveLength(0);
  });

  it('그래버 손잡이는 배치를 바꾸지 않는다 — 넓힌 여백만큼 음수 여백으로 되돌린다', () => {
    const root = mount(
      <BottomSheet visible onRequestClose={jest.fn()}>
        <SheetPanel>
          <SheetHeader title="필터" onClose={jest.fn()} />
        </SheetPanel>
      </BottomSheet>
    );

    const zone = root.root.find((node) => node.props.testID === 'sheet-grabber' && node.type === View);
    const style = zone.props.style as { paddingTop: number; marginTop: number; paddingBottom: number; marginBottom: number };
    expect(style.paddingTop + style.marginTop).toBe(0);
    /* 막대 아래 4(정본 `grab` margin-bottom)만 남고 나머지는 되돌린다. */
    expect(style.paddingBottom + style.marginBottom).toBe(4);
  });
});

describe('닫히는 시트를 다시 잡아도 Modal이 남지 않는다', () => {
  function StateSheet({ visible, onRequestClose }: { visible: boolean; onRequestClose: () => void }) {
    return (
      <BottomSheet visible={visible} onRequestClose={onRequestClose}>
        <SheetPanel>
          <SheetHeader title="예식일 선택" onClose={onRequestClose} />
          <View />
        </SheetPanel>
      </BottomSheet>
    );
  }

  it('끌어서 닫는 중 두 번째로 쓸면 잡히지 않고, 닫는 움직임이 끝나면 Modal이 내려간다', () => {
    const onRequestClose = jest.fn();
    const root = mount(<StateSheet visible onRequestClose={onRequestClose} />);
    layoutAndOpen(root);
    const drag = configs[configs.length - 1]!;

    /* 첫 번째 쓸기 — 끝까지 끌어 놓는다. */
    act(() => {
      drag.onPanResponderGrant?.(EVENT, down(0));
      drag.onPanResponderMove?.(EVENT, down(200));
      drag.onPanResponderRelease?.(EVENT, down(200));
    });
    expect(onRequestClose).toHaveBeenCalledTimes(1);

    /* 호출한 쪽이 닫는다(visible=false) — 닫는 움직임 도중(40ms)에 다시 쓴다. */
    act(() => root.update(inApp(<StateSheet visible={false} onRequestClose={onRequestClose} />)));
    act(() => {
      jest.advanceTimersByTime(40);
    });
    const latest = configs[configs.length - 1]!;
    expect(latest.onMoveShouldSetPanResponder?.(EVENT, down(20))).toBe(false);

    /* 그래도 누군가 잡았다고 치자(끊겼다 · 놓았다) — 닫는 길은 끝까지 가야 한다. */
    act(() => {
      latest.onPanResponderGrant?.(EVENT, down(0));
      latest.onPanResponderMove?.(EVENT, down(20));
      latest.onPanResponderRelease?.(EVENT, down(20));
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(root.root.findAll((node) => node.type === Modal)).toHaveLength(0);
  });

  it('끌어서 닫기를 요청했는데 호출한 쪽이 닫지 않으면(입력 중 확인) 제자리로 돌아와 다시 잡힌다', () => {
    const onRequestClose = jest.fn();
    const root = mount(<StateSheet visible onRequestClose={onRequestClose} />);
    layoutAndOpen(root);
    const drag = configs[configs.length - 1]!;

    act(() => {
      drag.onPanResponderGrant?.(EVENT, down(0));
      drag.onPanResponderRelease?.(EVENT, down(200));
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(root.root.findAll((node) => node.type === Modal)).toHaveLength(1);
    expect(configs[configs.length - 1]!.onMoveShouldSetPanResponder?.(EVENT, down(20))).toBe(true);
  });
});

describe('중첩 시트의 딤을 쓸어도 바깥 시트가 끌리지 않는다', () => {
  it('안쪽 딤에서 루트까지 끌기 처리기가 없고, 딤의 누름은 조상에게 빼앗기지 않는다', () => {
    const root = mount(
      <BottomSheet visible onRequestClose={jest.fn()} testID="outer">
        <SheetPanel>
          <SheetHeader title="일정 추가" onClose={jest.fn()} />
          <ScrollView>
            <DateWheelSheet visible title="날짜 선택" value="2027-04-17" onConfirm={jest.fn()} onDismiss={jest.fn()} today={new Date(2026, 8, 26)} />
          </ScrollView>
        </SheetPanel>
      </BottomSheet>
    );

    /* 딤 — 화면 전체를 덮는 «닫기» 누름(시트 머리의 X가 아니라). */
    const isScrim = (node: ReactTestInstance | null) =>
      !!node && typeof node.type !== 'string' && node.props.accessibilityLabel === '닫기' && node.props.style === StyleSheet.absoluteFill;
    /* Pressable은 memo · forwardRef 두 겹이라 바깥 겹만 센다. */
    const scrims = root.root.findAll((node) => isScrim(node) && !isScrim(node.parent));
    expect(scrims.length).toBe(2);
    const inner = scrims[1]!;
    expect(ancestors(inner).filter(claimsMoves)).toHaveLength(0);
    for (const scrim of scrims) expect(scrim.props.cancelable).toBe(false);
  });
});
