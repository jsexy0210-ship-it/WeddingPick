/**
 * 웨딩픽 UI.
 *
 * 앱 화면이 조립에 쓰는 부품과 디자인 토큰. 여기 있는 것은 모두 표시에만 관여한다 —
 * 등급의 의미나 가격 규칙 같은 판단은 @weddingpick/domain에 있고, 이 패키지는 그것을
 * 어떻게 보여줄지만 안다.
 *
 * 앱(React Native)은 `src`를 그대로 쓰고, 웹 도구는 react-native-web으로 빌드한
 * `dist`를 쓴다 — package.json의 조건부 exports가 갈라준다.
 */

export { ThemedText, type ThemedTextProps } from './themed-text';
export { ThemedView, type ThemedViewProps } from './themed-view';
export { ActionButton, type ActionButtonProps } from './action-button';
export { FilterChip, type FilterChipProps } from './filter-chip';
export { TextField, type TextFieldProps } from './text-field';
/*
 * `Card`도 내보내지 않는다 — 부르는 화면이 0이다. 검색 · Pick · 홈 · 관리자가 전부
 * 자기 카드를 따로 그린다(관리자는 `app/admin/_ui`). 유일한 사용처였던
 * `vendor-card` · `pick-card`를 위에서 내리면서 완전히 고아가 됐고, **파일도 지웠다**
 * (2026-09-15 · MASTER). 다시 필요하면 지운 커밋에서 꺼내 온다.
 */
export { IconButton, type IconButtonProps } from './icon-button';
export { SectionHeader, type SectionHeaderProps } from './section-header';
export { SearchBar, type SearchBarProps } from './search-bar';
export { SegmentedTabs, type SegmentedTabsProps, type SegmentedTabItem } from './segmented-tabs';
/*
 * `VendorCard` · `PickCard`는 내보내지 않는다 — 2026-09-15 대표 지시 「안 쓰는 건 싹다 삭제해」.
 * 둘 다 화면에서 부르는 곳이 0이었고(검색 · Pick · 홈은 각자 피그마대로 다시 짰다),
 * 값이 피그마와 달라서(곡률 10 · 14 · 썸네일 72 정사각 · 사진 위 배치) 다음 사람이
 * 집어 쓰면 그 화면이 어긋난다. **파일도 지웠다**(2026-09-15 · MASTER) —
 * `packages/ui/src/vendor-card.tsx` · `pick-card.tsx`.
 */
export { RatingPicker, type RatingPickerProps } from './rating-picker';
export { RatingStars, type RatingStarsProps } from './rating-stars';
export {
  WeddingMark,
  /* 하트 윤곽만. Pick Mark(하트 + 체크)가 아니라 하트 하나로 그리는 자리가 쓴다 — 검색 결과 카드의 Pick pill. */
  MARK_HEART_PATH,
  /* 마크를 다른 그림 안에 얹는 자리 — 관리자 링크 미리보기의 기본 카드 그림(정본 OG카드.svg). */
  MARK_CHECK_PATH,
  MARK_STROKE,
  MARK_VIEWBOX,
  type WeddingMarkProps,
} from './wedding-mark';
export { ProductSymbol, type ProductSymbolName } from './product-symbol';
export { SeedIcon, type SeedIconName } from './seed-icon';
export { NpayLogo } from './npay-logo';
export { Skeleton, type SkeletonProps } from './skeleton';
export { Toast, TOAST_MS, type ToastProps } from './toast';
export { DonutChart, type DonutChartProps, type DonutSlice } from './donut-chart';
export { Fab, type FabProps } from './fab';
export { Accordion, type AccordionProps, type AccordionItem } from './accordion';
export { ProgressBar, type ProgressBarProps } from './progress-bar';
export { VerificationBadge, type VerificationBadgeProps } from './verification-badge';
export { LoadingView, SkeletonView, RecommendingView, RecommendingBody, recommendingTitle, ErrorView, EmptyView, NetworkErrorView, PermissionDeniedView, ProcessingView, MaintenanceView } from './status-view';
export type { LoadingViewProps, SkeletonViewProps, RecommendingViewProps, RecommendingBodyProps, ErrorViewProps, EmptyViewProps, NetworkErrorViewProps, PermissionDeniedViewProps, PermissionKind, ProcessingViewProps, MaintenanceViewProps } from './status-view';
/**
 * 로더는 원형 하나다(2026-09-15 대표 지시 — 「모든 화면 로딩 발생 시 기본로더로
 * 돌려라. **기존 정책 파기** 기본로더만 사용할것」). 700ms 규칙은 `useDelayedVisible`로
 * 감싼다.
 *
 * **`CategoryCycleLoader`(업종 아이콘 순회)는 지웠다.** 규칙은 폐기였는데 코드가
 * 따라오지 않아 화면 다섯에서 계속 돌고 있었다 — 홈 첫 진입 · 온보딩 완료 · TOP3 ·
 * 분석 중 · 확인 중. 로더가 둘이면 어느 자리가 어느 것인지를 매번 판단해야 하고,
 * 그 판단이 화면마다 갈렸다.
 *
 * 화면이 직접 부르지 않고 `DelayedLoader`를 쓴다.
 */
export { CircleLoader, buildSpinKeyframes, type CircleLoaderProps, type CircleLoaderSize } from './circle-loader';
export { LoaderSkeleton, type LoaderSkeletonProps, type LoaderSkeletonShape, type LoaderSkeletonSize } from './loader-skeleton';
export { useDelayedVisible } from './use-delayed-visible';
export { useReduceMotion } from './use-reduce-motion';
export { CategoryIcon, CATEGORY_CYCLE_ORDER, CATEGORY_ICON_LABEL, type CategoryIconKind } from './category-icon';
export { StepList, type Step, type StepState } from './step-list';
export { ListSkeleton, type ListSkeletonProps } from './list-skeleton';
export { PickStatusBadge, STATUS_BADGE_STYLE, type PickStatusBadgeProps, type PickStatus } from './pick-status-badge';
export { Badge, type BadgeProps, type BadgeKind } from './badge';
export { VendorImage, type VendorImageProps, type VendorCategory } from './vendor-image';
export { DefaultImage, type DefaultImageProps, type DefaultImageCategory } from './default-image';
export { DataTierBadge, getDataTier, type DataTierBadgeProps, type DataTier } from './data-tier-badge';
export { TruncatedText, type TruncatedTextProps } from './truncated-text';
export { SocialLogo } from './social-logo';

export {
  Colors,
  Fonts,
  Spacing,
  AdminSpacing,
  Layout,
  Motion,
  Radius,
  Border,
  Elevation,
  Skins,
  DEFAULT_SKIN,
  pickTintFor,
  BottomTabInset,
  MaxContentWidth,
  USE_NATIVE_DRIVER,
  SocialColors,
  NpayColors,
  ToastColors,
  CanonGray,
  type ThemeColor,
  type SkinId,
} from './theme';
export { FontSize, LetterSpacing, LineHeight, type FontSizeToken } from './typography';
export { useTheme } from './use-theme';
export { PRESS_TRANSITION, readWebInteractionState, type WebInteractionState } from './web-interaction';
export { VERIFICATION_LEVEL_ACCENT } from './verification-levels';
