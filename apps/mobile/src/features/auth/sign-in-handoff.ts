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
 * 아니라 WP-AUTH-010(이용 불가 안내)으로 간다.
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

/** WP-AUTH-010. 로그인 화면(`app/login/age-required.tsx`)과 같은 경로여야 한다. */
export const AGE_REQUIRED_ROUTE = '/login/age-required' as const;
