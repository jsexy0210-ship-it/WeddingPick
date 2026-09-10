import { MINIMUM_AGE } from '@weddingpick/domain';

/**
 * 제공자가 준 **연령대**로 만 14세 판정만 뽑는다.
 *
 * ```
 * age_range 있음    14세 이상 → 통과 · 미만 → WP-AUTH-009(계정 없음)
 * age_range 없음    unknown — 이 파일은 여기서 끝이고, 통과 여부는 라우트가 정한다
 * ```
 *
 * **출생 연도를 쓰지 않는다**(2026-09-10 사용자 지시). 핸드오프 v3.25의 동의항목
 * 표는 출생 연도를 필수 동의로 적었지만, 목적은 생일을 아는 것이 아니라 만 14세
 * 이상인지 확인하는 것이다. 연도만으로는 생일이 지났는지 몰라 만 나이가 한 살
 * 범위로 흔들리는데, 연령대의 아래끝에는 그 흔들림이 없다 — 더 적게 받고 더
 * 정확하다.
 *
 * **연령대는 저장하지 않는다.** 남기는 것은 `age_verified` · `age_verified_at` ·
 * `age_verified_via`(0104) 셋뿐이고, 셋 중 어느 것도 연령대 문자열이 아니다. 이
 * 파일은 문자열에서 판정 하나를 꺼내고 문자열은 버린다.
 *
 * 카카오 연령대 꼴: `1~9` `10~14` `15~19` `20~29` … `90~`. 네이버는 `20-29`다.
 * 둘 다 읽는다 — 구분자가 다르다고 판정을 못 하면 그 사람은 화면에서 확인을 한 번
 * 더 하게 되는데, 그건 오류가 아니라 헛수고다.
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
 * 확인이 아니다.
 *
 * 연령대가 없거나 못 읽으면 `unknown`이다. **`unknown`은 통과가 아니다** —
 * 「확인함」도 「미달」도 아닌 세 번째 값이고, 무엇으로 이어붙일지는 라우트가
 * 정한다(`routes/auth.ts`: 화면의 확인이 있으면 통과, 없으면 `age_unverified`).
 * 이 함수가 `unknown`을 조용히 `verified` 쪽으로 접으면 그 판단이 보이지 않는
 * 곳으로 숨는다 — 2026-09-10에 뚫린 구멍이 정확히 그런 모양이었다.
 */
export function ageVerdictFromRange(range: string | undefined | null): AgeVerdict {
  const lower = ageRangeLowerBound(range);

  if (lower === null) return 'unknown';

  return lower >= MINIMUM_AGE ? 'verified' : 'under_age';
}
