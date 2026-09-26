import { ACTIVATION_CONSENTS, CONSENT_ITEMS, MINIMUM_AGE, REQUIRED_CONSENTS } from '@weddingpick/domain';

import { z } from 'zod';

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
        /*
         * 계정을 살리는 관문은 필수 다섯 전부다(2026-09-26 대표 결정 「강제한다」).
         * `missingRequired`는 옛 앱이 아는 항목만 담고(옛 앱 zod 호환), 전부는 `missingAgreements`다.
         */
        missingRequired: ['terms', 'privacy'],
        missingAgreements: ACTIVATION_CONSENTS,
      });
      expect(ACTIVATION_CONSENTS).toEqual(REQUIRED_CONSENTS);
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

      const body = response.json<{
        items: { item: string; required: boolean }[];
        agreements: { item: string; required: boolean }[];
      }>();

      expect(body.agreements.filter((item) => item.required).map((item) => item.item)).toEqual(
        REQUIRED_CONSENTS
      );
      expect(body.agreements.some((item) => !item.required)).toBe(true);
      /* 옛 앱이 읽는 `items`에는 옛 셋만 — 새 항목이 섞이면 옛 앱의 계약 검사가 응답을 버린다. */
      expect(body.items.map((item) => item.item)).toEqual(['terms', 'privacy', 'marketing']);
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

  /**
   * v3.29 약관 동의(WP-AUTH-010)의 여덟 칸(2026-09-26 대표 감사 8). 화면이 받은 동의가
   * 전부 항목 · 판 · 필수 여부 · 시각으로 남는지, 옛 앱의 세 항목 요청도 그대로
   * 통하는지를 본다.
   */
  describe('약관 동의 여덟 칸', () => {
    const ALL = [
      'age', 'terms', 'privacy', 'pick_certification', 'consultation_recording',
      'contact_share', 'marketing', 'night_alerts',
    ];

    it('여덟 칸 모두 항목 · 판 · 필수 여부로 남는다', async () => {
      const session = await pending('kakao-eight');

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: ALL },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ activated: true, missingRequired: [] });

      const { rows } = await test.pool.query<{
        item: string;
        terms_version: string;
        is_required: boolean;
        granted_at: Date;
      }>(
        'SELECT item, terms_version, is_required, granted_at FROM structured.active_consents WHERE user_id = $1',
        [session.userId]
      );

      expect(rows.map((row) => row.item).sort()).toEqual([...ALL].sort());

      for (const row of rows) {
        const definition = CONSENT_ITEMS.find((item) => item.key === row.item);
        expect(definition).toBeDefined();
        expect(row.terms_version).toBe(definition?.version);
        expect(row.is_required).toBe(definition?.required);
        expect(row.granted_at).toBeInstanceOf(Date);
      }

      /* 필수 다섯은 is_required=true로 남는다 — 화면이 받던 성격 그대로. */
      expect(rows.filter((row) => row.is_required).map((row) => row.item).sort()).toEqual(
        ['age', 'consultation_recording', 'pick_certification', 'privacy', 'terms']
      );
    });

    it('가입 상태가 여덟 칸의 동의 시각을 돌려준다', async () => {
      const session = await pending('kakao-eight-state');

      await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: ALL },
      });

      const state = await test.app.inject({ method: 'GET', url: '/v1/me/signup', headers: session.headers });
      const body = state.json<{
        items: { item: string; grantedAt: string | null }[];
        agreements: { item: string; required: boolean; grantedAt: string | null }[];
      }>();

      expect(body.agreements.map((item) => item.item).sort()).toEqual([...ALL].sort());
      expect(body.agreements.every((item) => item.grantedAt !== null)).toBe(true);

      /*
       * 옛 앱의 계약(`items[].item`이 terms · privacy · marketing 셋 중 하나)으로 읽어도
       * 응답이 통과한다 — 새 칸 `agreements`는 옛 zod가 모르는 칸이라 버린다.
       */
      const legacy = z.object({
        activated: z.boolean(),
        items: z.array(z.object({ item: z.enum(['terms', 'privacy', 'marketing']) })),
        missingRequired: z.array(z.enum(['terms', 'privacy', 'marketing'])),
      });
      expect(legacy.safeParse(state.json()).success).toBe(true);
      expect(body.items.every((item) => item.grantedAt !== null)).toBe(true);
    });

    it('글이 공개된 항목은 그 판을 가리키고, 글이 없거나 초안이면 비워 둔다', async () => {
      const session = await pending('kakao-eight-version');

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: ALL },
      });

      /* 항목 이름을 그대로 terms_doc_kind로 바꾸면 pick_certification에서 쿼리가 터진다. */
      expect(response.statusCode).toBe(200);

      const { rows } = await test.pool.query<{ item: string; terms_version_id: string | null; doc: string | null }>(
        `SELECT c.item, c.terms_version_id, v.doc::text AS doc
         FROM structured.user_consents c
         LEFT JOIN structured.terms_versions v ON v.id = c.terms_version_id
         WHERE c.user_id = $1`,
        [session.userId]
      );
      const byItem = new Map(rows.map((row) => [row.item, row]));

      expect(byItem.get('age')?.terms_version_id).toBeNull();
      expect(byItem.get('night_alerts')?.terms_version_id).toBeNull();

      for (const [item, doc] of [
        ['terms', 'terms'],
        ['privacy', 'privacy'],
        ['marketing', 'marketing'],
        ['pick_certification', 'pick_verification'],
        ['consultation_recording', 'consultation_recording'],
        ['contact_share', 'contact_sharing'],
      ] as const) {
        const published = await test.pool.query<{ id: string }>(
          `SELECT id FROM structured.terms_versions
           WHERE doc = $1::terms_doc_kind AND published_at IS NOT NULL
           ORDER BY published_at DESC LIMIT 1`,
          [doc]
        );
        const expected = published.rows[0]?.id ?? null;

        expect(byItem.get(item)?.terms_version_id ?? null).toBe(expected);
        if (expected !== null) expect(byItem.get(item)?.doc).toBe(doc);
      }
    });

    /*
     * 2026-09-26 대표 결정 「강제한다」 — 필수 다섯이 모두 관문이다. 옛 앱이 보내는
     * terms · privacy(· marketing)만으로는 가입이 끝나지 않는다. 받은 동의는 남기고
     * 활성화만 하지 않는다.
     */
    it('옛 앱이 보내는 terms · privacy · marketing만으로는 가입이 끝나지 않는다(400)', async () => {
      const session = await pending('kakao-legacy');

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: ['terms', 'privacy', 'marketing'] },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: 'invalid_request', message: '필수 항목에 동의해야 가입이 끝나요' },
      });

      /* 활성화되지 않았다 — 보호된 화면은 여전히 닫혀 있다. */
      const me = await test.app.inject({ method: 'GET', url: '/v1/me', headers: session.headers });
      expect(me.statusCode).toBe(403);

      /* 받은 동의는 남긴다. 빠진 필수 셋이 가입 상태에 보인다. */
      const state = await test.app.inject({ method: 'GET', url: '/v1/me/signup', headers: session.headers });
      expect(state.json()).toMatchObject({
        activated: false,
        missingRequired: [],
        missingAgreements: ['age', 'pick_certification', 'consultation_recording'],
      });
    });

    it.each(['age', 'terms', 'privacy', 'pick_certification', 'consultation_recording'])(
      '필수 %s 하나만 빠져도 400이고 활성화하지 않는다',
      async (missing) => {
        const session = await pending(`kakao-missing-${missing}`);

        const response = await test.app.inject({
          method: 'POST',
          url: '/v1/me/signup',
          headers: session.headers,
          payload: { consents: ALL.filter((item) => item !== missing) },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({ error: { message: '필수 항목에 동의해야 가입이 끝나요' } });

        const state = await test.app.inject({ method: 'GET', url: '/v1/me/signup', headers: session.headers });
        expect(state.json()).toMatchObject({ activated: false, missingAgreements: [missing] });
      }
    );

    it('선택 셋은 빼도 필수 다섯이면 가입이 끝난다', async () => {
      const session = await pending('kakao-required-only');

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: REQUIRED_CONSENTS },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ activated: true, missingRequired: [], missingAgreements: [] });
    });

    it('가입 전 상태 응답은 옛 앱의 계약으로도 읽힌다 — 배포 사이 옛 화면이 멈추지 않게', async () => {
      const session = await pending('kakao-legacy-read');

      const state = await test.app.inject({ method: 'GET', url: '/v1/me/signup', headers: session.headers });
      const legacy = z.object({
        activated: z.boolean(),
        items: z.array(z.object({ item: z.enum(['terms', 'privacy', 'marketing']) })),
        missingRequired: z.array(z.enum(['terms', 'privacy', 'marketing'])),
      });

      expect(legacy.safeParse(state.json()).success).toBe(true);
      /* 새 앱은 서버가 알려 주는 여덟 칸으로 필수 다섯을 모두 보낸다(`acceptedSignupItems`). */
      expect(state.json<{ agreements: { item: string }[] }>().agreements.map((item) => item.item)).toEqual(
        expect.arrayContaining(REQUIRED_CONSENTS)
      );
    });

    it('계약에 없는 항목은 거절한다', async () => {
      const session = await pending('kakao-unknown');

      const response = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: ['terms', 'privacy', 'benefit_alerts'] },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
