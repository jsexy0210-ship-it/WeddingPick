import { TASK_PRESETS } from '@weddingpick/domain';

import {
  consentToPaymentProofs,
  createTestApp,
  createWedding,
  resetDatabase,
  signInAs,
  type TestApp,
} from './helpers';

async function weddingWithPartner(test: TestApp) {
  const owner = await signInAs(test, 'apple-owner');
  const weddingId = await createWedding(test, owner.headers);
  const partner = await signInAs(test, 'apple-partner');

  await test.pool.query('UPDATE structured.weddings SET partner_user_id = $2 WHERE id = $1', [
    weddingId,
    partner.userId,
  ]);

  return { owner, partner, weddingId };
}

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

    it('온보딩에서 고른 예산 구간은 숫자 예산과 별개로 내려온다', async () => {
      /*
       * «4,000만원 이상»은 상한이 없어 budget.set은 계속 false다 — 그래도 이미
       * 답했다는 사실은 budgetBracket으로 구분해야, 지출 화면이 답한 사람에게
       * 예산 정하기 시트를 다시 들이밀지 않는다.
       */
      const { headers, weddingId } = await mine();

      await test.app.inject({
        method: 'POST',
        url: '/v1/me/setup',
        headers,
        payload: { weddingDate: at(200), region: '서울', budgetBracket: 'over_30m' },
      });

      const body = (await expenses(headers, weddingId)).json<{
        budget: { set: boolean };
        budgetBracket: string | null;
      }>();

      expect(body.budget.set).toBe(false);
      expect(body.budgetBracket).toBe('over_30m');
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

  /**
   * 지출 상세. WP-OUR-010.
   */
  describe('지출 상세', () => {
    const detail = (headers: Record<string, string>, weddingId: string, expenseId: string) =>
      test.app.inject({
        method: 'GET',
        url: `/v1/weddings/${weddingId}/expenses/${expenseId}`,
        headers,
      });

    it('직접 입력한 항목은 환불 상태가 기본값 정상이고 분할 결제가 비어 있다', async () => {
      const { headers, weddingId } = await mine();

      const added = await test.app.inject({
        method: 'POST',
        url: `/v1/weddings/${weddingId}/expenses`,
        headers,
        payload: { label: '계약금', amount: 3_000_000, category: 'hall' },
      });

      const { expenseId } = added.json<{ expenseId: string }>();

      const body = (await detail(headers, weddingId, expenseId)).json<{
        refundStatus: string;
        refundStatusLabel: string;
        splitPayments: unknown[];
        bucketLabel: string;
        source: string;
      }>();

      expect(body.refundStatus).toBe('normal');
      expect(body.refundStatusLabel).toBe('정상');
      expect(body.splitPayments).toEqual([]);
      expect(body.bucketLabel).toBe('웨딩홀');
      expect(body.source).toBe('manual');
    });

    it('환불 상태를 고칠 수 있다', async () => {
      const { headers, weddingId } = await mine();

      const added = await test.app.inject({
        method: 'POST',
        url: `/v1/weddings/${weddingId}/expenses`,
        headers,
        payload: { label: '계약금', amount: 3_000_000 },
      });

      const { expenseId } = added.json<{ expenseId: string }>();

      const updated = await test.app.inject({
        method: 'PATCH',
        url: `/v1/weddings/${weddingId}/expenses/${expenseId}`,
        headers,
        payload: { refundStatus: 'partial_refund' },
      });

      expect(updated.statusCode).toBe(200);

      const body = (await detail(headers, weddingId, expenseId)).json<{
        refundStatus: string;
        refundStatusLabel: string;
      }>();

      expect(body.refundStatus).toBe('partial_refund');
      expect(body.refundStatusLabel).toBe('부분환불');
    });

    it('결제인증에서 온 줄도 상세를 볼 수 있고 환불 상태는 늘 정상이다', async () => {
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

      const body = (await detail(headers, weddingId, proofId)).json<{
        source: string;
        refundStatus: string;
        splitPayments: unknown[];
      }>();

      expect(body.source).toBe('payment_proof');
      expect(body.refundStatus).toBe('normal');
      expect(body.splitPayments).toEqual([]);
    });

    it('없는 지출은 404다', async () => {
      const { headers, weddingId } = await mine();

      const response = await detail(headers, weddingId, '00000000-0000-4000-8000-000000000000');

      expect(response.statusCode).toBe(404);
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

  /**
   * 메모. WP-OUR-011.
   *
   * 규칙 — 작성자와 수정 여부를 항상 남긴다. 동시 수정 충돌은 version으로 판정한다.
   */
  describe('메모', () => {
    const notes = (headers: Record<string, string>, weddingId: string) =>
      test.app.inject({ method: 'GET', url: `/v1/weddings/${weddingId}/notes`, headers });

    it('업체별 메모와 자유 메모를 둘 다 담을 수 있다', async () => {
      const { headers, weddingId } = await mine();

      await test.app.inject({
        method: 'POST',
        url: `/v1/weddings/${weddingId}/notes`,
        headers,
        payload: { vendorLabel: '가온예식홀', body: '식대 별도라고 함' },
      });

      await test.app.inject({
        method: 'POST',
        url: `/v1/weddings/${weddingId}/notes`,
        headers,
        payload: { body: '이번 주말에 상견례' },
      });

      const body = (await notes(headers, weddingId)).json<{
        notes: { vendorLabel: string | null; body: string; authoredByPartner: boolean; edited: boolean }[];
      }>();

      expect(body.notes).toHaveLength(2);
      expect(body.notes.find((n) => n.vendorLabel === '가온예식홀')?.body).toBe('식대 별도라고 함');
      expect(body.notes.find((n) => n.vendorLabel === null)?.body).toBe('이번 주말에 상견례');
      expect(body.notes.every((n) => n.authoredByPartner === false)).toBe(true);
      expect(body.notes.every((n) => n.edited === false)).toBe(true);
    });

    it('배우자가 쓴 메모인지 안다', async () => {
      const { owner, partner, weddingId } = await weddingWithPartner(test);

      await test.app.inject({
        method: 'POST',
        url: `/v1/weddings/${weddingId}/notes`,
        headers: partner.headers,
        payload: { body: '드레스 예약 완료' },
      });

      const body = (await notes(owner.headers, weddingId)).json<{
        notes: { authoredByPartner: boolean }[];
      }>();

      expect(body.notes[0]!.authoredByPartner).toBe(true);
    });

    it('고치면 수정됨으로 남는다', async () => {
      const { headers, weddingId } = await mine();

      const created = await test.app.inject({
        method: 'POST',
        url: `/v1/weddings/${weddingId}/notes`,
        headers,
        payload: { body: '식대 별도라고 함' },
      });

      const { noteId } = created.json<{ noteId: string }>();

      const firstList = (await notes(headers, weddingId)).json<{ notes: { version: number }[] }>();
      const version = firstList.notes[0]!.version;

      const updated = await test.app.inject({
        method: 'PATCH',
        url: `/v1/weddings/${weddingId}/notes/${noteId}`,
        headers,
        payload: { body: '식대 포함이라고 정정', version },
      });

      expect(updated.statusCode).toBe(200);

      const after = (await notes(headers, weddingId)).json<{
        notes: { body: string; edited: boolean; editedByPartner: boolean | null }[];
      }>();

      expect(after.notes[0]!.body).toBe('식대 포함이라고 정정');
      expect(after.notes[0]!.edited).toBe(true);
      expect(after.notes[0]!.editedByPartner).toBe(false);
    });

    it('배우자가 먼저 고치면 conflict를 돌려준다', async () => {
      /*
       * 그대로 덮어쓰면 배우자의 수정이 조용히 사라진다. 화면이 결론을 내리게
       * conflict를 돌려준다(WP-CPL-005 conflict 화면).
       */
      const { owner, partner, weddingId } = await weddingWithPartner(test);

      const created = await test.app.inject({
        method: 'POST',
        url: `/v1/weddings/${weddingId}/notes`,
        headers: owner.headers,
        payload: { body: '식대 별도라고 함' },
      });

      const { noteId } = created.json<{ noteId: string }>();

      // 배우자가 먼저 고친다 — version이 2로 올라간다.
      await test.app.inject({
        method: 'PATCH',
        url: `/v1/weddings/${weddingId}/notes/${noteId}`,
        headers: partner.headers,
        payload: { body: '배우자가 먼저 고침', version: 1 },
      });

      // 내가 옛 version(1)을 들고 고치려 한다.
      const conflict = await test.app.inject({
        method: 'PATCH',
        url: `/v1/weddings/${weddingId}/notes/${noteId}`,
        headers: owner.headers,
        payload: { body: '내가 나중에 고침', version: 1 },
      });

      expect(conflict.statusCode).toBe(409);
      expect(conflict.json<{ error: { code: string } }>().error.code).toBe('conflict');

      // 배우자의 수정은 그대로 남아 있다.
      const after = (await notes(owner.headers, weddingId)).json<{ notes: { body: string }[] }>();

      expect(after.notes[0]!.body).toBe('배우자가 먼저 고침');
    });

    it('지울 수 있다', async () => {
      const { headers, weddingId } = await mine();

      const created = await test.app.inject({
        method: 'POST',
        url: `/v1/weddings/${weddingId}/notes`,
        headers,
        payload: { body: '지울 메모' },
      });

      const { noteId } = created.json<{ noteId: string }>();

      const removed = await test.app.inject({
        method: 'DELETE',
        url: `/v1/weddings/${weddingId}/notes/${noteId}`,
        headers,
      });

      expect(removed.statusCode).toBe(204);

      const after = (await notes(headers, weddingId)).json<{ notes: unknown[] }>();

      expect(after.notes).toHaveLength(0);
    });

    it('남의 웨딩 메모는 볼 수 없다', async () => {
      const { weddingId } = await mine();
      const stranger = await signInAs(test, 'apple-stranger-notes');

      expect((await notes(stranger.headers, weddingId)).statusCode).toBe(403);
    });
  });
});
