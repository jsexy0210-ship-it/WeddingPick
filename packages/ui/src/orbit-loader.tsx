import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { CATEGORY_CYCLE, CategoryIcon } from './category-icon';
import { StepList, type Step } from './step-list';
import { Motion, Radius, Spacing } from './theme';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

/** 단계 목록 5행. 아이콘 순서와 같다 — 핸드오프 로딩 1번. */
const STEP_LABELS = [
  '결정사 후보 훑기',
  '웨딩홀 금액 비교',
  '스튜디오 취향 맞추기',
  '드레스 일정 확인',
  '메이크업 후보 정리',
] as const;

/** 원 120 · 점 10 · 아이콘 34. 시안 고정값 — 8단계 타이포와 무관한 도형 크기라 토큰이 아니다. */
const RING = 120;
const DOT = 10;
const ICON = 34;

/**
 * WP-ST-015 — 업종 순회 로딩. 추천 계산 · 첫 진입.
 *
 * 추천을 계산하는 동안 웨딩픽이 무엇을 보고 있는지 순서대로 보여준다.
 * 결정사 → 웨딩홀 → 스튜디오 → 드레스 → 메이크업. 코랄 점이 원을 2.4초에
 * 한 바퀴, 중앙 아이콘은 1.4초씩 바뀐다. 전체 7초 한 사이클. **순서를 임의로
 * 섞지 않는다.**
 *
 * 화면 전체를 채우지 않는다 — 부모가 가운데 놓는다(`LoadingView`류의
 * StatusFrame 안에서 쓴다).
 */
export function CategoryOrbitLoader({
  title = '두 분에게 맞는 곳을\n찾고 있어요',
  estimate = '10초 안에 끝나요',
}: {
  title?: string;
  estimate?: string;
}) {
  const theme = useTheme();
  const [orbit] = useState(() => new Animated.Value(0));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: Motion.orbit.duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();

    const timer = setInterval(
      () => setIndex((current) => (current + 1) % CATEGORY_CYCLE.length),
      Motion.iconSwap.duration
    );

    return () => {
      loop.stop();
      clearInterval(timer);
    };
  }, [orbit]);

  const steps: Step[] = STEP_LABELS.map((label, i) => ({
    label,
    state: i < index ? 'done' : i === index ? 'now' : 'todo',
  }));

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={estimate}>
      <View style={styles.orbit}>
        <View style={[styles.ring, { borderColor: theme.backgroundSelected }]} />
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
              ],
            },
          ]}>
          <View style={[styles.dot, { backgroundColor: theme.tint }]} />
        </Animated.View>
        <View style={styles.icon}>
          <CategoryIcon kind={CATEGORY_CYCLE[index]!} size={ICON} color={theme.tint} />
        </View>
      </View>

      <View style={styles.text}>
        <ThemedText type="t3" style={styles.centered}>
          {title}
        </ThemedText>
        <ThemedText type="t6" themeColor="textAssistive" style={styles.centered}>
          {estimate}
        </ThemedText>
      </View>

      <StepList steps={steps} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'stretch', gap: Spacing.five },
  orbit: { width: RING, height: RING },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: Radius.pill, borderWidth: 2 },
  dot: {
    position: 'absolute',
    top: -DOT / 2,
    left: RING / 2 - DOT / 2,
    width: DOT,
    height: DOT,
    borderRadius: Radius.pill,
  },
  icon: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  text: { alignItems: 'center', gap: Spacing.two },
  centered: { textAlign: 'center' },
});
