import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { Spacing } from './theme';
import { useTheme } from './use-theme';

export type RatingPickerProps = {
  /** 무엇에 대한 별점인지. 스크린 리더가 이걸 읽는다. */
  label: string;
  /** 아직 고르지 않았으면 null. 0은 쓰지 않는다 — "0점"과 "안 골랐다"는 다른 것이다. */
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** 전체 만족도처럼 화면에서 크게 보여야 할 때만 'large'. */
  size?: 'default' | 'large';
};

/**
 * 별점 고르기.
 *
 * 0을 만들지 않는다. "0점"과 "아직 안 골랐다"를 같은 값으로 두면, 답하지 않은 항목이
 * 최하점으로 계산에 들어간다. 고르지 않은 상태는 `null`이고 저장되지 않는다.
 */
export function RatingPicker({
  label,
  value,
  onChange,
  min = 1,
  max = 5,
  size = 'default',
}: RatingPickerProps) {
  const theme = useTheme();
  const options = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
      {options.map((option) => {
        const filled = value !== null && option <= value;

        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === option }}
            accessibilityLabel={`${option}점`}
            hitSlop={Spacing.one}
            onPress={() => onChange(option)}>
            <ThemedText
              type={size === 'large' ? 'subtitle' : 'default'}
              style={[styles.star, { color: filled ? theme.tint : theme.border }]}>
              ★
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.one,
    alignItems: 'center',
  },
  star: {
    // 눌리는 넓이를 별 모양이 아니라 글자 칸으로 맞춘다. 손가락이 별 사이로 빠지지 않게.
    paddingHorizontal: Spacing.one,
  },
});
