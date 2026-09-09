import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { FontSize, LineHeight } from './typography';

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
    /** 바텀시트 제목. tokens.json heading 24/32. */
    | 't3'
    /** SEED title2. 섹션 제목. */
    | 't4'
    /** SEED title3. 목록 항목명·강조 값. */
    | 't5'
    /** SEED subtitle1/body-l1. 본문. */
    | 't6'
    /** SEED subtitle2. 캡션·라벨·출처. */
    | 't7'
    /** micro 13/18/700. 정보 단계 배지 · 스타일 칩(28) · 이미지 위 순위 pill. */
    | 'micro'
    | 'tab'
    /** 상태 배지 14/19/700 — component.badge. */
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
        /* 시스템 서체 — 네이티브는 fontFamily를 주지 않는다(undefined). 웹만 시스템 스택을 넘긴다. */
        Fonts.sans ? { fontFamily: Fonts.sans } : null,
        styles[STYLE_FOR[type]],
        androidLetterSpacing(STYLE_FOR[type]),
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
  t3: 't3',
  t4: 't4',
  t5: 't5',
  t6: 't6',
  t7: 't7',
  micro: 'micro',
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
 * 안드로이드 자간. spec/tokens.json `platform.letterSpacing` — iOS는 전부 0이고,
 * 안드로이드만 display −0.04 · title −0.03 · body −0.02 · caption −0.04em이다.
 * 넣지 않으면 글자가 벌어져 2줄 제목이 3줄로 터진다(핸드오프 SPEC §14).
 * em 값을 px로 바꿔 적는다(RN letterSpacing은 px).
 */
const ANDROID_LETTER_SPACING_EM: Record<keyof typeof styles, number> = {
  t1: -0.04,
  amount: -0.04,
  t2: -0.03,
  t3: -0.03,
  t4: -0.03,
  t5: -0.03,
  t6: -0.02,
  body: -0.02,
  link: -0.02,
  t7: -0.04,
  micro: -0.04,
  tab: -0.04,
  badge: -0.04,
  code: 0,
  numeric: 0,
};

function androidLetterSpacing(key: keyof typeof styles): { letterSpacing: number } | null {
  if (Platform.OS !== 'android') return null;
  const em = ANDROID_LETTER_SPACING_EM[key];
  const size = (styles[key] as { fontSize?: number }).fontSize;
  if (!em || !size) return null;

  return { letterSpacing: Math.round(em * size * 100) / 100 };
}

/**
 * SEED 래더. 행간은 135%이고, 여러 줄로 읽히는 `body`만 150%다.
 *
 * **iOS 자간은 전부 0이다.** 그래서 스타일에 letterSpacing을 적지 않는다 — 안드로이드
 * 보정은 위 `androidLetterSpacing` 한 곳에서만 붙는다.
 */
const styles = StyleSheet.create({
  /** SEED h3. 홈 히어로 — `두근두근 / 142일 남았어요`. */
  t1: { fontSize: FontSize.t1, lineHeight: LineHeight.t1, fontWeight: 700 },
  /** SEED h4. 화면 헤드라인·섹션 히어로. 줄바꿈은 수동. */
  t2: { fontSize: FontSize.t2, lineHeight: LineHeight.t2, fontWeight: 700 },
  /** 바텀시트 제목. */
  t3: { fontSize: FontSize.t3, lineHeight: LineHeight.t3, fontWeight: 700 },
  /** SEED title2. 섹션 제목. */
  t4: { fontSize: FontSize.t4, lineHeight: LineHeight.t4, fontWeight: 700 },
  /** SEED title3. 목록 항목명, 강조 값. */
  t5: { fontSize: FontSize.t5, lineHeight: LineHeight.t5, fontWeight: 700 },
  /** SEED subtitle1. 본문, 설명. */
  t6: { fontSize: FontSize.t6, lineHeight: LineHeight.t6, fontWeight: 400 },
  /** SEED subtitle2. 캡션, 라벨, 출처. */
  t7: { fontSize: FontSize.t7, lineHeight: LineHeight.t7, fontWeight: 400 },
  /** SEED body-l1. 두 줄 이상 이어 읽는 안내문 — sub 16의 150% 변형. */
  body: { fontSize: FontSize.t6, lineHeight: LineHeight.t6Body, fontWeight: 400 },
  /** micro 13/18. 정보 단계 배지 · 스타일 칩 · 순위 pill. */
  micro: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, fontWeight: 700 },
  tab: { fontSize: FontSize.tab, lineHeight: LineHeight.tab, fontWeight: 700 },
  badge: { fontSize: FontSize.badge, lineHeight: LineHeight.badge, fontWeight: 700 },
  amount: { fontSize: FontSize.amount, lineHeight: LineHeight.amount, fontWeight: 700 },

  numeric: { fontVariant: ['tabular-nums'] },

  link: { fontSize: FontSize.t7, lineHeight: LineHeight.link },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: FontSize.code,
  },
});
