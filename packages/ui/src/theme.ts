import { Platform } from 'react-native';

/**
 * 디자인 토큰 — SEED(당근 디자인시스템) 기준. **원본은 `spec/tokens.json`이고, 그 파일은
 * `docs/design-handoff/current/tokens.json`을 그대로 옮긴 것이다.** 여기 있는 값은 그 두 파일에
 * 있는 수와 색이어야 한다 — 이 파일이 새 값을 만들지 않는다(2026-09-09 감사에서 어긋난 값을 전부
 * 핸드오프로 맞췄다: primaryPressed · primaryTint · warningSurface · dangerText · dim · divider · inverse).
 *
 * 화면은 이 값을 직접 읽지 않고 useTheme으로 지금 모드에 맞는 쪽을 받는다 —
 * 화면마다 모드를 판단하면 언젠가 한 곳이 어긋난다.
 */

/**
 * 팔레트 원본. 역할 이름 아래에서만 쓰고 화면이 직접 집지 않는다.
 *
 * gray 램프와 의미색은 SEED scale 토큰을 그대로 옮겼다. **키 컬러만 SEED와 다르다** —
 * SEED의 carrot(#ff6f0f)은 당근의 브랜드색이고, 우리 키 컬러는 코랄 `#ff6f61`이다.
 * 코랄 파생색(눌림 · 짙은 · 옅은 · 면 · 테두리)은 핸드오프 tokens.json `color.brand` 값이다.
 */
