import { resolve } from '../payment-proof-admin';
import {
  createTestApp,
  createWedding,
  registerPaymentProof,
  resetDatabase,
  signInAs,
  type TestApp,
} from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 2026-09-26 대표 결정 「초과되는 금액만큼 총 예산도 늘려」.
 *
 * Pick 인증(결제인증)이 지출로 세어지는 순간 총예산을 넘으면 넘은 만큼 총예산을 늘려
 * 총예산 = 낸 돈 합으로 맞춘다. 직접 입력은 여전히 총예산을 넘을 수 없다.
 */
describeWithDb('Pick 인증이 총예산을 넘기면 총예산을 늘린다', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function aWedding(budget: number | null) {
    const session = await signInAs(test);
    const weddingId = await createWedding(test, session.headers);
    if (budget !== null) {
      const set = await test.app.inject({
        method: 'PUT',
        url: `/v1/weddings/${weddingId}/budget`,
        headers: session.headers,
        payload: { budget },
      });
      expect(set.statusCode).toBe(200);
    }
    return { ...session, weddingId };
  }

  async function addManual(headers: Record<string, string>, weddingId: string, amount: number) {
    return test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/expenses`,
      headers,
      payload: { label: '드레스 예약금', amount, status: 'paid', category: 'dress' },
    });
  }

  async function budgetOf(weddingId: string): Promise<number | null> {
    const { rows } = await test.pool.query<{ budget_amount: string | null }>(
      'SELECT budget_amount FROM structured.weddings WHERE id = $1',
      [weddingId]
    );
    const raw = rows[0]?.budget_amount;
    return raw === null || raw === undefined ? null : Number(raw);
  }

  async function expensesOf(headers: Record<string, string>, weddingId: string) {
    const response = await test.app.inject({ method: 'GET', url: `/v1/weddings/${weddingId}/expenses`, headers });
    return response.json<{ paidTotal: number; budget: { set: boolean; budget?: number; remaining?: number; over?: boolean } }>();
  }

  async function notices(userId: string) {
    const { rows } = await test.pool.query<{ title: string; body: string; kind: string; target_id: string | null }>(
      'SELECT title, body, kind, target_id FROM structured.notifications WHERE user_id = $1 ORDER BY created_at',
      [userId]
    );
    return rows;
  }

  it('총예산을 넘은 Pick 인증은 총예산을 낸 돈 합과 똑같이 늘리고, 늘렸다는 것을 남긴다', async () => {
    const { headers, userId, weddingId } = await aWedding(10_000_000);
    expect((await addManual(headers, weddingId, 9_000_000)).statusCode).toBe(201);

    const response = await registerPaymentProof(test, headers, { paidAmount: 3_000_000 }, weddingId);

    expect(response.statusCode).toBe(201);
    const body = response.json<{ status: string; paymentProofId: string; budgetRaise: unknown }>();
    expect(body.status).toBe('accepted');
    expect(body.budgetRaise).toEqual({ weddingId, before: 10_000_000, budget: 12_000_000, raisedBy: 2_000_000 });

    expect(await budgetOf(weddingId)).toBe(12_000_000);
    const summary = await expensesOf(headers, weddingId);
    expect(summary.paidTotal).toBe(12_000_000);
    expect(summary.budget).toMatchObject({ set: true, budget: 12_000_000, remaining: 0, over: false });

    /* 웨딩노트 «변경내역»이 읽는 알림 — 문구는 spec/strings.ko.json. */
    expect(await notices(userId)).toContainEqual({
      title: '총예산을 200만원 늘렸어요',
      body: 'Pick 인증한 지출이 총예산을 넘어서 총예산을 1,200만원으로 맞췄어요',
      kind: 'verification',
      target_id: body.paymentProofId,
    });
  });

  it('총예산 안이면 아무것도 바꾸지 않는다', async () => {
    const { headers, userId, weddingId } = await aWedding(10_000_000);

    const response = await registerPaymentProof(test, headers, { paidAmount: 3_000_000 }, weddingId);

    expect(response.statusCode).toBe(201);
    expect(response.json<{ budgetRaise: unknown }>().budgetRaise).toBeNull();
    expect(await budgetOf(weddingId)).toBe(10_000_000);
    expect((await notices(userId)).filter((row) => row.title.startsWith('총예산을'))).toEqual([]);
  });

  it('총예산이 없으면 한도가 없어 아무것도 바꾸지 않는다', async () => {
    const { headers, weddingId } = await aWedding(null);

    const response = await registerPaymentProof(test, headers, { paidAmount: 30_000_000 }, weddingId);

    expect(response.statusCode).toBe(201);
    expect(response.json<{ budgetRaise: unknown }>().budgetRaise).toBeNull();
    expect(await budgetOf(weddingId)).toBeNull();
  });

  it('검수 대기는 지출이 아니라 늘리지 않고, 운영자가 풀 때 같은 규칙이 돈다', async () => {
    const { headers, userId, weddingId } = await aWedding(2_000_000);

    const response = await registerPaymentProof(test, headers, { paidAmount: null }, weddingId);
    expect(response.statusCode).toBe(201);
    const body = response.json<{ status: string; paymentProofId: string; budgetRaise: unknown }>();
    expect(body.status).toBe('pending_review');
    expect(body.budgetRaise).toBeNull();
    expect(await budgetOf(weddingId)).toBe(2_000_000);

    const operator = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
    );
    const resolved = await resolve(
      test.pool,
      body.paymentProofId,
      {
        merchantName: '가온예식홀',
        paidAmount: 5_000_000,
        paidAt: '2026-05-20T04:00:00.000Z',
        reasonCode: 'amount_read_by_operator',
      },
      operator.rows[0]!.id
    );

    expect(resolved.budgetRaise).toEqual({ weddingId, before: 2_000_000, budget: 5_000_000, raisedBy: 3_000_000 });
    expect(await budgetOf(weddingId)).toBe(5_000_000);
    expect((await notices(userId)).map((row) => row.title)).toContain('총예산을 300만원 늘렸어요');
  });

  it('직접 입력은 여전히 총예산을 넘을 수 없다 — 늘리지 않고 막는다', async () => {
    const { headers, weddingId } = await aWedding(10_000_000);
    expect((await addManual(headers, weddingId, 9_000_000)).statusCode).toBe(201);

    const over = await addManual(headers, weddingId, 2_000_000);

    expect(over.statusCode).toBe(400);
    expect(over.json<{ error: { message: string } }>().error.message).toBe(
      '총예산을 넘을 수 없어요. 남은 예산은 100만원이에요'
    );
    expect(await budgetOf(weddingId)).toBe(10_000_000);
  });

  it('배우자에게도 같은 알림이 간다 — 총예산은 웨딩 하나에 하나다', async () => {
    const { headers, weddingId } = await aWedding(1_000_000);
    const partner = await test.pool.query<{ id: string }>('INSERT INTO structured.users DEFAULT VALUES RETURNING id');
    await test.pool.query('UPDATE structured.weddings SET partner_user_id = $2 WHERE id = $1', [
      weddingId,
      partner.rows[0]!.id,
    ]);

    const response = await registerPaymentProof(test, headers, { paidAmount: 3_000_000 }, weddingId);

    expect(response.json<{ budgetRaise: { raisedBy: number } }>().budgetRaise.raisedBy).toBe(2_000_000);
    expect((await notices(partner.rows[0]!.id)).map((row) => row.title)).toEqual(['총예산을 200만원 늘렸어요']);
  });
});
