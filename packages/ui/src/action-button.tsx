import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { ThemedText } from './themed-text';
import { Border, Layout, Motion, Radius, Spacing } from './theme';
import { useTheme } from './use-theme';
import { readWebInteractionState } from './web-interaction';

export type ActionButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /** 라벨 왼쪽에 붙는 작은 아이콘. 소셜 로그인 버튼의 제공자 로고처럼 라벨과 같은 줄에 놓인다. */
  icon?: ReactNode;
  /** 보조 설명. 라벨 아래 작은 글씨로 붙는다. */
  hint?: string;
  /**
   * 02-design-system «Button».
   *
   * - `primary`   코랄 채움 · 흰 글자. 화면당 하나.
   * - `secondary` 밴드(#F2F3F6) 채움 · #393A40 글자 — 시트의 「다시 볼게요」 같은 보조 행동.
   * - `ghost`     흰 바탕 · 1px #DCDEE3 테두리 · #212124 글자 — 시안의 Secondary 48 · Small 40.
   *               Primary가 이미 다른 곳에 있거나 없어야 하는 자리에 쓴다.
   * - `selected`  Pick 완료 — 1.5px 코랄 테두리 · #FFF5F2 면 · 코랄 글자.
   * - `danger`    탈퇴 · 신고 · 빼기 — #FF4133 채움 · 흰 글자.
   */
  variant?: 'primary' | 'secondary' | 'ghost' | 'selected' | 'danger';
  /**
   * SEED 컨트롤 높이 — xlarge 52(Primary CTA) · large 48(Secondary) · medium 40(Small).
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

/**
 * 버튼. 02-design-system · tokens.json size.cta.
 *
 * - 라벨은 Primary CTA(52)만 body 18, 나머지는 sub 16 — 둘 다 700(«본문 · 금액 · 버튼» = sub).
 * - 누르면 `scale(.98)` 100ms, **색은 바꾸지 않는다**(motion.pressButton).
 * - Disabled는 회색 채움 — #F2F3F6 위 #ADB1BA(20-onboarding-v2 ctaDisabled · CHANGELOG v3.19 «값이 없으면
 *   회색 비활성»). 02-design-system의 «투명도 0.4»보다 뒤에 나온 규칙이라 이쪽을 따른다.
 * - 아이콘과 라벨 사이 8(01a-login ctaKakao).
 * - 모서리 6(radius.control).
 */
export function ActionButton({
  label,
  icon,
  hint,
  variant = 'secondary',
  size = 'auto',
  tone,
  disabled,
  ...rest
}: ActionButtonProps) {
  const theme = useTheme();

  const look: Look =
    disabled === true
      ? { background: theme.backgroundSelected, text: theme.textDisabled, borderWidth: 0, hint: theme.textDisabled }
      : tone
        ? {
            background: tone.background,
            text: tone.text,
            border: tone.border,
            borderWidth: tone.border ? Border.hairline : 0,
          }
        : LOOK[variant](theme);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      style={(state) => {
        const { pressed, focused } = readWebInteractionState(state);
        return [
          styles.button,
          size === 'auto' ? null : [styles.fixed, { height: HEIGHT[size] }],
          {
            backgroundColor: look.background,
            /* 키보드 포커스(웹)만 코랄 링을 얹는다 — 마우스 오버 · 누름은 색을 바꾸지 않는다. */
            borderWidth: focused ? Math.max(look.borderWidth, Border.focus) : look.borderWidth,
            borderColor: focused ? theme.tint : look.border ?? look.background,
            transform: [{ scale: pressed && !disabled ? Motion.pressButton.scale : 1 }],
          },
        ];
      }}
      {...rest}>
      <View style={styles.row}>
        {icon}
        <ThemedText
          type={size === 'xlarge' ? 't5' : 't6'}
          numberOfLines={1}
          style={[styles.label, { color: look.text }]}>
          {label}
        </ThemedText>
      </View>
      {hint ? (
        <ThemedText type="t7" style={{ color: look.hint ?? look.text }}>
          {hint}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

type Look = { background: string; text: string; border?: string; borderWidth: number; hint?: string };

type Theme = ReturnType<typeof useTheme>;

const LOOK: Record<NonNullable<ActionButtonProps['variant']>, (theme: Theme) => Look> = {
  primary: (theme) => ({ background: theme.tint, text: theme.onTint, borderWidth: 0 }),
  secondary: (theme) => ({
    background: theme.backgroundSelected,
    text: theme.textStrong,
    borderWidth: 0,
    hint: theme.textAssistive,
  }),
  ghost: (theme) => ({
    background: theme.background,
    text: theme.text,
    border: theme.track,
    borderWidth: Border.hairline,
    hint: theme.textAssistive,
  }),
  selected: (theme) => ({
    background: theme.tintSurface,
    text: theme.tint,
    border: theme.tint,
    borderWidth: Border.selected,
  }),
  danger: (theme) => ({ background: theme.negativeAction, text: theme.onTint, borderWidth: 0 }),
};

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.control,
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
  /** 아이콘(소셜 로고)과 라벨 사이 8 — 01a-login ctaKakao gap. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  /** 버튼 라벨은 크기와 무관하게 700 — sub(16)의 400 기본값을 덮는다. */
  label: { fontWeight: 700 },
});