const palette = {
  /* 키 컬러 — spec/tokens.json color.brand. */
  coral500: '#ff6f61',
  /** primaryPressed — Primary 버튼 눌림. */
  coralPressed: '#ee6255',
  /** `coralPressed`의 옛 이름 — 웹(site-styles `--tint-strong`)이 이 이름으로 값을 맞춘다. 같은 값. */
  coral600: '#ee6255',
  /** primaryDark — 옅은 코랄 배경 위 텍스트(대비 확보). */
  coralDark: '#c2453a',
  /** primaryTint — 옅은 코랄 배지 · 아바타. color-mix(pick 12%, #fff)의 고정값. */
  coralTint: '#ffe8e4',
  /** primarySurface — 코랄 카드 · Pick 완료 버튼 배경. color-mix(pick 7%, #fff)의 고정값. */
  coralSurface: '#fff5f2',
  /** primaryBorder — 코랄 카드 테두리. */
  coralBorder: '#ffd9d4',

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
  /** surface.inverse — 토스트 · 어두운 안내 블록. */
  inverse: '#0e0f10',

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

  /* 의미색 — spec/tokens.json color.status. 스킨과 무관하게 고정. */
  successText: '#1aa174',
  successSurface: '#e8faf6',
  /** 옛 이름(SEED green-500 · green-50) — 웹 파리티 검사가 이 이름을 본다. 같은 값. */
  green500: '#1aa174',
  green50: '#e8faf6',
  warningText: '#805217',
  warningSurface: '#ffe3ba',
  dangerText: '#e81607',
  dangerSurface: '#ffe5e3',
  /* 안내 상자 — 배지 칠(Surface)보다 옅은 바탕과 그 테두리. 20-admin.dc.html의
     «자동 승인» · «보류 · 사람 확인» · «자동 반려» 상자가 bg와 border를 따로 쓴다. */
  successBorder: '#96ebc3',
  warningBox: '#fff7e6',
  warningBorder: '#facc87',
  dangerBox: '#fff3f2',
  dangerBorder: '#fcd2cf',
  /*
   * 「돈을 쓰는 것」 배지. spec/tokens.json color.status.costFg — 21-admin.dc.html
   * `dashCards`의 «비용» 모드가 modeFg #e0404e · modeBg #fff1f2다.
   *
   * **반려·오류의 dangerText(#e81607)와 다르다.** 비용 카드는 잘못된 상태가
   * 아니라 지출을 말한다 — 같은 빨강으로 칠하면 매달 정상으로 나가는 돈이
   * 고장으로 보인다.
   */
  costText: '#e0404e',
  costSurface: '#fff1f2',
  /**
   * 관리자 콘솔의 어두운 면 — 사이드바 · 로그인 오른쪽 판.
   *
   * **본문 먹색(gray900 #212124)과 다르다.** 한때 사이드바가 gray900으로 바뀐 적이
   * 있는데, 하드코딩을 없애려다 아무 토큰이나 갖다 쓴 것이었다. 시안(21-admin ·
   * 22-admin-ops)이 쓰는 값은 이것이다.
   */
  adminChrome: '#17181c',
  /** 탈퇴 · 신고 · 빼기 같은 파괴적 행동 버튼. */
  dangerAction: '#ff4133',
  accentText: '#0077b2',
  accentAction: '#0088cc',
  accentSurface: '#ebf7fa',
  /** 어두운 모드 danger — SEED red-400. */
  red400: '#ff7466',

  /* 관리자 콘솔 크롬 — spec/tokens.json color.admin(v3.27 · 22-admin-ops). 사용자 앱에는 쓰지 않는다. */
  adminSidebarLine: '#26272c',
  adminSidebarLabel: '#9ca3ad',
  adminSidebarGroup: '#5f6570',
  adminBannerWarn: '#fff6e6',
  adminBannerOkIcon: '#c9f2e8',
  adminBannerBadIcon: '#ffd0cb',
  adminDotWarn: '#e5a12c',
  adminBarFill: '#ffc9c2',

  /* 달력 — spec/tokens.json color.calendar(WP-APP-023 · 20-onboarding-v2). 일요일 · 토요일 · 다른 달. */
  calendarSunday: '#e8735f',
  calendarSaturday: '#5b8def',

  /* 차트 계열 — spec/tokens.json color.chart. 코랄 계열 셋 + 나머지 회색. 스킨과 무관하게 고정. */
  chartSeries1: '#ff6f61',
  chartSeries2: '#ffb3ab',
  chartSeries3: '#ffd6d1',
  chartSeriesRest: '#eaebee',

  /*
   * 지출 차트의 옛 계열색. **핸드오프에 없는 값이다** — 차트는 chartSeries1~3 · chartSeriesRest로
   * 옮긴다. 아직 쓰는 화면이 있어 지우지 않았다(`Colors.*.chartTeal` 참고).
   */
  tealBar: '#00c2b3',
  tealText: '#00a99d',
  violetBar: '#8b5cf6',
  violetText: '#7c3aed',

  /** 어두운 모드 구분선 — SEED gray-alpha. */
  darkLineAlpha: '#ffffff1f',
  /* 오버레이 — spec/tokens.json color.overlay. */
  dim: 'rgba(0,0,0,0.45)',
  scrimLight: 'rgba(0,0,0,0.20)',
  pillOnImage: 'rgba(0,0,0,0.5)',

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
  /** Npay 로고. spec/tokens.json color.social.npayBg · npayInk. 이미지 없이 그린다. */
  npayBg: '#03c75a',
  npayInk: '#1e1e1e',
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
 * Npay 로고 색. 로그인 제공자(`SocialColors`)와 따로 둔다 — Npay는 로그인이 아니라
 * 리워드 수령 수단이고, 제공자 목록에 섞이면 로그인 버튼이 하나 늘어난다.
 * spec/tokens.json color.social.npayBg · npayInk.
 */
export const NpayColors = {
  background: palette.npayBg,
  ink: palette.npayInk,
  text: '#ffffff',
} as const;

/**
 * 스킨 6종 — spec/tokens.json `color.skin`. 사용자가 MY · 화면 설정에서 고른다.
 * CTA · Pick · 선택 상태에만 적용되고, 의미색(status) · 앱 아이콘 · 스플래시 · 차트 계열색은
 * 스킨과 무관하게 고정이다.
 */
export const Skins = {
  coral: '#ff6f61',
  red: '#ff4d4d',
  yellow: '#ffc041',
  green: '#34c759',
  blue: '#3182f6',
  darkGray: '#191f28',
} as const;

export type SkinId = keyof typeof Skins;

export const DEFAULT_SKIN: SkinId = 'coral';

/**
 * Pick 계열이 쓰는 색. **Dark Gray를 고르면 Pick 버튼만 코랄을 유지한다** — 회색 CTA는
 * 비활성으로 읽히기 때문이다(spec/tokens.json color.skin.$pickException).
 */
export function pickTintFor(skin: SkinId): string {
  return skin === 'darkGray' ? Skins.coral : Skins[skin];
}

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
    /** 그룹 블록 배경. SEED gray-50 — surface.recessed. */
    backgroundElement: palette.gray50,
    /** 섹션 밴드·칩 배경·Secondary 버튼. SEED gray-100 — surface.band. */
    backgroundSelected: palette.gray100,
    /** 이미지 로딩 전 · 뼈대 바. SEED gray-200 — surface.imagePlaceholder. */
    imagePlaceholder: palette.gray200,
    /** 반전 면 — 토스트 · 어두운 안내 블록. surface.inverse. */
    backgroundInk: palette.inverse,

    /**
     * 구분선 · 카드 안쪽 선. SEED gray-200 — line.divider.
     * 컨트롤 테두리(카드 외곽 · Secondary 버튼)는 `track`(gray-300 · line.border)이다.
     */
    border: palette.gray200,
    /** 1px 구분선. line.divider와 같은 값 — 옛 gray-alpha 값은 핸드오프에 없어 버렸다. */
    line: palette.gray200,
    /** 컨트롤 테두리 · 카드 외곽 · 트랙. SEED gray-300 — line.border. */
    track: palette.gray300,
    /** 입력 필드 기본 테두리. line.fieldBorder. */
    fieldBorder: palette.gray400,
    /** 입력 필드 포커스 테두리. line.fieldBorderFocus. */
    fieldBorderFocus: palette.gray900,

    tint: palette.coral500,
    /** Primary 버튼 눌림. brand.primaryPressed. */
    tintPressed: palette.coralPressed,
    /** 옅은 코랄 배경 위 텍스트. brand.primaryDark. */
    tintDark: palette.coralDark,
    /** @deprecated primaryDark의 옛 이름. `tintDark`를 쓴다. */
    tintStrong: palette.coralDark,
    /** 옅은 코랄 배지·아바타. brand.primaryTint(#FFE8E4). */
    tintSubtle: palette.coralTint,
    /** 코랄 카드 · Pick 완료 버튼 배경. brand.primarySurface. */
    tintSurface: palette.coralSurface,
    /** 코랄 카드 테두리. brand.primaryBorder. */
    tintBorder: palette.coralBorder,
    tintInactive: palette.gray500,

    positive: palette.successText,
    positiveBackground: palette.successSurface,
    cautionary: palette.warningText,
    cautionaryBackground: palette.warningSurface,
    negative: palette.dangerText,
    negativeBackground: palette.dangerSurface,

    /**
     * 안내 상자용 — `...Background`는 배지 칠이고 이쪽이 더 옅은 상자 바탕이다.
     * 시안이 둘을 구분해 쓴다(예: 반려는 배지 #ffe5e3, 상자 #fff3f2). 상자에
     * 배지 칠을 쓰면 목록 안에서 필요 이상으로 튄다. status.boxBg · status.border.
     */
    positiveBorder: palette.successBorder,
    cautionaryBoxBackground: palette.warningBox,
    cautionaryBorder: palette.warningBorder,
    negativeBoxBackground: palette.dangerBox,
    negativeBorder: palette.dangerBorder,
    /**
     * 「돈을 쓰는 것」 — 관리자 요약 대시보드의 비용 카드 배지. color.status.costFg.
     * 반려(`negative`)와 나누어 둔다 — 지출은 고장이 아니다.
     */
    cost: palette.costText,
    costBackground: palette.costSurface,
    /** 관리자 콘솔의 어두운 면(사이드바 · 로그인 오른쪽 판). color.status.adminChrome. */
    adminChrome: palette.adminChrome,
    /** 파괴적 행동 버튼(탈퇴 · 신고 · 빼기). status.dangerAction. */
    negativeAction: palette.dangerAction,
    /** 관리자 차트 · 정보 배지. status.accentAction · accentText · accentSurface. */
    accent: palette.accentAction,
    accentText: palette.accentText,
    accentBackground: palette.accentSurface,

    /** 관리자 콘솔 크롬 — color.admin. 웹 전용 `/admin` 라우트만 쓴다. */
    adminSidebarLine: palette.adminSidebarLine,
    adminSidebarLabel: palette.adminSidebarLabel,
    adminSidebarGroup: palette.adminSidebarGroup,
    adminBannerWarn: palette.adminBannerWarn,
    adminBannerOkIcon: palette.adminBannerOkIcon,
    adminBannerBadIcon: palette.adminBannerBadIcon,
    adminDotWarn: palette.adminDotWarn,
    adminBarFill: palette.adminBarFill,

    /** 달력 날짜 색 — 일요일 · 토요일 · 다른 달(gray-300). color.calendar. */
    calendarSunday: palette.calendarSunday,
    calendarSaturday: palette.calendarSaturday,
    calendarMuted: palette.gray300,

    /** 차트 계열 — spec/tokens.json color.chart. 코랄 셋 + 나머지 회색. */
    chartSeries1: palette.chartSeries1,
    chartSeries2: palette.chartSeries2,
    chartSeries3: palette.chartSeries3,
    chartSeriesRest: palette.chartSeriesRest,
    /** @deprecated 핸드오프에 없는 계열색. chartSeries1~3으로 옮긴다. */
    chartTeal: palette.tealBar,
    /** @deprecated */
    chartTealText: palette.tealText,
    /** @deprecated */
    chartViolet: palette.violetBar,
    /** @deprecated */
    chartVioletText: palette.violetText,
    chartMuted: palette.gray300,
    chartMutedText: palette.gray700,

    /** 바텀시트 · 모달 뒤 딤. overlay.dim rgba(0,0,0,.45). */
    scrim: palette.dim,
    /** 옅은 스크림. overlay.scrim rgba(0,0,0,.20). */
    scrimLight: palette.scrimLight,
    /** 이미지 위 순위 · 광고 pill 배경. overlay.pillOnImage. */
    pillOnImage: palette.pillOnImage,
    onTint: palette.gray00,
    /** 본문 속 링크(약관 · 처리방침). 코랄은 CTA·Pick·선택에만 쓴다(CLAUDE.md §5). */
    link: palette.accentAction,
  },

  /*
   * 어두운 모드.
   *
   * **앱은 항상 라이트다**(use-color-scheme.ts · 2026-09-08 결정). 이 벌은 `useColorScheme`이
   * 두 벌을 기대하는 타입 때문에 남아 있다 — 값은 SEED gray 램프의 어두운 벌이고, 키 컬러와
   * 의미색은 어두운 면에서 읽히도록 올린 값이다. 라이트와 키가 같아야 `ThemeColor`가 성립한다.
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
    imagePlaceholder: palette.darkGray200,
    backgroundInk: '#0b0b0d',

    border: palette.darkGray200,
    line: palette.darkLineAlpha,
    track: palette.darkGray300,
    fieldBorder: palette.darkGray400,
    fieldBorderFocus: palette.darkGray900,

    tint: '#ff8478',
    tintPressed: '#ff9a90',
    tintDark: '#ffa79e',
    tintStrong: '#ffa79e',
    tintSubtle: '#3a2320',
    tintSurface: '#2b1c1a',
    tintBorder: '#4a2c28',
    tintInactive: palette.darkGray500,

    positive: '#3ecf8e',
    positiveBackground: '#12281d',
    positiveBorder: '#1f4a34',
    cautionary: '#e0a340',
    cautionaryBackground: '#2b2113',
    cautionaryBoxBackground: '#1f180e',
    cautionaryBorder: '#4a3a1c',
    negative: palette.red400,
    negativeBackground: '#2e1614',
    negativeBoxBackground: '#211010',
    negativeBorder: '#4d2422',
    /* 관리자 콘솔은 라이트 전용이다. 역할 표를 비워두지 않으려고 어두운 벌만 맞춰 둔다. */
    cost: '#ff8a94',
    costBackground: '#2b1518',
    negativeAction: palette.dangerAction,
    accent: palette.accentAction,
    accentText: '#57c7ff',
    accentBackground: '#0f2430',

    /* 관리자는 웹 전용이고 항상 라이트다 — 같은 값을 둔다(ThemeColor가 두 벌을 요구한다). */
    adminSidebarLine: palette.adminSidebarLine,
    adminSidebarLabel: palette.adminSidebarLabel,
    adminSidebarGroup: palette.adminSidebarGroup,
    adminBannerWarn: palette.adminBannerWarn,
    adminBannerOkIcon: palette.adminBannerOkIcon,
    adminBannerBadIcon: palette.adminBannerBadIcon,
    adminDotWarn: palette.adminDotWarn,
    adminBarFill: palette.adminBarFill,

    calendarSunday: palette.calendarSunday,
    calendarSaturday: palette.calendarSaturday,
    calendarMuted: palette.darkGray300,

    chartSeries1: '#ff8478',
    chartSeries2: palette.chartSeries2,
    chartSeries3: palette.chartSeries3,
    chartSeriesRest: palette.darkGray300,
    chartTeal: palette.tealBar,
    chartTealText: '#4fd8cd',
    chartViolet: palette.violetBar,
    chartVioletText: '#a98bf5',
    chartMuted: palette.darkGray300,
    chartMutedText: palette.darkGray700,

    scrim: 'rgba(0,0,0,.72)',
    scrimLight: 'rgba(0,0,0,.40)',
    pillOnImage: palette.pillOnImage,
    onTint: '#ffffff',
    link: palette.accentAction,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * 글꼴 — **시스템 서체.** spec/tokens.json `typography.$fontFamily` · CLAUDE.md 「폰트는 시스템 서체
 * 유지(Pretendard 미적용)」 · 핸드오프 tokens.json `typography.webfont: null`.
 *
 * SEED는 웹폰트를 배포하지 않고 시스템 서체로 떨어뜨리는 것이 기본이다. 한때 Pretendard를
 * 번들에 실어 앞에 두었는데(라이선스 문제는 없었다), 핸드오프 v3.24까지 「Pretendard 도입 보류」가
 * 유지되어 2026-09-09 감사에서 시스템 서체로 되돌렸다. 네이티브는 fontFamily를 주지 않으면
 * iOS Apple SD Gothic Neo · Android Roboto/Noto Sans KR로 떨어진다 — 핸드오프 `platform.font` 그대로다.
 */
