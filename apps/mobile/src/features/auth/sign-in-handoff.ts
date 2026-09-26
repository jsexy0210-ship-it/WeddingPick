import { ApiError } from '@/api/client';

/**
 * 부팅(app/_layout.tsx)이 카카오 리다이렉트를 마무리하다 실패했을 때, 그 이유를
 * 로그인 화면에 넘기는 손잡이. 화면은 뜨자마자 한 번 꺼내 실패 시트를 띄운다.
 *
 * 모듈 변수다 — 같은 부팅 안에서 한 번 넘기고 끝이라 저장소까지 갈 이유가 없다.
 */
let pendingError: string | null = null;

export function setPendingSignInError(message: string): void {
  pendingError = message;
}

export function takePendingSignInError(): string | null {
  const message = pendingError;

  pendingError = null;

  return message;
}

/**
 * 「카카오로 로그인하는 중이에요」를 **누가 말하는가**.
 *
 * 부팅 화면(`SigningInView`)과 로그인 화면(`SigningInBody`)이 같은 문장을 들고 있어서,
 * 카카오에서 돌아온 한 번의 로그인에 문장이 두 번 나왔다(2026-09-09 사용자 보고).
 *
 * v3.25는 로그인 화면에 `!hasKakaoReturn()` 가드를 달아 막으려 했는데 그게 듣지 않았다 —
 * **`completeKakaoRedirect()`가 URL에서 `code`를 지우는 것이 먼저다.** 지운 뒤에는
 * `hasKakaoReturn()`이 false가 되어 가드가 풀리고, 로그인 화면이 같은 말을 다시 한다.
 * 네이티브는 URL이 없어 애초에 늘 false였다.
 *
 * 그래서 URL이 아니라 **깃발**로 정한다. 부팅이 카카오 복귀를 발견하면 이 페이지가
 * 살아 있는 동안 문장을 계속 맡는다 — 교환에 실패해 로그인 화면으로 떨어져도 거기서는
 * 실패 시트가 말하지, 진행 문구가 다시 나오지 않는다.
 */
let bootOwnsMessage = false;

export function claimSigningInMessageForBoot(): void {
  bootOwnsMessage = true;
}

export function bootOwnsSigningInMessage(): boolean {
  return bootOwnsMessage;
}

/**
 * 서버가 만 14세 미만으로 판정했다(`under_age`, v3.22 SPEC 3.5). 실패 시트가
 * 아니라 WP-AUTH-009(이용 불가 안내)으로 간다.
 *
 * 부팅 경로는 실패를 **문장 하나**로만 넘기므로(`setPendingSignInError`), 그
 * 경로에서도 알아볼 수 있게 정해진 문장을 쓴다. 카카오 제공자(`providers.ts`)가
 * `ApiError`를 이 문장으로 바꿔 던지고, 로그인 훅은 둘 다 알아본다.
 */
export const UNDER_AGE_SIGN_IN_MESSAGE = '만 14세부터 이용할 수 있어요';

export function isUnderAgeSignInError(error: unknown): boolean {
  if (error instanceof ApiError) return error.code === 'under_age';

  return error instanceof Error && error.message === UNDER_AGE_SIGN_IN_MESSAGE;
}

/** WP-AUTH-009. 로그인 화면(`app/login/age-required.tsx`)과 같은 경로여야 한다. */
export const AGE_REQUIRED_ROUTE = '/login/age-required' as const;

/**
 * 서버가 나이를 **확인하지 못했다**(`age_unverified`, 2026-09-10). 미달로 확인된
 * 것과 다르다 — 카카오가 연령대를 주지 않아 판정할 근거가 없었다는 뜻이다.
 *
 * 이때는 WP-AUTH-009(이용 불가)으로 보내지 않는다. 그 화면은 「만 14세가 되면」을
 * 말하는데, 이 사람은 미달이라고 확인된 적이 없다. 로그인 화면이 «만 14세
 * 이상이에요» 확인을 한 번 받고 다시 시도한다.
 *
 * 부팅 경로는 실패를 **문장 하나**로만 넘기므로(`setPendingSignInError`) 여기서도
 * 정해진 문장을 쓴다 — `UNDER_AGE_SIGN_IN_MESSAGE`와 같은 방식이다.
 */
