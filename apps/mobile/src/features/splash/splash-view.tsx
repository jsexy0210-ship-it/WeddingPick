import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import {
  Colors,
  FontSize,
  LineHeight,
  WeddingMark,
} from '@weddingpick/ui';

/**
 * 스플래시. 디자인 핸드오프 0번.
 *
 * 키 컬러 전면에 심볼과 이름만. **슬로건은 넣지 않는다** — 핸드오프가 그렇게
 * 정했고, 서비스 설명은 바로 다음 온보딩에서 한다.
 *
 * 화면(route)이 아니라 컴포넌트다. 첫 화면을 정하는 동안 `_layout`이 이걸 덮어
 * 두므로, 뒤로가기로 돌아올 자리를 만들지 않는다.
 */

/*
 * 이만큼은 보여준다. 핸드오프 0번이 1400을 적어뒀지만, 그 값은 로딩 자체가
 * 오래 걸리던 시절 "너무 빨리 사라지지 않게" 잡은 하한이었다 — 정작 애니메이션은
 * 심볼(480) · 제목(지연 200+320=520) · 부제(지연 280+320=600)로 600ms에 다
 * 끝난다. 1400까지 붙잡아두면 그 뒤 800ms는 그냥 멎어 있는 화면이다. 진입
 * 애니메이션이 끝까지 보이는 선(600)까지만 낮춘다.
 */
export const SPLASH_MINIMUM_MS = 600;

const SYMBOL_MS = 480;
const TEXT_MS = 320;

/** 핸드오프의 `cubic-bezier(.16,1,.3,1)`. */
const ENTER = Easing.bezier(0.16, 1, 0.3, 1);

export function SplashView() {
  /*
   * useRef(new Animated.Value(0)).current로 두면 렌더 중에 ref를 읽는 셈이 되어
   * 컴파일러가 막는다. useState의 초기화 함수는 한 번만 불리므로 같은 값을
   * 유지하면서 그 규칙을 지킨다.
   */
  const [symbol] = useState(() => new Animated.Value(0));
  const [title] = useState(() => new Animated.Value(0));
  const [subtitle] = useState(() => new Animated.Value(0));

  useEffect(() => {
    /*
     * 심볼이 먼저 커지며 나타나고, 글자 둘이 200ms·280ms 늦게 8px 아래에서
     * 올라온다. 핸드오프가 정한 순서와 지연이다.
     */
    Animated.parallel([
      Animated.timing(symbol, {
        toValue: 1,
        duration: SYMBOL_MS,
        easing: ENTER,
        useNativeDriver: true,
      }),
      Animated.timing(title, {
        toValue: 1,
        delay: 200,
        duration: TEXT_MS,
        easing: ENTER,
        useNativeDriver: true,
      }),
      Animated.timing(subtitle, {
        toValue: 1,
        delay: 280,
        duration: TEXT_MS,
        easing: ENTER,
        useNativeDriver: true,
      }),
    ]).start();
  }, [symbol, title, subtitle]);

  /** 8px 아래에서 제자리로. */
  const rise = (value: Animated.Value) => ({
    opacity: value,
    transform: [
      { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
    ],
  });

  return (
    <View style={[styles.screen, { backgroundColor: Colors.light.tint }]}>
      <Animated.View
        style={{
          opacity: symbol,
          // 0.88에서 1로. 커지는 것이 아니라 다가오는 느낌이어야 한다.
          transform: [{ scale: symbol.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
        }}>
        <WeddingMark size={88} color={Colors.light.onTint} />
      </Animated.View>

      <Animated.Text style={[styles.title, rise(title)]}>웨딩픽</Animated.Text>
      <Animated.Text style={[styles.subtitle, rise(subtitle)]}>WeddingPick</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 20,
    fontSize: FontSize.t2,
    lineHeight: LineHeight.t2,
    letterSpacing: -0.6,
    fontWeight: '700',
    color: Colors.light.onTint,
  },
  subtitle: {
    marginTop: 4,
    fontSize: FontSize.t7,
    lineHeight: LineHeight.t7,
    letterSpacing: 1.4,
    fontWeight: '600',
    // 핸드오프: 흰색 62%.
    color: 'rgba(255, 255, 255, 0.62)',
  },
});
