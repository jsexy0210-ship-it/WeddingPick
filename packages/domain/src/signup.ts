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
 * 만 14세 이상인지는 자기 신고로 받는다. v3.13 §3.5.
 *
 * **생년월일을 받지 않는다.** 예전에는 생년월일로 만 나이를 셌지만, 그 값을
 * 어차피 저장하지 않을 거라면 처음부터 묻지 않는 편이 낫다 — 개인정보보호법은
 * 만 14세 미만인지 확인하라고만 정하고 방법을 지정하지 않고, 감독기관
 * 가이드라인도 "합리적인 노력" 수준을 요구한다. 로그인 화면의 체크박스
 * 하나(«만 14세 이상이에요»)가 그 확인이다.
 *
 * **저장하는 것은 두 개뿐이다** — `ageVerified`(확인 여부) · `ageVerifiedAt`
 * (확인 시점). 생년·생년월일·연령대는 기록하지 않는다. 확인 절차를 뒀다는
 * 사실을 증명해야 하므로 시점만 로그로 남긴다.
 */

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

/** 체크하지 않고 시작하려 했을 때. WP-AUTH-009 이용 불가 안내가 이 문구를 쓴다. */
export const AGE_BLOCKED_NOTICE = `만 ${MINIMUM_AGE}세부터 이용할 수 있어요`;

export const REQUIRED_CONSENT_NOTICE = '필수 항목에 동의해야 가입이 끝나요';

/** 동의 화면 머리말. 선택 항목이 따로 있다는 것을 먼저 말한다. */
export const CONSENT_INTRO = '가입을 마치려면 필수 항목에 동의해주세요. 선택 항목은 나중에 바꿀 수 있어요';

/** 아직 가입이 끝나지 않은 계정이 무언가를 하려 할 때. */
export const NOT_ACTIVATED_NOTICE = '아직 가입이 끝나지 않았어요. 동의 화면에서 마저 진행해주세요';

/* ── 회원가입 때 카카오에서 받는 정보 ─────────────────────────────────────
 *
 * **로그인 화면에 그대로 적는다.** 카카오 개인정보 동의항목 심사가
 * 「회원가입 화면 내 수집 항목 · 수집 조건 기재 필수」를 요구한다(2026-09-09 반려).
 * 처음 제출한 화면은 「웨딩 준비, 진짜 견적부터 확인해 보세요」만 보여서
 * 심사자가 회원가입 절차로 읽지 못했다.
 *
 * **카카오 개발자센터의 설정과 이 표가 같아야 한다.** 한쪽만 고치면 화면이
 * 말하는 것과 실제로 받는 것이 갈라진다 — 받는 항목은
 * `apps/mobile/src/features/auth/providers.ts`의 `scopes`가 정한다.
 */
export const SIGNUP_PROFILE_FIELDS = [
  { label: '출생 연도', required: true, why: '만 14세 이상인지 확인해요' },
  { label: '프로필 (닉네임 · 사진)', required: true, why: '후기와 제보에 표시해요' },
  { label: '연령대', required: false, why: '출생 연도를 못 받았을 때 대신 확인해요' },
  { label: '생일', required: false, why: '경계 나이일 때만 함께 봐요' },
] as const satisfies readonly { label: string; required: boolean; why: string }[];

/** 화면에 적는 안내 한 줄. 무엇을 위한 절차인지 먼저 말한다. */
export const SIGNUP_COLLECT_NOTICE = '카카오 계정으로 회원가입해요. 받는 정보는 아래와 같아요.';
