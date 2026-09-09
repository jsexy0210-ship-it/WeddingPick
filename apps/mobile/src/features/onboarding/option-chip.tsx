import { Pressable, StyleSheet } from 'react-native';

import { Layout, Radius, ThemedText, useTheme } from '@weddingpick/ui';

/**
 * 칩 하나. 예식일의 «아직 정하지 않았어요»와 지역 시/도 아홉 개가 같이 쓴다 —
 * 시안 20-onboarding-v2 `chip()`: 높이 36 · 좌우 14 · pill · 700, 미선택
 * gray100(#F2F3F6)/#4D5159(textSecondary), 선택 코랄/흰색.
 *
 * 글자는 시안 15인데 타이포 토큰에 15가 없어 t6(16)이다.
 */
export function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.tint : theme.backgroundSelected }]}>
      <ThemedText type="t6" themeColor={selected ? 'onTint' : 'textSecondary'} style={styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** 시안 고정 — 칩 좌우 14. 토큰 spacing에 14가 없다. */
const CHIP_PADDING_X = 14;

const styles = StyleSheet.create({
  chip: {
    height: Layout.chip,
    paddingHorizontal: CHIP_PADDING_X,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: 700 },
});
