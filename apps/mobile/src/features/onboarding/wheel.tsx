import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { FontSize, LineHeight, Radius, ThemedText, useTheme } from '@weddingpick/ui';

/**
 * 굴림 휠 한 벌 — 예식일 시트(WP-APP-023 · 휠 3열)와 지역 시트(시/도 · 시/군/구 2열)가
 * 같은 것을 쓴다.
 *
 * **원래는 `date-picker-sheet.tsx` 안에만 있었다.** 2026-09-15 대표 지시로 지역 선택도
 * 휠이 되면서 두 곳이 쓰게 돼 여기로 옮겼다 — 「휠은 이미 있는 것을 쓴다. 새 라이브러리를
 * 들이지 마라」. 옮기면서 값을 바꾸지 않았다. 숫자만 받던 것을 글자도 받게 넓힌 것뿐이다.
 *
 * 값은 전부 `spec/tokens.json` `component.dateWheel`이다(루트 시안 `wheelCol` ·
 * `wheelItem` · `wheelBand` · `wheelFadeTop` 실측).
 */

/**
 * 휠 한 열.
 *
 * 스크롤 위치를 값으로 읽는다 — `snapToInterval`이 한 칸(48)마다 멈추므로 중앙에
 * 걸린 것은 `offset / 48`번째다. 위아래 패딩 96이 첫 항목을 밴드 자리로 내려 준다.
 *
 * `value`가 밖에서 바뀌면(시/도를 굴려 시/군/구가 첫 항목으로 당겨졌을 때) 그 자리로
 * 되돌린다. **사람이 굴리는 중에는 건드리지 않는다** — 손 밑에서 목록이 움직이면
 * 고르던 것을 놓친다.
 */
