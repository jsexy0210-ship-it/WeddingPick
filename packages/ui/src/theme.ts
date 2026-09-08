import { Platform } from 'react-native';

/**
 * 디자인 토큰 — SEED(당근 디자인시스템) 기준.
 *
 * 이전에는 TDS(토스) 어휘를 받아 적고 있었다. **TDS는 상업적으로 쓸 수 없어서**
 * 핸드오프가 SEED로 갈아탔다(홈 C-1 설계). 바뀐 것은 자산 레이어뿐이고 화면
 * 구조·IA·용어는 그대로다 — 여기가 그 자산 레이어다.
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
 * gray 램프와 의미색은 SEED scale 토큰을 그대로 옮겼다. **키 컬러만 SEED와
 * 다르다** — SEED의 carrot(#ff6f0f)은 당근의 브랜드색이고, 우리 키 컬러는
 * 통합정책 v3.1 §5가 정한 코랄 `#ff6f61`이다.
 *
 * `orange`/`orangeBg`(경고)는 `design_handoff_weddingpick/웨딩픽 컴포넌트
 * 시트.dc.html`에서 직접 읽은 값이다 — gray 램프와 이름 체계가 달라 보여도
 * 같은 SEED 출처다.
 */
const palette = {
  /*
   * 키 컬러. Pick·핵심 CTA·활성/선택에만 제한적으로 쓴다.
   *
   * strong/weak은 정책이 값을 정해주지 않아 우리가 뽑았다. weak은 정책이 적은
   * `#FFF0EE`를 그대로 쓴다.
   */
  coral500: '#ff6f61',
  coral600: '#e2564a',
  coral50: '#fff0ee',

  /* SEED gray 램프 (light). */
  gray900: '#212124',
  gray800: '#393a40',
  gray700: '#4d5159',
  gray600: '#868b94',
  gray500: '#adb1ba',
  gray400: '#d1d3d8',
  gray300: '#dcdee3',
  gray200: '#eaebee',
  gray100: '#f2f3f6',
  gray50: '#f7f8fa',
  gray00: '#ffffff',

  /* SEED gray 램프 (dark). SEED가 어두운 모드 값을 직접 정해준다. */
  darkGray900: '#eaebee',
  darkGray800: '#ced3de',
  darkGray700: '#adb1ba',
  darkGray600: '#868b94',
  darkGray500: '#6d717a',
  darkGray400: '#50545c',
  darkGray300: '#43474f',
  darkGray200: '#34373d',
  darkGray100: '#2b2e33',
  darkGray50: '#212124',
  darkGray00: '#17171a',

  /* SEED 의미색. */
  red600: '#fa2314',
  red400: '#ff7466',
  green500: '#1aa174',
  green50: '#e8faf6',
  yellow700: '#805217',
  yellow50: '#fff7e6',
  /** Warning. 컴포넌트 시트에서 직접 읽었다. */
  orange: '#b57a00',
  orangeBg: '#fff5e0',

  /* 지출 차트. SEED가 정하지 않은 자리라 이전 값을 그대로 쓴다. */
  tealBar: '#00c2b3',
  tealText: '#00a99d',
  violetBar: '#8b5cf6',
  violetText: '#7c3aed',

  /** SEED gray-alpha-50. 1px 구분선. */
  lineAlpha: '#0017580d',
  darkLineAlpha: '#ffffff1f',
  /** SEED static-black-alpha-500. */
  scrim: '#00000080',
  /** spec/tokens.json color.accent — 링크 · 정보 배지. */
  accent: '#0088cc',

  /**
   * 소셜 로그인 버튼 — 제공자 공식 브랜드색. spec/tokens.json `color.social`과
   * 같은 값이다. 테마(라이트/다크)·사용자 스킨과 무관하게 고정이다 — Pick
   * Mark가 스킨과 무관하게 코랄 고정인 것과 같은 이유다.
   */
  kakaoBg: '#fee500',
  /** 카카오 공식 지정값. 앱 잉크(#212124)와 다르다 — spec/tokens.json color.social 참고. */
  kakaoText: '#191919',
  appleBg: '#000000',
  appleText: '#ffffff',
  googleBg: '#ffffff',
  googleText: '#212124',
  naverBg: '#03c75a',
  naverText: '#ffffff',
} as const;

/**
 * 소셜 로그인 버튼 색. 라이트/다크 모드로 나뉘지 않는다 — 위 palette 주석 참고.
 * `apps/mobile/src/features/auth/providers.ts`의 `PROVIDER_TONE`이 이 값을
 * `AuthProvider`별로 매핑해 로그인 화면에 넘긴다.
 */
export const SocialColors = {
  kakao: { background: palette.kakaoBg, text: palette.kakaoText },
  apple: { background: palette.appleBg, text: palette.appleText },
  google: { background: palette.googleBg, text: palette.googleText, border: palette.gray300 },
  naver: { background: palette.naverBg, text: palette.naverText },
} as const;

