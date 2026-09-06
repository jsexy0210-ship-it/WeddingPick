import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from './themed-text';
import { Layout, Radius, Spacing } from './theme';
import { useTheme } from './use-theme';
import { readWebInteractionState } from './web-interaction';

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
  /**
   * `variant`가 정하는 테마 색 대신 고정 색을 쓴다 — 소셜 로그인처럼 제공자
   * 브랜드색이 앱 스킨과 무관하게 고정이어야 하는 자리에만 쓴다(`SocialColors`
   * 참고). 지정하면 `variant`의 배경·테두리·글자색을 전부 덮어쓴다.
   */
  tone?: { background: string; text: string; border?: string };
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
  tone,
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
      style={(state) => {
        const { pressed, hovered, focused } = readWebInteractionState(state);
        return [
          styles.button,
          size === 'auto' ? null : [styles.fixed, { height: HEIGHT[size] }],
          {
            backgroundColor: tone
              ? tone.background
              : isPrimary
                ? theme.tint
                : isGhost
                  ? theme.background
                  : theme.backgroundElement,
            borderWidth: tone ? (tone.border ? 1 : 0) : isGhost || focused ? 1 : 0,
            borderColor: tone ? (tone.border ?? tone.background) : focused ? theme.tint : theme.track,
            opacity: disabled === true ? 0.4 : pressed ? 0.8 : hovered || focused ? 0.9 : 1,
          },
        ];
      }}
      {...rest}>
      <ThemedText
        type="t5"
        numberOfLines={1}
        themeColor={isPrimary ? 'onTint' : 'text'}
        style={tone ? { color: tone.text } : undefined}>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 높이를 고정하면 안쪽 여백 대신 가운데 정렬로 세운다. */
  fixed: {
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
