import { VENDOR_CATEGORY_LABEL, type VendorCategory } from './vendor';

/**
 * 취향. 핸드오프 v3.19 «취향을 다음 미완료 업종 기준으로 개편» · SPEC §13.6.
 *
 * 온보딩 5/5(WP-APP-021)는 **한 번에 한 업종만** 묻는다 — 아홉 업종을 전부 물으면
 * 온보딩이 설문이 된다. 어느 업종을 물을지는 준비 현황(3/5)에서 완료로 체크하지
 * 않은 첫 업종이다(nextTasteCategory). 업종마다 취향 세트가 다르고(TASTE_SETS),
 * 각 6장 · 2×3 격자 · 최소 1장 필수다.
 *
 * 2026-09-08 이전의 취향(white · daylight · flower · classic · minimal · film)은
 * 스튜디오 한 세트였다. 0089가 그 값을 studio_* 키로 옮겼다.
 */

/**
 * 취향을 묻는 업종 — 곧 우선순위다(SPEC §13.6 «취향은 다음 미완료 업종 기준»).
 *
 *   웨딩홀 → 스튜디오 → 드레스 → 메이크업 → 본식스냅 → 예물 → 혼수 → 허니문 → 청첩장
 *
 * 결정사 · 헤어변형 · 부케는 사진으로 고르는 업종이 아니라 빠진다.
 */
export const TASTE_CATEGORIES = [
  'hall',
  'studio',
  'dress',
  'makeup',
  'snap',
  'goods',
  'dowry',
  'honeymoon',
  'invitation',
] as const satisfies readonly VendorCategory[];

export type TasteCategory = (typeof TASTE_CATEGORIES)[number];

/** 같은 배열이다 — 이름을 둘로 부르는 이유는 «순서가 우선순위»라는 뜻을 코드에 남기기 위해서다. */
export const TASTE_PRIORITY: readonly TasteCategory[] = TASTE_CATEGORIES;

export type TasteOption = { key: string; label: string };

/** 한 업종당 사진 수 — 2×3 격자. 세트마다 정확히 이만큼이어야 한다(테스트가 지킨다). */
export const TASTE_SET_SIZE = 6;

/** 최소 1장 — 온보딩에서 유일한 필수 답이다(SPEC §13.6 «미정을 억지로 받지 않습니다»). */
export const TASTE_MIN_PICKS = 1;

/**
 * 업종별 취향 세트. SPEC §13.6의 목록 그대로 — 순서도 문구도 바꾸지 않는다.
 * 키는 `업종_뜻`의 ascii snake_case이고 사진 파일·저장값이 이 키를 쓴다.
 */
export const TASTE_SETS: Record<TasteCategory, readonly TasteOption[]> = {
  hall: [
    { key: 'hall_hotel', label: '호텔' },
    { key: 'hall_chapel', label: '채플' },
    { key: 'hall_outdoor', label: '야외' },
    { key: 'hall_house', label: '하우스웨딩' },
    { key: 'hall_bright', label: '밝은 홀' },
    { key: 'hall_dark', label: '어두운 홀' },
  ],
  studio: [
    { key: 'studio_white', label: '깔끔한 화이트' },
    { key: 'studio_minimal', label: '모던 미니멀' },
    { key: 'studio_film', label: '따뜻한 필름' },
    { key: 'studio_daylight', label: '야외 자연광' },
    { key: 'studio_classic', label: '클래식' },
    { key: 'studio_editorial', label: '화보' },
  ],
  dress: [
    { key: 'dress_silk', label: '실크' },
    { key: 'dress_beads', label: '비즈' },
    { key: 'dress_lace', label: '레이스' },
    { key: 'dress_minimal', label: '미니멀' },
    { key: 'dress_glam', label: '화려한 스타일' },
    { key: 'dress_classic', label: '클래식' },
  ],
  makeup: [
    { key: 'makeup_natural', label: '내추럴' },
    { key: 'makeup_pure', label: '청순' },
    { key: 'makeup_defined', label: '또렷한' },
    { key: 'makeup_radiant', label: '화사한' },
    { key: 'makeup_contour', label: '음영' },
    { key: 'makeup_glow', label: '글로우' },
  ],
  snap: [
    { key: 'snap_bright', label: '밝고 깨끗한' },
    { key: 'snap_film', label: '필름톤' },
    { key: 'snap_documentary', label: '다큐멘터리' },
    { key: 'snap_emotional', label: '감성적인' },
    { key: 'snap_classic', label: '클래식' },
    { key: 'snap_natural', label: '자연스러운' },
  ],
  goods: [
    { key: 'goods_simple', label: '심플' },
    { key: 'goods_classic', label: '클래식' },
    { key: 'goods_glam', label: '화려한' },
    { key: 'goods_modern', label: '모던' },
    { key: 'goods_vintage', label: '빈티지' },
    { key: 'goods_unique', label: '유니크' },
  ],
  dowry: [
    { key: 'dowry_minimal', label: '미니멀' },
    { key: 'dowry_wood', label: '따뜻한 우드' },
    { key: 'dowry_modern', label: '모던' },
    { key: 'dowry_natural', label: '내추럴' },
    { key: 'dowry_hotel', label: '호텔식' },
    { key: 'dowry_color', label: '컬러 포인트' },
  ],
  honeymoon: [
    { key: 'honeymoon_resort', label: '휴양' },
    { key: 'honeymoon_sightseeing', label: '관광' },
    { key: 'honeymoon_nature', label: '자연' },
    { key: 'honeymoon_city', label: '도시' },
    { key: 'honeymoon_activity', label: '액티비티' },
    { key: 'honeymoon_luxury', label: '럭셔리' },
  ],
  invitation: [
    { key: 'invitation_minimal', label: '미니멀' },
    { key: 'invitation_classic', label: '클래식' },
    { key: 'invitation_emotional', label: '감성' },
    { key: 'invitation_illustration', label: '일러스트' },
    { key: 'invitation_photo', label: '사진형' },
    { key: 'invitation_traditional', label: '전통적' },
  ],
};

