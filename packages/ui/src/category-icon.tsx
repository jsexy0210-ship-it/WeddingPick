import Svg, { Path } from 'react-native-svg';

import { useTheme } from './use-theme';

/**
 * WP-ST-016 — 업종 아이콘 8종. 24 viewBox · stroke 1.7 · round cap · path 2개.
 *
 * 순회 로딩(WP-ST-015)과 업종 칩·검색 업종에 **같은 글리프**를 쓴다. 다른 아이콘
 * 라이브러리로 대체하지 않는다. path는 핸드오프 `30-loading.dc.html`의 값
 * 그대로다 — 손대지 않는다.
 */
export type CategoryIconKind =
  | 'agency'
  | 'hall'
  | 'studio'
  | 'dress'
  | 'makeup'
  | 'snap'
  | 'ring'
  | 'honeymoon';

export const CATEGORY_ICON_LABEL: Record<CategoryIconKind, string> = {
  agency: '결정사',
  hall: '웨딩홀',
  studio: '스튜디오',
  dress: '드레스',
  makeup: '메이크업',
  snap: '본식스냅',
  ring: '예물',
  honeymoon: '허니문',
};

const GLYPH: Record<CategoryIconKind, [string, string]> = {
  agency: [
    'M8.6 11.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z',
    'M2.6 20.4v-.9a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v.9M16.4 5.5a3.4 3.4 0 0 1 0 6M17.8 14.8a5 5 0 0 1 3.6 4.8v.8',
  ],
  hall: ['M4 20.5V9.8L12 4l8 5.8v10.7', 'M9.4 20.5v-6.1h5.2v6.1M2.4 20.5h19.2'],
  studio: [
    'M4.5 8.4h2.7l1.4-2.3h6.8l1.4 2.3h2.7a1.6 1.6 0 0 1 1.6 1.6v7.6a1.6 1.6 0 0 1-1.6 1.6H4.5A1.6 1.6 0 0 1 2.9 17.6V10a1.6 1.6 0 0 1 1.6-1.6z',
    'M12 16.9a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z',
  ],
  dress: [
    'M9.6 3.5h4.8l-1.1 3.6 4.8 9.4a2 2 0 0 1-1.2 2.8 14 14 0 0 1-9.8 0 2 2 0 0 1-1.2-2.8l4.8-9.4z',
    'M10.7 7.1h2.6',
  ],
  makeup: ['M9.3 3.6h5.4l-.9 4.2H10.2z', 'M10.2 7.8h3.6v11a1.8 1.8 0 0 1-1.8 1.8 1.8 1.8 0 0 1-1.8-1.8z'],
  snap: [
    'M6.4 4.4h11.2a2 2 0 0 1 2 2v11.2a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2V6.4a2 2 0 0 1 2-2z',
    'm5.4 16.4 4.2-4.2 3.2 3.2 2.8-2.8 3.8 3.8M9.2 9.4a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z',
  ],
  ring: ['M12 20.4a6.2 6.2 0 1 0 0-12.4 6.2 6.2 0 0 0 0 12.4z', 'M9.4 8.6 12 3.6l2.6 5'],
  honeymoon: ['M20.4 12.6a8.4 8.4 0 0 1-16.8 0', 'M12 3.4v9.2M3.6 12.6h16.8M7.4 7.2 12 12.6l4.6-5.4'],
};

/** 순회 로딩 순서. 준비 순서와 같다 — 임의로 섞지 않는다. */
export const CATEGORY_CYCLE: readonly CategoryIconKind[] = ['agency', 'hall', 'studio', 'dress', 'makeup'];

export function CategoryIcon({
  kind,
  size = 24,
  color,
}: {
  kind: CategoryIconKind;
  size?: number;
  /** 기본 #4D5159(textSecondary) · 활성 coral. */
  color?: string;
}) {
  const theme = useTheme();
  const [d1, d2] = GLYPH[kind];
  const stroke = color ?? theme.textSecondary;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityLabel={CATEGORY_ICON_LABEL[kind]}>
      <Path d={d1} stroke={stroke} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d2} stroke={stroke} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
