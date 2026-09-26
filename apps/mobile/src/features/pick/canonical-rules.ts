/**
 * Pick 화면 정본 규칙.
 *
 * 서버 비교 API가 허용하는 상한과 별개로, 화면 정본은 한 번에 최대 3곳만 비교한다.
 * 화면마다 숫자를 따로 적어 다시 갈라지지 않도록 Pick 흐름은 이 값을 하나만 본다.
 */
export const PICK_COMPARE_MIN = 2;
export const PICK_COMPARE_MAX = 3;

export const PICK_COMPARE_ADD_LABEL = '비교에 담기';
export const PICK_COMPARE_REMOVE_LABEL = '비교에서 빼기';
export const PICK_COMPARE_BANNER_HINT = '금액과 조건을 나란히 볼 수 있어요';

export function compareBasketLabel(count: number): string {
  return `${count}곳 담았어요`;
}

/** 정본 pick.jsx catGroupHead의 catGroupMeta — «3개 · 최신순». */
export function groupMetaLabel(count: number): string {
  return `${count}개 · 최신순`;
}

/**
 * 묶음 머리의 «N개 · 최신순»을 그리는가. 담은 곳이 없고 «내 조건에 맞는 곳»만 보이는 묶음에서는
 * 그 줄이 추천 줄의 머리로 읽혀 지운다(2026-09-26 대표 지시 — 「내 조건에 맞는 곳」의 «0개 · 최신순»
 * 삭제). 담은 곳이 있는 묶음과, 추천도 없어 정본 `catGroups`의 빈 묶음(«예물 · 신혼» count 0)과
 * 같은 자리는 정본대로 그린다.
 */
export function showGroupMeta(pickedCount: number, recommendedCount: number): boolean {
  return pickedCount > 0 || recommendedCount === 0;
}
