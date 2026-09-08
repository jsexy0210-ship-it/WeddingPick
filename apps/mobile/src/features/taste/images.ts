import { TASTE_PRIORITY, TASTE_SETS, type TasteCategory, type VendorCategory } from '@weddingpick/domain';
import type { ImageSource } from 'expo-image';

/**
 * 취향 카드 이미지 목록. 디자인 핸드오프 v3.19 IMAGES.md «취향 이미지 필요 목록».
 *
 * 키는 도메인의 취향 키(`TASTE_SETS` — `studio_white` 같은 `업종_뜻`)다. 화면은
 * 이 표에서만 사진을 꺼낸다 — 온보딩 5/5 · 홈 취향 고르기 · MY 취향 다시 고르기가
 * 같은 사진을 봐야 하고, 사진이 오면 여기 한 줄만 더하면 끝이어야 한다.
 *
 * **지금은 스튜디오 3장뿐이다**(IMAGES.md «보유 3장 · 하드코딩으로 유지»). 나머지
 * 63장은 대기 중이다. 파일이 오면 `assets/images/taste/taste_<업종>_<라벨>.jpg`
 * (IMAGES.md 파일명 규칙)에 두고 아래 주석의 `require()` 꼴로 등록한다.
 *
 * **3장 미만인 업종은 취향 질문을 건너뛴다**(IMAGES.md «이미지가 없을 때»). 빈
 * 상자나 «사진 준비 중»을 내놓지 않는다 — 세트의 절반이 비어 있으면 고르는 화면이
 * 아니라 없는 것을 알리는 화면이 된다. 3장 이상인 업종 안에서 사진이 없는 카드
 * (예: 스튜디오 «야외 자연광»)만 옅은 면으로 그린다.
 */

/** 취향 키. 도메인 `TasteOption.key`와 같은 문자열이다(`studio_white` …). */
export type TasteKey = (typeof TASTE_SETS)[TasteCategory][number]['key'];

/**
 * 한 업종의 취향 질문을 열기 위한 최소 장수. 여섯 장 세트의 절반 — 이보다 적으면
 * 그 업종을 건너뛴다.
 */
export const TASTE_IMAGE_MIN = 3;

/**
 * 보유 이미지. IMAGES.md «보유 3장» — 스튜디오 깔끔한 화이트 · 모던 미니멀 · 따뜻한
 * 필름. 원본은 시안 uploads/에 있고 아직 번들에 들어오지 않아 시안과 같은 출처의
 * URL을 그대로 쓴다.
 *
 * 로컬 파일이 오면 이렇게 바꾼다(IMAGES.md 파일명 규칙 `taste_<업종>_<라벨>.jpg`):
 *
 *   hall_hotel: require('../../../assets/images/taste/taste_hall_hotel.jpg'),
 *   hall_chapel: require('../../../assets/images/taste/taste_hall_chapel.jpg'),
 *   studio_white: require('../../../assets/images/taste/taste_studio_white.jpg'),
 */
export const TASTE_IMAGE_SOURCE: Partial<Record<TasteKey, ImageSource>> = {
  studio_white: {
    uri: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80&auto=format&fit=crop',
  },
  studio_minimal: {
    uri: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&q=80&auto=format&fit=crop',
  },
  studio_film: {
    uri: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=80&auto=format&fit=crop',
  },
};

/** 이 키의 사진. 없으면 null — 부르는 쪽이 옅은 면으로 그린다. */
export function tasteImageSource(key: TasteKey): ImageSource | null {
  return TASTE_IMAGE_SOURCE[key] ?? null;
}

/** 이 업종 세트에서 사진이 있는 장수. */
export function tasteImageCount(category: TasteCategory): number {
  return TASTE_SETS[category].filter((option) => TASTE_IMAGE_SOURCE[option.key] !== undefined).length;
}

/** 취향 질문을 열 만큼 사진이 있는가 — `TASTE_IMAGE_MIN`장 이상. */
export function hasEnoughTasteImages(category: TasteCategory): boolean {
  return tasteImageCount(category) >= TASTE_IMAGE_MIN;
}

/**
 * 취향을 물을 업종 — 우선순위(`TASTE_PRIORITY`)에서 준비 현황에 없고 **사진이
 * 충분한** 첫 업종. 도메인 `nextTasteCategory`는 사진을 모르는 순수 규칙이라 그대로
 * 두고, 사진 조건은 여기서 얹는다. 해당하는 업종이 없으면 null — 온보딩은 5/5를
 * 통째로 건너뛴다.
 *
 * `hasImages`는 시험이 바꿔 끼우기 위한 자리다. 화면은 기본값을 쓴다.
 */
export function nextTasteCategoryWithImages(
  prepared: readonly VendorCategory[],
  hasImages: (category: TasteCategory) => boolean = hasEnoughTasteImages
): TasteCategory | null {
  return TASTE_PRIORITY.find((category) => !prepared.includes(category) && hasImages(category)) ?? null;
}
