import { MINIMUM_AGE } from '@weddingpick/domain';

/**
 * 제공자가 준 값으로 만 14세 판정만 뽑는다. 핸드오프 v3.24(2026-09-09).
 *
 * ```
 * 14세 이상 → 통과 · 미만 → WP-AUTH-009 · 못 읽음 → unknown
 * ```
 *
 * 로그인 화면에 체크박스가 없다(v3.24). 판정은 전부 여기서만 난다.
 *
 * **연령대는 저장하지 않는다.** 남기는 것은 `age_verified` · `age_verified_at`
 * 둘뿐이다. 이 파일은 문자열에서 판정 하나를 꺼내고 문자열은 버린다.
 *
 * 카카오 연령대 꼴: `1~9` `10~14` `15~19` `20~29` … `90~`. 네이버는 `20-29`다.
 * 둘 다 읽는다 — 구분자가 다르다고 판정을 놓치면 통과할 사람이 `unknown`으로
 * 남는다.
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
 * 연령대가 없거나 못 읽으면 `unknown` — 계정은 만들되 확인 표시를 남기지 않는다.
 */
export function ageVerdictFromRange(range: string | undefined | null): AgeVerdict {
  const lower = ageRangeLowerBound(range);

  if (lower === null) return 'unknown';

  return lower >= MINIMUM_AGE ? 'verified' : 'under_age';
}

/**
 * 출생 연도로 만 14세 이상인가. 2026-09-09 사용자 결정 — **출생 연도를 필수 동의로
 * 받고 이것으로 판정한다.** 로그인 화면의 체크박스는 없앴다(v3.24).
 *
 * **연도만으로는 만 나이가 하나로 떨어지지 않는다.** 생일이 지났는지 모르기 때문이다.
 *
 * ```
 * 올해 - 출생연도 >= 15   만 14 또는 15 → 어느 쪽이든 14 이상   verified
 * 올해 - 출생연도 == 14   만 13 또는 14 → 갈린다               under_age
 * 올해 - 출생연도 <= 13   만 13 이하                          under_age
 * ```
 *
 * **경계(== 14)를 막는다**(2026-09-09 사용자 결정으로 생일 동의를 뺀 뒤). 예전에는
 * `unknown`으로 두고 생일까지 받아 가렸는데, 생일을 안 받기로 했으므로 가릴 수단이
 * 없어졌다. 남은 선택은 둘뿐이다 — 통과시키면 **아직 열세 살인 사람이 들어오고**,
 * 막으면 진짜 열네 살인 사람이 생일까지 기다린다. 개인정보 보호법이 금지하는 것은
 * 앞쪽이라 뒤쪽을 고른다. 막힌 사람이 보는 화면도 「만 14세가 되면 이용할 수
 * 있어요」라 그 사람에게는 사실이다.
 *
 * `unknown`은 값을 못 읽었을 때만 남는다.
 */
export function ageVerdictFromBirthYear(
  birthYear: string | number | undefined | null,
  now: Date = new Date()
): AgeVerdict {
  const year = typeof birthYear === 'number' ? birthYear : Number(String(birthYear ?? '').trim());

  if (!Number.isInteger(year) || year < 1900) return 'unknown';

  const elapsed = now.getFullYear() - year;

  if (elapsed >= MINIMUM_AGE + 1) return 'verified';

  /* 경계(== 14)도 막는다. 생일을 받지 않으므로 가릴 수단이 없다. */
  return 'under_age';
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