export function Wheel<T extends string | number>({
  accessibilityLabel,
  flex,
  items,
  format,
  value,
  onChange,
  numeric = false,
}: {
  accessibilityLabel: string;
  flex: number;
  items: readonly T[];
  format: (item: T) => string;
  value: T;
  onChange: (item: T) => void;
  /**
   * 숫자 열인가. 날짜는 참 — 자리가 고정된 숫자꼴이라야 굴릴 때 폭이 흔들리지 않는다.
   * 지역 이름처럼 글자인 열은 거짓이다.
   */
  numeric?: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  const dragging = useRef(false);
  /* 첫 배치를 했는가. 안드로이드는 `contentOffset`을 무시하므로 한 번은 직접 굴려 준다. */
  const placed = useRef(false);
  const index = Math.max(items.indexOf(value), 0);
  const [centered, setCentered] = useState(index);

  useEffect(() => {
    if (placed.current && (dragging.current || centered === index)) return;

    placed.current = true;
    setCentered(index);
    ref.current?.scrollTo({ y: index * ITEM, animated: false });
  }, [index, centered]);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.min(Math.max(Math.round(event.nativeEvent.contentOffset.y / ITEM), 0), items.length - 1);
    const item = items[next];

    if (item === undefined || next === centered) return;

    setCentered(next);
    /* 멈추기를 기다리지 않는다 — 굴리는 중에도 아래 결과가 따라 움직인다(시안 B). */
    if (item !== value) onChange(item);
  }

  return (
    <ScrollView
      ref={ref}
      accessibilityLabel={accessibilityLabel}
      style={[styles.wheel, { flex }]}
      contentContainerStyle={styles.wheelContent}
      contentOffset={{ x: 0, y: index * ITEM }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={onScroll}
      onScrollBeginDrag={() => {
        dragging.current = true;
      }}
      onScrollEndDrag={() => {
        dragging.current = false;
      }}
      onMomentumScrollEnd={() => {
        dragging.current = false;
      }}>
      {items.map((item, at) => (
        <WheelItem key={item} label={format(item)} numeric={numeric} distance={Math.abs(at - centered)} />
      ))}
    </ScrollView>
  );
}

/**
 * 열들을 담는 틀. 밴드가 열보다 뒤에 깔리고 덮개가 앞에 온다 — **형제 순서가 곧
 * z 순서다**(밴드 → 열 → 페이드). 시안 `wheelWrap` · `wheelBand`.
 */
export function WheelGroup({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={styles.wheels}>
      <View style={[styles.band, { backgroundColor: theme.backgroundElement }]} />

      {children}

      {/* 위아래로 흐려지는 덮개. 눌리지 않게 둔다 — 휠은 그 아래에서 굴러간다. */}
      <Fade edge="top" />
      <Fade edge="bottom" />
    </View>
  );
}

/** 항목 하나. 중앙에서 멀어질수록 작아지고 옅어진다 — 시안 `wheelItem`의 네 단계. */
function WheelItem({ label, distance, numeric }: { label: string; distance: number; numeric: boolean }) {
  const theme = useTheme();
  const step = Math.min(distance, STEP_COLOR.length - 1);

  return (
    <View style={styles.item}>
      <ThemedText
        numeric={numeric}
        numberOfLines={1}
        style={[STEP_TEXT[step] ?? styles.far, { color: theme[STEP_COLOR[step] ?? 'text'] }]}>
        {label}
      </ThemedText>
    </View>
  );
}

/**
 * 위아래 덮개 — 시안 `wheelFadeTop` «#fff 30% → 투명» · `wheelFadeBottom` «투명 → #fff 70%».
 *
 * **React Native에는 그라데이션이 없다.** 이 한 자리를 위해 `expo-linear-gradient`를
 * 새로 들이는 대신 96을 네 칸(24)으로 끊어 흉내 낸다. 칸마다의 불투명도는 원래
 * 기울기를 그 칸 가운데에서 읽은 값이다 — 끊긴 자리가 보이지 않을 만큼은 촘촘하고,
 * 라이브러리 하나를 더 싣지는 않는다.
 */
function Fade({ edge }: { edge: 'top' | 'bottom' }) {
  const theme = useTheme();
  const steps = edge === 'top' ? FADE_STEPS : [...FADE_STEPS].reverse();

  return (
    <View pointerEvents="none" style={[styles.fade, edge === 'top' ? styles.fadeTop : styles.fadeBottom]}>
      {steps.map((opacity, at) => (
        <View key={at} style={[styles.fadeStep, { backgroundColor: theme.background, opacity }]} />
      ))}
    </View>
  );
}

/** 휠 한 칸. 밴드 높이와 같다. */
const ITEM = 48;
/** 열 높이. 위아래 패딩 96을 빼면 가운데 48이 남고 그것이 밴드다(240 - 96*2 = 48). */
const HEIGHT = 240;
const PAD = (HEIGHT - ITEM) / 2;
/** 덮개 한 겹의 불투명도. 위는 이 순서, 아래는 뒤집어 쓴다. */
const FADE_STEPS = [1, 0.89, 0.54, 0.18] as const;

/** 중앙에서 0 · 1 · 2 · 3칸 밖. 크기와 색이 네 단계로 줄어든다. */
const STEP_COLOR = ['text', 'textAssistive', 'dateWheelTwo', 'dateWheelFar'] as const;

const styles = StyleSheet.create({
  /* 시안 wheelWrap — 열이 나란히 굴러가고 밖으로 나간 항목은 잘린다. */
  wheels: { flexDirection: 'row', height: HEIGHT, overflow: 'hidden' },
  /* 시안 wheelBand — 가운데 한 칸. 열보다 뒤에 깔린다. */
  band: { position: 'absolute', left: 0, right: 0, top: PAD, height: ITEM, borderRadius: Radius.medium },
  wheel: { minWidth: 0, height: HEIGHT },
  /* 위아래 패딩이 첫 · 끝 항목을 밴드 자리까지 데려온다. */
  wheelContent: { paddingVertical: PAD },
  item: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
  near: { fontSize: FontSize.t4, lineHeight: LineHeight.t4, fontWeight: 700 },
  one: { fontSize: FontSize.t5, lineHeight: LineHeight.t5 },
  two: { fontSize: FontSize.dateWheel, lineHeight: LineHeight.dateWheel },
  far: { fontSize: FontSize.t6, lineHeight: LineHeight.t6 },
  fade: { position: 'absolute', left: 0, right: 0, height: PAD },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
  fadeStep: { flex: 1 },
});

const STEP_TEXT = [styles.near, styles.one, styles.two, styles.far] as const;