const WEB_SANS_STACK =
  "-apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Segoe UI', Roboto, 'Noto Sans KR', 'Helvetica Neue', Arial, sans-serif";

export const Fonts: { sans: string | undefined; serif: string; rounded: string | undefined; mono: string } =
  Platform.select({
    ios: { sans: undefined, serif: 'ui-serif', rounded: undefined, mono: 'ui-monospace' },
    web: { sans: WEB_SANS_STACK, serif: 'serif', rounded: WEB_SANS_STACK, mono: 'ui-monospace, monospace' },
    default: { sans: undefined, serif: 'serif', rounded: undefined, mono: 'monospace' },
  }) ?? { sans: undefined, serif: 'serif', rounded: undefined, mono: 'monospace' };

/**
 * 간격 — 8배수 사다리. 핸드오프 허용 간격 토큰은 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28이고,
 * 이 사다리에 없는 6 · 10 · 12 · 14 · 20 · 28은 `Layout`이 이름을 붙여 들고 있다
 * (cardGap 10 · inlineGap 12 · sectionHeadGap 14 · listGap 20 · sectionGap 28).
 * `six`(64)는 핸드오프에 없는 값이다 — 새 자리에 쓰지 않는다.
 */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  /** @deprecated 핸드오프 허용 간격이 아니다(최대 28). */
  six: 64,
} as const;