/**
 * 화면이 쓰는 색 역할.
 *
 * **막대 색과 텍스트 색을 나눈다.** 핸드오프가 명시한 규칙이다 — 8px 막대에 쓰는
 * 옅은 색을 15px 텍스트에 그대로 쓰면 대비가 부족하다.
 */
export const Colors = {
  light: {
    text: palette.gray900,
    textStrong: palette.gray800,
    textSecondary: palette.gray700,
    textAssistive: palette.gray600,
    textDisabled: palette.gray500,

    background: palette.gray00,
    /** 그룹 블록 배경. SEED gray-50. */
    backgroundElement: palette.gray50,
    /** 섹션 밴드·아이콘 배경·입력 필드. SEED gray-100. */
    backgroundSelected: palette.gray100,
    /** 잉크 블록 — 강조해서 보여주는 어두운 면. */
    backgroundInk: palette.gray900,

    border: palette.gray200,
    /** 1px 구분선. border보다 옅다. */
    line: palette.lineAlpha,
    /** 트랙·미달성 체크. */
    track: palette.gray300,
    /** 입력 필드 기본 테두리. spec/tokens.json line.fieldBorder. */
    fieldBorder: palette.gray400,

    tint: palette.coral500,
    tintStrong: palette.coral600,
    /** 배지·안내 배너·아바타의 옅은 코랄. 정책 v3.1의 Coral Weak. */
    tintSubtle: palette.coral50,
    tintInactive: palette.gray500,

    positive: palette.green500,
    positiveBackground: palette.green50,
    cautionary: palette.yellow700,
    cautionaryBackground: palette.yellow50,
    negative: palette.red600,

    /** 지출 차트 — 막대와 텍스트를 나눠 쓴다. */
    chartTeal: palette.tealBar,
    chartTealText: palette.tealText,
    chartViolet: palette.violetBar,
    chartVioletText: palette.violetText,
    chartMuted: palette.gray300,
    chartMutedText: palette.gray700,

    /** 모달·바텀시트 뒤를 덮는 색. */
    scrim: palette.scrim,
    onTint: palette.gray00,
    /** 본문 속 링크(약관 · 처리방침). 코랄은 CTA·Pick·선택에만 쓴다(CLAUDE.md §5). */
    link: palette.accent,
  },

  /*
   * 어두운 모드.
   *
   * **이제 받아 적은 값이다.** 이전에는 핸드오프가 어두운 모드를 정하지 않아
   * 우리가 지어냈지만, SEED는 gray 램프의 어두운 벌을 직접 정해준다 — 그대로
   * 옮겼다. 키 컬러만 SEED carrot이 아니라 우리 코랄을 어두운 면에서 읽히도록
   * 올린 값이고, 이 두 줄만 우리가 정했다.
   *
   * 지우지 않는 이유는 useColorScheme이 이미 두 벌을 기대하고 있어서다. 한 벌만
   * 두면 시스템이 어두운 모드일 때 흰 배경에 흰 글씨가 난다.
   */
  dark: {
    text: palette.darkGray900,
    textStrong: palette.darkGray800,
    textSecondary: palette.darkGray700,
    textAssistive: palette.darkGray600,
    textDisabled: palette.darkGray500,

    background: palette.darkGray00,
    backgroundElement: palette.darkGray50,
    backgroundSelected: palette.darkGray100,
    backgroundInk: '#0b0b0d',

    border: palette.darkGray200,
    line: palette.darkLineAlpha,
    track: palette.darkGray300,
    fieldBorder: palette.darkGray400,

    tint: '#ff8478',
    tintStrong: '#ffa79e',
    tintSubtle: '#3a2320',
    tintInactive: palette.darkGray500,

    positive: '#3ecf8e',
    positiveBackground: '#12281d',
    cautionary: '#e0a340',
    cautionaryBackground: '#2b2113',
    negative: palette.red400,

    chartTeal: palette.tealBar,
    chartTealText: '#4fd8cd',
    chartViolet: palette.violetBar,
    chartVioletText: '#a98bf5',
    chartMuted: palette.darkGray300,
    chartMutedText: palette.darkGray700,

    scrim: 'rgba(0,0,0,.72)',
    onTint: '#ffffff',
    link: palette.accent,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * 글꼴.
 *
 * **SEED는 웹폰트를 아예 배포하지 않는다.** 시스템 서체로 떨어뜨리는 것이 SEED의
 * 기본이고, 그래서 핸드오프도 "시스템 서체 유지"라고 적었다. 그 문장의 이유는
 * 라이선스였다 — TDS의 Toss Product Sans를 쓸 수 없었기 때문이다.
 *
 * 우리는 이미 Pretendard를 번들에 싣고 있고, Pretendard는 상업적으로 쓸 수 있다.
 * 즉 **핸드오프가 피하려던 문제가 여기에는 없다.** 시스템 서체까지 내려가면 한글이
 * 눈에 띄게 나빠지므로 Pretendard를 앞에 두고 뒤는 SEED 순서를 그대로 따른다.
 * **핸드오프에서 벗어난 유일한 값이고, 벗어난 이유가 이것이다.**
 */
const SANS_STACK =
  "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

export const Fonts = Platform.select({
  ios: { sans: 'Pretendard', serif: 'ui-serif', rounded: 'Pretendard', mono: 'ui-monospace' },
  default: { sans: 'Pretendard', serif: 'serif', rounded: 'Pretendard', mono: 'monospace' },
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

/**
 * 핸드오프가 이름 붙인 치수. 화면이 숫자를 직접 적지 않게 한다.
 *
 * **거터만 SEED와 다르다.** SEED 스펙은 16px인데 확정 정책이 24px이라 24를
 * 지킨다 — 이탈은 이 한 줄뿐이고, 나머지는 SEED 컨트롤 토큰 그대로다.
 */
export const Layout = {
  /** 화면 좌우 거터. 바텀시트 내부도 같다. */
  gutter: 24,
  /** 섹션을 가르는 gray100 밴드 높이. */
  sectionBand: 16,
  /** 섹션과 섹션 사이. */
  sectionGap: 28,
  /** 섹션 제목에서 첫 콘텐츠까지. */
  sectionHeadGap: 14,
  /** 목록 행 최소 높이. */
  rowMinHeight: 56,
  /** 목록 행 상하 패딩. spec/tokens.json spacing.rowPaddingY. */
  rowPaddingY: 12,
  /** 카드 내부 패딩. spec/tokens.json spacing.cardPadding. */
  cardPadding: 20,
  /** 2열 카드 사이. spec/tokens.json spacing.gap2col. */
  gap2col: 11,
  /** 요약 카드 행 상하 패딩. spec/tokens.json spacing.summaryRowPaddingY. */
  summaryRowPaddingY: 9,
  /** 제목 블록과 2열 격자 사이. spec/tokens.json spacing.gapHeadlineGrid. */
  gapHeadlineGrid: 20,
  /** 터치 타깃 최소 크기. */
  touchTarget: 44,
  statusBar: 44,
  navBar: 56,
  /** 카드 안 요소 사이. spec/tokens.json spacing.cardGap. */
  cardGap: 10,
  /** 세로 목록의 카드 사이. spec/tokens.json spacing.listGap. */
  listGap: 20,
  /** SEED 핸드오프: 72 + Safe Area. */
  tabBar: 72,
  /** 탭 바 위 패딩. spec/tokens.json tabBar.paddingTop. */
  tabBarPaddingTop: 9,
  /** 탭 항목 최소 높이. spec/tokens.json tabBar.itemMinHeight. */
  tabItemMinHeight: 52,
  /** 탭 아이콘과 라벨 사이. spec/tokens.json tabBar.itemGap. */
  tabItemGap: 3,
  /** Pick 탭 점 배지 지름·테두리·위치. spec/tokens.json tabBar.pickDot. */
  tabPickDot: 7,
  tabPickDotBorder: 1.5,
  tabPickDotOffset: -1,
  /** SEED 컨트롤 높이. 화면당 Primary CTA는 xlarge다. */
  controlMedium: 40,
  controlLarge: 48,
  controlXLarge: 52,
  /** 입력 필드 높이. spec/tokens.json size.field — Primary CTA와 같은 52다. */
  field: 52,
  /** 칩 높이. spec/tokens.json size.chip.min — 시안의 40이 아니라 토큰 36이다. */
  chip: 36,
  /** 탭·내비게이션 아이콘. spec/tokens.json size.iconTab. */
  iconTab: 24,
  /** 헤더 오른쪽 아이콘 버튼 한 변(40, 원형). spec/tokens.json size.iconButton. */
  iconButton: 40,
  /** 행 끝 chevron 한 변. spec/tokens.json size.iconInline. */
  iconInline: 18,
  /** 칩 삭제 X 한 변. spec/tokens.json size.iconChipClose. */
  iconChipClose: 14,
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
  /** 체크 팝. scale 0→1.18→1 — bezier의 Y가 1을 넘어 한 번의 timing으로 튀었다 돌아온다. */
  checkPop: {
    duration: 460,
    easing: 'cubic-bezier(.34,1.56,.64,1)',
    bezier: [0.34, 1.56, 0.64, 1],
  },
  /* 로딩 — 핸드오프 v3.20. 반복 애니메이션이 허용되는 유일한 자리(업종 순회 로더·뼈대).
     원형 스피너는 폐기됐다 — spin·orbit·iconSwap 토큰이 없다. */
  /**
   * 업종 순회 로더가 아이콘 하나에 머무는 시간. 작은 로더(20·28) 820 · 전체 화면(40) 620.
   * spec/tokens.json motion.loaderIconCycle.
   */
  loaderIconCycle: { perIconSmall: 820, perIconFull: 620 },
  /**
   * 응답이 이 시간을 넘으면 화면 성격과 무관하게 로더를 띄운다. 안에 오면 아무것도
   * 띄우지 않는다. spec/tokens.json motion.loaderThreshold.showAfter — `useDelayedVisible`.
   */
  loaderThreshold: 700,
  /** 뼈대 숨쉬기 한 사이클(1 → .45 → 1). */
  skeleton: { duration: 1400 },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
