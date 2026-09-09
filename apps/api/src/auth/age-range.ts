import { MINIMUM_AGE } from '@weddingpick/domain';

/**
 * 제공자가 준 연령대로 만 14세 판정만 뽑는다. 핸드오프 v3.22 SPEC 3.5 «카카오에서 받는 것».
 *
 * ```
 * age_range 있음    14세 이상 → 체크박스 없이 통과 · 미만 → WP-AUTH-010
 * age_range 없음    체크박스 그대로
 * ```
 *
 * **연령대는 저장하지 않는다.** 남기는 것은 `age_verified` · `age_verified_at`
 * 둘뿐이다. 이 파일은 문자열에서 판정 하나를 꺼내고 문자열은 버린다.
 *
 * 카카오 연령대 꼴: `1~9` `10~14` `15~19` `20~29` … `90~`. 네이버는 `20-29`다.
 * 둘 다 읽는다 — 구분자가 다르다고 판정을 못 하면 사람이 체크박스를 한 번 더
 * 누르게 되는데, 그건 오류가 아니라 헛수고다.
 */

export type AgeVerdict = 'verified' | 'under_age' | 'unknown';

/** 연령대의 아래끝. 꼴이 아니면 null — 모르는 것을 숫자로 만들지 않는다. */
export function ageRangeLowerBound(range: string | undefined | null): number | null {
  if (!range) return null;

  const match = /^\s*(\d{1,3})\s*[~\-]/.exec(range);

  if (!match) return null;

  return Number(match[1]);
}

/**
 * 만 14세 이상인가.
 *
 * 구간의 **아래끝**으로 본다 — `10~14`는 14세도 들어 있지만 13세도 들어 있어
 * 확인이 아니다. 확인 못 한 것은 통과가 아니라 WP-AUTH-010이다(SPEC 3.5).
 * 연령대가 없거나 못 읽으면 `unknown` — 체크박스가 그대로 판정한다.
 */
export function ageVerdictFromRange(range: string | undefined | null): AgeVerdict {
  const lower = ageRangeLowerBound(range);

  if (lower === null) return 'unknown';

  return lower >= MINIMUM_AGE ? 'verified' : 'under_age';
}