/**
 * 관리자 콘솔 전용 간격 · 크기. spec/tokens.json `spacing`의 `admin*` 항목 그대로다.
 *
 * 앱의 8배수 사다리(`Spacing`)와 따로 두는 이유 — 관리자 시안(v3.27 `22-admin-ops.dc.html`)은
 * 3 · 11 · 13 · 14 · 18처럼 사다리에 없는 값을 쓴다. **가까운 값으로 대신하지 않는다.**
 * 20을 24로 올리면 카드 하나는 표가 나지 않지만, 격자 · 표 · 배너가 다 같이 밀려서
 * 1920 기준으로 맞춰 둔 열 폭이 어긋난다. 화면은 목업과 1:1이다.
 */
export const AdminSpacing = {
  /** 제목과 그 아래 한 줄 사이. */
  stackGap: 3,
  /** 행 상하 패딩 — 메타 줄 없음 · 있음. */
  rowPaddingY: 11,
  rowPaddingYMeta: 13,
  rowMinHeight: 52,
  /** 상단 상태 배너. */
  bannerGap: 12,
  bannerPaddingY: 16,
  bannerPaddingX: 18,
  /** 배지 — 상하는 stackGap(3)과 같은 값이다. */
  badgePaddingX: 9,
  /** 행·카드 안 작은 단추. */
  btnPaddingX: 12,
  btnHeight: 30,
  /** 상단바 · 배너 · 확인 카드의 단추 높이. */
  topActionHeight: 36,
  bannerCtaHeight: 32,
  confirmCtaHeight: 44,
  /** 토글 · 원형 표식. */
  toggleWidth: 44,
  toggleHeight: 26,
  bannerIcon: 28,
  emptyMark: 44,
  /** 확인 카드 항목 앞 점 — 본문 bulletDot(6)과 다른 값이다. */
  confirmDot: 5,
  /** 카드 · 격자. */
  cardGap: 14,
  cardPadding: 20,
  gridGap: 20,
  /** 본문 · 상단바. */
  bodyPaddingTop: 24,
  bodyPaddingX: 32,
  topbarHeight: 76,
  /** 표. */
  tableGap: 16,
  theadHeight: 40,
  tbodyHeight: 48,
  /** 빈 상태 · 확인 카드. */
  emptyPaddingY: 36,
  confirmWidth: 520,
  confirmPadding: 24,
  /** 사이드바. */
  navItemHeight: 34,
  sidebarWidth: 240,
} as const;

