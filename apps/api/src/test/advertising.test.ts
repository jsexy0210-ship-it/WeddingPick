import { SPONSORED_LABEL } from '@weddingpick/domain';

import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 광고와 자연 결과의 분리. 최종통합정책 v2.0 E장.
 *
 * 요점은 하나다 — **광고를 넣어도 자연 결과가 달라지지 않는다.**
 */
describeWithDb('광고 지면', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function aVendor(name: string, category = 'hall', region = '서울 강남구') {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, $2::vendor_category, $3, 'public_data') RETURNING id`,
      [name, category, region]
    );

    return rows[0]!.id;
  }

  async function place(
    vendorId: string,
    over: { category?: string; region?: string; days?: [number, number] } = {}
  ) {
    const [from, to] = over.days ?? [-1, 30];

    await test.pool.query(
      `INSERT INTO ads.placements (vendor_id, surface, category, region, starts_on, ends_on)
       VALUES ($1, 'search', $2::vendor_category, $3, current_date + $4::int, current_date + $5::int)`,
      [vendorId, over.category ?? null, over.region ?? null, from, to]
    );
  }

  const search = (query = '') =>
    test.app.inject({ method: 'GET', url: `/v1/vendors${query}` });

  it('광고가 없으면 빈 배열이다', async () => {
    await aVendor('가온예식홀');

    const body = (await search()).json<{ sponsored: unknown[] }>();

    expect(body.sponsored).toEqual([]);
  });

  it('광고는 자연 결과와 다른 배열에 담긴다', async () => {
    /*
     * E-1. 같은 배열에 넣고 배지만 붙이면 화면이 섞어 그릴 수 있고, 배지를 못 본
     * 사람에게 그건 그냥 검색 결과다.
     */
    const paid = await aVendor('광고홀');
    await aVendor('보통홀');
    await place(paid);

    const response = await search();
    const body = response.json<{
      vendors: { id: string }[];
      sponsored: { vendorId: string; label: string }[];
    }>();

    expect(response.statusCode).toBe(200);
    expect(body.sponsored).toHaveLength(1);
    expect(body.sponsored[0]?.vendorId).toBe(paid);
    expect(body.sponsored[0]?.label).toBe(SPONSORED_LABEL);
  });

  it('광고를 넣어도 자연 결과의 순서와 개수가 그대로다', async () => {
    /*
     * E-1의 핵심. 광고비는 자연 검색 품질점수에 영향을 주지 않는다 — 넣기 전과
     * 후를 그대로 견줘본다.
     */
    const paid = await aVendor('가온예식홀');
    await aVendor('나루컨벤션');
    await aVendor('다온홀');

    const before = (await search()).json<{ vendors: { id: string }[]; total: number }>();

    await place(paid);

    const after = (await search()).json<{ vendors: { id: string }[]; total: number }>();

    expect(after.vendors.map((row) => row.id)).toEqual(before.vendors.map((row) => row.id));
    expect(after.total).toBe(before.total);
  });

  it('광고로 실린 업체도 자연 결과에서 빠지지 않는다', async () => {
    // 빼버리면 그것도 광고가 순위를 건드린 것이다. 값을 치렀다고 목록에서 지우지 않는다.
    const paid = await aVendor('가온예식홀');
    await place(paid);

    const body = (await search()).json<{ vendors: { id: string }[] }>();

    expect(body.vendors.map((row) => row.id)).toContain(paid);
  });

  it('기간이 지난 광고는 실리지 않는다', async () => {
    const paid = await aVendor('지난홀');
    await place(paid, { days: [-30, -1] });

    expect((await search()).json<{ sponsored: unknown[] }>().sponsored).toEqual([]);
  });

  it('업종을 걸어둔 광고는 그 업종에서만 실린다', async () => {
    const paid = await aVendor('스튜디오하나', 'sdm');
    await place(paid, { category: 'sdm' });

    const wrong = (await search('?category=hall')).json<{ sponsored: unknown[] }>();
    const right = (await search('?category=sdm')).json<{ sponsored: unknown[] }>();

    expect(wrong.sponsored).toEqual([]);
    expect(right.sponsored).toHaveLength(1);
  });

  it('지역을 걸어둔 광고는 그 지역에서만 실린다', async () => {
    const paid = await aVendor('부산홀', 'hall', '부산 해운대구');
    await place(paid, { region: '부산' });

    expect((await search('?region=서울')).json<{ sponsored: unknown[] }>().sponsored).toEqual([]);
    expect(
      (await search('?region=부산')).json<{ sponsored: unknown[] }>().sponsored
    ).toHaveLength(1);
  });

  it('둘째 쪽부터는 광고가 다시 나오지 않는다', async () => {
    // 쪽마다 다시 나오면 스크롤할수록 광고가 늘어난다.
    const paid = await aVendor('가온예식홀');
    await aVendor('나루컨벤션');
    await place(paid);

    const first = (await search('?limit=1')).json<{
      sponsored: unknown[];
      nextCursor: string;
    }>();

    expect(first.sponsored).toHaveLength(1);

    const second = (
      await search(`?limit=1&cursor=${encodeURIComponent(first.nextCursor)}`)
    ).json<{ sponsored: unknown[] }>();

    expect(second.sponsored).toEqual([]);
  });

  it('자리를 겹쳐 잡아도 한 업체는 한 번만 실린다', async () => {
    /*
     * 기간이 겹치는 두 자리를 잡을 수 있다 — 나눠 잡는 정상적인 경우가 있어
     * 표로 막지 않는다. 대신 같은 업체가 두 줄로 나오지 않게 묶는다.
     * 렌더해보고 잡았다.
     */
    const paid = await aVendor('가온예식홀');
    await place(paid);
    await place(paid);

    expect((await search()).json<{ sponsored: unknown[] }>().sponsored).toHaveLength(1);
  });

  it('한 화면에 두 개까지만 싣는다', async () => {
    /*
     * 자연 결과가 스무 곳인데 광고가 열 개면, 그건 분리된 영역이 아니라 광고
     * 화면에 검색 결과가 딸려 있는 것이다.
     */
    for (const name of ['광고하나', '광고둘', '광고셋', '광고넷']) {
      await place(await aVendor(name));
    }

    expect(
      (await search()).json<{ sponsored: unknown[] }>().sponsored.length
    ).toBeLessThanOrEqual(2);
  });
});
