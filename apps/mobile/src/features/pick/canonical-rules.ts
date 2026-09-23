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