/**
 * 핸드오프가 이름 붙인 치수. 화면이 숫자를 직접 적지 않게 한다. spec/tokens.json
 * `spacing` · `size` · `tabBar` · `component`.
 *
 * **거터만 SEED와 다르다.** SEED 스펙은 16px인데 확정 정책이 24px이라 24를
 * 지킨다 — 이탈은 이 한 줄뿐이고, 나머지는 SEED 컨트롤 토큰 그대로다.
 */
export const Layout = {
  /** 화면 좌우 거터. 바텀시트 내부도 같다. */
  gutter: 24,
  /**
   * 관리자 콘솔 상단바. size.adminTopBar — 22-admin-ops.dc.html `topbar`의 «flex:0 0 76px».
   * 사이드바 240(admin/_layout.tsx)과 짝이다.
   */
  adminTopBar: 76,
  /** 섹션을 가르는 gray100 밴드 높이. */
  sectionBand: 16,
  /** 섹션과 섹션 사이 · 섹션 하단. spacing.sectionBottom. */
  sectionGap: 28,
  /** 섹션 제목에서 첫 콘텐츠까지. */
  sectionHeadGap: 14,
  /**
   * MY 메뉴 그룹의 제목→목록과 행 사이. spacing.menuGroupGap.
   *
   * 05-root의 `myGroups`가 `padding:0 24px 28px; gap:6px`다. 6은 8배수 사다리에
   * 없는 값이라 화면이 숫자로 적지 않게 여기서 이름을 든다 — 이 파일이 이미
   * 그렇게 하기로 적어 둔 방식이다(cardGap 10 · inlineGap 12 …).
   */
  menuGroupGap: 6,
  /**
   * 촘촘한 섹션의 제목→내용. spacing.sectionGapCompact — **검색 홈(06-search)만** 이 값이다.
   * 그 시안의 섹션 컨테이너가 `gap:12px`이고, 02-design-system(14)과 갈릴 때는 그 화면 시안을
   * 따른다(2026-09-09 패딩 감사). 다른 화면은 `sectionHeadGap` 14 그대로다.
   */
  sectionHeadGapCompact: 12,
  /** 목록 행 최소 높이. component.row.minHeight. */
  rowMinHeight: 56,
  /** 촘촘한 행 최소 높이. size.rowMinHeightCompact. */
  rowMinHeightCompact: 48,
  /** 목록 행 상하 패딩. component.row.paddingY. */
  rowPaddingY: 12,
  /** 메타가 있는 행 상하 패딩. component.row.paddingYWithMeta. */
  rowPaddingYWithMeta: 14,
  /** 행 사이(구분선 포함). spacing.rowGap. */
  rowGap: 2,
  /** 행 안 썸네일과 글 사이 · 뼈대 행 간격. spacing.inlineGap · component.row.gap. */
  inlineGap: 12,
  /** 아이콘과 라벨 사이(단계 점 · 진행바와 숫자). spacing.iconTextGap. */
  iconTextGap: 10,
  /** 카드 내부 패딩. component.card.padding. */
  cardPadding: 20,
  /** 촘촘한 카드의 상하 패딩 — component.card.paddingCompact «18px 20px»(좌우는 cardPadding). */
  cardPaddingCompactY: 18,
  /** 카드 안 요소 사이. spacing.cardGap · component.card.gap. */
  cardGap: 10,
  /** 2열 카드 사이. spacing.gap2col. */
  gap2col: 11,
  /** 2열 카드 행 사이. spacing.grid2RowGap. */
  gap2colRow: 20,
  /** 3열 카드 사이. spacing.gap3col. */
  gap3col: 10,
  /** 칩 사이. spacing.gapChip. */
  chipGap: 8,
  /** 세로 목록의 카드 사이. spacing.listGap. */
  listGap: 20,
  /** 요약 카드 행 상하 패딩. spacing.summaryRowPaddingY. */
  summaryRowPaddingY: 9,
  /** 제목 블록과 2열 격자 사이. spacing.gapHeadlineGrid. */
  gapHeadlineGrid: 20,
  /** 2열 카드 텍스트 블록 고정 높이. component.twoColCard.textBlockHeight. */
  twoColTextBlock: 92,
  /** 터치 타깃 최소 크기. */
  touchTarget: 44,
  statusBar: 44,
  navBar: 56,
  /**
   * 하위 화면 상단 내비의 좌우. component.navBack «padding:0 20px 0 12px» — 시안 18개가 모두 같다.
   * 거터(24)와 다른 이유는 뒤로가기가 40 원형이라 그 안의 아이콘 24가 20 선에 앉기 때문이다.
   * 화면이 24에서 직접 빼 계산하면 버튼 크기가 바뀔 때 한 곳만 어긋난다.
   */
  navPaddingLeft: 12,
  navPaddingRight: 20,
  /** 상단 내비 요소 사이. component.navBack.gap. */
  navGap: 8,
  /** 검색 헤더 높이. size.headerSearch. */
  headerSearch: 60,
  /** 하단 dock 높이(+ safeBottom). size.dock. */
  dock: 92,
  /** 탭 바 높이(+ safeBottom). tabBar.height. */
  tabBar: 72,
  /** 탭 바 위 패딩. tabBar.paddingTop. */
  tabBarPaddingTop: 9,
  /** 탭 항목 최소 높이. tabBar.itemMinHeight. */
  tabItemMinHeight: 52,
  /** 탭 아이콘과 라벨 사이. tabBar.itemGap. */
  tabItemGap: 3,
  /** Pick 탭 점 배지 지름·테두리·위치. tabBar.pickDot. */
  tabPickDot: 7,
  tabPickDotBorder: 1.5,
  tabPickDotOffset: -1,
  /** SEED 컨트롤 높이. 화면당 Primary CTA는 xlarge(52)다. size.cta. */
  controlMedium: 40,
  controlLarge: 48,
  controlXLarge: 52,
  /**
   * Pick CTA 높이. size.ctaPick — 09-core-loop의 «Pick하기 · N곳 비교하기»가 56이다
   * (screens.json WP-VEND-001도 56). 업체 상세·비교의 Pick 자리에만 쓰고,
   * 나머지 Primary CTA는 `controlXLarge` 52 그대로다.
   */
  ctaPick: 56,
  /**
   * 바텀시트 확정 CTA 높이. size.ctaSheet — SPEC 13.7이 «시트 CTA는 width:100% +
   * flex:0 0 56px»라고 적는다. 시트는 세로로 쌓이는 통이라 CTA에 flex를 주면
   * 늘어나므로, 높이를 못박고 폭만 100%로 편다.
   *
   * `controlXLarge` 52와 4 차이라 눈에 안 띄어 보이지만, 시안과 나란히 놓으면
   * 시트 아래가 그만큼 얕아 보인다. 값이 다른 자리는 값이 다르게 적혀 있다.
   */
  ctaSheet: 56,
  /** 카드 안 CTA. size.ctaInCard. */
  ctaInCard: 44,
  /** 입력 필드 높이. size.field — Primary CTA와 같은 52다. */
  field: 52,
  /** 입력 필드 좌우 패딩. component.field.padding. */
  fieldPaddingX: 14,
  /**
   * 날짜 선택 연 · 월 셀렉트의 좌우 패딩. component.datePicker.selectPaddingX —
   * 20-onboarding-v2의 `selBox`가 «padding:0 16px»다. 일반 입력 필드(14)와
   * 값이 다른 자리라 따로 둔다.
   */
  datePickerSelectPaddingX: 16,
  /** 여러 줄 입력 최소 높이. size.textarea. */
  textarea: 88,
  /** 체크박스 한 변. size.checkbox. */
  checkbox: 24,
  /** 토글 스위치. size.toggle. */
  toggleWidth: 52,
  toggleHeight: 32,
  toggleKnob: 26,
  /** 칩 높이 · 좌우 패딩. component.chip. */
  chip: 36,
  chipPaddingX: 14,
  /** 작은 칩(스타일 태그 · 취향 배지). v3.24 «추천 이유 첫 줄 칩 28» · image.textOnImage.tasteCard. */
  chipSmall: 28,
  chipSmallPaddingX: 10,
  /**
   * 배지. component.badge — 항상 한 줄. **22는 최소 높이다.** 핸드오프 배지는 height를
   * 적지 않고 `padding:4px 9px; line-height:19px`로만 그려서 27이 된다(pick-status-badge
   * `STATUS_BADGE_STYLE` 주석). 22를 고정 높이로 쓰면 글자가 상자에 닿는다.
   */
  badgeHeight: 22,
  badgePaddingX: 9,
  /**
   * 관리자 콘솔 배지의 좌우 여백. component.badge.adminPaddingX — 21-admin.dc.html
   * `.ad-bdg`가 «padding:0 7px»다. 앱 배지(9)보다 좁다 — 한 줄에 배지가 여럿 앉는
   * 표에서 9로는 글자 사이가 벌어져 보인다.
   */
  adminBadgePaddingX: 7,
  badgePaddingY: 4,
  /** 정보 단계 배지(WP-ST-005 · 17-sheets tier) — micro 13/18 · padding 3 8. */
  tierBadgePaddingX: 8,
  tierBadgePaddingY: 3,
  /** 탭·내비게이션 아이콘. size.iconTab. */
  iconTab: 24,
  /** 헤더 오른쪽 아이콘 버튼 한 변(40, 원형) · 뒤로가기. size.iconButton · size.backButton. */
  iconButton: 40,
  /** 행 안 아이콘. size.iconRow. */
  iconRow: 20,
  /** 행 끝 chevron 한 변. size.iconInline. */
  iconInline: 18,
  /** 칩 삭제 X 한 변. size.iconChipClose · size.iconSmall. */
  iconChipClose: 14,
  /** 썸네일. size.thumbList · thumbCandidate · thumbGallery. */
  thumbList: 52,
  thumbCandidate: 44,
  thumbGallery: 52,
  /** 아바타. size.avatar. */
  avatarSmall: 22,
  avatarRow: 32,
  avatarProfile: 56,
  avatarLarge: 88,
  /**
   * 제출 완료 히어로의 상하 패딩과 체크 원. component.doneHero — 11-report-review
   * «padding:64px 24px 40px · gap 24 · 원 72»(WP-RPT-007). 64·40은 간격 사다리 밖이라
   * `Spacing`이 아니라 이 이름으로만 든다.
   */
  doneHeroPaddingTop: 64,
  doneHeroPaddingBottom: 40,
  doneHeroRing: 72,
  /** 진행바 트랙 · 누적 막대 높이. component.progressTrack · stackedBar. */
  progressTrack: 6,
  stackedBar: 10,
  /** 처리 단계 점 지름 · 행 높이. spacing.stepDot(WP-ST-012). */
  stepDot: 18,
  stepRow: 30,
  /** 목록 앞 점 지름. spacing.bulletDot — 시안 «width:6px;height:6px;border-radius:999px». */
  bulletDot: 6,
  /** 바텀시트 패널 — padding 12 24 28(+ safeBottom) · 요소 간격 20 · 제목과 본문 사이 6. component.sheet. */
  sheetPaddingTop: 12,
  sheetPaddingBottom: 28,
  sheetGap: 20,
  sheetHeadGap: 6,
  /** 시트 그래버 40×4. component.sheet.grabber. */
  grabberWidth: 40,
  grabberHeight: 4,
  /** 업종 순회 로더 — 아이콘 3크기 · 박스 패딩. size.loader. */
  loaderSmall: 20,
  loaderMedium: 28,
  loaderLarge: 40,
  loaderBoxPadding: 10,
} as const;

