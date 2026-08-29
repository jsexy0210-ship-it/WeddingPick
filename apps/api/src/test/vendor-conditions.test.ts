import {
  DEEP_DATA_NOTE,
  NARROWED_NOT_ENOUGH,
  RECENT_PERIOD_LABEL,
  requiredCount,
} from '@weddingpick/domain';

import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 조건이 비슷한 결제 사례. 최종통합정책 v2.0 D-1 · C-3 · C-4.
 *
 * 좁힐수록 더 많은 건수를 요구하고, 못 보여줄 바에는 넓게라도 보여준다.
 */
describeWithDb('조건이 비슷한 사례', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function aVendor(name: string, region: string) {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, 'hall', $2, 'public_data') RETURNING id`,
      [name, region]
    );

    return rows[0]!.id;
  }

  /** 결제인증을 직접 심는다. 등록 경로는 다른 시험의 몫이다. */
  async function addProofs(
    vendorId: string,
    count: number,
    options: { monthsAgo?: number; amount?: number } = {}
  ) {
    for (let i = 0; i < count; i += 1) {
      await test.pool.query(
        `WITH reporter AS (INSERT INTO structured.users DEFAULT VALUES RETURNING id)
         INSERT INTO structured.payment_proofs
           (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
         SELECT reporter.id, $1, '가맹점', $2, now() - ($3 || ' months')::interval
         FROM reporter`,
        [vendorId, (options.amount ?? 3_000_000) + i * 10_000, options.monthsAgo ?? 1]
      );
    }
  }

  /** 이 사람이 낸 결제인증 한 건. 깊이를 여는 것은 이것이다(K-6). */
  async function ownProof(userId: string, vendorId: string) {
    await test.pool.query(
      `INSERT INTO structured.payment_proofs
         (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
       VALUES ($1, $2, '내 결제', 1_000_000, now() - interval '1 month')`,
      [userId, vendorId]
    );
  }

  const ask = (vendorId: string, headers: Record<string, string> = {}) =>
    test.app.inject({ method: 'GET', url: `/v1/vendors/${vendorId}/conditions`, headers });

  it('결제인증이 없으면 여는 방법을 알려준다', async () => {
    /*
     * 막는 것이 아니라 여는 방법을 말한다. 결제인증이 여는 것은 접근이 아니라
     * 깊이다(K-6) — 실제 결제 구간은 이 사람도 이미 보고 있다.
     */
    const vendorId = await aVendor('가온예식홀', '서울 강남구');
    const response = await ask(vendorId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ available: false, note: DEEP_DATA_NOTE });
  });

  it('낼 수 없을 때는 금액이 응답에 아예 없다', async () => {
    // 비워 보내면 화면이 0원이나 빈 구간을 그릴 여지가 남는다.
    const vendorId = await aVendor('가온예식홀', '서울 강남구');
    const response = await ask(vendorId);

    expect(response.json()).not.toHaveProperty('price');
  });

  it('데이터가 모자라면 개인정보 탓을 하지 않는다', async () => {
    const who = await signInAs(test, 'deep');
    const vendorId = await aVendor('가온예식홀', '서울 강남구');

    await ownProof(who.userId, vendorId);

    const response = await ask(vendorId, who.headers);
    const body = response.json<{ available: boolean; note: string }>();

    expect(body.available).toBe(false);
    expect(body.note).toBe(NARROWED_NOT_ENOUGH);
    expect(body.note).not.toContain('개인정보');
  });

  it('좁힌 조건이 모자라면 넓은 조건으로 보여준다', async () => {
    /*
     * C-4의 "묶거나 숨긴다"에서 묶는 쪽이다. 못 보여줄 바에는 넓게라도 보여준다.
     *
     * 서울에 requiredCount(1)만큼 모으고 부산에 나머지를 둬서, 지역으로 좁힌
     * 겹은 모자라고 전국 겹만 되는 상태를 만든다.
     */
    const who = await signInAs(test, 'deep');
    const seoul = await aVendor('가온예식홀', '서울 강남구');
    const busan = await aVendor('해운대홀', '부산 해운대구');

    await ownProof(who.userId, seoul);
    // 전국은 넘기고 지역은 모자라게.
    await addProofs(seoul, requiredCount(1) - 2);
    await addProofs(busan, requiredCount(0));

    const body = (await ask(seoul, who.headers)).json<{
      available: boolean;
      condition: string;
      axes: number;
    }>();

    expect(body.available).toBe(true);
    expect(body.axes).toBe(0);
    expect(body.condition).toContain('전국');
  });

  it('충분히 모이면 지역까지 좁혀 보여준다', async () => {
    const who = await signInAs(test, 'deep');
    const seoul = await aVendor('가온예식홀', '서울 강남구');

    await ownProof(who.userId, seoul);
    // 최근 3개월 밖에 둬서 시기 겹은 모자라게 한다.
    await addProofs(seoul, requiredCount(1), { monthsAgo: 6 });

    const body = (await ask(seoul, who.headers)).json<{
      condition: string;
      axes: number;
    }>();

    expect(body.axes).toBe(1);
    expect(body.condition).toContain('서울');
    // 구까지 좁혀 적지 않는다. "그 동네에서 결혼한 사람"이 되면 안 된다.
    expect(body.condition).not.toContain('강남구');
  });

  it('가장 좁은 겹까지 되면 시기도 함께 적는다', async () => {
    const who = await signInAs(test, 'deep');
    const seoul = await aVendor('가온예식홀', '서울 강남구');

    await ownProof(who.userId, seoul);
    await addProofs(seoul, requiredCount(2), { monthsAgo: 1 });

    const body = (await ask(seoul, who.headers)).json<{
      condition: string;
      axes: number;
    }>();

    expect(body.axes).toBe(2);
    expect(body.condition).toContain('최근 3개월');
  });

  it('캡션의 기간이 실제로 거른 기간과 같다', async () => {
    /*
     * 시기까지 좁힌 겹은 최근 3개월만 세는데 캡션이 12개월이라고 적으면, 조건과
     * 캡션이 서로 다른 말을 하게 된다. 라벨이 사실보다 앞서면 안 된다.
     */
    const who = await signInAs(test, 'deep');
    const seoul = await aVendor('가온예식홀', '서울 강남구');

    await ownProof(who.userId, seoul);
    await addProofs(seoul, requiredCount(2), { monthsAgo: 1 });

    const body = (await ask(seoul, who.headers)).json<{
      condition: string;
      price: { caption: string };
    }>();

    expect(body.price.caption).toContain(RECENT_PERIOD_LABEL);
    expect(body.price.caption).not.toContain('12개월');
  });

  it('다른 업종은 섞이지 않는다', async () => {
    const who = await signInAs(test, 'deep');
    const seoul = await aVendor('가온예식홀', '서울 강남구');

    const studio = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ('스튜디오하나', 'sdm', '서울 강남구', 'public_data') RETURNING id`
    );

    await ownProof(who.userId, seoul);
    await addProofs(studio.rows[0]!.id, requiredCount(2) * 2);

    const body = (await ask(seoul, who.headers)).json<{ available: boolean }>();

    expect(body.available).toBe(false);
  });

  it('없는 업체는 404다', async () => {
    const who = await signInAs(test, 'deep');

    const response = await ask('00000000-0000-0000-0000-000000000000', who.headers);

    expect(response.statusCode).toBe(404);
  });
});
