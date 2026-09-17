/** 카카오 웹 인증 요청 검증. 외부 SDK와 저장소에 의존하지 않는다. */
export const KAKAO_AUTH_REQUEST_KEY = 'weddingpick.kakaoAuthRequest.v1';
export const KAKAO_AUTH_REQUEST_TTL_MS = 10 * 60 * 1000;

export type PendingKakaoRedirect = {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  startedAt: number;
  ageAcknowledged?: boolean;
};

/** 저장소의 JSON도 신뢰하지 않는다. 교환 전에 형식·수명·state·복귀 주소를 확인한다. */
export function validateKakaoRedirect(
  raw: string | null,
  state: string | null,
  code: string | null,
  expectedRedirectUri: string,
  now = Date.now()
): PendingKakaoRedirect {
  if (!raw) throw new Error('로그인 요청 정보가 없어요. 다시 시도해 주세요.');

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('로그인 요청을 확인하지 못했어요. 다시 시도해 주세요.');
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('로그인 요청을 확인하지 못했어요. 다시 시도해 주세요.');
  }

  const pending = value as Record<string, unknown>;
  if (
    typeof pending.state !== 'string' || pending.state.length === 0 || pending.state.length > 512 ||
    typeof pending.codeVerifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(pending.codeVerifier) ||
    typeof pending.redirectUri !== 'string' || pending.redirectUri !== expectedRedirectUri ||
    typeof pending.startedAt !== 'number' || !Number.isFinite(pending.startedAt) ||
    (pending.ageAcknowledged !== undefined && typeof pending.ageAcknowledged !== 'boolean')
  ) {
    throw new Error('로그인 요청을 확인하지 못했어요. 다시 시도해 주세요.');
  }

  if (!Number.isFinite(now) || now < pending.startedAt || now - pending.startedAt >= KAKAO_AUTH_REQUEST_TTL_MS) {
    throw new Error('로그인 요청 시간이 지났어요. 다시 시도해 주세요.');
  }
  if (!state || state !== pending.state) {
    throw new Error('로그인 요청이 맞지 않아요. 다시 시도해 주세요.');
  }
  if (!code || code.trim().length === 0) {
    throw new Error('로그인 인증 코드가 없어요. 다시 시도해 주세요.');
  }

  return {
    state: pending.state,
    codeVerifier: pending.codeVerifier,
    redirectUri: pending.redirectUri,
    startedAt: pending.startedAt,
    ...(typeof pending.ageAcknowledged === 'boolean' ? { ageAcknowledged: pending.ageAcknowledged } : {}),
  };
}
