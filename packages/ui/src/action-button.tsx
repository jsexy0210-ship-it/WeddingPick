import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from './themed-text';
import { Radius, Spacing } from './theme';
import { useTheme } from './use-theme';

export type ActionButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /** 보조 설명. 라벨 아래 작은 글씨로 붙는다. */
  hint?: string;
  variant?: 'primary' | 'secondary';
};

export function ActionButton({ label, hint, variant = 'secondary', disabled, ...rest }: ActionButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isPrimary ? theme.tint : theme.backgroundElement,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
      ]}
      {...rest}>
      <ThemedText
        type="smallBold"
        style={isPrimary ? styles.primaryLabel : undefined}
        themeColor={isPrimary ? undefined : 'text'}>
        {label}
      </ThemedText>
      {hint ? (
        <ThemedText
          type="small"
          style={isPrimary ? styles.primaryLabel : undefined}
          themeColor={isPrimary ? undefined : 'textSecondary'}>
          {hint}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    /* SEED 핸드오프: 버튼 라디우스 6. */
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  primaryLabel: {
    color: '#ffffff',
  },
});
