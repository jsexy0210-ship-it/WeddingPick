import { WEDDING_FEED_TOPICS } from '@weddingpick/domain';

import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

/**
 * 홈 「웨딩 준비 팁」 — 준비 단계에 맞춘 순서(`GET /v1/wedding-feed?order=stage`)를
 * **실제 DB**에 맞대어 본다(2026-09-26 대표 오더 「준비단계에 맞춰 콘텐츠를 추천한다」).
 *
 * 단계 규칙 자체는 domain `preparation-stage.test.ts`가 경계마다 본다. 여기서 보는 것은
 * 서버가 그 규칙에 **맞는 값을 넣는가**다 — 예식일을 한국 날짜로 세는가, 준비 현황
 * (`prepared_categories`)과 앱의 결정(`category_decisions`) · 담는 중(`vendor_candidates`)을
 * 모두 읽는가, 단계를 모를 때 원래 순서로 돌아가는가.
 */
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

let test: TestApp;

type FeedBody = { items: { id: string; title: string; categoryLabel: string }[] };

/** 자동 작성 주제마다 한 편. 원래 순서는 주제 목록 차례(앞이 최신)다. */
async function seedTopicPosts(): Promise<Map<string, string>> {
  const idByTopic = new Map<string, string>();

  for (const [index, topic] of WEDDING_FEED_TOPICS.entries()) {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.wedding_feed_posts
         (category_label, title, summary, status, source, model, topic, published_at)
       VALUES ($1, $2, '', 'published', 'generated', 'test-model', $3,
               now() - make_interval(mins => $4::int))
       RETURNING id`,
      [topic.categoryLabel, topic.brief, topic.key, index]
    );
    idByTopic.set(rows[0]!.id, topic.key);
  }

  return idByTopic;
}

/** 로그인 + 웨딩 하나. 예식일은 **한국 날짜** 기준 오늘에서 `daysLeft`일 뒤다. */
async function member(subject: string, setup: { daysLeft: number | null; prepared?: string[] }) {
  const { headers } = await signInAs(test, subject);
  const weddingId = await createWedding(test, headers);

  await test.pool.query(
    `UPDATE structured.weddings
     SET wedding_date = CASE WHEN $2::int IS NULL THEN NULL
                             ELSE (now() AT TIME ZONE 'Asia/Seoul')::date + $2::int END,
         prepared_categories = $3::vendor_category[]
     WHERE id = $1`,
    [weddingId, setup.daysLeft, setup.prepared ?? []]
  );

  return { headers, weddingId };
}

async function aVendor(name: string, category: string) {
  const { rows } = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.vendors (name, category, region, source)
     VALUES ($1, $2::vendor_category, '서울', 'public_data') RETURNING id`,
    [name, category]
  );

  return rows[0]!.id;
}

