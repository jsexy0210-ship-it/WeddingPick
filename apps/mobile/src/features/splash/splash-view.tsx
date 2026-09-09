import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Colors, FontSize, LineHeight, Spacing, WeddingMark } from '@weddingpick/ui';

/**
 * 스플래시(WP-APP-002). 시안 `01-onboarding.dc.html` #11a —
 *
 *   코랄 바탕 · 세로 중앙 · 마크 112(흰색) · 아래 18 · «웨딩픽» 32/43 700 흰색
 *
 * 키 컬러 전면에 심볼과 이름만. **슬로건도 영문 이름도 넣지 않는다** — 시안이 그렇게
 * 정했고, 서비스 설명은 바로 다음 화면(로그인)이 한다. 마크의 획은 확정본 1.9
 * (`WeddingMark` · CLAUDE.md «심볼 — 절대 변경 금지»)를 그대로 쓴다.
 *
 * 화면(route)이 아니라 컴포넌트다. 첫 화면을 정하는 동안 `_layout`이 이걸 덮어
 * 두므로, 뒤로가기로 돌아올 자리를 만들지 않는다.
 */

/*
 * 이만큼은 보여준다. 핸드오프 0번이 1400을 적어뒀지만, 그 값은 로딩 자체가
 * 오래 걸리던 시절 "너무 빨리 사라지지 않게" 잡은 하한이었다 — 정작 애니메이션은
 * 심볼(wpMark 480) · 이름(wpWord 지연 200 + 400 = 600)으로 600ms에 다 끝난다.
 * 1400까지 붙잡아두면 그 뒤 800ms는 그냥 멎어 있는 화면이다. 진입 애니메이션이
 * 끝까지 보이는 선(600)까지만 낮춘다.
 */
export const SPLASH_MINIMUM_MS = 600;

/** 시안 wpMark 480 · wpWord 400(지연 200). */
const SYMBOL_MS = 480;
const TEXT_MS = 400;
const TEXT_DELAY_MS = 200;

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

  useEffect(() => {
    /*
     * 심볼이 먼저 커지며 나타나고, 이름이 200ms 늦게 8px 아래에서 올라온다.
     * 핸드오프가 정한 순서와 지연이다.
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
        delay: TEXT_DELAY_MS,
        duration: TEXT_MS,
        easing: ENTER,
        useNativeDriver: true,
      }),
    ]).start();
  }, [symbol, title]);

  return (
    <View style={[styles.screen, { backgroundColor: Colors.light.tint }]}>
      <Animated.View
        style={{
          opacity: symbol,
          // 0.88에서 1로. 커지는 것이 아니라 다가오는 느낌이어야 한다.
          transform: [{ scale: symbol.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
        }}>
        <WeddingMark size={MARK_SIZE} color={Colors.light.onTint} />
      </Animated.View>

      <Animated.Text
        style={[
          styles.title,
          {
            opacity: title,
            transform: [{ translateY: title.interpolate({ inputRange: [0, 1], outputRange: [Spacing.two, 0] }) }],
          },
        ]}>
        웨딩픽
      </Animated.Text>
    </View>
  );
}

/* 시안 고정값 — 마크 112 · 마크와 이름 사이 18. */
const MARK_SIZE = 112;
const TITLE_GAP = 18;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 시안 — 32/43 700 흰색. 자간은 iOS 0(spec/tokens.json platform.letterSpacing). */
  title: {
    marginTop: TITLE_GAP,
    fontSize: FontSize.t1,
    lineHeight: LineHeight.t1,
    fontWeight: '700',
    color: Colors.light.onTint,
  },
});
