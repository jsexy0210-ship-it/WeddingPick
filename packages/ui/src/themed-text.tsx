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
    | 'note'
    | 'link'
    | 'code'
    /** 아래는 옛 이름. 위 스케일로 잇는다. */
    | 'title'
    | 'subtitle'
    | 'default'
    | 'small'
    | 'smallBold'
    /* 피그마 규격서 크기 — 이름이 곧 값. 굵기는 style로, 줄높이가 다르면 LineHeight.lhNN으로 덮는다. */
    | 'f7'
    | 'f9'
    | 'f10'
    | 'f11'
    | 'f12'
    | 'f13'
    | 'f14'
    | 'f15'
    | 'f16'
    | 'f18'
    | 'f20'
    | 'f24'
    | 'f26'
    | 'f28'
    | 'f30'
    | 'f32'
    | 'f38'
    | 'f42'
    | 'f46'
    | 'f52';
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
  note: 'note',
  link: 'link',
  code: 'code',

  title: 't1',
  subtitle: 't2',
  default: 't6',
  small: 't7',
  // 목록 항목명·강조 값. smallBold가 실제로 쓰이던 자리가 t5다.
  smallBold: 't5',

  f7: 'f7',
  f9: 'f9',
  f10: 'f10',
  f11: 'f11',
  f12: 'f12',
  f13: 'f13',
  f14: 'f14',
  f15: 'f15',
  f16: 'f16',
  f18: 'f18',
  f20: 'f20',
  f24: 'f24',
  f26: 'f26',
  f28: 'f28',
  f30: 'f30',
  f32: 'f32',
  f38: 'f38',
  f42: 'f42',
  f46: 'f46',
  f52: 'f52',
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
  /* caption 14와 같은 단계다 — 줄 높이만 다르다. */
  note: -0.04,
  micro: -0.04,
  tab: -0.04,
  badge: -0.04,
  code: 0,
  numeric: 0,
  /* 피그마 규격서 크기는 자간을 줄마다 따로 적는다(«ls -0.4px») — 기본 0, 자리에서 style로 준다. */
  f7: 0,
  f9: 0,
  f10: 0,
  f11: 0,
  f12: 0,
  f13: 0,
  f14: 0,
  f15: 0,
  f16: 0,
  f18: 0,
  f20: 0,
  f24: 0,
  f26: 0,
  f28: 0,
  f30: 0,
  f32: 0,
  f38: 0,
  f42: 0,
  f46: 0,
  f52: 0,
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
  /**
   * caption 14의 여러 줄 변형 — 14/21. `LineHeight.t7Loose`.
   *
   * 알림 본문 · 안내 두 줄처럼 `t7`(14/19)보다 숨이 필요한 자리다. 목업 여럿이 이 짝을
   * 쓰는데(12-closing `t14w` · 11-report `카드 사유`) 쓸 타입이 없어 `body`(16/24)로
   * 올라가 있었다 — 제목과 무게가 비슷해져 줄이 구분되지 않았다.
   */
  note: { fontSize: FontSize.t7, lineHeight: LineHeight.t7Loose, fontWeight: 400 },
  /** micro 13/18. 정보 단계 배지 · 스타일 칩 · 순위 pill. */
  micro: { fontSize: FontSize.micro, lineHeight: LineHeight.micro, fontWeight: 700 },
  tab: { fontSize: FontSize.tab, lineHeight: LineHeight.tab, fontWeight: 700 },
  badge: { fontSize: FontSize.badge, lineHeight: LineHeight.badge, fontWeight: 700 },
  amount: { fontSize: FontSize.amount, lineHeight: LineHeight.amount, fontWeight: 700 },

  numeric: { fontVariant: ['tabular-nums'] },

  /*
   * 피그마 규격서 크기. 줄높이는 Tailwind 기본(규격서에 가장 많이 적힌 값)이고, 자리마다
   * 다르면 LineHeight.lhNN으로 덮는다. 굵기는 기본 400 — 규격서의 500 · 600 · 700을 style로 준다.
   */
  /* 7 · 9는 홈 히어로에만 있다(home.txt 아바타 «7/700 · lh 11» · «두근두근» «9/400 · lh 14»). */
  f7: { fontSize: FontSize.f7, lineHeight: LineHeight.lh11, fontWeight: 400 },
  f9: { fontSize: FontSize.f9, lineHeight: LineHeight.lh14, fontWeight: 400 },
  f10: { fontSize: FontSize.f10, lineHeight: LineHeight.lh15, fontWeight: 400 },
  f11: { fontSize: FontSize.f11, lineHeight: LineHeight.lh17, fontWeight: 400 },
  f12: { fontSize: FontSize.f12, lineHeight: LineHeight.lh16, fontWeight: 400 },
  f13: { fontSize: FontSize.f13, lineHeight: LineHeight.lh20, fontWeight: 400 },
  f14: { fontSize: FontSize.f14, lineHeight: LineHeight.lh20, fontWeight: 400 },
  f15: { fontSize: FontSize.f15, lineHeight: LineHeight.lh22, fontWeight: 400 },
  f16: { fontSize: FontSize.f16, lineHeight: LineHeight.lh24, fontWeight: 400 },
  f18: { fontSize: FontSize.f18, lineHeight: LineHeight.lh28, fontWeight: 400 },
  f20: { fontSize: FontSize.f20, lineHeight: LineHeight.lh28, fontWeight: 400 },
  f24: { fontSize: FontSize.f24, lineHeight: LineHeight.lh32, fontWeight: 400 },
  f26: { fontSize: FontSize.f26, lineHeight: LineHeight.lh39, fontWeight: 400 },
  f28: { fontSize: FontSize.f28, lineHeight: LineHeight.lh42, fontWeight: 400 },
  /* 30은 상담 예약 제목뿐이다(vendor-1-consult.txt «30/700 · lh 38»). */
  f30: { fontSize: FontSize.f30, lineHeight: LineHeight.lh38, fontWeight: 400 },
  f32: { fontSize: FontSize.f32, lineHeight: LineHeight.lh40, fontWeight: 400 },
  f38: { fontSize: FontSize.f38, lineHeight: LineHeight.lh45, fontWeight: 400 },
  f42: { fontSize: FontSize.f42, lineHeight: LineHeight.lh45, fontWeight: 400 },
  f46: { fontSize: FontSize.f46, lineHeight: LineHeight.lh46, fontWeight: 400 },
  f52: { fontSize: FontSize.f52, lineHeight: LineHeight.lh52, fontWeight: 400 },

  link: { fontSize: FontSize.t7, lineHeight: LineHeight.link },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: FontSize.code,
  },
});
