import { useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Motion, Radius, useTheme } from '@weddingpick/ui';

/**
 * 선택 표시 원. 온보딩 전체가 같은 모양을 쓴다 — 답 줄 20 · 준비 현황 카드 20 ·
 * 구 목록 행 22 · 예산 카드 22 · 취향 카드 24. 시안 20-onboarding-v2 `mark` ·
 * `cellCheck` · `answeredCheck`.
 *
 * 켜지면 코랄 원에 흰 체크, 꺼지면 `outline`일 때만 1.5px 회색 테두리 원을 남긴다
 * (목록 행 · 예산 카드처럼 «고를 수 있는 자리»를 미리 보여줄 때). 카드 안의 체크는
 * 꺼지면 아예 없다 — 자리가 비는 대신 라벨이 그 폭을 쓴다.
 *
 * 켜질 때 한 번 튄다 — spec/tokens.json motion.checkPop.
 */
export function CheckCircle({
  size,
  checked,
  outline = false,
}: {
  size: number;
  checked: boolean;
  outline?: boolean;
}) {
  const theme = useTheme();
  const scale = useMemo(() => new Animated.Value(checked ? 1 : 0), [checked]);

  useEffect(() => {
    if (!checked) return;

    scale.setValue(0);
    Animated.timing(scale, {
      toValue: 1,
      duration: Motion.checkPop.duration,
      easing: Easing.bezier(...Motion.checkPop.bezier),
      useNativeDriver: true,
    }).start();
  }, [checked, scale]);

  const box = { width: size, height: size };

  if (!checked) {
    return outline ? (
      <View style={[styles.circle, box, { borderWidth: 1.5, borderColor: theme.track }]} />
    ) : null;
  }

  const glyph = Math.round(size * 0.6);

  return (
    <Animated.View style={[styles.circle, box, { backgroundColor: theme.tint, transform: [{ scale }] }]}>
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
        <Path
          d="m5 12.5 4.5 4.5L19 7.5"
          stroke={theme.onTint}
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
