import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, ToastAndroid, View } from 'react-native';

import { Elevation, Layout, Motion, Radius, ToastColors, USE_NATIVE_DRIVER } from './theme';
import { FontSize, LineHeight } from './typography';
import { useReduceMotion } from './use-reduce-motion';

export type ToastProps = {
  /** 보여줄 말. null이면 아무것도 그리지 않는다. */
  message: string | null;
  onHidden?: () => void;
};

/**
 * 화면 하단에서 이만큼 띄운다. RN 정본 WP-DLG-F `toastWrap`(`docs/design/React_Native/
 * common.js:198`) — dock 위 100. 이 토스트는 dock 유무를 모르므로 탭바가 있는 화면 기준 값을 쓴다.
 */
const BOTTOM = 100;
/** 사용자 설정: 결과 알림은 1초 뒤 사라진다. */
export const TOAST_MS = 1000;
const FADE_MS = 175;

/**
 * 잠깐 뜨는 안내. 디자인 핸드오프 인터랙션 규칙.
 *
 * 저장·수정·삭제 결과와 막힌 이유를 짧게 알린다. Android에서는 OS 토스트를,
 * iOS·웹에서는 같은 문구의 앱 토스트를 쓴다. 되돌리기 동작이 필요한 삭제는
 * 별도의 액션 토스트가 맡는다.
 */
export function Toast({ message, onHidden }: ToastProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const reduceMotion = useReduceMotion();
  /** 사라지는 동안에도 그려야 해서, 글자는 따로 붙잡아 둔다. */
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (message === null) return;

    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      onHidden?.();
      return;
    }

    setShown(message);

    const animation = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.delay(TOAST_MS - FADE_MS * 2),
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);

    animation.start(({ finished }) => {
      if (!finished) return;

      setShown(null);
      onHidden?.();
    });

    return () => animation.stop();
    // onHidden이 매 렌더 새로 만들어져도 토스트가 다시 뜨지 않게, 글자만 본다.
  }, [message, opacity]);

  if (Platform.OS === 'android' || shown === null) return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {/*
        나타날 때 제자리에서 켜지지 않고 살짝 올라오며 켜진다 — `Motion.rise`(요소 상승, translateY 10 → 0)의
        거리만 빌리고 시간은 이 토스트의 페이드(175ms)를 그대로 따른다. 같은 값 하나(opacity)로 둘을
        움직여 사라질 때도 같은 길로 내려간다. 「움직임 줄이기」면 페이드만 한다.
      */}
      <Animated.Text
        accessibilityRole="alert"
        style={[
          styles.toast,
          {
            opacity,
            transform: reduceMotion
              ? []
              : [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [Motion.rise.from, 0] }) }],
          },
        ]}>
        {shown}
      </Animated.Text>
    </View>
  );
}

/* 정본 toastStyle — 내용 폭 · padding 14 18 · radius 10 · 15/22 · 700 · 배경 · 그림자(`common.js:199`). */
const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Layout.gutter,
    right: Layout.gutter,
    bottom: BOTTOM,
    // 바텀시트 위에도 보여야 한다.
    zIndex: 100,
    alignItems: 'center',
  },
  toast: {
    maxWidth: '100%',
    borderRadius: Radius.medium,
    paddingHorizontal: Layout.cardPaddingCompactY,
    paddingVertical: Layout.sectionHeadGap,
    textAlign: 'center',
    fontSize: FontSize.f15,
    lineHeight: LineHeight.lh22,
    fontWeight: '700',
    color: ToastColors.text,
    backgroundColor: ToastColors.background,
    ...Elevation.toast,
    // 글자 상자의 둥근 모서리를 자른다(iOS). 웹의 box-shadow는 이것에 잘리지 않는다.
    overflow: 'hidden',
  },
});