export function isTasteCategory(category: string): category is TasteCategory {
  return (TASTE_CATEGORIES as readonly string[]).includes(category);
}

/** 이 업종에서 고를 수 있는 키. */
export function tasteKeysFor(category: TasteCategory): readonly string[] {
  return TASTE_SETS[category].map((option) => option.key);
}

/** 이 업종의 세트에 있는 키인가. 다른 업종의 키는 거절한다 — 사진이 없다. */
export function isTasteKey(category: TasteCategory, key: string): boolean {
  return tasteKeysFor(category).includes(key);
}

/** 키의 화면 라벨. 모르는 키는 null — 화면이 빈 배지를 그리지 않게 부르는 쪽이 거른다. */
export function tasteLabel(category: TasteCategory, key: string): string | null {
  return TASTE_SETS[category].find((option) => option.key === key)?.label ?? null;
}

/**
 * 취향을 물을 업종. 준비 현황에서 완료로 체크하지 않은 첫 업종(우선순위 순).
 * 아홉 업종을 전부 준비했으면 null — 그때 온보딩은 5/5를 건너뛴다(SPEC §13.6).
 */
export function nextTasteCategory(prepared: readonly VendorCategory[]): TasteCategory | null {
  return TASTE_PRIORITY.find((category) => !prepared.includes(category)) ?? null;
}

/**
 * 5/5 설명 줄. «아직 정하지 않은 메이크업 취향을 반영할게요» — 업종명이 들어간다.
 */
export function tasteStepDescription(category: TasteCategory): string {
  return `아직 정하지 않은 ${VENDOR_CATEGORY_LABEL[category]} 취향을 반영할게요`;
}

/** 5/5 제목. 업종과 무관하게 하나다(v3.21 «문구 최종»). */
export const TASTE_STEP_TITLE = '남은 준비는 어떤 분위기가 좋으세요?';

/**
 * 답 줄 요약 — «화이트 · 필름 외 1개»(이미지 단위 «개»). v3.21 «첫 항목 외 N»:
 * 1~2개는 그대로, 3개부터 첫 항목 외 N.
 */
export function summarizeTasteKeys(category: TasteCategory, keys: readonly string[]): string {
  const labels = keys.map((key) => tasteLabel(category, key)).filter((label): label is string => label !== null);

  if (labels.length === 0) return '';
  if (labels.length <= 2) return labels.join(' · ');

  return `${labels[0]} 외 ${labels.length - 1}개`;
}

/** 저장된 취향. 행이 없으면 아직 안 고른 것 — category가 null이다. */
export type TasteSelection = {
  category: TasteCategory | null;
  keys: readonly string[];
};

/** 저장된 키 중 그 업종 세트에 없는 것은 버린다. 항목이 바뀌어도 화면이 빈 칸을 그리지 않게. */
export function reconcileTasteSelection(
  category: string | null,
  keys: readonly string[]
): TasteSelection {
  if (category === null || !isTasteCategory(category)) return { category: null, keys: [] };

  return { category, keys: keys.filter((key) => isTasteKey(category, key)) };
}
