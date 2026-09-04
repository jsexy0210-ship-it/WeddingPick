import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from './themed-text';
import { Layout, Radius, Spacing } from './theme';
import { useTheme } from './use-theme';

export type ActionButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /** 보조 설명. 라벨 아래 작은 글씨로 붙는다. */
  hint?: string;
  /**
   * `ghost`는 흰 바탕에 테두리만 있는 보조 버튼이다.
   *
   * 비교할 것이 없을 때 권하는 제보처럼 **Primary가 이미 다른 곳에 있거나 아예
   * 없어야 하는 자리**에 쓴다 — 화면당 Primary CTA는 하나라는 규칙을 지키면서도
   * 행동을 남긴다.
   */
  variant?: 'primary' | 'secondary' | 'ghost';
  /**
   * SEED 컨트롤 높이.
   *
   * 기본값 `auto`는 높이를 고정하지 않고 안쪽 여백으로 부푼다 — 목록 안에서 한
   * 줄짜리로 쓰이던 기존 자리들이 그대로 있어 기본값을 바꾸지 않았다. 화면의 주
   * 행동에는 `xlarge`를 준다.
   */
  size?: 'auto' | 'medium' | 'large' | 'xlarge';
};

const HEIGHT = {
  medium: Layout.controlMedium,
  large: Layout.controlLarge,
  xlarge: Layout.controlXLarge,
} as const;

export function ActionButton({
  label,
  hint,
  variant = 'secondary',
  size = 'auto',
  disabled,
  ...rest
}: ActionButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.button,
        size === 'auto' ? null : [styles.fixed, { height: HEIGHT[size] }],
        {
          backgroundColor: isPrimary
            ? theme.tint
            : isGhost
              ? theme.background
              : theme.backgroundElement,
          borderWidth: isGhost ? 1 : 0,
          borderColor: theme.track,
          // hovered는 react-native-web에서만 온다(마우스 없는 네이티브는 항상 false).
          opacity: disabled === true ? 0.4 : pressed ? 0.8 : hovered ? 0.9 : 1,
        },
      ]}
      {...rest}>
      <ThemedText type="t5" numberOfLines={1} themeColor={isPrimary ? 'onTint' : 'text'}>
        {label}
      </ThemedText>
      {hint ? (
        <ThemedText type="t7" themeColor={isPrimary ? 'onTint' : 'textAssistive'}>
          {hint}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    /** SEED 박스 버튼은 6이다. TDS에서는 14였고, 이 값이 인상을 가장 크게 바꾼다. */
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  /** 높이를 고정하면 안쪽 여백 대신 가운데 정렬로 세운다. */
  fixed: {
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
