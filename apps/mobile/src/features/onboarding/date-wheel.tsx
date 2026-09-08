import { useEffect, useRef } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ThemedText, useTheme } from '@weddingpick/ui';

import { WHEEL_HEIGHT, WHEEL_PAD, WHEEL_ROW, wheelIndexFromOffset } from './calendar';

/**
 * 휠 한 열(연 · 월 · 일). SPEC §13.6 «데이트피커 · 휠 3열» — 행 48 · 5행 노출 · 상하
 * 패딩 96이라 첫·마지막 항목도 중앙 밴드에 온다.
 *
 * **굴리는 즉시 값이 바뀐다.** 스크롤 오프셋을 행으로 읽어(`wheelIndexFromOffset`)
 * 가까운 항목이 바뀔 때마다 `onChange` — 확인을 누를 때까지 기다리지 않는다.
 *
 * 스냅은 플랫폼이 다르다. 네이티브는 `snapToInterval` + `decelerationRate="fast"`로
 * 행 경계에 멈추고, 웹(react-native-web)은 `snapToInterval`을 모르므로 스크롤이
 * 멎은 뒤 가까운 행으로 맞춘다(`SETTLE_MS`). 마우스 휠도 같은 길을 탄다.
 *
 * 글자는 중앙에서 떨어진 거리로 작아지고 옅어진다(«거리별 글자» 표). 크기는
 * 토큰 t4(20) · t5(18) · t6(16)이고 17만 토큰에 없어 여기 상수로 둔다.
 */
export type WheelItem = { key: number; label: string };

export function DateWheel({
  items,
  selected,
  onChange,
  flex,
  id,
}: {
  items: readonly WheelItem[];
  /** 중앙에 온 항목의 인덱스. */
  selected: number;
  onChange: (index: number) => void;
  /** 컬럼 비율 — 연 1.1 : 월 1 : 일 1. */
  flex: number;
  /** 웹 DOM id — 재현 스크립트가 휠을 찾는 손잡이. */
  id: string;
}) {
  const theme = useTheme();
  const scroller = useRef<ScrollView>(null);
  /** 마지막으로 부모에 알린 인덱스. 손가락 아래에서 휠을 되감지 않기 위해 기억한다. */
  const reported = useRef(selected);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = items.length;
  const lastCount = useRef(-1);

  useEffect(() => {
    /*
     * 부모가 값을 바꿨거나(달이 바뀌어 일이 당겨짐) 목록 길이가 바뀌면 그 행으로
     * 맞춘다. 내가 방금 알린 값이 되돌아온 것이면 건드리지 않는다 — 손가락 아래에서
     * 휠이 튄다.
     */
    if (selected !== reported.current || count !== lastCount.current) {
      reported.current = selected;
      lastCount.current = count;
      scroller.current?.scrollTo({ y: selected * WHEEL_ROW, animated: false });
    }
  }, [selected, count]);

  useEffect(() => () => {
    if (settle.current) clearTimeout(settle.current);
  }, []);

  function snapTo(index: number, animated: boolean) {
    scroller.current?.scrollTo({ y: index * WHEEL_ROW, animated });
  }

  function report(offset: number) {
    const index = wheelIndexFromOffset(offset, count);

    if (index !== reported.current) {
      reported.current = index;
      onChange(index);
    }

    return index;
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offset = event.nativeEvent.contentOffset.y;
    const index = report(offset);

    if (Platform.OS !== 'web') return;

    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      if (Math.abs(offset - index * WHEEL_ROW) > 1) snapTo(index, true);
    }, SETTLE_MS);
  }

  function handleEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    report(event.nativeEvent.contentOffset.y);
  }

  return (
    <ScrollView
      ref={scroller}
      nativeID={id}
      style={[styles.column, { flex }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ROW}
      snapToAlignment="start"
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={handleScroll}
      onMomentumScrollEnd={handleEnd}
      onScrollEndDrag={handleEnd}
      nestedScrollEnabled>
      {items.map((item, index) => {
        const distance = Math.abs(index - selected);

        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: distance === 0 }}
            onPress={() => snapTo(index, true)}
            style={styles.row}>
            <ThemedText
              type={distance === 0 ? 't4' : distance === 1 ? 't5' : 't6'}
              numeric
              numberOfLines={1}
              style={[
                distance === 0 && [styles.selected, { color: theme.text }],
                distance === 1 && { color: theme.textAssistive },
                distance === 2 && styles.far,
                distance >= 3 && styles.farthest,
              ]}>
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
      <View style={styles.tail} />
    </ScrollView>
  );
}

/** 웹에서 스크롤이 이만큼 멎으면 가까운 행으로 맞춘다. */
const SETTLE_MS = 120;

/*
 * SPEC §13.6 «거리별 글자» — 중앙에서 2칸은 17px `#C4C8CE`, 3칸부터 16px `#E2E5E9`.
 * 17은 타이포 토큰(t5 18 · t6 16)에 없고 두 회색도 gray 램프(#D1D3D8 · #DCDEE3)와
 * 다른 값이라 여기 이름 붙여 둔다. 토큰이 생기면 여기만 바꾼다.
 */
const WHEEL_FONT_FAR = 17;
const WHEEL_LINE_FAR = 23;
const WHEEL_GRAY_FAR = '#C4C8CE';
const WHEEL_GRAY_FARTHEST = '#E2E5E9';

const styles = StyleSheet.create({
  column: { minWidth: 0, height: WHEEL_HEIGHT, zIndex: 2 },
  content: { paddingTop: WHEEL_PAD },
  row: { height: WHEEL_ROW, alignItems: 'center', justifyContent: 'center' },
  /* 마지막 항목도 중앙에 오도록 아래 패딩 — contentContainer padding은 웹에서 스냅 계산과 어긋나 View로 둔다. */
  tail: { height: WHEEL_PAD },
  selected: { fontWeight: 700 },
  far: { fontSize: WHEEL_FONT_FAR, lineHeight: WHEEL_LINE_FAR, color: WHEEL_GRAY_FAR },
  farthest: { color: WHEEL_GRAY_FARTHEST },
});
