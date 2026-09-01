import { NotAnOperator } from '../decisions';
import { link } from '../payment-proof-admin';
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
});
