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

/** 이용할 수 있는 나이. v3.13 §3.5. */
export const MINIMUM_AGE = 14;

/**
 * 만 14세 확인. v3.13 §3.5 · 2026-09-10 사용자 지시.
 *
 * **생년월일을 받지 않는다.** 예전에는 생년월일로 만 나이를 셌지만, 그 값을
 * 어차피 저장하지 않을 거라면 처음부터 묻지 않는 편이 낫다 — 개인정보보호법은
 * 만 14세 미만인지 확인하라고만 정하고 방법을 지정하지 않고, 감독기관
 * 가이드라인도 "합리적인 노력" 수준을 요구한다.
 *
 * 확인은 **두 경로**뿐이고 순서가 있다.
 *
 * ```
 * 제공자가 준 연령대 · 14세 이상   통과            AgeVerifiedVia 'provider'
 * 제공자가 준 연령대 · 미달        차단 · 계정 없음
 * 연령대를 못 받음                 화면의 확인      AgeVerifiedVia 'self_declared'
 *                                  확인 못 받으면 차단 · 계정 없음
 * ```
 *
 * **못 한 확인은 통과가 아니다.** 2026-09-10에 뚫린 자리가 정확히 여기였다 —
 * 연령대를 못 받은 사람이 아무 확인 없이 전부 통과했다. 「확인 못 함」의 기본값은
 * 통과가 아니라 차단이다.
 *
 * **화면의 확인은 연령대를 못 받았을 때만 본다.** 제공자가 미달로 판정한 사람을
 * 화면이 뒤집지 못한다 — 뒤집을 수 있으면 그 관문은 클라이언트가 여는 것이 되고,
 * 그것이 원래 뚫린 이유다.
 *
 * **저장하는 것은 셋뿐이다** — `ageVerified`(확인 여부) · `ageVerifiedAt`(확인
 * 시점) · `ageVerifiedVia`(어느 경로로 확인했는가). 생년·생년월일·연령대는
 * 기록하지 않는다. 경로를 남기는 이유는 나중에 「이 확인이 무엇에 근거했는가」를
 * 답할 수 있어야 하기 때문이다 — 셋이 아니라 둘만 남겼던 탓에, 이미 들어온 계정
 * 중 어느 것이 제공자 판정으로 켜졌고 어느 것이 자기 신고로 켜졌는지 지금 가릴 수
 * 없다.
 */

/** 무엇이 만 14세 이상임을 확인했는가. DB `structured.users.age_verified_via`. */
export type AgeVerifiedVia = 'provider' | 'self_declared';

export const AGE_VERIFIED_VIA = ['provider', 'self_declared'] as const;

/**
 * 동의 항목.
 *
 * `required`가 UI와 DB를 함께 가른다(§N-2). 선택 항목을 필수처럼 미리 켜두거나
 * 한 덩어리로 묶어 받으면, 받아둔 동의가 무엇에 대한 동의였는지 나중에 말할 수 없다.
 *
 * **v3.29 약관 동의(WP-AUTH-010)의 여덟 칸을 전부 적는다**(2026-09-26 대표 감사 8).
 * 화면은 필수 5 · 선택 3을 받는데 서버로는 셋(`terms` · `privacy` · `marketing`)만
 * 갔고, 나머지 다섯(만 14세 · Pick 인증 · 상담 녹음 · 연락처 제공 · 야간 알림)은
 * 체크만 하고 어디에도 남지 않았다. 이제 여덟 모두 `user_consents`에 항목 · 판 ·
 * 필수 여부 · 동의 시각이 한 줄씩 남는다. 표의 `item`은 text라 새 마이그레이션이
 * 필요 없다(0046). 화면 쪽 키와의 대응은 `consent-terms.ts`의 `signupConsentKey`다.
 *
 * - `activates` — 계정을 살리는 관문. **여전히 `terms` · `privacy` 둘뿐이다.** 옛 앱은
 *   이 둘만 보내므로, 여기에 새 필수 항목을 더하면 이미 깔린 앱이 가입을 못 끝낸다
 *   (하위 호환). 새 필수 셋을 서버 관문에 올릴지는 대표님 판단으로 남긴다.
 * - `doc` — 동의한 글의 문서 종류(`terms_doc_kind`, 0130 · 0429). 공개된 판이 있으면
 *   `user_consents.terms_version_id`가 그 행을 가리킨다. 글이 없는 항목은 null.
 */