describeWithDb('웨딩 준비 팁 — 준비 단계 순서(실제 DB)', () => {
  let topicOf: Map<string, string>;

  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(async () => {
    await resetDatabase();
    topicOf = await seedTopicPosts();
  });

  const feed = async (url: string, headers?: Record<string, string>) => {
    const response = await test.app.inject({ method: 'GET', url, headers });

    expect(response.statusCode).toBe(200);

    return response.json<FeedBody>().items.map((item) => topicOf.get(item.id));
  };
  const home = (headers?: Record<string, string>) => feed('/v1/wedding-feed?limit=2&order=stage', headers);
  const LATEST_TWO = WEDDING_FEED_TOPICS.slice(0, 2).map((topic) => topic.key);

  it('비회원은 원래 순서(최신) 두 편', async () => {
    expect(await home()).toEqual(LATEST_TWO);
  });

  it('웨딩이 없는 회원(온보딩 전)도 원래 순서 — 단계를 모른다', async () => {
    const { headers } = await signInAs(test, 'no-wedding');

    expect(await home(headers)).toEqual(LATEST_TWO);
  });

  it('D-400 · 아무것도 안 정함 — 준비 순서와 웨딩홀 비용', async () => {
    const { headers } = await member('early', { daysLeft: 400 });

    expect(await home(headers)).toEqual(['schedule-order', 'budget-hall']);
  });

  it('D-300 · 아무것도 안 정함 — 웨딩홀 글과 하객', async () => {
    const { headers } = await member('start', { daysLeft: 300 });

    expect(await home(headers)).toEqual(['hall-visit', 'guest-count']);
  });

  it('D-120 · 준비 현황에서 웨딩홀을 정함 — 스튜디오와 스드메 예산', async () => {
    const { headers } = await member('sdm', { daysLeft: 120, prepared: ['hall'] });

    expect(await home(headers)).toEqual(['studio-pick', 'budget-sdm']);
  });

  it('앱에서 웨딩홀을 결정해도 같다 — category_decisions를 읽는다', async () => {
    const { headers, weddingId } = await member('decided-in-app', { daysLeft: 120 });
    const hall = await aVendor('강남 A 웨딩홀', 'hall');

    await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/candidates`,
      headers,
      payload: { vendorId: hall },
    });
    const decided = await test.app.inject({
      method: 'PUT',
      url: `/v1/weddings/${weddingId}/decisions`,
      headers,
      payload: { category: 'hall', vendorId: hall },
    });
    expect(decided.statusCode).toBeLessThan(300);

    expect(await home(headers)).toEqual(['studio-pick', 'budget-sdm']);
  });

  it('드레스 후보를 담는 중이면 드레스 글이 먼저다 — 홈 히어로와 같은 업종', async () => {
    const { headers, weddingId } = await member('picking-dress', { daysLeft: 200, prepared: ['hall'] });
    const dress = await aVendor('청담 B 드레스', 'dress');

    await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/candidates`,
      headers,
      payload: { vendorId: dress },
    });

    expect(await home(headers)).toEqual(['dress-fitting', 'budget-sdm']);
  });

  it('D-20 — 한 달 전 체크리스트와 하객', async () => {
    const { headers } = await member('final', { daysLeft: 20, prepared: ['hall'] });

    expect(await home(headers)).toEqual(['checklist-1m', 'guest-count']);
  });

  it('예식일이 지났으면 원래 순서', async () => {
    const { headers } = await member('after', { daysLeft: -1 });

    expect(await home(headers)).toEqual(LATEST_TWO);
  });

  it('배우자로 연결된 사람도 같은 웨딩의 단계를 받는다', async () => {
    const { weddingId } = await member('owner', { daysLeft: 20 });
    const { headers, userId } = await signInAs(test, 'partner');

    await test.pool.query('UPDATE structured.weddings SET partner_user_id = $2 WHERE id = $1', [
      weddingId,
      userId,
    ]);

    expect(await home(headers)).toEqual(['checklist-1m', 'guest-count']);
  });

  it('맞는 글이 하나도 없으면 원래 순서 그대로 — 비지 않는다', async () => {
    await test.pool.query('DELETE FROM structured.wedding_feed_posts');
    for (const [index, label] of ['운영 소식', '운영 공지'].entries()) {
      await test.pool.query(
        `INSERT INTO structured.wedding_feed_posts (category_label, title, status, published_at)
         VALUES ($1, $2, 'published', now() - make_interval(mins => $3::int))`,
        [label, `글 ${index}`, index]
      );
    }
    const { headers } = await member('no-match', { daysLeft: 120, prepared: ['hall'] });

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/wedding-feed?limit=2&order=stage',
      headers,
    });

    expect(response.json<FeedBody>().items.map((item) => item.title)).toEqual(['글 0', '글 1']);
  });

  it('순서를 안 물으면(라운지) 로그인해도 원래 순서 — 단계는 홈 두 장에만 쓴다', async () => {
    const { headers } = await member('lounge', { daysLeft: 20 });

    expect(await feed('/v1/wedding-feed?limit=2', headers)).toEqual(LATEST_TWO);
  });

  it('단계 순서에서 토큰이 틀리면 401 — 조용히 비회원으로 떨어뜨리지 않는다', async () => {
    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/wedding-feed?limit=2&order=stage',
      headers: { authorization: 'Bearer nope' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('순서를 안 묻는 목록은 예전처럼 토큰을 보지 않는다', async () => {
    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/wedding-feed?limit=2',
      headers: { authorization: 'Bearer nope' },
    });

    expect(response.statusCode).toBe(200);
  });
});
