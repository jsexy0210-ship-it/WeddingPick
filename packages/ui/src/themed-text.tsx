import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { FontSize, LineHeight } from './typography';

import { Fonts, ThemeColor } from './theme';
import { useTheme } from './use-theme';

/**
 * 글자 크기 — 디자인 핸드오프가 정한 t 스케일.
 *
 * 핸드오프 이름(t1·t2·t4·t5·t6·t7)을 그대로 쓴다. 우리 이름으로 바꿔 두면 디자인을
 * 보면서 코드를 쓸 때 매번 머릿속에서 번역해야 하고, 번역은 틀린다.
 *
 * 옛 이름(title·subtitle·default·small·smallBold)은 화면 34곳이 쓰고 있어 남겨두고
 * 같은 값으로 잇는다 — 이름을 한꺼번에 바꾸는 것은 개편이 아니라 이사다.
 */
export type ThemedTextProps = TextProps & {
  type?:
    | 't1'
    | 't2'
    | 't4'
    | 't5'
    | 't6'
    | 't7'
    | 'tab'
    | 'badge'
    /** 홈 지출 총액 전용. 핸드오프가 이 자리만 38/48/-1로 따로 정했다. */
    | 'amount'
    | 'link'
    | 'code'
    /** 아래는 옛 이름. 위 스케일로 잇는다. */
    | 'title'
    | 'subtitle'
    | 'default'
    | 'small'
    | 'smallBold';
  themeColor?: ThemeColor;
  /** 금액에는 tabular-nums를 붙인다. 자릿수가 흔들리면 숫자가 춤춘다. */
  numeric?: boolean;
};

export function ThemedText({
  style,
  type = 't6',
  themeColor,
  numeric,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        styles[STYLE_FOR[type]],
        numeric && styles.numeric,
        style,
      ]}
      {...rest}
    />
  );
}

type TextType = NonNullable<ThemedTextProps['type']>;

/**
 * 이름 → 실제 값.
 *
 * 옛 이름은 t 스케일로 잇는다. 값을 두 벌 두지 않으려고 이름만 잇는 것이라,
 * `title`과 `t1`은 같은 줄을 가리킨다.
 */
const STYLE_FOR: Record<TextType, keyof typeof styles> = {
  t1: 't1',
  t2: 't2',
  t4: 't4',
  t5: 't5',
  t6: 't6',
  t7: 't7',
  tab: 'tab',
  badge: 'badge',
  amount: 'amount',
  link: 'link',
  code: 'code',

  title: 't1',
  subtitle: 't2',
  default: 't6',
  small: 't7',
  // 목록 항목명·강조 값. smallBold가 실제로 쓰이던 자리가 t5다.
  smallBold: 't5',
};

const styles = StyleSheet.create({
  /** 대표 숫자. */
  t1: { fontSize: FontSize.t1, lineHeight: LineHeight.t1, letterSpacing: -0.8, fontWeight: 700 },
  /** 화면 헤드라인. 줄바꿈은 수동. */
  t2: { fontSize: FontSize.t2, lineHeight: LineHeight.t2, letterSpacing: -0.6, fontWeight: 700 },
  /** 섹션 제목. */
  t4: { fontSize: FontSize.t4, lineHeight: LineHeight.t4, letterSpacing: -0.4, fontWeight: 700 },
  /** 목록 항목명, 강조 값. */
  t5: { fontSize: FontSize.t5, lineHeight: LineHeight.t5, letterSpacing: -0.3, fontWeight: 600 },
  /** 본문, 설명. */
  t6: { fontSize: FontSize.t6, lineHeight: LineHeight.t6, letterSpacing: -0.3, fontWeight: 400 },
  /** 캡션, 라벨, 출처. */
  t7: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, letterSpacing: -0.2, fontWeight: 400 },
  tab: { fontSize: FontSize.tab, lineHeight: LineHeight.tab, fontWeight: 600 },
  badge: { fontSize: FontSize.badge, lineHeight: LineHeight.badge, fontWeight: 600 },
  amount: { fontSize: FontSize.amount, lineHeight: LineHeight.amount, letterSpacing: -1, fontWeight: 700 },

  numeric: { fontVariant: ['tabular-nums'] },

  link: { fontSize: FontSize.t7, lineHeight: LineHeight.link },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: FontSize.code,
  },
});
