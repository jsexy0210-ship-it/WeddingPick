import { REQUIRED_CONSENTS } from '@weddingpick/domain';

import type { IdentityProvider, VerifiedIdentity } from '../auth/identity-provider';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/** 인가 코드 교환을 부르지 않고 신원을 정해준다. 카카오 꼴(authorization_code)이다. */
function fakeCodeProvider(identity: VerifiedIdentity): IdentityProvider {
  return { flow: 'authorization_code', verify: async () => identity };
}

/**
 * 카카오 연령대. 핸드오프 v3.22 SPEC 3.5 «카카오에서 받는 것».
 *
 * ```
 * age_range 있음    14세 이상 → 체크박스 없이 통과 · 미만 → WP-AUTH-009
 * age_range 없음    체크박스 그대로
 * ```
 *
 * 그리고 **나이를 저장하지 않는다** — 남는 것은 age_verified · age_verified_at뿐이다.
 */
describeWithDb('카카오 연령대', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  function kakaoWith(ageRange?: string, subject = 'kakao-user-1') {
    test.context.providers.kakao = fakeCodeProvider({
      provider: 'kakao',
      subject,
      profile: { nickname: '웨픽', ...(ageRange === undefined ? {} : { ageRange }) },
    });
  }

  const signIn = () =>
    test.app.inject({
      method: 'POST',
      url: '/v1/auth/sessions',
      payload: {
        provider: 'kakao',
        authorizationCode: 'code',
        state: 'state',
        redirectUri: 'https://example.test/setup',
      },
    });

  async function userRow(userId: string) {
    const { rows } = await test.pool.query<{
      age_verified: boolean;
      age_verified_at: Date | null;
      age_gate: string;
    }>('SELECT age_verified, age_verified_at, age_gate FROM structured.users WHERE id = $1', [userId]);

    return rows[0]!;
  }

  it('14세 이상이면 체크박스 없이 확인이 끝난다', async () => {
    kakaoWith('20~29');

    const response = await signIn();
    const body = response.json<{ userId: string; ageVerified: boolean; activated: boolean }>();

    expect(response.statusCode).toBe(201);
    expect(body.ageVerified).toBe(true);
    // 확인은 끝났지만 가입(동의)은 아직이다 — 둘은 다른 일이다.
    expect(body.activated).toBe(false);

    const user = await userRow(body.userId);

    expect(user.age_verified).toBe(true);
    expect(user.age_verified_at).toBeInstanceOf(Date);
    expect(user.age_gate).toBe('passed');
  });

  it('연령대는 어디에도 남지 않는다', async () => {
    kakaoWith('20~29');

    const { userId } = (await signIn()).json<{ userId: string }>();

    const { rows } = await test.pool.query<{ age_range: string | null; birth_year: string | null }>(
      'SELECT age_range, birth_year FROM identity.identities WHERE user_id = $1',
      [userId]
    );

    expect(rows[0]).toEqual({ age_range: null, birth_year: null });
  });

  it('14세 미만이면 계정을 만들지 않고 under_age로 답한다', async () => {
    kakaoWith('10~14');

    const response = await signIn();

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('under_age');

    // 아무것도 만들지 않았다 — 계정도, 소셜 신원도, 세션도.
    const counts = await test.pool.query<{ users: string; identities: string; sessions: string }>(
      `SELECT (SELECT count(*) FROM structured.users) AS users,
              (SELECT count(*) FROM identity.identities) AS identities,
              (SELECT count(*) FROM identity.sessions) AS sessions`
    );

    expect(counts.rows[0]).toEqual({ users: '0', identities: '0', sessions: '0' });
  });

  it('연령대가 없으면 체크박스가 그대로 판정한다', async () => {
    kakaoWith(undefined);

    const response = await signIn();
    const body = response.json<{ userId: string; ageVerified: boolean; token: string }>();

    expect(response.statusCode).toBe(201);
    expect(body.ageVerified).toBe(false);
    expect((await userRow(body.userId)).age_verified).toBe(false);

    // 체크박스를 켜고 가입을 마치면 그때 확인된다 — 예전 흐름 그대로.
    const signup = await test.app.inject({
      method: 'POST',
      url: '/v1/me/signup',
      headers: { authorization: `Bearer ${body.token}` },
      payload: { ageVerified: true, consents: REQUIRED_CONSENTS },
    });

    expect(signup.statusCode).toBe(200);
    expect((await userRow(body.userId)).age_verified).toBe(true);
  });

  it('이미 확인된 계정의 확인 시점은 다시 로그인해도 바뀌지 않는다', async () => {
    kakaoWith('20~29');

    const first = (await signIn()).json<{ userId: string }>();
    const before = (await userRow(first.userId)).age_verified_at;

    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = (await signIn()).json<{ userId: string }>();

    expect(second.userId).toBe(first.userId);
    expect((await userRow(first.userId)).age_verified_at).toEqual(before);
  });
});
