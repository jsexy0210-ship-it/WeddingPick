/**
 * 스타일 4종.
 *
 * 사용자 화면에는 대표 스타일명 4개만 노출한다. 내부 값은 영문 태그다 — 한글 문자열을
 * DB 기준값으로 쓰지 않는다.
 *
 *   사용자   preferenceStyleTags: WeddingStyle[]   최소 1 · 개수 제한 없음(넷 다 골라도 된다)
 *   업체     styleTags: WeddingStyle[]             개수 제한 없음
 *
 * **최대 개수가 없다**(2026-09-26 대표 결정 「개수제한 없다」). 정본 WP-AUTH-006
 * (`docs/design/React_Native/home.jsx:328` 「개수 제한 없이 원하는 만큼 고를 수 있습니다」 ·
 * `home.js:815` 「4종 버튼 · 개수 제한 없음」)을 따른다. 전에는 최대 2개 · 3번째는 토스트
 * («스타일은 2개까지 고를 수 있어요»)였고 온보딩 · MY 스타일(WP-MY-014)이 같이 막았다 —
 * 그 상한과 토스트를 함께 걷었다. 최소 1개는 그대로다.
 *
 * **태그는 정렬 가중치로만 쓴다.** 태그가 다르다고 업체를 목록에서 빼지 않는다 — 교집합
 * 개수를 순서에만 반영한다. 업종별 세부 속성(실크 · 비즈 · 필름톤 …)은 여기 넣지 않는다.
 */

export const WEDDING_STYLES = ['URBAN', 'NATURAL', 'ROMANTIC', 'GLAMOROUS'] as const;

export type WeddingStyle = (typeof WEDDING_STYLES)[number];

/** 사용자 화면 라벨. 이 넷 외의 스타일명을 화면에 쓰지 않는다. */
export const WEDDING_STYLE_LABEL: Record<WeddingStyle, string> = {
  URBAN: '도시적인',
  NATURAL: '자연스러운',
  ROMANTIC: '로맨틱한',
  GLAMOROUS: '화려한',
};

/** 업체 데이터 매핑용 세부 정의. 화면에는 쓰지 않는다. */
export const WEDDING_STYLE_NOTE: Record<WeddingStyle, string> = {
  URBAN: '모던 · 세련됨 · 도심 · 현대적',
  NATURAL: '내추럴 · 편안함 · 자연광 · 야외',
  ROMANTIC: '부드러움 · 감성적 · 사랑스러움',
  GLAMOROUS: '럭셔리 · 풍성함 · 장식적 · 강한 존재감',
};

/** 최소 1개. 최대는 없다 — 위 머리말(2026-09-26 대표 결정). */
export const STYLE_PICK_MIN = 1;

export function isWeddingStyle(value: unknown): value is WeddingStyle {
  return typeof value === 'string' && (WEDDING_STYLES as readonly string[]).includes(value);
}

/**
 * 스타일 토글 — 재클릭은 해제하고, 아니면 더한다. 몇 개든 더한다(최대 없음).
 * 순서는 고른 순서를 지킨다.
 */
export function toggleStyle(chosen: readonly WeddingStyle[], style: WeddingStyle): readonly WeddingStyle[] {
  if (chosen.includes(style)) return chosen.filter((item) => item !== style);

  return [...chosen, style];
}

/** 사용자가 고른 것과 업체 태그의 교집합 — 정렬 가중치이자 «고른 스타일 N개가 다 맞아요»의 N. */
export function styleOverlap(
  chosen: readonly WeddingStyle[],
  vendorTags: readonly WeddingStyle[]
): readonly WeddingStyle[] {
  return chosen.filter((style) => vendorTags.includes(style));
}

/**
 * 추천 이유 첫 불릿 — 스타일 일치(SPEC §2 «출시 초기 추천 근거» · §13.6).
 *
 *   고른 2개가 다 맞음   «고른 스타일 2개가 다 맞아요»
 *   일부 맞음           «고른 스타일이랑 맞아요»
 *   안 맞음 · 미선택     null — 이 불릿을 적지 않는다
 */
export function styleMatchReason(
  chosen: readonly WeddingStyle[],
  vendorTags: readonly WeddingStyle[]
): string | null {
  const overlap = styleOverlap(chosen, vendorTags);
  if (chosen.length === 0 || overlap.length === 0) return null;
  if (overlap.length === chosen.length && chosen.length >= 2) {
    return `고른 스타일 ${chosen.length}개가 다 맞아요`;
  }
  return '고른 스타일이랑 맞아요';
}