export const CONSENT_ITEMS = [
  {
    key: 'terms',
    label: '이용약관',
    required: true,
    activates: true,
    doc: 'terms',
    /* 아직 법률 자문 전이라 판이 초안이다. release-gate가 출시를 막는다. */
    version: 'draft-2026-09-01',
  },
  {
    key: 'privacy',
    label: '개인정보처리방침',
    required: true,
    activates: true,
    doc: 'privacy',
    version: 'draft-2026-09-01',
  },
  {
    key: 'marketing',
    label: '혜택 소식 받기',
    required: false,
    activates: false,
    doc: 'marketing',
    /*
     * 지금은 이 동의로 보내는 것이 없다. 그래도 받아두는 이유가 아니라 **선택으로
     * 두는 이유**가 요점이다 — 보낼 것이 생겼을 때 필수 동의에 슬쩍 끼워 넣지
     * 못하게, 자리를 처음부터 갈라둔다.
     */
    version: 'draft-2026-09-01',
  },
  {
    key: 'age',
    label: '만 14세 이상이에요',
    required: true,
    activates: false,
    /* 판정은 로그인이 한다(`age_verified`). 이 줄은 화면에서 확인한 사실만 남긴다. */
    doc: null,
    version: 'draft-2026-09-01',
  },
  {
    key: 'pick_certification',
    label: 'Pick 인증 자료 수집 · 이용',
    required: true,
    activates: false,
    doc: 'pick_verification',
    version: 'draft-2026-09-01',
  },
  {
    key: 'consultation_recording',
    label: '상담 녹음 수집 · 이용',
    required: true,
    activates: false,
    doc: 'consultation_recording',
    version: 'draft-2026-09-01',
  },
  {
    key: 'contact_share',
    label: '상담 예약 시 업체에 연락처 제공',
    required: false,
    activates: false,
    doc: 'contact_sharing',
    version: 'draft-2026-09-01',
  },
  {
    key: 'night_alerts',
    label: '밤 9시 ~ 아침 8시에도 알림 받기',
    required: false,
    activates: false,
    doc: null,
    version: 'draft-2026-09-01',
  },
] as const satisfies readonly {
  key: string;
  label: string;
  required: boolean;
  activates: boolean;
  doc: string | null;
  version: string;
}[];

export type ConsentItem = (typeof CONSENT_ITEMS)[number]['key'];

/** 약관 문서 종류(`terms_doc_kind`). 동의 항목이 가리키는 글. */
export type ConsentDocKind = NonNullable<(typeof CONSENT_ITEMS)[number]['doc']>;

/** 화면의 필수 항목 전부(필수 5). 행의 `is_required`도 이것으로 적는다. */
export const REQUIRED_CONSENTS: ConsentItem[] = CONSENT_ITEMS.filter(
  (item) => item.required
).map((item) => item.key);

export const OPTIONAL_CONSENTS: ConsentItem[] = CONSENT_ITEMS.filter(
  (item) => !item.required
).map((item) => item.key);

/**
 * 계정을 살리는 데 꼭 있어야 하는 동의 — `terms` · `privacy`. 옛 앱과 맞추는 관문이다
 * (위 `activates` 설명). `missingRequiredConsents` · `canActivate`가 이것을 본다.
 */
export const ACTIVATION_CONSENTS: ConsentItem[] = CONSENT_ITEMS.filter(
  (item) => item.activates
).map((item) => item.key);

