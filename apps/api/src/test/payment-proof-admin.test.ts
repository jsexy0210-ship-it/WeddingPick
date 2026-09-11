import { NotAnOperator } from '../decisions';
import { link, list, pending, resolve } from '../payment-proof-admin';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 가맹점 이름이 여러 업체에 걸린 결제인증을 잇는다. 05번 명세 20번.
 *
 * `matchVendor`는 후보가 둘 이상이면 고르지 않고 `vendor_id`를 NULL로 둔다.
 * `usable_payment_proofs`는 그 조건을 보므로, 잇지 않으면 영원히 어느 업체의
 * 결제 구간에도 반영되지 않는다.
 */
describeWithDb('결제인증 잇기', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function anOperator(): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
    );

    return rows[0]!.id;
  }

  async function aVendor(name = '가온예식홀'): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, 'hall', '서울', 'public_data') RETURNING id`,
      [name]
    );

    return rows[0]!.id;
  }

  async function anUnmatchedProof(merchantName = '가온예식홀'): Promise<{ id: string; reporterId: string }> {
    const reporter = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );

    const proof = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.payment_proofs
         (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
       VALUES ($1, NULL, $2, 3000000, now())
       RETURNING id`,
      [reporter.rows[0]!.id, merchantName]
    );

    return { id: proof.rows[0]!.id, reporterId: reporter.rows[0]!.id };
  }

  const isUsable = async (proofId: string) =>
    (
      await test.pool.query('SELECT 1 FROM structured.usable_payment_proofs WHERE id = $1', [
        proofId,
      ])
    ).rowCount === 1;

  it('이으면 그 업체의 결제 구간에 반영된다', async () => {
    const { id: proofId } = await anUnmatchedProof();
    const vendorId = await aVendor();

    expect(await isUsable(proofId)).toBe(false);

    await link(test.pool, proofId, vendorId, await anOperator());

    expect(await isUsable(proofId)).toBe(true);

    const { rows } = await test.pool.query<{ vendor_id: string }>(
      'SELECT vendor_id FROM structured.payment_proofs WHERE id = $1',
      [proofId]
    );

    expect(rows[0]!.vendor_id).toBe(vendorId);
  });

  it('운영자가 아니면 이을 수 없다', async () => {
    const { id: proofId } = await anUnmatchedProof();
    const vendorId = await aVendor();
    const notOperator = (
      await test.pool.query<{ id: string }>('INSERT INTO structured.users DEFAULT VALUES RETURNING id')
    ).rows[0]!.id;

    await expect(link(test.pool, proofId, vendorId, notOperator)).rejects.toThrow(NotAnOperator);

    expect(await isUsable(proofId)).toBe(false);
  });

  it('없는 업체와는 이을 수 없다', async () => {
    const { id: proofId } = await anUnmatchedProof();
    const nowhere = '00000000-0000-0000-0000-000000000000';

    await expect(link(test.pool, proofId, nowhere, await anOperator())).rejects.toThrow('없는 업체다.');
  });

  it('이미 이어진 것은 다시 이을 수 없다', async () => {
    // 잇는다고 별칭으로 남기지 않으므로, 다시 잇는 시도는 실수로 다른 업체를
    // 덮어쓰려는 것일 수 있다. 조용히 넘어가지 않는다.
    const { id: proofId } = await anUnmatchedProof();
    const first = await aVendor('가온예식홀');
    const second = await aVendor('가온 웨딩홀 (별개 지점)');
    const operator = await anOperator();

    await link(test.pool, proofId, first, operator);

    await expect(link(test.pool, proofId, second, operator)).rejects.toThrow(
      '없는 결제인증이거나 이미 다른 업체와 연결돼 있다.'
    );

    const { rows } = await test.pool.query<{ vendor_id: string }>(
      'SELECT vendor_id FROM structured.payment_proofs WHERE id = $1',
      [proofId]
    );

    expect(rows[0]!.vendor_id).toBe(first);
  });

  it('후보 수는 진짜 숫자다 — pg가 count(*)를 문자열로 돌려줘도', async () => {
    // "0" === 0은 항상 거짓이라, number로 잘못 선언해두면 후보가 없어도
    // "등록된 업체 없음" 문구가 절대 안 뜬다(candidates === 0 비교가 실패).
    const { id: withoutCandidates } = await anUnmatchedProof('아무도 없는 가맹점');
    const { id: withCandidates } = await anUnmatchedProof('가온예식홀');
    await aVendor('가온예식홀');

    const rows = await list(test.pool);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));

    expect(byId[withoutCandidates]!.candidates).toBe(0);
    expect(byId[withCandidates]!.candidates).toBe(1);
  });
});

/**
 * 사진에서 읽지 못해 보류된 결제인증을 사람이 본다. 0150.
 *
 * **되돌릴 수 없는 조작이다.** 이 한 번으로 그 금액이 업체의 금액 구간과 그 사람의
 * 지출에 들어간다 — 그래서 사유를 받고 기록을 남긴다.
 */
