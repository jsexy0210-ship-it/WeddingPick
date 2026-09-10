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
        /*
         * **나이는 이미 확인됐다.** 로그인 때 제공자 연령대로 끝난다 — 확인하지
         * 못했으면 여기까지 오지도 못한다(로그인이 403 age_unverified). 남은 것은
         * 동의뿐이고, 그래서 `activated`만 false다.
         */
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

  /**
   * 만 14세 확인.
   *
   * **여기 있던 시험 셋이 요청 본문의 `ageVerified`를 보고 있었다.** 그 시절에는
   * 맞았다 — 로그인 화면에 체크박스가 있었고 그 값이 본문에 실려 왔다. 핸드오프
   * v3.24가 체크박스를 없앴고, 그 뒤로 앱은 그 자리에 **늘 `true`를 넣는다**
   * (`setup.tsx` — 넣을 다른 값이 없다). 시험은 `false`를 직접 만들어 넣어
   * 통과했지만, 실제로는 아무도 `false`를 보내지 않으므로 이 관문은 **누구도
   * 막지 못하는 상태**였다.
   *
   * 지금은 서버가 로그인 때 카카오 연령대로 확인하고 적어둔 값을 본다. 그래서
   * 여기서 만드는 「막힌 계정」도 본문이 아니라 **그 값을 지워서** 만든다.
   */
  describe('만 14세 확인', () => {
    /** 서버가 나이를 확인하지 못한 상태로 되돌린다. */
    async function unverify(userId: string) {
      await test.pool.query(
        'UPDATE structured.users SET age_verified = false, age_verified_at = NULL WHERE id = $1',
        [userId]
      );
    }

    it('확인되지 않았으면 가입할 수 없다', async () => {
      const session = await pending();

      await unverify(session.userId);

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        // 클라이언트가 «확인했다»고 말해도 소용없다 — 서버가 확인한 것만 본다.
        payload: { ageVerified: true, consents: REQUIRED_CONSENTS },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json<{ error: { message: string } }>().error.message).toContain(
        `만 ${MINIMUM_AGE}세`
      );
    });

    it('막힌 계정은 세션까지 끊긴다', async () => {
      const session = await pending();

      await unverify(session.userId);

      await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { ageVerified: true, consents: REQUIRED_CONSENTS },
      });

      const after = await test.app.inject({
        method: 'GET',
        url: '/v1/me/signup',
        headers: session.headers,
      });

      expect(after.statusCode).toBe(401);
    });

    it('연령대가 확인되면 다시 로그인해서 통과한다', async () => {
      // 우겨서 여는 문이 아니다 — 제공자가 나이를 주면 그냥 통과한다.
      const session = await pending();

      await unverify(session.userId);

      await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { ageVerified: true, consents: REQUIRED_CONSENTS },
      });

      const retry = await signInAs(test, 'apple-pending', { completeSignup: false });

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: retry.headers,
        payload: { ageVerified: true, consents: REQUIRED_CONSENTS },
      });

      expect(response.statusCode).toBe(200);
    });

    it('확인 시점을 남긴다', async () => {
      const session = await pending();

      await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { ageVerified: true, consents: REQUIRED_CONSENTS },
      });

      const { rows } = await test.pool.query<{
        age_verified: boolean;
        age_verified_at: Date | null;
      }>('SELECT age_verified, age_verified_at FROM structured.users WHERE id = $1', [
        session.userId,
      ]);

      expect(rows[0]?.age_verified).toBe(true);
      expect(rows[0]?.age_verified_at).toBeInstanceOf(Date);
    });
  });

  describe('동의', () => {
    it('필수를 다 받아야 계정이 살아난다', async () => {
      const session = await pending();

      const partial = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { ageVerified: true, consents: [REQUIRED_CONSENTS[0]] },
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
        payload: { ageVerified: true, consents: REQUIRED_CONSENTS },
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
        payload: { ageVerified: true, consents: REQUIRED_CONSENTS },
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
        payload: { ageVerified: true, consents: REQUIRED_CONSENTS },
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
       * v3.13 §3.5. 로그인 화면의 체크박스 하나가 확인의 전부다 — 생년월일
       * 필드 자체가 없다.
       */
      const session = await pending();

      await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { ageVerified: true, consents: REQUIRED_CONSENTS },
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
    });

    it('두 번 보내도 동의가 겹치지 않는다', async () => {
      const session = await pending();
      const payload = { ageVerified: true, consents: REQUIRED_CONSENTS };

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
