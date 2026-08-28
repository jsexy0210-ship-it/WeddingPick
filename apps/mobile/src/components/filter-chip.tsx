import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 여럿 중 하나만 고르는 자리인지. 스크린 리더가 읽는 역할이 달라진다. */
  role?: 'checkbox' | 'radio';
};

/** 눌러서 켜고 끄는 작은 조건 단추. 검색 필터와 증빙 종류 선택이 같은 것을 쓴다. */
export function FilterChip({ label, selected, onPress, role = 'checkbox' }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}>
      <ThemedView
        style={[
          styles.chip,
          {
            borderColor: selected ? theme.tint : theme.border,
            backgroundColor: selected ? theme.tint : 'transparent',
          },
        ]}>
        <ThemedText
          type="small"
          style={selected ? styles.selectedLabel : undefined}
          themeColor={selected ? undefined : 'textSecondary'}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: Spacing.four,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  selectedLabel: {
    color: '#ffffff',
  },
});
