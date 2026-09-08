import Svg, { Path } from 'react-native-svg';

import { useTheme } from './use-theme';

/**
 * WP-ST-016 — 업종 아이콘 12종. 24 viewBox · path 2개 · stroke 1.8 · round cap/join.
 *
 * 온보딩 진행 상황(3/5)의 12업종과 **1:1**이다 — 온보딩에 없는 업종을 여기 넣지
 * 않는다. 순회 로더(WP-ST-015)와 업종 칩·검색 업종에 같은 글리프를 쓰고, 다른
 * 아이콘 라이브러리로 대체하지 않는다.
 *
 * path는 핸드오프 v3.21 `30-loading.dc.html`의 `ICONS` 값 **그대로**다 — 다시
 * 그리지 않는다. 시안 키와 다른 이름 셋: `invite` → invitation · `home` → dowry.
 */
export type CategoryIconKind =
  | 'agency'
  | 'hall'
  | 'studio'
  | 'dress'
  | 'makeup'
  | 'hair'
  | 'snap'
  | 'bouquet'
  | 'invitation'
  | 'ring'
  | 'dowry'
  | 'honeymoon';

export const CATEGORY_ICON_LABEL: Record<CategoryIconKind, string> = {
  agency: '결정사',
  hall: '웨딩홀',
  studio: '스튜디오',
  dress: '드레스',
  makeup: '메이크업',
  hair: '헤어변형',
  snap: '본식스냅',
  bouquet: '부케',
  invitation: '청첩장',
  ring: '예물',
  dowry: '혼수',
  honeymoon: '허니문',
};

/** 시안 `ICONS` 그대로. 바꾸지 않는다. */
const GLYPH: Record<CategoryIconKind, readonly [string, string]> = {
  agency: [
    'M8.6 9.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM16.4 9.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z',
    'M3.4 19.8v-1.2a4.4 4.4 0 0 1 4.4-4.4h1.6a4.4 4.4 0 0 1 4.4 4.4v1.2M14.8 14.2h1.4a4.4 4.4 0 0 1 4.4 4.4v1.2',
  ],
  hall: ['M4.8 20.4v-9.6L12 5.2l7.2 5.6v9.6', 'M2.8 20.4h18.4M9.4 20.4v-4.4a2.6 2.6 0 0 1 5.2 0v4.4M12 2.6v2.6'],
  studio: [
    'M4.6 8.2h2.6L8.6 5.8h6.8l1.4 2.4h2.6a1.8 1.8 0 0 1 1.8 1.8v7.6a1.8 1.8 0 0 1-1.8 1.8H4.6a1.8 1.8 0 0 1-1.8-1.8V10a1.8 1.8 0 0 1 1.8-1.8z',
    'M12 16.6a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
  ],
  dress: [
    'M10 3.6h4l-.8 3.2 4.6 9.6a1.8 1.8 0 0 1-1 2.5 13.6 13.6 0 0 1-9.6 0 1.8 1.8 0 0 1-1-2.5l4.6-9.6z',
    'M10.8 6.8h2.4',
  ],
  makeup: [
    'M15.4 3.8a2.2 2.2 0 0 1 3.1 3.1l-1.3 1.3-3.1-3.1z',
    'M14.1 5.1 5.2 14a2 2 0 0 0-.5.9l-.9 4.1a.7.7 0 0 0 .9.9l4.1-.9a2 2 0 0 0 .9-.5l8.9-8.9',
  ],
  hair: [
    'M7 6.4a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM7 12.8a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z',
    'm9.2 10.4 10.4-5.8M9.2 13.6l10.4 5.8',
  ],
  snap: [
    'M8.4 3.6h10a1.8 1.8 0 0 1 1.8 1.8v10a1.8 1.8 0 0 1-1.8 1.8h-10a1.8 1.8 0 0 1-1.8-1.8v-10a1.8 1.8 0 0 1 1.8-1.8z',
    'm7 14.4 3.4-3.4 2.4 2.4 2.4-2.4 4.6 4.6M3.4 7v12a1.6 1.6 0 0 0 1.6 1.6h12',
  ],
  bouquet: [
    'M12 7.6a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM7 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM17 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z',
    'M8.4 9.6 12 20.4M15.6 9.6 12 20.4M12 9.8v10.6M9.4 20.6h5.2',
  ],
  invitation: [
    'M4.4 5.8h15.2a1.8 1.8 0 0 1 1.8 1.8v9a1.8 1.8 0 0 1-1.8 1.8H4.4a1.8 1.8 0 0 1-1.8-1.8v-9a1.8 1.8 0 0 1 1.8-1.8z',
    'm2.9 6.8 9.1 6.2 9.1-6.2',
  ],
  ring: ['M12 20.6a5.6 5.6 0 1 0 0-11.2 5.6 5.6 0 0 0 0 11.2z', 'm9.6 6.4 2.4-2.8 2.4 2.8-2.4 3z'],
  dowry: [
    'M5 11V8.6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V11',
    'M3 12.8a1.8 1.8 0 0 1 3.6 0V16h10.8v-3.2a1.8 1.8 0 0 1 3.6 0V19H3z',
  ],
  honeymoon: [
    'M12 3.6c1.1 0 2 1.5 2 3.4v2.4l6.4 3.8v2.2L14 13.6v3.6l2.4 1.6v1.6L12 19.4l-4.4 1v-1.6L10 17.2v-3.6l-6.4 2.2v-2.2L10 9.4V7c0-1.9.9-3.4 2-3.4z',
    'M12 6.8v2.4',
  ],
};

/** 시안 stroke. 순회 로더와 칩이 같은 값을 쓴다. */
const STROKE_WIDTH = 1.8;

/**
 * 순회 로더 순서 — 온보딩 진행 상황의 12업종 순서 그대로. **임의로 섞지 않는다.**
 * 실제 순회 대상은 여기서 온보딩 «결정 완료» 업종을 뺀 것이다(`CategoryCycleLoader`
 * `exclude`).
 */
export const CATEGORY_CYCLE_ORDER: readonly CategoryIconKind[] = [
  'agency',
  'hall',
  'studio',
  'dress',
  'makeup',
  'hair',
  'snap',
  'bouquet',
  'invitation',
  'ring',
  'dowry',
  'honeymoon',
];

export function CategoryIcon({
  kind,
  size = 24,
  color,
}: {
  kind: CategoryIconKind;
  size?: number;
  /** WP-ST-016 상태 — 기본 #4D5159(textSecondary) · 활성 coral. 로더는 coral을 넘긴다. */
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
      <Path d={d1} stroke={stroke} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d2} stroke={stroke} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
