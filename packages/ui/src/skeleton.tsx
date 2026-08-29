import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, type ViewStyle } from 'react-native';

import { Radius } from './theme';
import { useTheme } from './use-theme';

export type SkeletonProps = {
  /**
   * `'auto'`를 주면 폭을 바깥 배치에 맡긴다.
   *
   * 기본값 `'100%'`가 flex 배치를 이긴다 — 퀵메뉴 자리처럼 `flexGrow`로 2×2를
   * 만들려던 곳이 세로로 늘어섰다. 그려보고 알았다.
   */
  width?: number | `${number}%` | 'auto';
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

/**
 * 자리를 지키는 회색 블록. 디자인 핸드오프 4번.
 *
 * **빈 화면을 보여주지 않기 위한 것이지, 빠르게 보이려고 쓰는 것이 아니다.**
 * 핸드오프의 "빈 상태에서 레이아웃을 바꾸지 않는다"와 같은 생각이다 — 자료가
 * 오기 전에도 화면의 골격은 같아야, 자료가 왔을 때 화면이 튀지 않는다.
 *
 * 숨쉬듯 옅어졌다 진해진다. 핸드오프는 "반복 애니메이션 없음"이라고 적었지만
 * 그건 **장식**을 두고 한 말이고, 이건 아직 기다리는 중이라는 표시다 — 멈춰
 * 있으면 로딩이 끝난 빈 화면과 구별되지 않는다.
 */
export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps) {
  const theme = useTheme();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    // 화면을 떠나면 멈춘다. 안 그러면 안 보이는 곳에서 계속 돈다.
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      // 읽는 기계에는 "불러오는 중"이라고 말한다. 회색 네모라고 말할 이유가 없다.
      accessibilityRole="progressbar"
      accessibilityLabel="불러오는 중"
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius: radius ?? Radius.small,
          backgroundColor: theme.backgroundSelected,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }),
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
  },
});
