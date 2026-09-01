import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from './theme';
import { useTheme } from './use-theme';

/**
 * 글자 크기 — SEED 타이포그래피 래더.
 *
 * SEED로 갈아타면서 세 가지가 바뀌었다.
 *
 * 1. **semibold가 없다.** SEED는 regular(400)와 bold(700) 둘뿐이다. 중간 강조가
 *    사라져서 위계를 두 단계로만 잡는다 — 예전 t5의 600은 700으로 올라갔다.
 * 2. **행간을 %로 잡는다.** 135%(small)와 150%(medium). px로 적어두면 크기를
 *    조정할 때 한쪽만 고쳐진다.
 * 3. **자간이 0이다.** SEED iOS 기본값이고, 예전 −0.2~−0.8은 TDS 값이었다.
 *
 * 핸드오프 이름(t1·t2·t4·t5·t6·t7)은 그대로 둔다. 화면 34곳이 쓰고 있고, 이름을
 * 한꺼번에 바꾸는 것은 개편이 아니라 이사다 — 값만 SEED로 옮긴다.
 */
export type ThemedTextProps = TextProps & {
  type?:
    /** SEED h3. 홈 히어로. */
    | 't1'
    /** SEED h4. 화면 헤드라인·섹션 히어로. */
    | 't2'
    /** SEED title2. 섹션 제목. */
    | 't4'
    /** SEED title3. 목록 항목명·강조 값. */
    | 't5'
    /** SEED subtitle1/body-l1. 본문. */
    | 't6'
    /** SEED subtitle2. 캡션·라벨·출처. */
    | 't7'
    | 'tab'
    | 'badge'
    /** 홈 지출 총액 전용. 이 자리만 따로 크게 간다. */
    | 'amount'
    /** 본문 중 여러 줄로 읽히는 것. 행간이 150%다. */
    | 'body'
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
  body: 'body',
  link: 'link',
  code: 'code',

  title: 't1',
  subtitle: 't2',
  default: 't6',
  small: 't7',
  // 목록 항목명·강조 값. smallBold가 실제로 쓰이던 자리가 t5다.
  smallBold: 't5',
};

/**
 * SEED 래더. 행간은 135%이고, 여러 줄로 읽히는 `body`만 150%다.
 *
 * **자간은 전부 0이다.** 그래서 letterSpacing을 적지 않는다 — 0을 적어두면 언젠가
 * 누군가 "여기만 조금" 하고 값을 넣는다.
 */
const styles = StyleSheet.create({
  /** SEED h3. 홈 히어로 — `두근두근 / 142일 남았어요`. */
  t1: { fontSize: 32, lineHeight: 43, fontWeight: 700 },
  /** SEED h4. 화면 헤드라인·섹션 히어로. 줄바꿈은 수동. */
  t2: { fontSize: 26, lineHeight: 35, fontWeight: 700 },
  /** SEED title2. 섹션 제목. */
  t4: { fontSize: 20, lineHeight: 27, fontWeight: 700 },
  /** SEED title3. 목록 항목명, 강조 값. */
  t5: { fontSize: 18, lineHeight: 24, fontWeight: 700 },
  /** SEED subtitle1. 본문, 설명. */
  t6: { fontSize: 16, lineHeight: 22, fontWeight: 400 },
  /** SEED subtitle2. 캡션, 라벨, 출처. */
  t7: { fontSize: 14, lineHeight: 19, fontWeight: 400 },
  /** SEED body-l1. 두 줄 이상 이어 읽는 안내문. */
  body: { fontSize: 16, lineHeight: 24, fontWeight: 400 },
  tab: { fontSize: 12, lineHeight: 16, fontWeight: 700 },
  badge: { fontSize: 12, lineHeight: 16, fontWeight: 700 },
  amount: { fontSize: 32, lineHeight: 43, fontWeight: 700 },

  numeric: { fontVariant: ['tabular-nums'] },

  link: { fontSize: 14, lineHeight: 19 },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
