import { StyleSheet, View } from 'react-native';

import { Layout, Radius } from './theme';
import { useTheme } from './use-theme';
import type { ThemeColor } from './theme';

export type ProgressBarProps = {
  /** 0~1. 범위를 벗어나면 잘라낸다 — 막대가 칸 밖으로 나가는 것보다 낫다. */
  value: number;
  /** 채우는 색. 기본은 강조색. */
  color?: ThemeColor;
  /** 트랙 색. 기본 `border`(#EAEBEE — component.progressTrack.bg). */
  trackColor?: ThemeColor;
  /** 트랙 높이. 기본 6(component.progressTrack) · 누적 막대는 10(stackedBar). */
  height?: number;
};

/**
 * 채워진 만큼 보여주는 막대 — tokens.json component.progressTrack: height 6 · radius 999 ·
 * 트랙 #EAEBEE · 채움 coral.
 *
 * **0도 그린다.** 빈 트랙을 남겨야 "아직 0"과 "그릴 것이 없음"이 구별된다 —
 * 아무것도 안 그리면 화면에서 그 줄 자체가 사라지고, 자료가 생겼을 때 레이아웃이
 * 움직인다.
 */
export function ProgressBar({
  value,
  color = 'tint',
  trackColor = 'border',
  height = Layout.progressTrack,
}: ProgressBarProps) {
  const theme = useTheme();
  const filled = Math.min(1, Math.max(0, value));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(filled * 100), min: 0, max: 100 }}
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme[trackColor] }]}>
      <View
        style={{
          width: `${filled * 100}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: theme[color],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    borderRadius: Radius.pill,
  },
});
