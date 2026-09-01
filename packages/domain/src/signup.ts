/**
 * 가입 연령과 약관 동의. 통합정책 v3.13 §N.
 *
 * 정책이 못박은 것 둘.
 *
 *   1. **만 14세 미만은 가입도 이용도 막는다.**
 *   2. **소셜 로그인 성공만으로 가입이 끝나지 않는다.** 필수 동의를 마친 뒤에야
 *      계정이 살아난다.
 *
 * 두 번째가 구현에서 자주 어긋난다. 로그인 제공자가 토큰을 확인해주면 그것으로
 * 계정이 생기고, 동의 화면은 그 뒤에 붙는 안내가 된다. 그러면 동의를 건너뛴 계정이
 * 이미 서비스를 쓰고 있는 상태가 만들어진다. 그래서 **계정을 만드는 것과 살리는
 * 것을 나눈다** — 로그인은 대기 상태의 계정을 만들고, 동의가 그것을 활성화한다.
 */

/** 이용할 수 있는 나이. v3.13 §N-1. */
export const MINIMUM_AGE = 14;

/**
 * 생년월일을 받아 만 나이를 센다.
 *
 * **이 값을 저장하지 않는다.** 판정만 남기고 생년월일은 버린다 — 정책 §N-3이
 * 기록하라고 한 것은 약관 버전·동의 항목·필수 여부·동의 일시이지 생년월일이
 * 아니고, 우리는 필요 없는 개인정보를 들고 있지 않는다.
 */
export function ageOn(birthDate: string, today: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());

  if (!match) return null;

  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);

  const born = new Date(Date.UTC(year, month - 1, day));

  /* `2026-02-30` 같은 값은 Date가 3월로 넘겨준다. 넘어갔으면 없는 날이다. */
  if (born.getUTCFullYear() !== year || born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day) {
    return null;
  }

  if (born.getTime() > today.getTime()) return null;

  let age = today.getUTCFullYear() - year;
  const hadBirthday =
    today.getUTCMonth() > month - 1 ||
    (today.getUTCMonth() === month - 1 && today.getUTCDate() >= day);

  if (!hadBirthday) age -= 1;

  return age;
}

/**
 * 가입할 수 있는 나이인가.
 *
 * 읽을 수 없는 날짜는 통과시키지 않는다. 모르는 것을 통과시키면 연령 제한은
 * 잘못 적기만 하면 넘어가는 문이 된다.
 */
export function isOldEnough(birthDate: string, today: Date): boolean {
  const age = ageOn(birthDate, today);

  return age !== null && age >= MINIMUM_AGE;
}

/** 연령 확인 결과. 값이 아니라 판정만 남긴다. */
export const AGE_GATE_RESULTS = ['pending', 'passed', 'blocked'] as const;

export type AgeGateResult = (typeof AGE_GATE_RESULTS)[number];

/**
 * 동의 항목.
 *
 * `required`가 UI와 DB를 함께 가른다(§N-2). 선택 항목을 필수처럼 미리 켜두거나
 * 한 덩어리로 묶어 받으면, 받아둔 동의가 무엇에 대한 동의였는지 나중에 말할 수 없다.
 */
export const CONSENT_ITEMS = [
  {
    key: 'terms',
    label: '이용약관',
    required: true,
    /* 아직 법률 자문 전이라 판이 초안이다. release-gate가 출시를 막는다. */
    version: 'draft-2026-09-01',
  },
  {
    key: 'privacy',
    label: '개인정보처리방침',
    required: true,
    version: 'draft-2026-09-01',
  },
  {
    key: 'marketing',
    label: '혜택 소식 받기',
    required: false,
    /*
     * 지금은 이 동의로 보내는 것이 없다. 그래도 받아두는 이유가 아니라 **선택으로
     * 두는 이유**가 요점이다 — 보낼 것이 생겼을 때 필수 동의에 슬쩍 끼워 넣지
     * 못하게, 자리를 처음부터 갈라둔다.
     */
    version: 'draft-2026-09-01',
  },
] as const satisfies readonly {
  key: string;
  label: string;
  required: boolean;
  version: string;
}[];

export type ConsentItem = (typeof CONSENT_ITEMS)[number]['key'];

export const REQUIRED_CONSENTS: ConsentItem[] = CONSENT_ITEMS.filter(
  (item) => item.required
).map((item) => item.key);

export const OPTIONAL_CONSENTS: ConsentItem[] = CONSENT_ITEMS.filter(
  (item) => !item.required
).map((item) => item.key);

export function consentVersion(item: ConsentItem): string {
  const found = CONSENT_ITEMS.find((candidate) => candidate.key === item);

  if (!found) throw new Error(`알 수 없는 동의 항목: ${item}`);

  return found.version;
}

/** 아직 확정되지 않은 판인가. `release-gate`가 이걸 보고 출시를 막는다. */
export function isDraftVersion(version: string): boolean {
  return version.startsWith('draft-');
}

/** 필수 항목 중 아직 받지 못한 것. 빈 배열이면 계정을 살릴 수 있다. */
export function missingRequiredConsents(
  granted: readonly { item: string; version: string }[]
): ConsentItem[] {
  return REQUIRED_CONSENTS.filter(
    (item) =>
      !granted.some((one) => one.item === item && one.version === consentVersion(item))
  );
}

/**
 * 계정을 살려도 되는가.
 *
 * 두 관문을 한 함수에 둔다. 나눠두면 한쪽만 부르는 자리가 생기고, 그 자리가
 * 정확히 정책이 막으려던 구멍이 된다.
 */
export type ActivationCheck = { ok: true } | { ok: false; reason: string };

export function canActivate(input: {
  ageGate: AgeGateResult;
  granted: readonly { item: string; version: string }[];
}): ActivationCheck {
  if (input.ageGate === 'blocked') {
    return { ok: false, reason: AGE_BLOCKED_NOTICE };
  }

  if (input.ageGate !== 'passed') {
    return { ok: false, reason: AGE_UNCHECKED_NOTICE };
  }

  return missingRequiredConsents(input.granted).length === 0
    ? { ok: true }
    : { ok: false, reason: REQUIRED_CONSENT_NOTICE };
}

/** 만 14세 미만. 왜 안 되는지만 말한다. */
export const AGE_BLOCKED_NOTICE = `만 ${MINIMUM_AGE}세부터 이용할 수 있어요`;

export const AGE_UNCHECKED_NOTICE = '생년월일을 확인해야 가입이 끝나요';

export const REQUIRED_CONSENT_NOTICE = '필수 항목에 동의해야 가입이 끝나요';

/** 동의 화면 머리말. 선택 항목이 따로 있다는 것을 먼저 말한다. */
export const CONSENT_INTRO = '가입을 마치려면 필수 항목에 동의해주세요. 선택 항목은 나중에 바꿀 수 있어요';

/** 아직 가입이 끝나지 않은 계정이 무언가를 하려 할 때. */
export const NOT_ACTIVATED_NOTICE = '아직 가입이 끝나지 않았어요. 동의 화면에서 마저 진행해주세요';
