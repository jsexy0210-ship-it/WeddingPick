import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import {
  Colors,
  FontSize,
  LetterSpacing,
  LineHeight,
  Spacing,
  USE_NATIVE_DRIVER,
  WeddingMark,
} from '@weddingpick/ui';

/**
 * 스플래시 — WP-APP-001. v3.29 정본
 * `docs/design/React_Native/home.jsx` 1번 화면(`splashStage` ·
 * `splashMark` · `splashName`).
 *
 *   코랄 바탕(`splashStage` background) · 세로 중앙 · 마크 64(흰색, `splashMark`
 *   width/height) · 마크-이름 사이 16(`splashStage` gap) · «웨딩픽» 20/700 흰색
 *   (`splashName` font-size · font-weight · color)
 *
 * **2026-09-23 정정 — 옛 `01-onboarding.dc.html`(v3.25 이전, 저장소에 이미 없다)의
 * 값(마크 112 · gap 18 · 32/43)을 쓰고 있었다.** v3.29 정본 수치로 다시 맞춘다 —
 * `docs/session-prompt.md`가 막는 바로 그 실수(옛 파일 링크를 정본으로 쓰는 것)다.
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
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(title, {
        toValue: 1,
        delay: TEXT_DELAY_MS,
        duration: TEXT_MS,
        easing: ENTER,
        useNativeDriver: USE_NATIVE_DRIVER,
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

/* RN 정본 home.jsx 고정값 — splashMark 64×64 · splashStage gap 16(마크-이름 사이). */
const MARK_SIZE = 64;
const TITLE_GAP = 16;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* home.js splashName — 20/700 흰색(ThemedText type="t4"와 같은 크기·굵기). */
  title: {
    marginTop: TITLE_GAP,
    fontSize: FontSize.t4,
    lineHeight: LineHeight.t4,
    fontWeight: '700',
    letterSpacing: LetterSpacing.n06,
    color: Colors.light.onTint,
  },
});
