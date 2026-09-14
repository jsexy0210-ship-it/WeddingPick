import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { Spacing } from './theme';
import { useTheme } from './use-theme';

export type RatingStarsProps = {
  /** 1~5. 소수를 받는다 — 평균은 4.3처럼 온다. */
  value: number;
  /** 숫자를 별 옆에 함께 적을지. 기본은 적는다 — 별만으로는 4.2와 4.4가 같아 보인다. */
  showValue?: boolean;
  /** 별 하나가 몇 명의 답인지. 있으면 «(12)»로 뒤에 붙인다. */
  count?: number;
  size?: 'default' | 'large';
};

const MAX = 5;

/**
 * 별점 보여주기(읽기 전용). 5.0 만점으로 환산해 그린다.
 *
 * `RatingPicker`와 짝이다 — 그쪽은 고르는 자리, 이쪽은 보여주는 자리다. 별 모양과
 * 색을 한 곳에서만 정하려고 나눠 두지 않고 같은 글리프(★)를 쓴다.
 *
 * **반 칸을 그리지 않는다.** 4.3에 별 4.3개를 그리려면 별을 잘라야 하는데, 잘린
 * 별은 기기마다 다르게 보이고 스크린 리더가 읽을 수도 없다. 별은 반올림해 채우고
 * **정확한 값은 숫자로 적는다** — 눈으로 어림잡을 것과 정확히 읽을 것을 나눈다.
 *
 * 0을 만들지 않는다(`RatingPicker`와 같은 이유). 평균이 없으면 이 컴포넌트를
 * 그리지 않는 것이 맞지, 0.0을 그리는 것이 아니다.
 */
export function RatingStars({ value, showValue = true, count, size = 'default' }: RatingStarsProps) {
  const theme = useTheme();
  const filled = Math.round(value);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={
        count === undefined ? `5점 만점에 ${value.toFixed(1)}점` : `5점 만점에 ${value.toFixed(1)}점 · ${count}명`
      }
      style={styles.row}>
      <View style={styles.stars}>
        {Array.from({ length: MAX }, (_, index) => (
          <ThemedText
            key={index}
            type={size === 'large' ? 'subtitle' : 'default'}
            style={{ color: index < filled ? theme.tint : theme.border }}>
            ★
          </ThemedText>
        ))}
      </View>

      {showValue ? (
        <ThemedText type={size === 'large' ? 't4' : 't6'} numeric style={styles.value}>
          {value.toFixed(1)}
        </ThemedText>
      ) : null}

      {count === undefined ? null : (
        <ThemedText type="t7" themeColor="textAssistive" numeric>
          ({count})
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  stars: { flexDirection: 'row' },
  value: { fontWeight: '700' },
});
