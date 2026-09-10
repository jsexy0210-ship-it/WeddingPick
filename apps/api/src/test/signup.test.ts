import { MINIMUM_AGE, REQUIRED_CONSENTS } from '@weddingpick/domain';

import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb('가입 연령과 약관 동의', () => {
  let test: TestApp;

  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  /** 로그인만 한 대기 계정. */
  async function pending(subject = 'apple-pending') {
    return await signInAs(test, subject, { completeSignup: false });
  }

  describe('로그인 다음', () => {
    it('로그인만으로는 가입이 끝나지 않는다', async () => {
      const session = await pending();

      const response = await test.app.inject({
        method: 'GET',
        url: '/v1/me/signup',
        headers: session.headers,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        activated: false,
        // 나이는 로그인이 이미 확인했다. 남은 것은 동의뿐이다.
        ageVerified: true,
        minimumAge: MINIMUM_AGE,
        missingRequired: REQUIRED_CONSENTS,
      });
    });

    it('대기 계정은 다른 화면을 열 수 없다', async () => {
      /*
       * 정책 §N-2가 막으려는 것이 바로 이 상태다. 관문이 라우트마다 있으면
       * 빠뜨린 라우트가 생기므로 requireUser 하나에 둔다.
       */
      const session = await pending();

      const blocked = [
        { method: 'GET' as const, url: '/v1/me' },
        { method: 'POST' as const, url: '/v1/weddings', payload: {} },
        { method: 'GET' as const, url: '/v1/me/settings' },
      ];

      for (const call of blocked) {
        const response = await test.app.inject({ ...call, headers: session.headers });

        expect(response.statusCode).toBe(403);
      }
    });

    it('필수와 선택이 갈라져 내려온다', async () => {
      const session = await pending();

      const response = await test.app.inject({
        method: 'GET',
        url: '/v1/me/signup',
        headers: session.headers,
      });

      const items = response.json<{ items: { item: string; required: boolean }[] }>().items;

      expect(items.filter((item) => item.required).map((item) => item.item)).toEqual(
        REQUIRED_CONSENTS
      );
      expect(items.some((item) => !item.required)).toBe(true);
    });
  });

  describe('만 14세 확인', () => {
    /**
     * **관문은 DB의 `age_verified`다.** 요청 본문이 아니다.
     *
     * 예전에는 본문의 `ageVerified`를 봤는데 앱은 그 자리에 늘 `true`를 넣었다 —
     * 관문이 아니라 통과 버튼이었고, 만 14세 미만 계정이 실제로 그리로 들어왔다
     * (2026-09-10). 지금은 로그인이 확인하고 여기서는 그 결과를 읽기만 한다.
     */

    /** 관문이 생기기 전에 만들어진 계정을 흉내 낸다 — 확인 없이 존재하는 계정. */
    async function unverify(userId: string) {
      await test.pool.query(
        `UPDATE structured.users
         SET age_verified = false, age_verified_at = NULL, age_verified_via = NULL
         WHERE id = $1`,
        [userId]
      );
    }

    it('서버가 확인하지 않은 계정은 가입을 마치지 못한다', async () => {
      const session = await pending();

      await unverify(session.userId);

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: REQUIRED_CONSENTS },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json<{ error: { code: string } }>().error.code).toBe('age_unverified');
    });

    it('본문이 확인했다고 말해도 관문은 열리지 않는다', async () => {
      /*
       * 이 시험이 이 파일의 요점이다. 앱이 보내는 어떤 값도 서버가 확인하지 않은
       * 계정을 통과시키지 못한다 — 계약이 그 필드를 아예 받지 않고, 받더라도
       * 관문이 보는 것은 DB다.
       */
      const session = await pending();

      await unverify(session.userId);

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { ageVerified: true, consents: REQUIRED_CONSENTS },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json<{ error: { code: string } }>().error.code).toBe('age_unverified');

      const { rows } = await test.pool.query<{ activated_at: Date | null }>(
        'SELECT activated_at FROM structured.users WHERE id = $1',
        [session.userId]
      );

      expect(rows[0]?.activated_at).toBeNull();
    });

    it('막힌 계정은 세션까지 끊긴다', async () => {
      const session = await pending();

      await unverify(session.userId);

      await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: REQUIRED_CONSENTS },
      });

      const after = await test.app.inject({
        method: 'GET',
        url: '/v1/me/signup',
        headers: session.headers,
      });

      expect(after.statusCode).toBe(401);
    });

    it('다시 로그인하면 로그인이 판정해서 통과한다', async () => {
      // 「우겨보는 문」이 아니다 — 다시 로그인하면 제공자가 준 연령대로 서버가
      // 판정하고, 14세 이상이면 그때 확인이 남는다.
      const session = await pending();

      await unverify(session.userId);

      const retry = await signInAs(test, 'apple-pending', { completeSignup: false });

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: retry.headers,
        payload: { consents: REQUIRED_CONSENTS },
      });

      expect(response.statusCode).toBe(200);
    });

    it('확인 시점과 경로를 남긴다', async () => {
      const session = await pending();

      const { rows } = await test.pool.query<{
        age_verified: boolean;
        age_verified_at: Date | null;
        age_verified_via: string | null;
      }>(
        `SELECT age_verified, age_verified_at, age_verified_via
         FROM structured.users WHERE id = $1`,
        [session.userId]
      );

      expect(rows[0]?.age_verified).toBe(true);
      expect(rows[0]?.age_verified_at).toBeInstanceOf(Date);
      // 제공자가 준 연령대로 판정했다. 화면이 확인한 것과 구분되어 남는다.
      expect(rows[0]?.age_verified_via).toBe('provider');
    });
  });

  describe('동의', () => {
    it('필수를 다 받아야 계정이 살아난다', async () => {
      const session = await pending();

      const partial = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: [REQUIRED_CONSENTS[0]] },
      });

      expect(partial.statusCode).toBe(400);

      const me = await test.app.inject({ method: 'GET', url: '/v1/me', headers: session.headers });

      expect(me.statusCode).toBe(403);
    });

    it('필수를 다 받으면 서비스가 열린다', async () => {
      const session = await pending();

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: REQUIRED_CONSENTS },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ activated: true, ageVerified: true });

      const me = await test.app.inject({ method: 'GET', url: '/v1/me', headers: session.headers });

      expect(me.statusCode).toBe(200);
    });

    it('선택 항목을 대신 켜주지 않는다', async () => {
      const session = await pending();

      await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: REQUIRED_CONSENTS },
      });

      const { rows } = await test.pool.query<{ item: string }>(
        'SELECT item FROM structured.active_consents WHERE user_id = $1 AND NOT is_required',
        [session.userId]
      );

      expect(rows).toEqual([]);
    });

    it('약관 판과 동의 일시가 남는다', async () => {
      /* v3.13 §N-3. 무엇에, 어느 판에, 언제 동의했는지가 없으면 동의 기록이 아니다. */
      const session = await pending();

      await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: REQUIRED_CONSENTS },
      });

      const { rows } = await test.pool.query<{
        item: string;
        terms_version: string;
        is_required: boolean;
        granted_at: Date;
      }>(
        `SELECT item, terms_version, is_required, granted_at
         FROM structured.active_consents WHERE user_id = $1 ORDER BY item`,
        [session.userId]
      );

      expect(rows).toHaveLength(REQUIRED_CONSENTS.length);

      for (const row of rows) {
        expect(row.terms_version).toBeTruthy();
        expect(row.is_required).toBe(true);
        expect(row.granted_at).toBeInstanceOf(Date);
      }
    });

    it('생년월일을 받지도 저장하지도 않는다', async () => {
      /*
       * v3.13 §3.5. 확인은 제공자의 연령대 또는 화면의 확인 하나로 끝난다 —
       * 생년월일 필드 자체가 없다.
       */
      const session = await pending();

      await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: REQUIRED_CONSENTS },
      });

      const { rows } = await test.pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'structured' AND table_name = 'users'`
      );

      const columns = rows.map((row) => row.column_name);

      expect(columns).not.toContain('birth_date');
      expect(columns).not.toContain('birthday');
      expect(columns).toContain('age_verified');
      expect(columns).toContain('age_verified_at');
      expect(columns).toContain('age_verified_via');
    });

    it('두 번 보내도 동의가 겹치지 않는다', async () => {
      const session = await pending();
      const payload = { consents: REQUIRED_CONSENTS };

      await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload,
      });

      const again = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload,
      });

      expect(again.statusCode).toBe(200);

      const { rows } = await test.pool.query(
        'SELECT 1 FROM structured.active_consents WHERE user_id = $1',
        [session.userId]
      );

      expect(rows).toHaveLength(REQUIRED_CONSENTS.length);
    });
  });
});
