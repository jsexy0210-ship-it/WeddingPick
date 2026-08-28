import { darkOriginTheme, lightOriginTheme } from '@montage-ui/theme';
import { Platform } from 'react-native';

/**
 * 디자인 토큰 — Montage (Wanted Design System) 위에 얹는다.
 *
 * 값을 베껴 오지 않고 `@montage-ui/theme`에서 그때그때 읽는다. 베껴두면 Montage가
 * 바뀔 때 우리만 옛 색을 들고 있게 된다. 그 패키지는 MIT에 순수 데이터라(DOM·React
 * 참조가 없다) React Native에서도 그대로 돈다.
 *
 * **Montage 컴포넌트는 쓸 수 없다.** `@montage-ui/core`는 react-dom과 Radix 프리미티브
 * 위에 서 있어 React Native에서 돌지 않는다. 우리가 가져오는 것은 디자인 언어 —
 * 색의 의미 체계, 간격 스케일, 글꼴 — 이고, 그리는 것은 우리 컴포넌트다.
 *
 * 화면은 이 값을 직접 읽지 않고 useTheme으로 지금 모드에 맞는 쪽을 받는다 — 화면마다
 * 모드를 판단하면 언젠가 한 곳이 어긋난다.
 */

const light = lightOriginTheme.semantic;
const dark = darkOriginTheme.semantic;

/**
 * 화면이 쓰는 색 역할.
 *
 * 이름은 우리 것을 지키고 값만 Montage에서 온다 — 화면 33곳이 이 이름으로 쓰고 있고,
 * 이름을 바꾸는 것은 개편이 아니라 이사다. 각 줄 끝에 어느 Montage 토큰인지 적어둔다.
 */
export const Colors = {
  light: {
    text: light.label.normal,
    textSecondary: light.label.alternative,
    textAssistive: light.label.assistive,
    background: light.background.normal.normal,
    backgroundElement: light.background.normal.alternative,
    backgroundSelected: light.fill.strong,
    border: light.line.solid.normal,
    tint: light.primary.normal,
    tintStrong: light.primary.strong,
    tintInactive: light.interaction.inactive,
    positive: light.status.positive,
    cautionary: light.status.cautionary,
    negative: light.status.negative,
  },
  dark: {
    text: dark.label.normal,
    textSecondary: dark.label.alternative,
    textAssistive: dark.label.assistive,
    background: dark.background.normal.normal,
    backgroundElement: dark.background.elevated.normal,
    backgroundSelected: dark.fill.strong,
    border: dark.line.solid.normal,
    tint: dark.primary.normal,
    tintStrong: dark.primary.strong,
    tintInactive: dark.interaction.inactive,
    positive: dark.status.positive,
    cautionary: dark.status.cautionary,
    negative: dark.status.negative,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * 글꼴.
 *
 * Montage는 Pretendard를 쓴다. 웹에서는 tokens.css가 정의한 변수로 들어가고, 네이티브는
 * 시스템 글꼴로 떨어진다 — 앱에 Pretendard 파일을 넣기 전까지는 그렇다. 있는 척하지
 * 않으려고 여기 적어둔다.
 */
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-sans)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-sans)',
    mono: 'var(--font-mono)',
  },
});

/**
 * 간격.
 *
 * 이름은 우리 것이되 값은 Montage 스케일에서 고른다 — 임의의 숫자를 만들지 않는다.
 * Montage는 px 문자열로 주므로 숫자로 바꾼다(React Native는 숫자를 쓴다).
 */
const scale = lightOriginTheme.spacing;
const px = (step: keyof typeof scale): number => Number.parseFloat(scale[step]);

export const Spacing = {
  half: px(2),
  one: px(4),
  two: px(8),
  three: px(16),
  four: px(24),
  five: px(32),
  six: px(64),
} as const;

/** 모서리 둥글기. Montage가 스케일을 따로 주지 않아 간격 스케일에서 고른다. */
export const Radius = {
  small: px(8),
  medium: px(12),
  large: px(16),
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
