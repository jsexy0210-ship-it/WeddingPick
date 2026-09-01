import { TASK_PRESETS } from '@weddingpick/domain';

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

const at = (days: number) => {
  const date = new Date();

  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
};

/**
 * 우리웨딩 — 웨딩 스케줄 · 지출내역 · 방문노트. 핸드오프 14~16번.
 *
 * 셋 다 웨딩에 매달려 있다. 배우자와 같은 목록을 보지 못하면 각자 다른 목록을 들고
 * 같은 이야기를 하게 된다.
 */
describeWithDb('우리웨딩', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function mine() {
    const session = await signInAs(test);

    return { ...session, weddingId: await createWedding(test, session.headers) };
  }

  const tasks = (headers: Record<string, string>, weddingId: string) =>
    test.app.inject({ method: 'GET', url: `/v1/weddings/${weddingId}/tasks`, headers });

  const expenses = (headers: Record<string, string>, weddingId: string) =>
    test.app.inject({ method: 'GET', url: `/v1/weddings/${weddingId}/expenses`, headers });

  describe('웨딩 스케줄', () => {
    it('처음 열면 기본 열넷이 깔린다', async () => {
      /*
       * 처음 결혼을 준비하는 사람은 무엇을 해야 하는지부터 모른다. 빈 목록을 주고
       * 채우라고 하면 그 목록은 영영 비어 있다.
       */
      const { headers, weddingId } = await mine();

      const body = (await tasks(headers, weddingId)).json<{
        tasks: { label: string }[];
        progress: { done: number; total: number };
      }>();

      expect(body.tasks).toHaveLength(TASK_PRESETS.length);
      expect(body.progress).toEqual({ done: 0, total: TASK_PRESETS.length });
    });

    it('지운 항목을 다시 깔지 않는다', async () => {
      // 다시 깔면 지우는 일이 아무 뜻이 없어진다.
      const { headers, weddingId } = await mine();
      const first = (await tasks(headers, weddingId)).json<{ tasks: { id: string }[] }>();

      await test.app.inject({
        method: 'DELETE',
        url: `/v1/weddings/${weddingId}/tasks/${first.tasks[0]!.id}`,
        headers,
      });

      const second = (await tasks(headers, weddingId)).json<{ tasks: unknown[] }>();

      expect(second.tasks).toHaveLength(TASK_PRESETS.length - 1);
    });

    it('날짜를 넣으면 상태가 따라온다', async () => {
      const { headers, weddingId } = await mine();
      const first = (await tasks(headers, weddingId)).json<{ tasks: { id: string }[] }>();

      await test.app.inject({
        method: 'PATCH',
        url: `/v1/weddings/${weddingId}/tasks/${first.tasks[0]!.id}`,
        headers,
        payload: { dueDate: at(1) },
      });

      const after = (await tasks(headers, weddingId)).json<{
        tasks: { id: string; state: string; manualState: boolean }[];
      }>();

      const task = after.tasks.find((row) => row.id === first.tasks[0]!.id)!;

      expect(task.state).toBe('in_progress');
      expect(task.manualState).toBe(false);
    });

    it('직접 지정하면 그 값이 이긴다', async () => {
      const { headers, weddingId } = await mine();
      const first = (await tasks(headers, weddingId)).json<{ tasks: { id: string }[] }>();
      const id = first.tasks[0]!.id;

      // 지난 날이라 자동으로는 '완료'가 되지만, 사람이 아니라고 말했으면 그쪽이 맞다.
      await test.app.inject({
        method: 'PATCH',
        url: `/v1/weddings/${weddingId}/tasks/${id}`,
        headers,
        payload: { dueDate: at(-5), state: 'in_progress' },
      });

      const after = (await tasks(headers, weddingId)).json<{
        tasks: { id: string; state: string; manualState: boolean }[];
      }>();

      const task = after.tasks.find((row) => row.id === id)!;

      expect(task.state).toBe('in_progress');
      expect(task.manualState).toBe(true);
    });

    it('보낸 칸만 고친다', async () => {
      // 날짜만 바꾸려던 사람이 업체까지 잃으면 안 된다.
      const { headers, weddingId } = await mine();
      const first = (await tasks(headers, weddingId)).json<{ tasks: { id: string }[] }>();
      const id = first.tasks[0]!.id;

      const patch = (payload: Record<string, unknown>) =>
        test.app.inject({
          method: 'PATCH',
          url: `/v1/weddings/${weddingId}/tasks/${id}`,
          headers,
          payload,
        });

      await patch({ vendorLabel: '스튜디오 이로' });
      await patch({ dueDate: at(3) });

      const after = (await tasks(headers, weddingId)).json<{
        tasks: { id: string; vendorLabel: string | null }[];
      }>();

      expect(after.tasks.find((row) => row.id === id)!.vendorLabel).toBe('스튜디오 이로');
    });

    it('남의 웨딩은 볼 수 없다', async () => {
      const { weddingId } = await mine();
      const stranger = await signInAs(test, 'apple-stranger');

      expect((await tasks(stranger.headers, weddingId)).statusCode).toBe(403);
    });
  });

  describe('지출내역', () => {
    it('Pick 인증이 지출로 들어온다', async () => {
      const { headers, weddingId } = await mine();

      await test.pool.query(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('가온예식홀', 'hall', '서울', 'public_data')`
      );

      await consentToPaymentProofs(test, headers);

      const registered = await test.app.inject({
        method: 'POST',
        url: '/v1/payment-proofs',
        headers,
        payload: {
          merchantName: '가온예식홀',
          paidAmount: 3_000_000,
          paidAt: '2026-05-20T04:00:00.000Z',
        },
      });

      expect(registered.statusCode).toBe(201);

      const body = (await expenses(headers, weddingId)).json<{
        paidTotal: number;
        expenses: { source: string; sourceLabel: string; bucket: string }[];
      }>();

      expect(body.paidTotal).toBe(3_000_000);
      // 어디서 온 값인지 줄마다 적는다.
      expect(body.expenses[0]!.source).toBe('payment_proof');
      expect(body.expenses[0]!.sourceLabel).toBe('Pick 인증 자료');
      expect(body.expenses[0]!.bucket).toBe('hall');
    });

    it('잔금은 합계에 더하지 않는다', async () => {
      /*
       * 더하면 "지금까지 결제한 금액"이 거짓말이 된다. 아직 안 냈다.
       */
      const { headers, weddingId } = await mine();

      const add = (payload: Record<string, unknown>) =>
        test.app.inject({
          method: 'POST',
          url: `/v1/weddings/${weddingId}/expenses`,
          headers,
          payload,
        });

      await add({ label: '계약금', amount: 3_000_000, category: 'hall' });
      await add({ label: '웨딩홀 잔금', amount: 20_000_000, status: 'scheduled', category: 'hall' });

      const body = (await expenses(headers, weddingId)).json<{
        paidTotal: number;
        scheduledTotal: number;
        scheduledNote: string;
      }>();

      expect(body.paidTotal).toBe(3_000_000);
      expect(body.scheduledTotal).toBe(20_000_000);
      expect(body.scheduledNote).toContain('아직 더하지 않았어요');
    });

    it('예산을 안 정했으면 지어내지 않는다', async () => {
      const { headers, weddingId } = await mine();

      const body = (await expenses(headers, weddingId)).json<{
        budget: { set: boolean; note?: string };
      }>();

      expect(body.budget.set).toBe(false);
      expect(body.budget.note).toContain('총 예산을 정하시면');
    });

    it('예산을 정하면 남은 금액을 준다', async () => {
      const { headers, weddingId } = await mine();

      await test.app.inject({
        method: 'PUT',
        url: `/v1/weddings/${weddingId}/budget`,
        headers,
        payload: { budget: 30_000_000 },
      });

      await test.app.inject({
        method: 'POST',
        url: `/v1/weddings/${weddingId}/expenses`,
        headers,
        payload: { label: '계약금', amount: 5_000_000 },
      });

      const body = (await expenses(headers, weddingId)).json<{
        budget: { set: boolean; remaining?: number };
      }>();

      expect(body.budget.remaining).toBe(25_000_000);
    });

    it('결제인증에서 온 줄은 지출내역에서 지울 수 없다', async () => {
      /*
       * 그건 지출 기록이 아니라 제보이고, 지우면 남의 분포에서도 빠진다. 제보를
       * 무르는 것은 다른 문이어야 한다.
       */
      const { headers, weddingId } = await mine();

      await test.pool.query(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('가온예식홀', 'hall', '서울', 'public_data')`
      );

      await consentToPaymentProofs(test, headers);

      const registered = await test.app.inject({
        method: 'POST',
        url: '/v1/payment-proofs',
        headers,
        payload: {
          merchantName: '가온예식홀',
          paidAmount: 3_000_000,
          paidAt: '2026-05-20T04:00:00.000Z',
        },
      });

      const proofId = registered.json<{ paymentProofId: string }>().paymentProofId;

      const removed = await test.app.inject({
        method: 'DELETE',
        url: `/v1/weddings/${weddingId}/expenses/${proofId}`,
        headers,
      });

      expect(removed.statusCode).toBe(404);

      const body = (await expenses(headers, weddingId)).json<{ paidTotal: number }>();

      expect(body.paidTotal).toBe(3_000_000);
    });
  });

  describe('방문노트', () => {
    it('업체를 못 찾아도 적을 수 있다', async () => {
      // 방문은 계약보다 먼저다.
      const { headers, weddingId } = await mine();

      const created = await test.app.inject({
        method: 'POST',
        url: `/v1/weddings/${weddingId}/visit-notes`,
        headers,
        payload: {
          vendorLabel: '아직 등록 안 된 홀',
          visitedOn: at(-3),
          quotedAmount: 28_000_000,
          memo: '식대 별도라고 함',
        },
      });

      expect(created.statusCode).toBe(201);

      const body = (
        await test.app.inject({
          method: 'GET',
          url: `/v1/weddings/${weddingId}/visit-notes`,
          headers,
        })
      ).json<{ notes: { vendorLabel: string; quotedAmount: number }[]; caveat: string }>();

      expect(body.notes[0]!.vendorLabel).toBe('아직 등록 안 된 홀');
      expect(body.notes[0]!.quotedAmount).toBe(28_000_000);
      expect(body.caveat).toContain('계약 금액이 아니고');
    });

    it('제안금액은 가격 통계에 들어가지 않는다', async () => {
      /*
       * 문서도 결제도 아니다. 방문해서 들은 말이다 — 그게 남의 화면에 중앙값으로
       * 나가면 우리는 들은 말을 사실로 파는 것이 된다.
       */
      const { headers, weddingId } = await mine();

      await test.app.inject({
        method: 'POST',
        url: `/v1/weddings/${weddingId}/visit-notes`,
        headers,
        payload: { vendorLabel: '가온예식홀', visitedOn: at(-1), quotedAmount: 28_000_000 },
      });

      for (const view of [
        'structured.comparable_quotes',
        'structured.usable_payment_proofs',
        'structured.usable_price_reports',
      ]) {
        const rows = await test.pool.query(`SELECT 1 FROM ${view}`);

        expect(rows.rows).toHaveLength(0);
      }
    });
  });
});
