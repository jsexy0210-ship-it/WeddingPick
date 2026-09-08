import type { StyleProp, ViewStyle } from 'react-native';

import { CategoryCycleLoader, type CategoryCycleLoaderSize } from './category-cycle-loader';

/**
 * @deprecated v3.20에서 원형 스피너가 폐기됐다. `CategoryCycleLoader`를 직접 쓴다.
 *
 * 예전 3크기(24 · 32 · 40)를 새 3크기(20 · 28 · 40)로 옮겨 그린다. 앱 화면이 모두
 * 갈아탈 때까지만 남겨 두는 별칭이고, 새 화면에서 쓰지 않는다.
 */
export type SpinnerSize = 24 | 32 | 40;

const SIZE_MAP: Record<SpinnerSize, CategoryCycleLoaderSize> = { 24: 20, 32: 28, 40: 40 };

/** @deprecated `CategoryCycleLoader`를 쓴다. */
export function Spinner({ size = 40, style }: { size?: SpinnerSize; style?: StyleProp<ViewStyle> }) {
  return <CategoryCycleLoader size={SIZE_MAP[size]} style={style} />;
}
