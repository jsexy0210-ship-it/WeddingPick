import { sendPriceChangeNudges, sendTaskNudges } from '../notify/nudges';
import type { Push, PushMessage } from '../push/port';
import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

function fakePush() {
  const sent: PushMessage[] = [];

  const push: Push = {
    async send(messages) {
      sent.push(...messages);

      return messages.map((message) => ({ token: message.token, delivered: true }));
    },
  };

  return { push, sent };
}

/** 며칠 뒤 날짜. */
function inDays(days: number): string {
  const date = new Date();

  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

/**
 * 준비 알림과 가격 변동 알림. 최종통합정책 v2.0 36·37번.
 *
 * **설정 스위치를 실제로 읽는지**가 여기서 걸린다 — 끌 수 있게 만들어놓고 보내는
 * 쪽이 그 값을 안 보면 그 스위치는 장식이다.
 */
describeWithDb('사용자 알림', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function registerDevice(userId: string, token = 'ExponentPushToken[abc]') {
    await test.pool.query(
      `INSERT INTO structured.device_tokens (user_id, token, platform)
       VALUES ($1, $2, 'ios')`,
      [userId, token]
    );
  }

  async function addTask(weddingId: string, dueDate: string, label = '드레스 투어') {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.wedding_tasks (wedding_id, label, due_date)
       VALUES ($1, $2, $3) RETURNING id`,
      [weddingId, label, dueDate]
    );

    return rows[0]!.id;
  }

  const inbox = async (headers: Record<string, string>) =>
    (
      await test.app.inject({ method: 'GET', url: '/v1/me/notifications', headers })
    ).json<{ notifications: { title: string; body: string }[] }>().notifications;

  describe('일정 알림', () => {
    it('7일 전 · 1일 전 · 당일에 보낸다', async () => {
      const { headers, userId } = await signInAs(test);
      const weddingId = await createWedding(test, headers);

      await test.pool.query(
        'UPDATE structured.weddings SET wedding_date = $2 WHERE id = $1',
        [weddingId, inDays(200)]
      );
      await addTask(weddingId, inDays(7));

      const { push } = fakePush();
      const result = await sendTaskNudges({ pool: test.pool, push });

      expect(result.stored).toBe(1);
      expect((await inbox(headers))[0]!.title).toContain('7일');
    });

    it('그 사이 날짜에는 보내지 않는다', async () => {
      // "7일 이하"로 두면 매일 가고, 그건 세 번 알리기로 한 것과 다르다.
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);

      await addTask(weddingId, inDays(4));

      const { push } = fakePush();

      expect((await sendTaskNudges({ pool: test.pool, push })).stored).toBe(0);
    });

    it('두 번 돌려도 한 번만 간다', async () => {
      /*
       * 워커가 한 바퀴 더 돌면 같은 알림이 또 가는 것이 이 종류의 기본 실패다.
       */
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);

      await addTask(weddingId, inDays(1));

      const { push } = fakePush();

      const first = await sendTaskNudges({ pool: test.pool, push });
      const second = await sendTaskNudges({ pool: test.pool, push });

      expect(first.stored).toBe(1);
      expect(second.stored).toBe(0);
      expect(second.skipped).toBe(1);
      expect(await inbox(headers)).toHaveLength(1);
    });

    it('예식이 끝난 사람에게는 보내지 않는다', async () => {
      /*
       * v2.0 D-4. 끝난 사람에게 "드레스 투어를 예약해보세요"는 안내가 아니라
       * 실례다.
       */
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);

      await test.pool.query(
        'UPDATE structured.weddings SET wedding_date = $2 WHERE id = $1',
        [weddingId, inDays(-3)]
      );
      await addTask(weddingId, inDays(1));

      const { push } = fakePush();

      expect((await sendTaskNudges({ pool: test.pool, push })).stored).toBe(0);
      expect(await inbox(headers)).toHaveLength(0);
    });

    it('직접 완료로 표시한 일에는 보내지 않는다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const taskId = await addTask(weddingId, inDays(1));

      await test.pool.query(
        `UPDATE structured.wedding_tasks SET state_override = 'done' WHERE id = $1`,
        [taskId]
      );

      const { push } = fakePush();

      expect((await sendTaskNudges({ pool: test.pool, push })).stored).toBe(0);
    });

    it('배우자 둘 다 받는다', async () => {
      const owner = await signInAs(test, 'owner-user');
      const weddingId = await createWedding(test, owner.headers);

      const invite = await test.app.inject({
        method: 'POST',
        url: `/v1/weddings/${weddingId}/invites`,
        headers: owner.headers,
      });

      const partner = await signInAs(test, 'partner-user');
      await test.app.inject({
        method: 'POST',
        url: '/v1/wedding-invites/accept',
        headers: partner.headers,
        payload: { code: invite.json<{ code: string }>().code },
      });

      await addTask(weddingId, inDays(1));

      const { push } = fakePush();

      expect((await sendTaskNudges({ pool: test.pool, push })).stored).toBe(2);
    });

    it('푸시를 꺼도 알림함에는 남는다', async () => {
      /*
       * 스위치는 **밀어서 알려줄지**를 정하는 값이지 결과를 감추는 값이 아니다.
       * 껐다고 결과가 사라지면 그 사람은 결과를 영영 모른다.
       */
      const { headers, userId } = await signInAs(test);
      const weddingId = await createWedding(test, headers);

      await registerDevice(userId);
      await addTask(weddingId, inDays(1));

      await test.app.inject({
        method: 'PUT',
        url: '/v1/me/settings',
        headers,
        payload: { pushEnabled: false },
      });

      const { push, sent } = fakePush();
      const result = await sendTaskNudges({ pool: test.pool, push });

      expect(result.stored).toBe(1);
      expect(sent).toHaveLength(0);
      expect(await inbox(headers)).toHaveLength(1);
    });

    it('켜져 있으면 기기로 나간다', async () => {
      const { headers, userId } = await signInAs(test);
      const weddingId = await createWedding(test, headers);

      await registerDevice(userId);
      await addTask(weddingId, inDays(1));

      const { push, sent } = fakePush();

      await sendTaskNudges({ pool: test.pool, push });

      expect(sent).toHaveLength(1);
    });
  });

  describe('하루 한도 — SPEC 13.12', () => {
    /** 한 사람이 Pick한 업체 여럿. 각각 가격 변동이 일어나게 만든다. */
    async function pickMany(count: number) {
      const { headers, userId } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const vendorIds: string[] = [];

      for (let index = 0; index < count; index += 1) {
        const vendor = await test.pool.query<{ id: string }>(
          `INSERT INTO structured.vendors (name, category, region, source)
           VALUES ($1, 'hall', '서울', 'public_data') RETURNING id`,
          [`예식홀 ${index}`]
        );
        const vendorId = vendor.rows[0]!.id;

        await test.pool.query(
          `INSERT INTO structured.vendor_candidates (wedding_id, vendor_id, added_by)
           VALUES ($1, $2, $3)`,
          [weddingId, vendorId, userId]
        );
        vendorIds.push(vendorId);
      }

      return { headers, userId, weddingId, vendorIds };
    }

    async function proofsFor(vendorIds: string[], count: number) {
      for (const vendorId of vendorIds) {
        for (let index = 0; index < count; index += 1) {
          const reporter = await test.pool.query<{ id: string }>(
            'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
          );
          await test.pool.query(
            `INSERT INTO structured.payment_proofs
               (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
             VALUES ($1, $2, '가맹점', $3, now() - interval '1 month')`,
            [reporter.rows[0]!.id, vendorId, 3_000_000 + index]
          );
        }
      }
    }

    it('가격 변동은 하루 두 건까지만 간다', async () => {
      const { headers, vendorIds } = await pickMany(3);
      const { push } = fakePush();

      // 첫 바퀴는 기준점만 남긴다.
      await sendPriceChangeNudges({ pool: test.pool, push });
      await proofsFor(vendorIds, 5);

      const result = await sendPriceChangeNudges({ pool: test.pool, push });

      expect(result.stored).toBe(2);
      expect(result.capped).toBe(1);
      expect(await inbox(headers)).toHaveLength(2);
    });

    it('일정 알림은 한도를 세지 않는다', async () => {
      // «하루 최대 2건. 일정 알림은 예외입니다.»
      const { headers, weddingId, vendorIds } = await pickMany(2);
      const { push } = fakePush();

      await sendPriceChangeNudges({ pool: test.pool, push });
      await proofsFor(vendorIds, 5);
      expect((await sendPriceChangeNudges({ pool: test.pool, push })).stored).toBe(2);

      await addTask(weddingId, inDays(1), '드레스 투어');
      await addTask(weddingId, inDays(7), '스튜디오 촬영');

      const tasks = await sendTaskNudges({ pool: test.pool, push });

      expect(tasks.stored).toBe(2);
      expect(tasks.capped).toBe(0);
      expect(await inbox(headers)).toHaveLength(4);
    });

    it('이미 보낸 알림은 한도에 막힌 것으로 세지 않는다', async () => {
      const { vendorIds } = await pickMany(2);
      const { push } = fakePush();

      await sendPriceChangeNudges({ pool: test.pool, push });
      await proofsFor(vendorIds, 5);
      await sendPriceChangeNudges({ pool: test.pool, push });

      // 기준점을 멀리 되돌려 같은 날 또 «변화»가 잡히게 한다 — 열쇠가 같아
      // 건너뛴 것이지 한도 때문이 아니다.
      await test.pool.query(
        'UPDATE structured.price_alert_marks SET low = 1000000, high = 1100000'
      );
      const again = await sendPriceChangeNudges({ pool: test.pool, push });

      expect(again.stored).toBe(0);
      expect(again.capped).toBe(0);
      expect(again.skipped).toBe(2);
    });
  });

  describe('가격 변동 알림', () => {
    async function candidateWith(count: number, amount: number) {
      const { headers, userId } = await signInAs(test);
      const weddingId = await createWedding(test, headers);

      const vendor = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
      );
      const vendorId = vendor.rows[0]!.id;

      await test.pool.query(
        `INSERT INTO structured.vendor_candidates (wedding_id, vendor_id, added_by)
         VALUES ($1, $2, $3)`,
        [weddingId, vendorId, userId]
      );

      await seedProofs(vendorId, count, amount);

      return { headers, userId, vendorId };
    }

    async function seedProofs(vendorId: string, count: number, amount: number) {
      for (let index = 0; index < count; index += 1) {
        const reporter = await test.pool.query<{ id: string }>(
          'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
        );

        await test.pool.query(
          `INSERT INTO structured.payment_proofs
             (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
           VALUES ($1, $2, '가맹점', $3, now() - interval '1 month')`,
          [reporter.rows[0]!.id, vendorId, amount + index]
        );
      }
    }

    it('처음 담은 업체에는 알리지 않는다', async () => {
      // 담자마자 "바뀌었어요"가 가면 그건 변화가 아니라 인사다.
      const { headers } = await candidateWith(6, 3_000_000);

      const { push } = fakePush();

      expect((await sendPriceChangeNudges({ pool: test.pool, push })).stored).toBe(0);
      expect(await inbox(headers)).toHaveLength(0);
    });

    it('수집 중이던 업체에 구간이 생기면 알린다', async () => {
      const { headers, vendorId } = await candidateWith(1, 3_000_000);
      const { push } = fakePush();

      // 첫 바퀴는 기준점만 남긴다.
      await sendPriceChangeNudges({ pool: test.pool, push });

      await seedProofs(vendorId, 5, 3_000_000);

      expect((await sendPriceChangeNudges({ pool: test.pool, push })).stored).toBe(1);
      expect((await inbox(headers))[0]!.title).toContain('볼 수 있어요');
    });

    it('한 건 늘어난 정도로는 알리지 않는다', async () => {
      // v2.0 37번: 신규 인증 1건이 들어올 때마다 알림을 보내지 않는다.
      const { vendorId } = await candidateWith(8, 3_000_000);
      const { push } = fakePush();

      await sendPriceChangeNudges({ pool: test.pool, push });
      await seedProofs(vendorId, 1, 3_000_010);

      expect((await sendPriceChangeNudges({ pool: test.pool, push })).stored).toBe(0);
    });

    it('같은 업체에 하루 두 번 가지 않는다', async () => {
      const { vendorId } = await candidateWith(1, 3_000_000);
      const { push } = fakePush();

      await sendPriceChangeNudges({ pool: test.pool, push });
      await seedProofs(vendorId, 5, 3_000_000);

      const first = await sendPriceChangeNudges({ pool: test.pool, push });

      // 기준점이 옮겨졌어도 열쇠가 같은 날이라 두 번째는 막힌다.
      await test.pool.query('DELETE FROM structured.price_alert_marks');
      const second = await sendPriceChangeNudges({ pool: test.pool, push });

      expect(first.stored).toBe(1);
      expect(second.stored).toBe(0);
    });

    it('결정을 끝낸 업종의 업체에는 알리지 않는다', async () => {
      /*
       * SPEC 13.12 — 알림은 진행 중 업종에서만 온다. 정한 뒤에 «다른 곳이
       * 싸졌어요»는 정보가 아니라 후회다.
       */
      const { headers, userId, vendorId } = await candidateWith(1, 3_000_000);
      const { push } = fakePush();

      await sendPriceChangeNudges({ pool: test.pool, push });
      await seedProofs(vendorId, 5, 3_000_000);

      await test.pool.query(
        `INSERT INTO structured.category_decisions (wedding_id, category, vendor_id, decided_by)
         SELECT c.wedding_id, 'hall', c.vendor_id, $1
         FROM structured.vendor_candidates c WHERE c.vendor_id = $2`,
        [userId, vendorId]
      );

      expect((await sendPriceChangeNudges({ pool: test.pool, push })).stored).toBe(0);
      expect(await inbox(headers)).toHaveLength(0);
    });

    it('앱 밖에서 이미 정했다고 고른 업종에도 알리지 않는다', async () => {
      const { headers, vendorId } = await candidateWith(1, 3_000_000);
      const { push } = fakePush();

      await sendPriceChangeNudges({ pool: test.pool, push });
      await seedProofs(vendorId, 5, 3_000_000);

      await test.pool.query(
        `UPDATE structured.weddings SET prepared_categories = ARRAY['hall']::vendor_category[]`
      );

      expect((await sendPriceChangeNudges({ pool: test.pool, push })).stored).toBe(0);
      expect(await inbox(headers)).toHaveLength(0);
    });

    it('가격 알림만 따로 끌 수 있다', async () => {
      /*
       * v2.0 37번. 자료 확인 결과는 받고 싶지만 가격 알림은 시끄러운 사람이 있고,
       * 하나로 묶으면 그 사람은 둘 다 끄게 된다.
       */
      const { headers, userId, vendorId } = await candidateWith(1, 3_000_000);

      await registerDevice(userId);
      await test.app.inject({
        method: 'PUT',
        url: '/v1/me/settings',
        headers,
        payload: { priceChangeEnabled: false },
      });

      const { push, sent } = fakePush();

      await sendPriceChangeNudges({ pool: test.pool, push });
      await seedProofs(vendorId, 5, 3_000_000);

      const result = await sendPriceChangeNudges({ pool: test.pool, push });

      // 알림함에는 남되 푸시는 안 나간다.
      expect(result.stored).toBe(1);
      expect(sent).toHaveLength(0);
    });
  });
});
