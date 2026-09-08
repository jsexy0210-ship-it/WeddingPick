import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, type ViewStyle } from 'react-native';

import { Motion, Radius } from './theme';
import { useTheme } from './use-theme';

/** WP-ST-007 — 24 (버튼 안) · 32 (카드 안) · 40 (화면 전체). 그 외 크기를 만들지 않는다. */
export type SpinnerSize = 24 | 32 | 40;

/** 24는 테두리 2, 나머지는 3. 핸드오프 로딩 3번. */
const BORDER: Record<SpinnerSize, number> = { 24: 2, 32: 3, 40: 3 };

/**
 * 기본 스피너. 회색 링 위에 코랄 호 하나가 900ms에 한 바퀴 돈다.
 *
 * **진행률을 모를 때만 쓴다.** 퍼센트를 알면 `ProgressBar`다 — 임의로 올라가는
 * 진행바를 두지 않는다(핸드오프 규칙 «가짜 진행률을 만들지 않아요»). 목록에는
 * 쓰지 않는다 — 목록은 `ListSkeleton`이다.
 */
export function Spinner({ size = 40, style }: { size?: SpinnerSize; style?: ViewStyle }) {
  const theme = useTheme();
  const [turn] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: Motion.spin.duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();

    return () => loop.stop();
  }, [turn]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="불러오는 중"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderWidth: BORDER[size],
          borderColor: theme.border,
          borderTopColor: theme.tint,
          transform: [
            { rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
          ],
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: { borderRadius: Radius.pill },
});
