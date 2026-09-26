import { MAX_CANDIDATES } from '@weddingpick/domain';

import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/** 오늘보다 뒤인 날. 결혼식은 미래여야 한다. */
function future(days: number): string {
  const date = new Date();

  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

/**
 * 준비 현황(3/5)에서 고른 업체 → Pick 담은 곳(2026-09-26 대표 지시).
 *
 * 요점은 셋이다.
 * 1. 온보딩 «완료»(`POST /v1/me/setup`) 한 번에 설정과 Pick 담기가 **같이** 된다.
 * 2. 다시 보내도 겹치지 않는다.
 * 3. «아직 정한 곳이 없어요»(업체를 안 보냄)는 Pick에 아무것도 넣지 않는다.
 */
describeWithDb('준비 현황 업체 → Pick', () => {
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

  async function setup(headers: Record<string, string>, over: Record<string, unknown> = {}) {
    return await test.app.inject({
      method: 'POST',
      url: '/v1/me/setup',
      headers,
      payload: { weddingDate: future(200), region: '서울', styleTags: ['URBAN'], ...over },
    });
  }

  type CandidateList = {
    groups: {
      category: string;
      state: string;
      decidedVendorId: string | null;
      candidates: { vendorId: string; vendorName: string; addedByPartner: boolean }[];
    }[];
    total: number;
    progress: { decided: number };
    manualDecisions: { category: string; categoryLabel: string; name: string; decidedByPartner: boolean }[];
  };

  async function decisionRows(weddingId: string) {
    return (
      await test.pool.query<{ category: string; vendor_id: string | null; manual_name: string | null }>(
        `SELECT category::text AS category, vendor_id, manual_name
         FROM structured.category_decisions WHERE wedding_id = $1 ORDER BY category`,
        [weddingId]
      )
    ).rows;
  }

  async function candidates(headers: Record<string, string>, weddingId: string) {
    return (
      await test.app.inject({ method: 'GET', url: `/v1/weddings/${weddingId}/candidates`, headers })
    ).json<CandidateList>();
  }

  const me = async (headers: Record<string, string>) =>
    (await test.app.inject({ method: 'GET', url: '/v1/me', headers })).json<{
      weddingId: string | null;
      setupComplete: boolean;
      hasPick: boolean;
      preparedCategories: string[];
    }>();

  it('완료 한 번에 준비 현황을 저장하고 고른 업체를 Pick에 담는다', async () => {
    const { headers } = await signInAs(test);
    const hall = await createVendor('강남 A 웨딩홀', 'hall');
    const studio = await createVendor('강남 E 스튜디오', 'studio');

    const response = await setup(headers, {
      preparedCategories: ['hall', 'studio', 'dress', 'makeup', 'hair'],
      preparedVendorIds: [hall, studio],
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<{ weddingId: string; hasPick: boolean; preparedCategories: string[] }>();

    expect(body.preparedCategories).toEqual(['hall', 'studio', 'dress', 'makeup', 'hair']);
    expect(body.hasPick).toBe(true);

    // 저장 뒤 다시 읽으면 Pick 담은 곳의 해당 업종 묶음에 들어 있다.
    const list = await candidates(headers, body.weddingId);
    const byCategory = Object.fromEntries(
      list.groups.map((group) => [group.category, group.candidates.map((c) => c.vendorName)])
    );

    expect(list.total).toBe(2);
    expect(byCategory).toEqual({ hall: ['강남 A 웨딩홀'], studio: ['강남 E 스튜디오'] });
  });

  it('다시 저장해도 같은 업체가 두 번 담기지 않는다', async () => {
    const { headers } = await signInAs(test);
    const hall = await createVendor('강남 A 웨딩홀', 'hall');

    await setup(headers, { preparedCategories: ['hall'], preparedVendorIds: [hall, hall] });
    expect((await setup(headers, { preparedCategories: ['hall'], preparedVendorIds: [hall] })).statusCode).toBe(200);

    const { weddingId } = await me(headers);
    const { rows } = await test.pool.query<{ count: string }>(
      'SELECT count(*) FROM structured.vendor_candidates WHERE wedding_id = $1',
      [weddingId]
    );

    expect(Number(rows[0]!.count)).toBe(1);
  });

  it('이미 Pick에 담아 둔 곳이면 그대로 두고 새로 담지 않는다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const hall = await createVendor('강남 A 웨딩홀', 'hall');

    await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/candidates`,
      headers,
      payload: { vendorId: hall, note: '먼저 담음' },
    });

    expect((await setup(headers, { preparedCategories: ['hall'], preparedVendorIds: [hall] })).statusCode).toBe(200);

    const { rows } = await test.pool.query<{ note: string | null }>(
      'SELECT note FROM structured.vendor_candidates WHERE wedding_id = $1',
      [weddingId]
    );

    expect(rows).toEqual([{ note: '먼저 담음' }]);
  });

  it('«아직 정한 곳이 없어요»는 Pick에 아무것도 넣지 않는다', async () => {
    const { headers } = await signInAs(test);

    // 업체 키를 안 보낸 것 · 빈 배열 둘 다 같다.
    await setup(headers, { preparedCategories: [] });
    await setup(headers, { preparedCategories: [], preparedVendorIds: [] });

    const current = await me(headers);

    expect(current.setupComplete).toBe(true);
    expect(current.hasPick).toBe(false);
    expect((await candidates(headers, current.weddingId!)).total).toBe(0);
  });

  it('업체 없이 다시 저장해도 이미 담긴 Pick은 그대로다', async () => {
    const { headers } = await signInAs(test);
    const hall = await createVendor('강남 A 웨딩홀', 'hall');

    await setup(headers, { preparedCategories: ['hall'], preparedVendorIds: [hall] });
    // MY 웨딩설정처럼 업체 키 없이 다시 부른다.
    await setup(headers, { preparedCategories: [] });

    const current = await me(headers);

    expect((await candidates(headers, current.weddingId!)).total).toBe(1);
  });

  it('없는 업체면 설정까지 통째로 되돌린다', async () => {
    const { headers } = await signInAs(test);

    const response = await setup(headers, {
      preparedCategories: ['hall'],
      preparedVendorIds: ['00000000-0000-4000-8000-000000000000'],
    });

    expect(response.statusCode).toBe(404);

    const current = await me(headers);

    // 반쯤 저장된 상태가 남지 않는다 — 설정도 안 끝났고 웨딩도 안 생겼다.
    expect(current.setupComplete).toBe(false);
    expect(current.weddingId).toBeNull();
  });

  it('준비 순서 밖 업종(«기타»)의 업체는 받지 않는다', async () => {
    const { headers } = await signInAs(test);
    const other = await createVendor('기타 업체', 'etc');

    expect((await setup(headers, { preparedVendorIds: [other] })).statusCode).toBe(400);
    expect((await me(headers)).setupComplete).toBe(false);
  });

  it('고른 업체의 업종이 같이 보낸 준비 현황에 없으면 받지 않는다', async () => {
    const { headers } = await signInAs(test);
    const hall = await createVendor('강남 A 웨딩홀', 'hall');

    // 웨딩홀 업체를 골랐는데 준비 현황에는 스드메만 있다 — 홈과 Pick이 서로 다른 말을 하게 된다.
    const response = await setup(headers, {
      preparedCategories: ['studio', 'dress', 'makeup', 'hair'],
      preparedVendorIds: [hall],
    });

    expect(response.statusCode).toBe(400);
    expect((await me(headers)).setupComplete).toBe(false);
  });

  it('카드 수(넷)를 넘겨 보내면 받지 않는다', async () => {
    const { headers } = await signInAs(test);
    const ids = await Promise.all(['a', 'b', 'c', 'd', 'e'].map((n) => createVendor(`웨딩홀 ${n}`)));

    expect((await setup(headers, { preparedVendorIds: ids })).statusCode).toBe(400);
  });

  it('Pick 상한을 넘기면 담기와 같은 말로 막고 설정도 되돌린다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const ids = await Promise.all(
      Array.from({ length: MAX_CANDIDATES + 1 }, (_, i) => createVendor(`업체 ${i + 1}`))
    );

    await test.pool.query(
      `INSERT INTO structured.vendor_candidates (wedding_id, vendor_id)
       SELECT $1, id FROM unnest($2::uuid[]) AS id`,
      [weddingId, ids.slice(0, MAX_CANDIDATES)]
    );

    const full = await setup(headers, { preparedCategories: ['hall'], preparedVendorIds: [ids[MAX_CANDIDATES]] });

    expect(full.statusCode).toBe(400);
    expect(full.json<{ error: { message: string } }>().error.message).toContain(`${MAX_CANDIDATES}곳까지`);
    expect((await me(headers)).setupComplete).toBe(false);

    // 이미 담긴 곳만 다시 보내면 새로 담을 것이 없어 막지 않는다.
    expect((await setup(headers, { preparedCategories: ['hall'], preparedVendorIds: [ids[0]] })).statusCode).toBe(200);
  });

  /* ───── 2026-09-26 대표 지시 「결정으로 넣는다」 · 「직접입력하는 방법 고안하라」 ───── */

  it('고른 업체는 Pick 담기와 함께 그 업종의 결정으로 남는다', async () => {
    const { headers } = await signInAs(test);
    const hall = await createVendor('강남 A 웨딩홀', 'hall');
    const studio = await createVendor('강남 E 스튜디오', 'studio');

    const response = await setup(headers, {
      preparedCategories: ['hall', 'studio', 'dress', 'makeup', 'hair'],
      preparedVendorIds: [hall, studio],
    });

    expect(response.statusCode).toBe(200);

    const { weddingId } = await me(headers);

    expect(await decisionRows(weddingId!)).toEqual([
      { category: 'hall', vendor_id: hall, manual_name: null },
      { category: 'studio', vendor_id: studio, manual_name: null },
    ]);

    // Pick 목록을 다시 읽으면 그 묶음이 «결정 완료»이고 결정한 곳이 그 업체다.
    const list = await candidates(headers, weddingId!);
    const byCategory = Object.fromEntries(list.groups.map((group) => [group.category, group]));

    expect(byCategory.hall).toMatchObject({ state: 'decided', decidedVendorId: hall });
    expect(byCategory.studio).toMatchObject({ state: 'decided', decidedVendorId: studio });
    expect(list.manualDecisions).toEqual([]);

    // 예약현황(WP-OUR-003)이 결정 둘을 센다 — /pick/confirm이 없어진 뒤 0이던 자리다.
    const decisions = (
      await test.app.inject({ method: 'GET', url: `/v1/weddings/${weddingId}/decisions`, headers })
    ).json<{ decisions: { vendor: { id: string } }[] }>();

    expect(decisions.decisions.map((row) => row.vendor.id).sort()).toEqual([hall, studio].sort());
  });

  it('다시 저장해도 결정이 겹치거나 바뀌지 않는다', async () => {
    const { headers } = await signInAs(test);
    const hall = await createVendor('강남 A 웨딩홀', 'hall');
    const payload = {
      preparedCategories: ['hall', 'studio', 'dress', 'makeup', 'hair'],
      preparedVendorIds: [hall],
      preparedManualVendors: [{ group: 'sdm', name: '청담 스튜디오' }],
    };

    expect((await setup(headers, payload)).statusCode).toBe(200);
    expect((await setup(headers, payload)).statusCode).toBe(200);

    const { weddingId } = await me(headers);

    expect(await decisionRows(weddingId!)).toEqual([
      { category: 'hall', vendor_id: hall, manual_name: null },
      { category: 'studio', vendor_id: null, manual_name: '청담 스튜디오' },
    ]);
  });

  it('배우자가 먼저 정한 업종은 덮지 않는다 — 고른 업체는 후보로만 담긴다', async () => {
    const owner = await signInAs(test, 'apple-owner');
    const partner = await signInAs(test, 'apple-partner');
    const weddingId = await createWedding(test, owner.headers);
    const theirs = await createVendor('배우자가 고른 웨딩홀', 'hall');
    const mine = await createVendor('내가 고른 웨딩홀', 'hall');

    await test.pool.query('UPDATE structured.weddings SET partner_user_id = $2 WHERE id = $1', [
      weddingId,
      partner.userId,
    ]);
    await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/candidates`,
      headers: partner.headers,
      payload: { vendorId: theirs },
    });
    expect(
      (
        await test.app.inject({
          method: 'PUT',
          url: `/v1/weddings/${weddingId}/decisions`,
          headers: partner.headers,
          payload: { category: 'hall', vendorId: theirs },
        })
      ).statusCode
    ).toBe(204);

    expect((await setup(owner.headers, { preparedCategories: ['hall'], preparedVendorIds: [mine] })).statusCode).toBe(200);

    // 결정은 배우자 것 그대로, 내가 고른 곳은 후보로 담겼다.
    expect(await decisionRows(weddingId)).toEqual([{ category: 'hall', vendor_id: theirs, manual_name: null }]);

    const list = await candidates(owner.headers, weddingId);
    const hall = list.groups.find((group) => group.category === 'hall')!;

    expect(hall.decidedVendorId).toBe(theirs);
    expect(hall.candidates.map((c) => c.vendorId).sort()).toEqual([theirs, mine].sort());

    // 직접 입력도 같다 — 배우자의 결정을 이름으로 덮지 않는다.
    expect(
      (
        await setup(owner.headers, {
          preparedCategories: ['hall'],
          preparedManualVendors: [{ group: 'start', name: '다른 예식장' }],
        })
      ).statusCode
    ).toBe(200);
    expect(await decisionRows(weddingId)).toEqual([{ category: 'hall', vendor_id: theirs, manual_name: null }]);
  });

  it('직접 입력한 곳은 담기 없이 묶음 첫 업종의 결정으로 남고, 다시 읽힌다', async () => {
    const { headers } = await signInAs(test);

    const response = await setup(headers, {
      preparedCategories: ['hall', 'studio', 'dress', 'makeup', 'hair'],
      // 앞뒤 공백은 뗀다.
      preparedManualVendors: [
        { group: 'start', name: '  우리동네 웨딩컨벤션 ' },
        { group: 'sdm', name: '청담 스튜디오' },
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ hasPick: boolean }>().hasPick).toBe(false);

    const { weddingId } = await me(headers);

    expect(await decisionRows(weddingId!)).toEqual([
      { category: 'hall', vendor_id: null, manual_name: '우리동네 웨딩컨벤션' },
      { category: 'studio', vendor_id: null, manual_name: '청담 스튜디오' },
    ]);

    const list = await candidates(headers, weddingId!);

    expect(list.total).toBe(0);
    expect(list.groups).toEqual([]);
    const manual = list.manualDecisions
      .map(({ category, categoryLabel, name, decidedByPartner }) => ({ category, categoryLabel, name, decidedByPartner }))
      .sort((a, b) => a.category.localeCompare(b.category));

    expect(manual).toEqual([
      { category: 'hall', categoryLabel: '웨딩홀', name: '우리동네 웨딩컨벤션', decidedByPartner: false },
      { category: 'studio', categoryLabel: '스튜디오', name: '청담 스튜디오', decidedByPartner: false },
    ]);
    // 직접 입력한 업종도 «결정 완료»로 센다.
    expect(list.progress.decided).toBeGreaterThanOrEqual(2);

    // 예약현황은 업체가 있는 결정만 센다 — 직접 입력은 이을 업체 · 일정이 없다.
    const decisions = (
      await test.app.inject({ method: 'GET', url: `/v1/weddings/${weddingId}/decisions`, headers })
    ).json<{ decisions: unknown[] }>();

    expect(decisions.decisions).toEqual([]);
  });

  it('직접 입력한 결정을 Pick한 곳으로 바꾸면 적어 둔 이름은 지워진다', async () => {
    const { headers } = await signInAs(test);
    const hall = await createVendor('강남 A 웨딩홀', 'hall');

    await setup(headers, {
      preparedCategories: ['hall'],
      preparedManualVendors: [{ group: 'start', name: '우리동네 웨딩컨벤션' }],
    });

    const { weddingId } = await me(headers);

    await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/candidates`,
      headers,
      payload: { vendorId: hall },
    });
    expect(
      (
        await test.app.inject({
          method: 'PUT',
          url: `/v1/weddings/${weddingId}/decisions`,
          headers,
          payload: { category: 'hall', vendorId: hall },
        })
      ).statusCode
    ).toBe(204);

    expect(await decisionRows(weddingId!)).toEqual([{ category: 'hall', vendor_id: hall, manual_name: null }]);
    expect((await candidates(headers, weddingId!)).manualDecisions).toEqual([]);
  });

  it('직접 입력한 결정도 결정 취소로 지울 수 있다', async () => {
    const { headers } = await signInAs(test);

    await setup(headers, {
      preparedCategories: ['hall'],
      preparedManualVendors: [{ group: 'start', name: '우리동네 웨딩컨벤션' }],
    });

    const { weddingId } = await me(headers);

    expect(
      (await test.app.inject({ method: 'DELETE', url: `/v1/weddings/${weddingId}/decisions/hall`, headers }))
        .statusCode
    ).toBe(204);
    expect(await decisionRows(weddingId!)).toEqual([]);
  });

  it('직접 입력은 이름이 비었거나 길면 받지 않고, 카드 하나에 두 곳을 받지 않는다', async () => {
    const { headers } = await signInAs(test);
    const hall = await createVendor('강남 A 웨딩홀', 'hall');

    expect(
      (await setup(headers, { preparedCategories: ['hall'], preparedManualVendors: [{ group: 'start', name: '   ' }] }))
        .statusCode
    ).toBe(400);
    expect(
      (
        await setup(headers, {
          preparedCategories: ['hall'],
          preparedManualVendors: [{ group: 'start', name: '가'.repeat(31) }],
        })
      ).statusCode
    ).toBe(400);
    // 같은 카드에 목록 업체와 직접 입력을 함께 보냈다.
    expect(
      (
        await setup(headers, {
          preparedCategories: ['hall'],
          preparedVendorIds: [hall],
          preparedManualVendors: [{ group: 'start', name: '우리동네 웨딩컨벤션' }],
        })
      ).statusCode
    ).toBe(400);
    // 직접 입력한 카드가 준비 현황에 없다.
    expect(
      (
        await setup(headers, {
          preparedCategories: ['snap', 'bouquet', 'invitation'],
          preparedManualVendors: [{ group: 'start', name: '우리동네 웨딩컨벤션' }],
        })
      ).statusCode
    ).toBe(400);
    expect((await me(headers)).setupComplete).toBe(false);
  });
});
