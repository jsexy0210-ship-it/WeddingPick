/**
 * 웹 Root 탭 — 전환이 끝나면 지나온 탭은 다시 접힌다(2026-09-26 검수 반례 · 주요).
 *
 * 탭 전환 움직임을 넣자 하단 탭이 지금 탭 **왼쪽**의 탭을 «전환 중»(display: flex, 투명)으로 남겼다.
 * 홈 → 검색 → MY로 오면 홈과 검색이 배치에 그대로 남아 키보드 Tab이 보이지 않는 홈 단추로
 * 들어갔고, 탭 바가 숨는 화면으로 가면 뒤에 남은 홈이 자라 스크롤이 잘렸다.
 *
 * 실제 하단 탭 내비게이터(expo-router의 react-navigation 포크)에 앱과 같은 탭 옵션 · 겉을 씌워 돌린다.
 * 플랫폼은 웹이다 — 웹에서만 생기는 일이고, 웹에서 탭 애니메이션이 JS로 돌아 끝 신호가 온다.
 */
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from 'expo-router/build/react-navigation/bottom-tabs';
import { NavigationContainer, createNavigationContainerRef } from 'expo-router/build/react-navigation/native';

import { useTabScreenOptions } from './screen-options';
import { useTabSceneGate } from './tab-scene';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  Object.defineProperty(RN.Platform, 'OS', { configurable: true, get: () => 'web' });
  return RN;
});

declare const require: (id: string) => unknown;
declare const __dirname: string;

type Params = { index: undefined; search: undefined; my: undefined; '(home)': undefined };
const Tab = createBottomTabNavigator<Params>();
const ref = createNavigationContainerRef<Params>();
const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function Tabs() {
  const screenOptions = useTabScreenOptions();
  const gate = useTabSceneGate();

  return (
    <Tab.Navigator screenOptions={screenOptions} tabBar={() => null} {...gate}>
      <Tab.Screen name="index">{() => <Text testID="home-body">홈</Text>}</Tab.Screen>
      <Tab.Screen name="search">{() => <Text testID="search-body">검색</Text>}</Tab.Screen>
      <Tab.Screen name="my">{() => <Text testID="my-body">MY</Text>}</Tab.Screen>
      <Tab.Screen name="(home)">{() => <Text testID="feed-body">피드</Text>}</Tab.Screen>
    </Tab.Navigator>
  );
}

let tree: ReactTestRenderer | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise<boolean>(() => undefined));
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: () => undefined } as never);
});

afterEach(() => {
  if (tree) act(() => tree?.unmount());
  tree = null;
  jest.useRealTimers();
});

function mount() {
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <NavigationContainer ref={ref}>
          <Tabs />
        </NavigationContainer>
      </SafeAreaProvider>
    );
  });
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  return tree as ReactTestRenderer;
}

function go(name: keyof Params, settle = true) {
  act(() => ref.navigate(name));
  if (settle) {
    act(() => {
      jest.advanceTimersByTime(1000);
    });
  }
}

/** 이 글자를 품은 탭 한 칸의 겉(`TabScene`이 그리는 판). */
function sceneOf(root: ReactTestRenderer, testID: string): ReactTestInstance {
  const body = root.root.find((node) => node.props.testID === testID && typeof node.type === 'string');
  for (let at: ReactTestInstance | null = body; at; at = at.parent) {
    if (at.props.testID === 'tab-scene' && typeof at.type === 'string') return at;
  }
  throw new Error(`${testID}: 탭 겉이 없다`);
}

/** 이 글자 위 어딘가가 `display: none`인가 — 배치 · 키보드 초점 · 스크린 리더에서 빠졌는가. */
function laidOut(root: ReactTestRenderer, testID: string): boolean {
  const body = root.root.find((node) => node.props.testID === testID && typeof node.type === 'string');
  for (let at: ReactTestInstance | null = body; at; at = at.parent) {
    if (typeof at.type === 'string' && (StyleSheet.flatten(at.props.style) as { display?: string } | undefined)?.display === 'none') return false;
  }
  return true;
}

const styleOf = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) as { display?: string; height?: number; flex?: number; flexShrink?: number };

function layout(node: ReactTestInstance, height: number) {
  act(() => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } }));
}

describe('웹 Root 탭 — 지나온 탭은 전환 뒤 배치에서 빠진다', () => {
  it('홈 → 검색 → MY 뒤에는 MY만 배치에 남는다(지나온 왼쪽 탭 둘은 display: none)', () => {
    const root = mount();
    go('search');
    go('my');

    expect({ home: laidOut(root, 'home-body'), search: laidOut(root, 'search-body'), my: laidOut(root, 'my-body') }).toEqual({
      home: false,
      search: false,
      my: true,
    });
  });

  it('떠나는 탭은 전환 동안 보이되 높이가 묶인다 — 탭 바가 숨어 자라도 스크롤이 잘리지 않는다', () => {
    const root = mount();
    layout(sceneOf(root, 'home-body'), 706);

    go('(home)', false);
    act(() => {
      jest.advanceTimersByTime(16);
    });
    const leaving = styleOf(sceneOf(root, 'home-body'));
    expect(leaving.display).not.toBe('none');
    expect(leaving.height).toBe(706);
    /* `flex`(웹에서 flex-basis 0%)가 남으면 적어 둔 높이를 이겨 판이 0으로 접힌다. */
    expect(leaving.flex).toBeUndefined();
    expect(leaving.flexShrink).toBe(0);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(styleOf(sceneOf(root, 'home-body')).display).toBe('none');

    /* 돌아오면 곧바로 다시 그린다 — 높이는 다시 내비게이터를 따른다. */
    go('index');
    const back = styleOf(sceneOf(root, 'home-body'));
    expect(back.display).not.toBe('none');
    expect(back.height).toBeUndefined();
  });

  it('탭 레이아웃이 이 겉을 씌운다', () => {
    const { readFileSync } = require('fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
    const { join } = require('path') as { join: (...parts: string[]) => string };
    const layoutFile = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', '_layout.tsx'), 'utf8');

    expect(layoutFile).toContain('useTabSceneGate()');
    expect(layoutFile).toMatch(/\{\.\.\.sceneGate\}/);
  });
});
