import {
  MISSION_COMPLETE_REWARD_NOTIFICATION,
  MONTHLY_DRAW_CONDITION_LABEL,
  MONTHLY_DRAW_ENTERED_NOTIFICATION,
  REWARDS,
} from '@weddingpick/domain';

import {
  consentToPaymentProofs,
  createTestApp,
  createWedding,
  resetDatabase,
  signInAs,
  type TestApp,
} from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 이벤트 보상. 최종통합정책 v2.0 I장.
 *
 * 요점 둘 — 가입만으로는 주지 않는다는 것(K-7), 그리고 조건이 찬 것과 돈이 간
 * 것이 다른 상태라는 것.
 */
describeWithDb('이벤트 보상', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function codeOf(headers: Record<string, string>) {
    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/me/rewards',
      headers,
    });

    return response.json<{ referralCode: string }>().referralCode;
  }

  const redeem = (headers: Record<string, string>, code: string) =>
    test.app.inject({
      method: 'POST',
      url: '/v1/referrals/redeem',
      headers,
      payload: { code },
    });

  async function registerProof(headers: Record<string, string>, merchantName = '가온예식홀') {
    await consentToPaymentProofs(test, headers);

    return await test.app.inject({
      method: 'POST',
      url: '/v1/payment-proofs',
      headers,
      payload: {
        merchantName,
        paidAmount: 3_000_000,
        paidAt: '2026-05-20T04:00:00.000Z',
        method: 'card',
      },
    });
  }

  const rewards = (headers: Record<string, string>) =>
    test.app.inject({ method: 'GET', url: '/v1/me/rewards', headers });

  describe('친구초대', () => {
    it('코드는 물어볼 때 만들어지고 그대로 남는다', async () => {
      const who = await signInAs(test, 'inviter');

      const first = await codeOf(who.headers);
      const again = await codeOf(who.headers);

      expect(first).toMatch(/^[A-Z0-9]{6}$/);
      expect(again).toBe(first);
    });

    it('내 코드는 내가 넣을 수 없다', async () => {
      const who = await signInAs(test, 'inviter');

      const response = await redeem(who.headers, await codeOf(who.headers));

      expect(response.statusCode).toBe(400);
    });

    it('가입만으로는 보상이 생기지 않는다', async () => {
      /*
       * v2.0 K-7이 "친구 가입+온보딩만으로 보상"을 폐기했다. 가입만으로 돈을
       * 주면 가입만 하는 계정이 모이고, 그 계정들이 만드는 것은 데이터가 아니라
       * 비용이다.
       */
      const inviter = await signInAs(test, 'inviter');
      const invited = await signInAs(test, 'invited');

      expect((await redeem(invited.headers, await codeOf(inviter.headers))).statusCode).toBe(204);

      const mine = (await rewards(inviter.headers)).json<{
        invitedCount: number;
        qualifiedCount: number;
        grants: unknown[];
      }>();

      expect(mine.invitedCount).toBe(1);
      expect(mine.qualifiedCount).toBe(0);
      expect(mine.grants).toEqual([]);
    });

    it('초대받은 사람의 첫 결제인증에 조건이 찬다', async () => {
      const inviter = await signInAs(test, 'inviter');
      const invited = await signInAs(test, 'invited');

      await redeem(invited.headers, await codeOf(inviter.headers));
      expect((await registerProof(invited.headers)).statusCode).toBe(201);

      const mine = (await rewards(inviter.headers)).json<{
        qualifiedCount: number;
        grants: { kind: string; amountKrw: number; status: string }[];
      }>();

      expect(mine.qualifiedCount).toBe(1);
      expect(mine.grants).toHaveLength(1);
      expect(mine.grants[0]?.kind).toBe('referral');
      expect(mine.grants[0]?.amountKrw).toBe(REWARDS.referral.amountKrw);
      // 조건이 찬 것이지 돈이 간 것이 아니다.
      expect(mine.grants[0]?.status).toBe('earned');
    });

    it('둘째 결제인증에는 보상이 또 생기지 않는다', async () => {
      const inviter = await signInAs(test, 'inviter');
      const invited = await signInAs(test, 'invited');

      await redeem(invited.headers, await codeOf(inviter.headers));
      await registerProof(invited.headers, '가온예식홀');
      await registerProof(invited.headers, '수아스튜디오');

      const mine = (await rewards(inviter.headers)).json<{ grants: unknown[] }>();

      expect(mine.grants).toHaveLength(1);
    });

    it('코드를 두 번 넣을 수 없다', async () => {
      const one = await signInAs(test, 'inviter-one');
      const two = await signInAs(test, 'inviter-two');
      const invited = await signInAs(test, 'invited');

      expect((await redeem(invited.headers, await codeOf(one.headers))).statusCode).toBe(204);
      expect((await redeem(invited.headers, await codeOf(two.headers))).statusCode).toBe(400);
    });

    it('없는 코드는 404다', async () => {
      const who = await signInAs(test, 'invited');

      expect((await redeem(who.headers, 'ZZZZZZ')).statusCode).toBe(404);
    });

    /** 한도만큼 지급된 친구초대를 심는다. 근거는 각각 다른 초대여야 한다. */
    async function seedPaidReferrals(count: number, createdAt = 'now()') {
      for (let i = 0; i < count; i += 1) {
        const { rows } = await test.pool.query<{ id: string }>(
          `WITH pair AS (
             INSERT INTO structured.users DEFAULT VALUES RETURNING id
           ), other AS (
             INSERT INTO structured.users DEFAULT VALUES RETURNING id
           )
           INSERT INTO structured.referrals (inviter_user_id, invited_user_id)
           SELECT pair.id, other.id FROM pair, other
           RETURNING id`
        );

        await test.pool.query(
          `INSERT INTO structured.reward_grants
             (user_id, kind, amount_krw, status, reason_code, referral_id, decided_at, decided_by, created_at)
           SELECT r.inviter_user_id, 'referral', 3000, 'paid', 'seed', r.id, now(), r.invited_user_id, ${createdAt}
           FROM structured.referrals r WHERE r.id = $1`,
          [rows[0]!.id]
        );
      }
    }

    it('이번 달 한도를 넘으면 사람에게 올린다', async () => {
      /*
       * I-3: 설정 한도 내 정상 지급은 사람이 승인하지 않고, 한도 초과만 위로
       * 보낸다. v3.22 이벤트 예산 — 친구 초대는 월 50건. 한도만큼 이미 지급한
       * 상태를 만들어놓고 확인한다.
       */
      const inviter = await signInAs(test, 'inviter');
      const invited = await signInAs(test, 'invited');

      await seedPaidReferrals(REWARDS.referral.monthlyCap);

      await redeem(invited.headers, await codeOf(inviter.headers));
      await registerProof(invited.headers);

      const mine = (await rewards(inviter.headers)).json<{
        grants: { status: string; statusLabel: string }[];
      }>();

      expect(mine.grants[0]?.status).toBe('held');
      expect(mine.grants[0]?.statusLabel).toBe('확인 중');

      // 넘긴 건은 사람을 기다리는 줄로 남는다. 그래야 누가 본다.
      const open = await test.pool.query(
        `SELECT reason_code FROM structured.open_decisions WHERE subject_kind = 'reward_grant'`
      );

      expect(open.rows).toEqual([{ reason_code: 'over_monthly_limit' }]);
    });

    it('지난달에 다 썼어도 이번 달은 다시 열린다', async () => {
      // «소진되면 다음 달에 다시 엽니다» — 한도는 캠페인 누적이 아니라 달마다 센다.
      const inviter = await signInAs(test, 'inviter');
      const invited = await signInAs(test, 'invited');

      await seedPaidReferrals(REWARDS.referral.monthlyCap, "now() - interval '1 month'");

      await redeem(invited.headers, await codeOf(inviter.headers));
      await registerProof(invited.headers);

      const mine = (await rewards(inviter.headers)).json<{ grants: { status: string }[] }>();

      expect(mine.grants[0]?.status).toBe('earned');
    });

    it('한도 안이면 사람을 기다리지 않는다', async () => {
      const inviter = await signInAs(test, 'inviter');
      const invited = await signInAs(test, 'invited');

      await redeem(invited.headers, await codeOf(inviter.headers));
      await registerProof(invited.headers);

      // 한도 안이면 사람을 기다리지 않는다. 승인 줄이 곧 병목이 된다(A-2).
      const open = await test.pool.query(
        `SELECT 1 FROM structured.open_decisions WHERE subject_kind = 'reward_grant'`
      );

      expect(open.rows).toHaveLength(0);
    });
  });

  describe('홍보인증', () => {
    const submit = (headers: Record<string, string>, url: string) =>
      test.app.inject({ method: 'POST', url: '/v1/promotions', headers, payload: { url } });

    it('주소 꼴이 아니면 받지 않는다', async () => {
      const who = await signInAs(test, 'promoter');

      expect((await submit(who.headers, 'http://blog.example.com/a')).statusCode).toBe(400);
      expect((await submit(who.headers, 'https://abc')).statusCode).toBe(400);
    });

    it('한 사람이 한 번만 참여한다', async () => {
      const who = await signInAs(test, 'promoter');

      expect((await submit(who.headers, 'https://blog.example.com/a')).statusCode).toBe(201);
      expect((await submit(who.headers, 'https://blog.example.com/b')).statusCode).toBe(409);
    });

    it('같은 글을 두 사람이 낼 수 없다', async () => {
      const one = await signInAs(test, 'promoter-one');
      const two = await signInAs(test, 'promoter-two');

      expect((await submit(one.headers, 'https://blog.example.com/a')).statusCode).toBe(201);
      expect((await submit(two.headers, 'https://blog.example.com/a')).statusCode).toBe(409);
    });

    it('내면 바로 지급 대상이 되지는 않는다', async () => {
      /*
       * I-2가 "자동검증"이라고 적었지만 우리는 그 글을 열어보지 않는다 — 남의
       * 사이트를 긁지 않기로 했고, 열어봐도 그 글이 이 사람 것인지는 알 수 없다.
       * 사람이 확인한 뒤에 보상이 생긴다.
       */
      const who = await signInAs(test, 'promoter');

      await submit(who.headers, 'https://blog.example.com/a');

      const mine = (await rewards(who.headers)).json<{ grants: unknown[] }>();

      expect(mine.grants).toEqual([]);
    });

    it('로그인해야 참여할 수 있다', async () => {
      expect((await submit({}, 'https://blog.example.com/a')).statusCode).toBe(401);
    });
  });

  describe('미션 완주', () => {
    type Grant = { kind: string; amountKrw: number; status: string; kindLabel: string };

    const grantsOf = async (headers: Record<string, string>) =>
      (await rewards(headers)).json<{ grants: Grant[] }>().grants;

    async function missionNotifications(userId: string): Promise<number> {
      const { rows } = await test.pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM structured.notifications WHERE user_id = $1 AND title = $2`,
        [userId, MISSION_COMPLETE_REWARD_NOTIFICATION.title]
      );
      return Number(rows[0]?.n ?? 0);
    }

    /** 설정 완료 · 첫 Pick · 배우자 연결 · Pick 인증 1건 — 미션 넷을 다 채운다. */
    async function completeAllMissions() {
      const owner = await signInAs(test, 'owner');
      const partner = await signInAs(test, 'partner');
      const weddingId = await createWedding(test, owner.headers);

      await test.pool.query(
        `UPDATE structured.weddings
         SET setup_completed_at = now(), partner_user_id = $2
         WHERE id = $1`,
        [weddingId, partner.userId]
      );

      const vendor = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
      );

      await test.pool.query(
        `INSERT INTO structured.vendor_candidates (wedding_id, vendor_id, added_by)
         VALUES ($1, $2, $3)`,
        [weddingId, vendor.rows[0]!.id, owner.userId]
      );

      return { owner, partner, weddingId, vendorId: vendor.rows[0]!.id };
    }

    it('미션 셋까지는 보상이 생기지 않는다', async () => {
      const { owner } = await completeAllMissions();

      // Pick 인증(4번째 미션)이 아직 없다.
      expect(await grantsOf(owner.headers)).toEqual([]);
      expect(await missionNotifications(owner.userId)).toBe(0);
    });

    it('넷을 다 마치면 5,000원 지급 대상이 되고, 한 번만 생긴다', async () => {
      /*
       * v3.22 — 4번째 미션이 «비교하기»에서 «Pick 인증 1건»으로 바뀌었다.
       * 완주 1커플이 곧 실 제보 1건이다. 조건이 찬 것이지 돈이 간 것이 아니다.
       */
      const { owner, vendorId } = await completeAllMissions();

      expect((await registerProof(owner.headers)).statusCode).toBe(201);
      // 업체가 매칭돼야 실 제보(usable_payment_proofs)다.
      await test.pool.query(
        `UPDATE structured.payment_proofs SET vendor_id = $2 WHERE reporter_user_id = $1`,
        [owner.userId, vendorId]
      );

      const grants = await grantsOf(owner.headers);

      expect(grants).toHaveLength(1);
      expect(grants[0]).toMatchObject({
        kind: 'mission',
        kindLabel: '미션 완주',
        amountKrw: REWARDS.mission.amountKrw,
        status: 'earned',
      });
      expect(await missionNotifications(owner.userId)).toBe(1);

      // 다시 봐도, 웨딩지원금 화면에서 봐도 하나다.
      await test.app.inject({ method: 'GET', url: '/v1/me/monthly-draw', headers: owner.headers });
      expect(await grantsOf(owner.headers)).toHaveLength(1);
      expect(await missionNotifications(owner.userId)).toBe(1);
    });

    it('이번 달 40커플이 찼으면 사람에게 올린다', async () => {
      const { owner, vendorId } = await completeAllMissions();

      // 다른 사람들이 이번 달 한도만큼 이미 지급 대상이 됐다.
      for (let i = 0; i < REWARDS.mission.monthlyCap; i += 1) {
        await test.pool.query(
          `WITH u AS (INSERT INTO structured.users DEFAULT VALUES RETURNING id)
           INSERT INTO structured.reward_grants (user_id, kind, amount_krw, status, reason_code)
           SELECT id, 'mission', 5000, 'earned', 'seed' FROM u`
        );
      }

      await registerProof(owner.headers);
      await test.pool.query(
        `UPDATE structured.payment_proofs SET vendor_id = $2 WHERE reporter_user_id = $1`,
        [owner.userId, vendorId]
      );

      const grants = await grantsOf(owner.headers);

      expect(grants[0]?.status).toBe('held');
    });
  });

  describe('월간 웨딩지원금', () => {
    type Draw = {
      status: string;
      remaining: number;
      conditions: { key: string; label: string; done: boolean }[];
      winnersPerMonth: number;
    };

    const draw = async (headers: Record<string, string>) =>
      (await test.app.inject({ method: 'GET', url: '/v1/me/monthly-draw', headers })).json<Draw>();

    async function enteredNotifications(userId: string): Promise<number> {
      const { rows } = await test.pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM structured.notifications WHERE user_id = $1 AND title = $2`,
        [userId, MONTHLY_DRAW_ENTERED_NOTIFICATION.title]
      );
      return Number(rows[0]?.n ?? 0);
    }

    it('조건 3개를 채우기 전에는 남은 수와 함께 응모 전이다', async () => {
      /*
       * v3.22 — 응모 조건은 미션 4개가 아니라 예식일과 지역 · Pick 인증 1건 · 배우자
       * 연결 셋이다. 혜택 안내 시트(WP-SHT-017)가 남은 수로 제목을 만든다.
       */
      const who = await signInAs(test, 'solo');
      await createWedding(test, who.headers);

      const mine = await draw(who.headers);

      expect(mine.status).toBe('not_entered');
      expect(mine.remaining).toBe(3);
      expect(mine.conditions.map((c) => c.key)).toEqual(['wedding_set', 'payment_proof', 'partner']);
      expect(mine.conditions.map((c) => c.label)).toEqual([
        MONTHLY_DRAW_CONDITION_LABEL.wedding_set,
        MONTHLY_DRAW_CONDITION_LABEL.payment_proof,
        MONTHLY_DRAW_CONDITION_LABEL.partner,
      ]);
      expect(mine.conditions.every((c) => !c.done)).toBe(true);
      expect(mine.winnersPerMonth).toBe(1);
      expect(await enteredNotifications(who.userId)).toBe(0);
    });

    it('조건을 다 채우면 자동 응모되고 알림은 처음 한 번만 남는다', async () => {
      const owner = await signInAs(test, 'owner');
      const partner = await signInAs(test, 'partner');
      const weddingId = await createWedding(test, owner.headers);

      await test.pool.query(
        `UPDATE structured.weddings
         SET wedding_date = '2027-05-16', region = '서울', partner_user_id = $2
         WHERE id = $1`,
        [weddingId, partner.userId]
      );

      // 예식일 · 지역 · 배우자까지 됐고 Pick 인증만 남았다 — «하나만 더 하면».
      const before = await draw(owner.headers);
      expect(before.status).toBe('not_entered');
      expect(before.remaining).toBe(1);
      expect(before.conditions.find((c) => c.key === 'payment_proof')?.done).toBe(false);

      // Pick 인증 1건 — 업체가 매칭돼야 실 제보(usable_payment_proofs)다.
      expect((await registerProof(owner.headers)).statusCode).toBe(201);
      await test.pool.query(
        `WITH v AS (
           INSERT INTO structured.vendors (name, category, region, source)
           VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id
         )
         UPDATE structured.payment_proofs p SET vendor_id = (SELECT id FROM v)
         WHERE p.reporter_user_id = $1`,
        [owner.userId]
      );

      const entered = await draw(owner.headers);
      expect(entered.status).toBe('entered');
      expect(entered.remaining).toBe(0);
      expect(entered.conditions.every((c) => c.done)).toBe(true);
      // 남은 조건 0 — 시트 대신 응모 완료 알림.
      expect(await enteredNotifications(owner.userId)).toBe(1);

      // 다시 물어도 응모 행은 하나고 알림도 하나다.
      expect((await draw(owner.headers)).status).toBe('entered');
      expect(await enteredNotifications(owner.userId)).toBe(1);
    });
  });
});