/**
 * 모서리 둥글기. spec/tokens.json `radius`: badge 4 · control 6 · card 10 · pick 14 · sheet 20 ·
 * storeIcon 26 · device 40 · full 999.
 *
 * 이름은 예전 스케일을 그대로 두고 값만 핸드오프로 맞췄다. **`card`(14)는 핸드오프의
 * `pickCard`다** — 일반 카드(10)는 `medium`이다. 헷갈리지 않게 `pickCard` · `control` · `badge`를
 * 같은 값의 이름으로 함께 둔다.
 */
export const Radius = {
  /** 배지 · 체크박스 · 뼈대 바. radius.badge. */
  badge: 4,
  /** 버튼 · 입력 필드 · 작은 썸네일. radius.control. */
  control: 6,
  /**
   * 날짜 선택의 연 · 월 펼침 칸과 날짜 칸. radius.picker — 20-onboarding-v2의
   * `optCell` · `dayCell`이 «border-radius:8px»다.
   *
   * **선택한 날짜도 원이 아니라 이 값이다.** SPEC 13.7 본문은 「coral 원」이라
   * 적지만 목업은 사각이고, 목업과 1:1로 맞춘다(2026-09-10 사용자 결정).
   */
  picker: 8,
  small: 6,
  input: 6,
  /** 카드 · 이미지 · 안내 박스. radius.card. */
  medium: 10,
  /** Pick 카드. radius.pick. */
  pickCard: 14,
  /** @deprecated `pickCard`(14)의 옛 이름. 일반 카드(10)는 `medium`이다. */
  card: 14,
  /** 바텀시트 상단. radius.sheet. */
  sheet: 20,
  /** 스토어 아이콘. radius.storeIcon. */
  storeIcon: 26,
  /** 폰 프레임(시안 전용). radius.device. */
  device: 40,
  pill: 999,
} as const;