/** 이 동의가 가리키는 문서 종류. 글이 없는 항목(만 14세 · 야간 알림)은 null. */
export function consentDocKind(item: ConsentItem): ConsentDocKind | null {
  return CONSENT_ITEMS.find((candidate) => candidate.key === item)?.doc ?? null;
}

/**
 * 마케팅 수신 동의 항목.
 *
 * 알림 설정(WP-NOTI-003)의 «마케팅 알림» 스위치가 켜고 끄는 것이 이 동의다.
 * 이름을 상수로 두는 이유는 가입 화면과 알림 설정이 **같은 줄**을 봐야 해서다 —
 * 각자 `'marketing'`이라고 적으면 한쪽만 고쳐도 티가 나지 않는다.
 */
export const MARKETING_CONSENT_ITEM: ConsentItem = 'marketing';

/** 이 항목이 필수 동의인가. 동의를 받던 그때의 성격을 행에 함께 적기 위해 쓴다. */
export function isRequiredConsent(item: ConsentItem): boolean {
  const found = CONSENT_ITEMS.find((candidate) => candidate.key === item);

  if (!found) throw new Error(`알 수 없는 동의 항목: ${item}`);

  return found.required;
}

export function consentVersion(item: ConsentItem): string {
  const found = CONSENT_ITEMS.find((candidate) => candidate.key === item);

  if (!found) throw new Error(`알 수 없는 동의 항목: ${item}`);

  return found.version;
}

/** 아직 확정되지 않은 판인가. `release-gate`가 이걸 보고 출시를 막는다. */
export function isDraftVersion(version: string): boolean {
  return version.startsWith('draft-');
}

/**
 * 계정을 살리는 관문(`ACTIVATION_CONSENTS`) 중 아직 받지 못한 것. 빈 배열이면 계정을
 * 살릴 수 있다. 화면의 새 필수 셋(만 14세 · Pick 인증 · 상담 녹음)은 기록하지만 이
 * 관문에는 넣지 않는다 — `CONSENT_ITEMS`의 `activates` 설명.
 */
export function missingRequiredConsents(
  granted: readonly { item: string; version: string }[]
): ConsentItem[] {
  return ACTIVATION_CONSENTS.filter(
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
  ageVerified: boolean;
  granted: readonly { item: string; version: string }[];
}): ActivationCheck {
  if (!input.ageVerified) {
    return { ok: false, reason: AGE_BLOCKED_NOTICE };
  }

  return missingRequiredConsents(input.granted).length === 0
    ? { ok: true }
    : { ok: false, reason: REQUIRED_CONSENT_NOTICE };
}

/** 만 14세 미만으로 **확인됐을 때**. WP-AUTH-009 이용 불가 안내가 이 문구를 쓴다. */
export const AGE_BLOCKED_NOTICE = `만 ${MINIMUM_AGE}세부터 이용할 수 있어요`;

/**
 * 나이를 **확인하지 못했을 때**. 미달로 확인된 것이 아니라 확인할 근거가 없는
 * 상태다 — 제공자가 연령대를 주지 않았고 화면의 확인도 받지 못했다.
 *
 * 「~할 수 없어요」로 끝내지 않는다(CLAUDE.md 용어). 무엇이 되는지를 말한다.
 */
export const AGE_UNVERIFIED_NOTICE = `만 ${MINIMUM_AGE}세 이상인지 확인하면 시작할 수 있어요`;

export const REQUIRED_CONSENT_NOTICE = '필수 항목에 동의해야 가입이 끝나요';

/** 동의 화면 머리말. 선택 항목이 따로 있다는 것을 먼저 말한다. */
export const CONSENT_INTRO = '가입을 마치려면 필수 항목에 동의해주세요. 선택 항목은 나중에 바꿀 수 있어요';

/** 아직 가입이 끝나지 않은 계정이 무언가를 하려 할 때. */
export const NOT_ACTIVATED_NOTICE = '아직 가입이 끝나지 않았어요. 동의 화면에서 마저 진행해주세요';
