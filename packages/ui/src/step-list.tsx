import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Radius, Spacing } from './theme';
import { ThemedText } from './themed-text';
import { useTheme } from './use-theme';

export type StepState = 'done' | 'now' | 'todo';

export type Step = { label: string; state: StepState };

/**
 * 처리 단계 목록 — WP-ST-012 · WP-ST-015 공용.
 *
 * 끝난 단계는 코랄 원 + 체크, 진행 중은 코랄 원 + 700, 남은 단계는 회색 원 +
 * 회색 글자. 점 18 · 라벨 16 · 행 30.
 */
export function StepList({ steps }: { steps: readonly Step[] }) {
  const theme = useTheme();

  return (
    <View style={styles.list}>
      {steps.map((step) => (
        <View key={step.label} style={styles.row} accessibilityLabel={`${step.label} · ${STATE_LABEL[step.state]}`}>
          <View
            style={[
              styles.dot,
              { backgroundColor: step.state === 'todo' ? theme.border : theme.tint },
            ]}>
            {step.state === 'done' ? (
              <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                <Path
                  d="m5 12.5 4.5 4.5L19 7.5"
                  stroke={theme.onTint}
                  strokeWidth={3.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            ) : null}
          </View>
          <ThemedText
            type={step.state === 'now' ? 't5' : 't6'}
            themeColor={step.state === 'todo' ? 'textDisabled' : 'text'}>
            {step.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const STATE_LABEL: Record<StepState, string> = { done: '끝남', now: '진행 중', todo: '남음' };

const styles = StyleSheet.create({
  list: { alignSelf: 'stretch', gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 },
  /* 시안 고정 18 — 8단계 타이포와 무관한 점 지름이라 토큰이 아닌 값이다. */
  dot: {
    width: 18,
    height: 18,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