/**
 * 테두리 두께. spec/tokens.json `border`.
 */
export const Border = {
  hairline: 1,
  selected: 1.5,
  checkbox: 1.5,
  focus: 2,
} as const;

/**
 * 그림자. spec/tokens.json `elevation` — 그림자를 거의 쓰지 않는다. 구분은 inset 선과 배경 톤으로
 * 한다. 떠 있는 카드 하나만 `floatingCard`(0 2px 6px rgba(0,0,0,.16))를 쓴다.
 */
export const Elevation = {
  floatingCard: {
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;

/**
 * 움직임. spec/tokens.json `motion`.
 *
 * **반복 애니메이션은 없다** — 업종 순회 로더와 뼈대만 예외다. 축하 연출도 한 번만 재생한다.
 */
export const Motion = {
  /** @deprecated `sheetEnter`. */
  enter: { duration: 350, easing: 'cubic-bezier(.16,1,.3,1)' },
  /** 혜택 안내 시트(WP-SHT-017) — 홈 최초 진입 후 이만큼 있다가 올라온다. motion.benefitSheetDelay. */
  benefitSheetDelay: { duration: 400 },
  /**
   * 바텀시트. motion.sheetEnter · sheetExit · scrimFade.
   * 패널만 translateY(100%) → 0으로 올라오고, 스크림은 제자리에서 opacity 0 → 1로 깔린다 —
   * 둘을 한 Modal 슬라이드로 묶으면 스크림까지 같이 올라온다(v3.23).
   */
  sheetEnter: { duration: 350, easing: 'cubic-bezier(.16,1,.3,1)', bezier: [0.16, 1, 0.3, 1] },
  sheetExit: { duration: 250, easing: 'ease-in' },
  scrimFade: { duration: 200, easing: 'ease-out' },
  /** 요소 상승 — translateY 10 → 0 · opacity 0 → 1. motion.rise. 세 블록이 이어 올라올 때의 지연이 riseDelays. */
  rise: { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)', from: 10, delays: [150, 260, 380] },
  /** @deprecated 핸드오프에 없는 값. `checkPop`을 쓴다. */
  bounce: { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' },
  /** Pick 버튼 누름 — scale .97 · 100ms. motion.press. */
  press: { duration: 100, scale: 0.97 },
  /** 일반 버튼 누름 — scale .98 · 100ms · 색은 바꾸지 않는다. motion.pressButton. */
  pressButton: { duration: 100, scale: 0.98 },
  /** 선택 상태 배경 채움. motion.selectFill. */
  selectFill: { duration: 150 },
  /** @deprecated `selectFill`. */
  color: { duration: 150 },
  /** 체크 팝. scale 0→1.18→1 — bezier의 Y가 1을 넘어 한 번의 timing으로 튀었다 돌아온다. */
  checkPop: {
    duration: 460,
    easing: 'cubic-bezier(.34,1.56,.64,1)',
    bezier: [0.34, 1.56, 0.64, 1],
    peak: 1.18,
  },
  /** 링 확산 — scale .5 opacity .45 → scale 2.4 opacity 0. motion.ringSpread. */
  ringSpread: { duration: 1000, easing: 'cubic-bezier(.16,1,.3,1)', bezier: [0.16, 1, 0.3, 1] },
  /** Pick 인증 스캔 — 문서 위를 훑는 선. motion.scanSweep. */
  scanSweep: { duration: 1600, easing: 'cubic-bezier(.4,0,.6,1)', bezier: [0.4, 0, 0.6, 1] },
  /*
   * 로딩 — 핸드오프 v3.20. 반복 애니메이션이 허용되는 유일한 자리(업종 순회 로더·뼈대).
   * 원형 스피너는 폐기됐다 — spin·orbit·iconSwap 토큰이 없다.
   */
  /**
   * 업종 순회 로더가 아이콘 하나에 머무는 시간. 작은 로더(20·28) 820 · 전체 화면(40) 620.
   * motion.loaderIconCycle.
   */
  loaderIconCycle: { perIconSmall: 820, perIconFull: 620 },
  /**
   * 응답이 이 시간을 넘으면 화면 성격과 무관하게 로더를 띄운다. 안에 오면 아무것도
   * 띄우지 않는다. motion.loaderThreshold.showAfter — `useDelayedVisible`.
   */
  loaderThreshold: 700,
  /** 뼈대 숨쉬기 한 사이클(1 → .45 → 1). motion.skeletonPulse. */
  skeleton: { duration: 1400, minOpacity: 0.45 },
} as const;

/**
 * @deprecated 하단 inset을 상수로 박은 옛 값. 핸드오프 규칙은 «34 · 18 · 48 같은 숫자를 상수로
 * 박지 않는다 — useSafeAreaInsets()의 값을 쓴다». `Layout.tabBar + insets.bottom`으로 옮긴다.
 */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
