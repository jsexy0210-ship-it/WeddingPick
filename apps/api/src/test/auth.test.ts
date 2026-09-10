import type { IdentityProvider, VerifiedIdentity } from '../auth/identity-provider';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/** 인가 코드 교환을 부르지 않고 신원을 정해준다. 카카오 꼴(authorization_code)이다. */
function fakeCodeProvider(identity: VerifiedIdentity): IdentityProvider {
  return { flow: 'authorization_code', verify: async () => identity };
}

/**
 * 만 14세 관문. 핸드오프 v3.22 SPEC 3.5 · 2026-09-10 사용자 지시.
 *
 * ```
 * 연령대 있음 · 14세 이상   통과 · via 'provider'
 * 연령대 있음 · 미달        계정 없음 · 403 under_age
 * 연령대 없음 · 화면 확인 O 통과 · via 'self_declared'
 * 연령대 없음 · 화면 확인 X 계정 없음 · 403 age_unverified
 * ```
 *
 * 마지막 줄이 이 파일이 새로 못박는 것이다. 예전 시험은 「연령대가 없으면 체크박스가
 * 그대로 판정한다」며 **무확인 통과를 정상으로 적어두고 있었다** — 판정할 체크박스가
 * 사라진 뒤에도 그 시험은 초록이었고, 그래서 구멍을 아무도 못 봤다.
 *
 * 그리고 **나이를 저장하지 않는다** — 남는 것은 age_verified · age_verified_at ·
 * age_verified_via 셋뿐이고, 연령대 문자열은 그중에 없다.
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

  /** `ageAcknowledged`를 넘기지 않으면 화면의 확인을 받지 못한 것이다 — 기본값이 통과가 아니다. */
  const signIn = (ageAcknowledged?: boolean) =>
    test.app.inject({
      method: 'POST',
      url: '/v1/auth/sessions',
      payload: {
        provider: 'kakao',
        authorizationCode: 'code',
        state: 'state',
        redirectUri: 'https://example.test/setup',
        ...(ageAcknowledged === undefined ? {} : { ageAcknowledged }),
      },
    });

  async function userRow(userId: string) {
    const { rows } = await test.pool.query<{
      age_verified: boolean;
      age_verified_at: Date | null;
      age_verified_via: string | null;
      age_gate: string;
    }>(
      `SELECT age_verified, age_verified_at, age_verified_via, age_gate
       FROM structured.users WHERE id = $1`,
      [userId]
    );

    return rows[0]!;
  }

  /** 계정도 소셜 신원도 세션도 만들어지지 않았는가. */
  async function nothingCreated() {
    const counts = await test.pool.query<{ users: string; identities: string; sessions: string }>(
      `SELECT (SELECT count(*) FROM structured.users) AS users,
              (SELECT count(*) FROM identity.identities) AS identities,
              (SELECT count(*) FROM identity.sessions) AS sessions`
    );

    return counts.rows[0];
  }

  it('14세 이상이면 화면에 묻지 않고 확인이 끝난다', async () => {
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
    // 무엇이 확인했는지 남는다. 화면이 아니라 제공자다.
    expect(user.age_verified_via).toBe('provider');
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
    expect(await nothingCreated()).toEqual({ users: '0', identities: '0', sessions: '0' });
  });

  it('미달로 판정되면 화면이 확인했다고 해도 막힌다', async () => {
    kakaoWith('10~14');

    // 앱이 «확인했다»를 보내도 제공자의 판정을 뒤집지 못한다. 이 줄이 요점이다 —
    // 클라이언트가 열 수 있는 관문은 관문이 아니다.
    const response = await signIn(true);

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('under_age');
    expect(await nothingCreated()).toEqual({ users: '0', identities: '0', sessions: '0' });
  });

  it('연령대가 없고 화면 확인도 없으면 계정을 만들지 않는다', async () => {
    kakaoWith(undefined);

    const response = await signIn();

    expect(response.statusCode).toBe(403);
    // 미달로 «확인된» 것이 아니다. 확인 자체가 없었다는 뜻의 다른 코드다.
    expect(response.json<{ error: { code: string } }>().error.code).toBe('age_unverified');
    expect(await nothingCreated()).toEqual({ users: '0', identities: '0', sessions: '0' });
  });

  it('연령대가 없어도 화면에서 확인하면 통과하고 그 경로가 남는다', async () => {
    kakaoWith(undefined);

    const response = await signIn(true);
    const body = response.json<{ userId: string; ageVerified: boolean }>();

    expect(response.statusCode).toBe(201);
    expect(body.ageVerified).toBe(true);

    const user = await userRow(body.userId);

    expect(user.age_verified).toBe(true);
    // 제공자가 판정한 것과 **구분되어** 남는다. 나중에 가려낼 수 있어야 한다.
    expect(user.age_verified_via).toBe('self_declared');
  });

  it('확인값이 false면 확인하지 않은 것과 같다', async () => {
    kakaoWith(undefined);

    const response = await signIn(false);

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('age_unverified');
    expect(await nothingCreated()).toEqual({ users: '0', identities: '0', sessions: '0' });
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