describeWithDb('결제인증 검수', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function anOperator(): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
    );

    return rows[0]!.id;
  }

  async function aVendor(name = '가온예식홀'): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, 'hall', '서울', 'public_data') RETURNING id`,
      [name]
    );

    return rows[0]!.id;
  }

  /** 금액을 못 읽어 보류된 제보 하나. 업체는 이미 알고 있다. */
  async function aPendingProof(vendorId: string): Promise<string> {
    const reporter = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );

    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.payment_proofs
         (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at,
          review_state, pending_fields, review_note)
       VALUES ($1, $2, NULL, NULL, NULL,
               'pending_review', ARRAY['merchantName','paidAmount','paidAt']::payment_proof_field[],
               '올려주신 자료를 확인하고 있어요')
       RETURNING id`,
      [reporter.rows[0]!.id, vendorId]
    );

    return rows[0]!.id;
  }

  const isUsable = async (proofId: string) =>
    (
      await test.pool.query('SELECT 1 FROM structured.usable_payment_proofs WHERE id = $1', [
        proofId,
      ])
    ).rowCount === 1;

  it('검수 대기 목록에 선다 — 이어붙이기 목록과 섞이지 않는다', async () => {
    const proofId = await aPendingProof(await aVendor());

    const waiting = await pending(test.pool);
    expect(waiting.map((row) => row.id)).toEqual([proofId]);
    expect(waiting[0]!.pendingFields).toContain('paidAmount');

    /*
     * 이어붙이기 목록은 「읽기는 끝났는데 업체만 못 고른 것」이다. 못 읽은 줄이
     * 거기 서면 고를 수 없는 줄을 붙들고 있게 된다.
     */
    expect(await list(test.pool)).toHaveLength(0);
  });

  it('검수를 마치면 그때부터 쓰인다', async () => {
    const proofId = await aPendingProof(await aVendor());

    expect(await isUsable(proofId)).toBe(false);

    await resolve(
      test.pool,
      proofId,
      {
        merchantName: '가온예식홀',
        paidAmount: 3_000_000,
        paidAt: '2026-05-20T04:00:00.000Z',
        reasonCode: 'read_by_operator',
      },
      await anOperator()
    );

    expect(await isUsable(proofId)).toBe(true);

    const { rows } = await test.pool.query<{ review_state: string; pending_fields: string[] }>(
      `SELECT review_state, pending_fields::text[] AS pending_fields
       FROM structured.payment_proofs WHERE id = $1`,
      [proofId]
    );

    expect(rows[0]!.review_state).toBe('accepted');
    expect(rows[0]!.pending_fields).toEqual([]);
  });

  it('누가 왜 넣었는지가 남는다', async () => {
    const proofId = await aPendingProof(await aVendor());
    const operator = await anOperator();

    await resolve(
      test.pool,
      proofId,
      {
        merchantName: '가온예식홀',
        paidAmount: 3_000_000,
        paidAt: '2026-05-20T04:00:00.000Z',
        reasonCode: 'read_by_operator',
      },
      operator
    );

    const { rows } = await test.pool.query<{
      actor_user_id: string;
      reason_code: string;
      evidence_refs: { kind: string; id: string }[];
    }>(
      `SELECT actor_user_id, reason_code, evidence_refs
       FROM structured.decisions
       WHERE subject_kind = 'payment_proof' AND subject_id = $1`,
      [proofId]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.actor_user_id).toBe(operator);
    expect(rows[0]!.reason_code).toBe('read_by_operator');
    // 근거는 가리키기만 한다. 금액도 가맹점명도 로그에 복사되지 않는다.
    expect(rows[0]!.evidence_refs).toEqual([{ kind: 'payment_proof', id: proofId }]);
  });

  it('운영자가 아니면 검수할 수 없다', async () => {
    const proofId = await aPendingProof(await aVendor());
    const notOperator = (
      await test.pool.query<{ id: string }>('INSERT INTO structured.users DEFAULT VALUES RETURNING id')
    ).rows[0]!.id;

    await expect(
      resolve(
        test.pool,
        proofId,
        {
          merchantName: '가온예식홀',
          paidAmount: 3_000_000,
          paidAt: '2026-05-20T04:00:00.000Z',
          reasonCode: 'read_by_operator',
        },
        notOperator
      )
    ).rejects.toThrow(NotAnOperator);

    expect(await isUsable(proofId)).toBe(false);
  });

  it('말이 안 되는 값으로는 검수를 마칠 수 없다', async () => {
    const proofId = await aPendingProof(await aVendor());

    // 앞으로의 결제는 없다. 운영자가 적더라도 같은 잣대로 본다.
    await expect(
      resolve(
        test.pool,
        proofId,
        {
          merchantName: '가온예식홀',
          paidAmount: 3_000_000,
          paidAt: '2099-01-01T00:00:00.000Z',
          reasonCode: 'read_by_operator',
        },
        await anOperator()
      )
    ).rejects.toThrow();

    expect(await isUsable(proofId)).toBe(false);
  });

  it('이미 검수가 끝난 것은 다시 고칠 수 없다', async () => {
    const proofId = await aPendingProof(await aVendor());
    const operator = await anOperator();
    const values = {
      merchantName: '가온예식홀',
      paidAmount: 3_000_000,
      paidAt: '2026-05-20T04:00:00.000Z',
      reasonCode: 'read_by_operator',
    };

    await resolve(test.pool, proofId, values, operator);

    await expect(
      resolve(test.pool, proofId, { ...values, paidAmount: 9_000_000 }, operator)
    ).rejects.toThrow('없는 결제인증이거나 이미 검수가 끝났다.');

    const { rows } = await test.pool.query<{ paid_amount: string }>(
      'SELECT paid_amount FROM structured.payment_proofs WHERE id = $1',
      [proofId]
    );

    expect(Number(rows[0]!.paid_amount)).toBe(3_000_000);
  });
});
