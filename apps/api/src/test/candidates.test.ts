import { MAX_CANDIDATES } from '@weddingpick/domain';

import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 후보 저장.
 *
 * 요점은 하나다 — **사람이 아니라 웨딩에 매달려 있다.** 배우자와 같은 목록을 보지
 * 못하면 각자 다른 목록을 들고 같은 이야기를 하게 된다(사업계획서 12번).
 */
describeWithDb('후보 저장', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function createVendor(name: string, category = 'hall') {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, $2::vendor_category, '서울', 'public_data') RETURNING id`,
      [name, category]
    );

    return rows[0]!.id;
  }

  async function add(
    headers: Record<string, string>,
    weddingId: string,
    vendorId: string,
    note?: string
  ) {
    return await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/candidates`,
      headers,
      payload: { vendorId, ...(note ? { note } : {}) },
    });
  }

  async function list(headers: Record<string, string>, weddingId: string) {
    return await test.app.inject({
      method: 'GET',
      url: `/v1/weddings/${weddingId}/candidates`,
      headers,
    });
  }

  /** 배우자를 연결한 웨딩 하나. */
  async function weddingWithPartner() {
    const owner = await signInAs(test, 'apple-owner');
    const weddingId = await createWedding(test, owner.headers);
    const partner = await signInAs(test, 'apple-partner');

    await test.pool.query('UPDATE structured.weddings SET partner_user_id = $2 WHERE id = $1', [
      weddingId,
      partner.userId,
    ]);

    return { owner, partner, weddingId };
  }

  it('담고 나면 목록에 나온다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const vendorId = await createVendor('가온예식홀');

    expect((await add(headers, weddingId, vendorId, '음식이 좋다고 함')).statusCode).toBe(201);

    const body = list(headers, weddingId);
    const groups = (await body).json<{
      groups: { category: string; candidates: { vendorName: string; note: string }[] }[];
      total: number;
    }>();

    expect(groups.total).toBe(1);
    expect(groups.groups[0]!.candidates[0]!.vendorName).toBe('가온예식홀');
    // 몇 달 뒤에 보면 왜 담았는지 잊는다.
    expect(groups.groups[0]!.candidates[0]!.note).toBe('음식이 좋다고 함');
  });

  it('배우자가 담은 곳을 내가 본다', async () => {
    const { owner, partner, weddingId } = await weddingWithPartner();
    const vendorId = await createVendor('가온예식홀');

    await add(partner.headers, weddingId, vendorId);

    const body = (await list(owner.headers, weddingId)).json<{
      groups: { candidates: { addedByPartner: boolean }[] }[];
    }>();

    expect(body.groups[0]!.candidates).toHaveLength(1);
    // 상대가 마음에 들어 한 곳인지 알아야 이야기가 된다.
    expect(body.groups[0]!.candidates[0]!.addedByPartner).toBe(true);
  });

  it('내가 담은 것은 배우자 표시가 붙지 않는다', async () => {
    const { owner, weddingId } = await weddingWithPartner();

    await add(owner.headers, weddingId, await createVendor('가온예식홀'));

    const body = (await list(owner.headers, weddingId)).json<{
      groups: { candidates: { addedByPartner: boolean }[] }[];
    }>();

    expect(body.groups[0]!.candidates[0]!.addedByPartner).toBe(false);
  });

  it('배우자가 담은 것도 뺄 수 있다', async () => {
    /*
     * 담은 사람만 뺄 수 있게 하면 "저건 네가 담은 거니 네가 빼"가 되고, 그건 함께
     * 고르는 것이 아니다.
     */
    const { owner, partner, weddingId } = await weddingWithPartner();
    const vendorId = await createVendor('가온예식홀');

    const created = await add(partner.headers, weddingId, vendorId);
    const candidateId = created.json<{ candidateId: string }>().candidateId;

    const removed = await test.app.inject({
      method: 'DELETE',
      url: `/v1/weddings/${weddingId}/candidates/${candidateId}`,
      headers: owner.headers,
    });

    expect(removed.statusCode).toBe(204);
    expect((await list(owner.headers, weddingId)).json<{ total: number }>().total).toBe(0);
  });

  it('남의 웨딩에는 담을 수 없다', async () => {
    const mine = await signInAs(test, 'apple-mine');
    const weddingId = await createWedding(test, mine.headers);
    const stranger = await signInAs(test, 'apple-stranger');

    const response = await add(stranger.headers, weddingId, await createVendor('가온예식홀'));

    expect(response.statusCode).toBe(403);
  });

  it('같은 업체를 두 번 담을 수 없다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const vendorId = await createVendor('가온예식홀');

    await add(headers, weddingId, vendorId);

    // 목록에 같은 이름이 두 번 나오면 지운 줄 안다.
    expect((await add(headers, weddingId, vendorId)).statusCode).toBe(409);
  });

  it('업종별로 나눠 준다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);

    await add(headers, weddingId, await createVendor('가온예식홀', 'hall'));
    await add(headers, weddingId, await createVendor('한빛예식홀', 'hall'));
    await add(headers, weddingId, await createVendor('스튜디오온', 'sdm'));

    const body = (await list(headers, weddingId)).json<{
      groups: { category: string; categoryLabel: string; comparable: boolean }[];
    }>();

    const halls = body.groups.find((group) => group.category === 'hall')!;
    const sdm = body.groups.find((group) => group.category === 'sdm')!;

    // 비교는 같은 업종끼리만 뜻이 있다. 웨딩홀과 스튜디오를 나란히 놓은 표는
    // 아무것도 말하지 않는다.
    expect(halls.comparable).toBe(true);
    expect(sdm.comparable).toBe(false);
    // 화면에 나가는 것은 우리말 이름이지 내부 키가 아니다.
    expect(halls.categoryLabel).toMatch(/[가-힣]/);
  });

  it('상한을 넘기면 이유와 함께 막는다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);

    for (let index = 0; index < MAX_CANDIDATES; index += 1) {
      const response = await add(headers, weddingId, await createVendor(`업체${index}`));

      expect(response.statusCode).toBe(201);
    }

    const over = await add(headers, weddingId, await createVendor('한 곳 더'));

    expect(over.statusCode).toBe(400);
    // 왜 안 되는지와 무엇을 하면 되는지를 말한다. 트리거 예외는 사람이 읽을 말이 아니다.
    expect(over.json<{ error: { message: string } }>().error.message).toContain('빼주세요');
  });

  it('로그인해야 담을 수 있다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/candidates`,
      payload: { vendorId: '00000000-0000-0000-0000-000000000000' },
    });

    expect(response.statusCode).toBe(401);
  });

  describe('최종 결정', () => {
    const decide = (
      headers: Record<string, string>,
      weddingId: string,
      category: string,
      vendorId: string
    ) =>
      test.app.inject({
        method: 'PUT',
        url: `/v1/weddings/${weddingId}/decisions`,
        headers,
        payload: { category, vendorId },
      });

    it('Pick한 곳으로 정하면 그 업종이 결정 완료가 된다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const vendorId = await createVendor('가온예식홀');

      await add(headers, weddingId, vendorId);

      expect((await decide(headers, weddingId, 'hall', vendorId)).statusCode).toBe(204);

      const body = (await list(headers, weddingId)).json<{
        groups: { category: string; state: string; stateLabel: string; decidedVendorId: string }[];
      }>();

      const hall = body.groups.find((group) => group.category === 'hall');

      expect(hall?.state).toBe('decided');
      expect(hall?.stateLabel).toBe('결정 완료');
      expect(hall?.decidedVendorId).toBe(vendorId);
    });

    it('Pick하지 않은 곳으로는 정할 수 없다', async () => {
      /*
       * 담아두지도 않은 곳으로 정해져 있는 상태가 생기면 안 된다. 표의 외래키가
       * 이미 막지만 사용자는 읽을 수 있는 말을 받아야 한다.
       */
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const vendorId = await createVendor('안 담은 홀');

      const response = await decide(headers, weddingId, 'hall', vendorId);

      expect(response.statusCode).toBe(400);
      expect(response.json<{ error: { message: string } }>().error.message).toContain('Pick한 곳');
    });

    it('업종이 맞지 않으면 받지 않는다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const vendorId = await createVendor('스튜디오하나', 'sdm');

      await add(headers, weddingId, vendorId);

      expect((await decide(headers, weddingId, 'hall', vendorId)).statusCode).toBe(400);
    });

    it('다시 정하면 바뀐다', async () => {
      // 마음이 바뀌는 일이라 되돌릴 수 없게 두지 않는다.
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const first = await createVendor('첫째 홀');
      const second = await createVendor('둘째 홀');

      await add(headers, weddingId, first);
      await add(headers, weddingId, second);
      await decide(headers, weddingId, 'hall', first);

      expect((await decide(headers, weddingId, 'hall', second)).statusCode).toBe(204);

      const body = (await list(headers, weddingId)).json<{
        groups: { category: string; decidedVendorId: string }[];
      }>();

      expect(body.groups.find((group) => group.category === 'hall')?.decidedVendorId).toBe(second);
    });

    it('결정을 되돌리면 다시 후보를 고르는 중이 된다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const vendorId = await createVendor('가온예식홀');

      await add(headers, weddingId, vendorId);
      await decide(headers, weddingId, 'hall', vendorId);

      const removed = await test.app.inject({
        method: 'DELETE',
        url: `/v1/weddings/${weddingId}/decisions/hall`,
        headers,
      });

      expect(removed.statusCode).toBe(204);

      const body = (await list(headers, weddingId)).json<{
        groups: { category: string; state: string }[];
      }>();

      expect(body.groups.find((group) => group.category === 'hall')?.state).toBe('picking');
    });

    it('Pick에서 빼면 결정도 함께 사라진다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const vendorId = await createVendor('가온예식홀');

      const added = await add(headers, weddingId, vendorId);
      const candidateId = added.json<{ candidateId: string }>().candidateId;

      await decide(headers, weddingId, 'hall', vendorId);

      await test.app.inject({
        method: 'DELETE',
        url: `/v1/weddings/${weddingId}/candidates/${candidateId}`,
        headers,
      });

      const left = await test.pool.query('SELECT 1 FROM structured.category_decisions');

      expect(left.rows).toHaveLength(0);
    });

    it('진행률의 분모는 업종 수다', async () => {
      /*
       * 담은 후보 수를 분모로 쓰면 많이 담을수록 진행률이 떨어진다. 그건 열심히
       * 한 사람을 벌주는 셈이다.
       */
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);
      const vendorId = await createVendor('가온예식홀');

      await add(headers, weddingId, vendorId);
      await add(headers, weddingId, await createVendor('둘째 홀'));
      await decide(headers, weddingId, 'hall', vendorId);

      const body = (await list(headers, weddingId)).json<{
        progress: { decided: number; total: number; label: string };
      }>();

      expect(body.progress.decided).toBe(1);
      expect(body.progress.total).toBeGreaterThan(1);
      expect(body.progress.label).toBe(`1/${body.progress.total} 완료`);
    });

    it('담다 만 업종을 다음으로 권한다', async () => {
      const { headers } = await signInAs(test);
      const weddingId = await createWedding(test, headers);

      await add(headers, weddingId, await createVendor('스튜디오하나', 'sdm'));

      const body = (await list(headers, weddingId)).json<{ nextCategory: string }>();

      expect(body.nextCategory).toBe('sdm');
    });
  });
});
