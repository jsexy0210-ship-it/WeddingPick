import { MINIMUM_AGE } from '@weddingpick/domain';

/**
 * 제공자가 준 **연령대**로 만 14세 판정만 뽑는다.
 *
 * ```
 * age_range 있음    14세 이상 → 통과 · 미만 → WP-AUTH-009
 * age_range 없음    확인 못 했다 → 막는다
 * ```
 *
 * **없을 때 통과시키지 않는다.** 예전 규칙은 「없으면 체크박스 그대로」였고 그때는
 * 로그인 화면에 「만 14세 이상이에요」 체크박스가 있었다. 핸드오프 v3.24가 그
 * 체크박스를 없앴는데 이 규칙은 남았고, 판정할 체크박스가 없으니 연령대를 못 받은
 * 사람은 **아무 확인 없이 전부 통과**했다 — 만 14세 미만 계정이 실제로 가입된 것을
 * 사용자가 잡았다(2026-09-10). 확인 못 한 것은 통과가 아니다.
 *
 * **출생 연도를 쓰지 않는다**(2026-09-10 사용자 지시). 핸드오프 v3.25의 동의항목
 * 표는 출생 연도를 필수 동의로 적었지만, 목적은 생일을 아는 것이 아니라 만 14세
 * 이상인지 확인하는 것이다. 연도만으로는 생일이 지났는지 몰라 만 나이가 한 살
 * 범위로 흔들리는데, 연령대의 아래끝에는 그 흔들림이 없다 — 더 적게 받고 더
 * 정확하다.
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
 * 확인이 아니다. 확인 못 한 것은 통과가 아니라 WP-AUTH-009이다(SPEC 3.5).
 * 연령대가 없거나 못 읽으면 `unknown`이다. **`unknown`은 통과가 아니다** — 이 함수는
 * 판정만 내리고, 그것을 어떻게 다룰지는 라우트가 정한다(`auth.ts`에서 막는다).
 */
export function ageVerdictFromRange(range: string | undefined | null): AgeVerdict {
  const lower = ageRangeLowerBound(range);

  if (lower === null) return 'unknown';

  return lower >= MINIMUM_AGE ? 'verified' : 'under_age';
}
