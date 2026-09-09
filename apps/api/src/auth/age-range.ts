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

/**
 * 출생 연도로 만 14세 이상인가. 2026-09-09 사용자 결정 — **출생 연도를 필수 동의로
 * 받고 이것으로 판정한다.** 로그인 화면의 체크박스는 없앤다.
 *
 * **연도만으로는 만 나이가 하나로 떨어지지 않는다.** 생일이 지났는지 모르기 때문이다.
 *
 * ```
 * 올해 - 출생연도 >= 15   만 14 또는 15 → 어느 쪽이든 14 이상   verified
 * 올해 - 출생연도 == 14   만 13 또는 14 → 갈린다               unknown
 * 올해 - 출생연도 <= 13   만 13 이하                          under_age
 * ```
 *
 * **경계(== 14)를 통과로 처리하지 않는다.** 그러면 아직 열세 살인 사람이 들어온다.
 * 막지도 않는다 — 그러면 진짜 열네 살이 막힌다. 모르는 것은 `unknown`으로 두고,
 * 판정은 생일까지 받은 경우에만 정확해진다(`ageVerdictFromBirthDate`).
 */
export function ageVerdictFromBirthYear(
  birthYear: string | number | undefined | null,
  now: Date = new Date()
): AgeVerdict {
  const year = typeof birthYear === 'number' ? birthYear : Number(String(birthYear ?? '').trim());

  if (!Number.isInteger(year) || year < 1900) return 'unknown';

  const elapsed = now.getFullYear() - year;

  if (elapsed >= MINIMUM_AGE + 1) return 'verified';
  if (elapsed <= MINIMUM_AGE - 1) return 'under_age';

  return 'unknown';
}

/**
 * 출생 연도 + 생일로 만 나이를 정확히 본다. 생일은 선택 동의라 없을 수 있고,
 * 없으면 `ageVerdictFromBirthYear`의 경계가 그대로 남는다.
 *
 * 카카오 생일 꼴은 `MMDD`(예 `0421`)다. 연도가 없으므로 출생 연도와 합쳐야 뜻이 생긴다.
 */
export function ageVerdictFromBirthDate(
  birthYear: string | number | undefined | null,
  birthdayMMDD: string | undefined | null,
  now: Date = new Date()
): AgeVerdict {
  const year = typeof birthYear === 'number' ? birthYear : Number(String(birthYear ?? '').trim());
  const mmdd = /^(\d{2})(\d{2})$/.exec(String(birthdayMMDD ?? '').trim());

  if (!Number.isInteger(year) || year < 1900 || !mmdd) {
    return ageVerdictFromBirthYear(birthYear, now);
  }

  const month = Number(mmdd[1]);
  const day = Number(mmdd[2]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return ageVerdictFromBirthYear(birthYear, now);

  let age = now.getFullYear() - year;
  const hadBirthday =
    now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);

  if (!hadBirthday) age -= 1;

  return age >= MINIMUM_AGE ? 'verified' : 'under_age';
}