export const AGE_UNVERIFIED_SIGN_IN_MESSAGE = '만 14세 이상인지 확인하면 시작할 수 있어요';

export function isAgeUnverifiedSignInError(error: unknown): boolean {
  if (error instanceof ApiError) return error.code === 'age_unverified';

  return error instanceof Error && error.message === AGE_UNVERIFIED_SIGN_IN_MESSAGE;
}

/**
 * 방금 «가입 전(활성화 전)»을 확인했다 — 약관 동의 화면(`app/login/consent.tsx`)이
 * **로더 없이 바로 서게** 하는 손잡이(2026-09-26 대표 감사 4).
 *
 * 로그인 → 약관 동의로 넘어갈 때 로더가 두 번 떴다. 부팅(`SigningInView`)이나
 * 로그인 화면이 «카카오로 로그인하는 중이에요»를 보이며 이미 `activated: false`를
 * 확인했는데(세션 응답 · `GET /v1/me/signup`), 약관 동의 화면이 같은 것을 다시 물으며
 * 제 로더(`DelayedLoader`, 700ms 뒤 뼈대)를 한 번 더 세웠다. `/v1/me/signup`은
 * 캐시하지 않는 주소라(`api/client.ts` `NEVER_CACHED`) 그 물음은 늘 서버까지 간다.
 *
 * 이제 앞 단계가 «가입 전»을 확인하면 이 깃발을 세우고, 약관 동의 화면은 깃발이
 * 싱싱하면 폼을 곧바로 그린다. **다시 묻는 것은 그대로다** — 뒤에서 물어, 이미
 * 활성화된 계정이면 초기 설정으로 넘기고 서버가 아는 동의 항목을 읽는다. 깃발은
 * 로더를 세울지만 정한다. 판정은 여전히 서버가 한다.
 */
const SIGNUP_PENDING_FRESH_MS = 60_000;
let signupPendingAt = 0;

export function noteSignupPending(now: number = Date.now()): void {
  signupPendingAt = now;
}

export function hasFreshSignupPending(now: number = Date.now()): boolean {
  return signupPendingAt > 0 && now - signupPendingAt <= SIGNUP_PENDING_FRESH_MS;
}

/** 한 번 쓰고 버린다 — 다음 진입(다시 시도 · 재방문)은 서버 답을 기다린다. */
export function clearSignupPending(): void {
  signupPendingAt = 0;
}

/**
 * 약관 동의 제출이 방금 가입을 마쳤다(`POST /v1/me/signup` 응답 `activated: true`) — 온보딩
 * (`app/setup.tsx`)이 같은 것을 다시 묻지 않게 하는 손잡이(2026-09-26 대표 지시 「약관 동의 →
 * 온보딩 이동 시 로딩 … 로딩 시간을 대폭 감축한다」).
 *
 * 온보딩은 들어서며 가입 상태(`GET /v1/me/signup`, 캐시하지 않는 주소)를 물은 **뒤에** 내 정보
 * (`GET /v1/me`)를 물었다 — 방금 받은 답을 한 번 더 기다리는 직렬 왕복이었다. 이 깃발이 싱싱하면
 * 가입 상태 물음을 건너뛴다. **저장(«완료»)할 때 다시 묻는 것은 그대로다** — 판정은 서버가 한다.
 */
let signupActivatedAt = 0;

export function noteSignupActivated(now: number = Date.now()): void {
  signupActivatedAt = now;
}

/** 한 번 쓰고 버린다. */
export function takeFreshSignupActivated(now: number = Date.now()): boolean {
  const fresh = signupActivatedAt > 0 && now - signupActivatedAt <= SIGNUP_PENDING_FRESH_MS;

  signupActivatedAt = 0;

  return fresh;
}
