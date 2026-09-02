import { Platform } from 'react-native';

/**
 * 디자인 토큰 — 디자인 핸드오프(v7)가 정한 값.
 *
 * 이전에는 `@montage-ui/theme`에서 읽어 왔다. 핸드오프가 색·타이포·간격·라디우스를
 * 전부 확정해 주면서 그 근거가 사라졌다 — 두 곳에서 값이 오면 언젠가 어긋난다.
 *
 * **값을 여기 적어 든다.** 받아 적은 값이라는 뜻이지 우리가 정했다는 뜻이 아니다.
 * 핸드오프가 바뀌면 여기가 낡는다.
 *
 * 화면은 이 값을 직접 읽지 않고 useTheme으로 지금 모드에 맞는 쪽을 받는다 —
 * 화면마다 모드를 판단하면 언젠가 한 곳이 어긋난다.
 */

/**
 * 팔레트 원본. 역할 이름 아래에서만 쓰고 화면이 직접 집지 않는다.
 *
 * 값은 `design_handoff_weddingpick/웨딩픽 컴포넌트 시트.dc.html`(SEED 기반,
 * Primary만 코랄로 치환)에서 직접 읽었다 — README.md의 색 표는 몇 곳에서 실제
 * 컴포넌트 시트와 어긋나 있어(예: Primary press·Warning·Danger) 시트 쪽을 썼다.
 * 키 이름은 예전 grey 스케일을 그대로 두고 값만 갈아 끼운다 — 이름을 바꾸는
 * 것은 개편이 아니라 이사다.
 */
const palette = {
  /** Primary. Pick·핵심 CTA·활성/선택에만 제한적으로 쓴다. */
  coral500: '#ff6f61',
  /** Primary press. */
  coral600: '#e2564a',
  /** weak coral — 컴포넌트 시트가 값을 안 주어 통합정책 v3.1 §5를 그대로 쓴다. */
  coral50: '#fff0ee',
  /** Ink. */
  grey900: '#212124',
  /** Ink 2. */
  grey800: '#393a40',
  grey700: '#4e5968',
  /** Secondary. */
  grey600: '#4d5159',
  /** Tertiary. */
  grey500: '#868b94',
  /** Disabled. */
  grey400: '#adb1ba',
  /** Divider — 행 구분선. */
  grey300: '#eaebee',
  /** Border — 컨트롤 테두리. */
  grey200: '#dcdee3',
  /** Band — 섹션 구분 밴드·칩 배경. */
  grey100: '#f2f3f6',
  /** Recessed — 카드 배경. */
  grey50: '#f7f8fa',
  white: '#ffffff',
  /** Danger. */
  red500: '#e03131',
  /** Success. */
  green: '#1aa174',
  /** Success 배경. */
  greenBg: '#e8faf6',
  tealBar: '#00c2b3',
  tealText: '#00a99d',
  violetBar: '#8b5cf6',
  violetText: '#7c3aed',
  /** Warning. */
  orange: '#b57a00',
  /** Warning 배경. */
  orangeBg: '#fff5e0',
  /** 행 구분선(Divider)과 같은 값. */
  line: '#eaebee',
  /** 바텀시트 배경 스크림. */
  scrim: 'rgba(0,0,0,.45)',
} as const;

/**
 * 화면이 쓰는 색 역할.
 *
 * **막대 색과 텍스트 색을 나눈다.** 핸드오프가 명시한 규칙이다 — 8px 막대에 쓰는
 * 옅은 색을 15px 텍스트에 그대로 쓰면 대비가 부족하다.
 */
