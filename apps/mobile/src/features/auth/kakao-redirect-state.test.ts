import { KAKAO_AUTH_REQUEST_TTL_MS, validateKakaoRedirect } from './kakao-redirect-state';

const now = 1_000_000;
const redirectUri = 'https://app.example.test/setup';
const pending = {
  state: 'expected-state', codeVerifier: 'v'.repeat(43), redirectUri, startedAt: now - 1,
};
const validate = (value: unknown = pending, state: string | null = pending.state, code: string | null = 'code') =>
  validateKakaoRedirect(JSON.stringify(value), state, code, redirectUri, now);

describe('카카오 callback 요청 검증', () => {
  it('정상 요청은 PKCE와 복귀 주소를 유지한다', () => expect(validate()).toEqual(pending));
  it('사람이 전달한 연령 확인 값만 보존한다', () => {
    expect(validate({ ...pending, ageAcknowledged: true }).ageAcknowledged).toBe(true);
    expect(validate().ageAcknowledged).toBeUndefined();
  });
  it.each([null, [], 'text', 4, {}, { ...pending, codeVerifier: undefined },
    { ...pending, codeVerifier: 'short' }, { ...pending, codeVerifier: 'v'.repeat(129) },
    { ...pending, redirectUri: 'https://other.example.test/setup' },
    { ...pending, startedAt: '1' }, { ...pending, ageAcknowledged: 'true' },
  ])('잘못된 저장값 %p는 차단한다', (value) => expect(() => validate(value)).toThrow());
  it('JSON 오류와 누락 요청을 사용자 오류로 처리한다', () => {
    expect(() => validateKakaoRedirect('{', pending.state, 'code', redirectUri, now)).toThrow();
    expect(() => validateKakaoRedirect(null, pending.state, 'code', redirectUri, now)).toThrow();
  });
  it('만료 경계와 미래 시각을 차단한다', () => {
    expect(() => validate({ ...pending, startedAt: now - KAKAO_AUTH_REQUEST_TTL_MS })).toThrow();
    expect(() => validate({ ...pending, startedAt: now + 1 })).toThrow();
    expect(validate({ ...pending, startedAt: now - KAKAO_AUTH_REQUEST_TTL_MS + 1 })).toBeDefined();
  });
  it.each([null, '', 'other-state'])('state %p는 차단한다', (state) => {
    expect(() => validate(pending, state)).toThrow();
  });
  it.each([null, '', '   '])('code %p는 차단한다', (code) => {
    expect(() => validate(pending, pending.state, code)).toThrow();
  });
});
