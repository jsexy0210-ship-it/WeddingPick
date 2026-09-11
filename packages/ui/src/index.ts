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
export { RatingPicker, type RatingPickerProps } from './rating-picker';
export { RatingStars, type RatingStarsProps } from './rating-stars';
export { WeddingCalendar, type WeddingCalendarProps } from './wedding-calendar';
export { WeddingMark, type WeddingMarkProps } from './wedding-mark';
export { ProductSymbol, type ProductSymbolName } from './product-symbol';
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
 * 로더 둘. 700ms 규칙은 둘 다 `useDelayedVisible`로 감싼다.
 *
 * `CircleLoader`   Depth·페이지 이동처럼 **스쳐 지나가는** 기다림 — 기본값
 * `CategoryCycleLoader`  첫 실행·재시작·추천 계산처럼 **오래 붙잡는** 기다림
 *
 * 어느 쪽인지 고르는 규칙은 `apps/mobile/src/features/loading/delayed-loader.tsx`의
 * `LoaderWait`에 적혀 있다. 화면이 직접 이 둘을 부르지 않고 `DelayedLoader`를 쓴다.
 */
export { CircleLoader, buildSpinKeyframes, type CircleLoaderProps, type CircleLoaderSize } from './circle-loader';
export {
  CategoryCycleLoader,
  resolveCategoryCycle,
  categoryCyclePerIconMs,
  type CategoryCycleLoaderProps,
  type CategoryCycleLoaderSize,
} from './category-cycle-loader';
export { useDelayedVisible } from './use-delayed-visible';
export { CategoryIcon, CATEGORY_CYCLE_ORDER, CATEGORY_ICON_LABEL, type CategoryIconKind } from './category-icon';
export { StepList, type Step, type StepState } from './step-list';
export { showAlert, type ShowAlertButton } from './show-alert';
export { ListSkeleton, type ListSkeletonProps } from './list-skeleton';
export { PickStatusBadge, STATUS_BADGE_STYLE, type PickStatusBadgeProps, type PickStatus } from './pick-status-badge';
export { Badge, type BadgeProps, type BadgeKind } from './badge';
export { VendorImage, type VendorImageProps, type VendorCategory } from './vendor-image';
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
  SocialColors,
  NpayColors,
  type ThemeColor,
  type SkinId,
} from './theme';
export { FontSize, LineHeight, type FontSizeToken } from './typography';
export { useTheme } from './use-theme';
export { readWebInteractionState, type WebInteractionState } from './web-interaction';
export { VERIFICATION_LEVEL_ACCENT } from './verification-levels';