export const Colors = {
  light: {
    text: palette.grey900,
    textStrong: palette.grey800,
    textSecondary: palette.grey600,
    textAssistive: palette.grey500,
    textDisabled: palette.grey400,

    background: palette.white,
    /** 그룹 블록 배경. 핸드오프의 grey50. */
    backgroundElement: palette.grey50,
    /** 섹션 밴드·아이콘 배경·입력 필드. 핸드오프의 grey100. */
    backgroundSelected: palette.grey100,
    /** 잉크 블록 — 강조해서 보여주는 어두운 면. */
    backgroundInk: palette.grey900,

    border: palette.grey200,
    /** 1px 구분선. grey200보다 옅다. */
    line: palette.line,
    /** 트랙·미달성 체크. */
    track: palette.grey300,

    tint: palette.coral500,
    tintStrong: palette.coral600,
    /** 배지·안내 배너·아바타의 옅은 코랄. 정책 v3.1의 Coral Weak. */
    tintSubtle: palette.coral50,
    tintInactive: palette.grey400,

    positive: palette.green,
    positiveBackground: palette.greenBg,
    cautionary: palette.orange,
    cautionaryBackground: palette.orangeBg,
    negative: palette.red500,

    /** 지출 차트 — 막대와 텍스트를 나눠 쓴다. */
    chartTeal: palette.tealBar,
    chartTealText: palette.tealText,
    chartViolet: palette.violetBar,
    chartVioletText: palette.violetText,
    chartMuted: palette.grey300,
    chartMutedText: palette.grey600,

    /** 모달·바텀시트 뒤를 덮는 색. */
    scrim: palette.scrim,
    onTint: palette.white,
  },

  /*
   * 어두운 모드.
   *
   * **핸드오프는 이 값을 정하지 않았다.** "배경은 항상 흰색"이라고만 적혀 있다.
   * 아래는 우리가 만든 값이고, 받아 적은 값이 아니다 — 핸드오프가 어두운 모드를
   * 정해 주면 그대로 갈아끼운다.
   *
   * 지우지 않는 이유는 useColorScheme이 이미 두 벌을 기대하고 있어서다. 한 벌만
   * 두면 시스템이 어두운 모드일 때 흰 배경에 흰 글씨가 난다.
   */
  dark: {
    text: '#f2f4f6',
    textStrong: '#e5e8eb',
    textSecondary: '#b0b8c1',
    textAssistive: '#8b95a1',
    textDisabled: '#6b7684',

    background: '#141618',
    backgroundElement: '#1e2124',
    backgroundSelected: '#2a2e33',
    backgroundInk: '#0b0d0f',

    border: '#2a2e33',
    line: 'rgba(255,255,255,.12)',
    track: '#3a3f45',

    tint: '#ff8478',
    tintStrong: '#ffa79e',
    tintSubtle: '#3a2320',
    tintInactive: '#6b7684',

    positive: '#3ecf8e',
    positiveBackground: '#12281d',
    cautionary: '#e0a340',
    cautionaryBackground: '#2b2113',
    negative: '#ff6b78',

    chartTeal: palette.tealBar,
    chartTealText: '#4fd8cd',
    chartViolet: palette.violetBar,
    chartVioletText: '#a98bf5',
    chartMuted: '#3a3f45',
    chartMutedText: '#b0b8c1',

    scrim: 'rgba(0,0,0,.72)',
    onTint: '#ffffff',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * 글꼴.
 *
 * 핸드오프의 첫 글꼴은 `'Toss Product Sans'`인데 그 파일이 우리에게 없다. 없는 것을
 * 적으면 조용히 다음 후보로 떨어지고 왜 다르게 보이는지 아무도 모른다.
 *
 * 대신 이미 싣고 있는 Pretendard를 앞에 두고 뒤는 핸드오프 순서를 그대로 따른다 —
 * 시스템 글꼴까지 내려가면 한글이 눈에 띄게 나빠진다. **핸드오프에서 벗어난 유일한
 * 값이고, 벗어난 이유가 이것이다.**
 */
const SANS_STACK =
  "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: { sans: SANS_STACK, serif: 'serif', rounded: SANS_STACK, mono: 'ui-monospace, monospace' },
});

/**
 * 간격. 핸드오프가 정한 값들에서 뽑았다.
 *
 * 화면 좌우 거터 24, 섹션 밴드 16, 목록 행 최소 높이 56, 터치 타깃 최소 44.
 */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** 핸드오프가 이름 붙인 치수. 화면이 숫자를 직접 적지 않게 한다. */
export const Layout = {
  /** 화면 좌우 거터. 바텀시트 내부도 같다. */
  gutter: 24,
  /** 섹션을 가르는 grey100 밴드 높이. */
  sectionBand: 16,
  /** 목록 행 최소 높이. */
  rowMinHeight: 56,
  /** 터치 타깃 최소 크기. */
  touchTarget: 44,
  statusBar: 44,
  navBar: 56,
  /** SEED 핸드오프: 72 + Safe Area. */
  tabBar: 72,
} as const;

/**
 * 모서리 둥글기. SEED 핸드오프(컴포넌트 시트): 버튼·입력필드·작은 썸네일·배지 컨테이너
 * 6, 카드·이미지·알림박스 10, Pick 카드 14, 바텀시트 상단 20, 칩·아바타·원형버튼 999.
 *
 * 이름은 예전(v7 Toss 핸드오프) 스케일을 그대로 두고 값만 SEED로 바꿨다.
 */
export const Radius = {
  small: 6,
  input: 6,
  medium: 10,
  card: 14,
  sheet: 20,
  pill: 999,
} as const;

/**
 * 움직임. 핸드오프가 정한 값.
 *
 * **반복 애니메이션은 없다.** 축하 연출도 한 번만 재생한다.
 */
export const Motion = {
  enter: { duration: 350, easing: 'cubic-bezier(.16,1,.3,1)' },
  bounce: { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' },
  press: { duration: 100 },
  color: { duration: 175 },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
