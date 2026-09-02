import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

async function createArticle(input: {
  title: string;
  stage?: string | null;
  relatedCategory?: string | null;
  source?: string;
  publishedDaysAgo?: number;
}) {
  const { rows } = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.wedding_guide_articles
       (title, body, stage, related_category, source, published_at)
     VALUES ($1, $2, $3::wedding_guide_stage, $4::vendor_category, $5,
             now() - ($6 || ' days')::interval)
     RETURNING id`,
    [
      input.title,
      '본문 '.repeat(10),
      input.stage ?? null,
      input.relatedCategory ?? null,
      input.source ?? 'public_data',
      String(input.publishedDaysAgo ?? 0),
    ]
  );

  return rows[0]!.id;
}

async function list(query = '') {
  const response = await test.app.inject({ method: 'GET', url: `/v1/guide-articles${query}` });

  expect(response.statusCode).toBe(200);

  return response.json();
}

describeWithDb('웨딩 정보 목록', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('로그인 없이 목록을 볼 수 있다', async () => {
    const response = await test.app.inject({ method: 'GET', url: '/v1/guide-articles' });

    expect(response.statusCode).toBe(200);
  });

  it('최신순으로 정렬한다', async () => {
    await createArticle({ title: '오래된 글', publishedDaysAgo: 10 });
    await createArticle({ title: '최신 글', publishedDaysAgo: 0 });

    const body = await list();

    expect(body.articles.map((a: { title: string }) => a.title)).toEqual(['최신 글', '오래된 글']);
  });

  it('준비단계로 좁힌다', async () => {
    await createArticle({ title: '초기 글', stage: 'early' });
    await createArticle({ title: '준비중 글', stage: 'preparing' });
    await createArticle({ title: '단계 없는 글', stage: null });

    const body = await list('?stage=preparing');

    expect(body.articles.map((a: { title: string }) => a.title)).toEqual(['준비중 글']);
  });

  it('카테고리로 좁힌다', async () => {
    await createArticle({ title: '홀 글', relatedCategory: 'hall' });
    await createArticle({ title: '스드메 글', relatedCategory: 'sdm' });

    const body = await list('?category=hall');

    expect(body.articles.map((a: { title: string }) => a.title)).toEqual(['홀 글']);
  });

  it('본문은 목록에 싣지 않는다', async () => {
    await createArticle({ title: '긴 글' });

    const body = await list();

    expect(body.articles[0]).not.toHaveProperty('body');
  });
});

describeWithDb('웨딩 정보 상세', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('본문·출처·마지막 확인일을 함께 준다', async () => {
    const articleId = await createArticle({ title: '체크리스트', stage: 'preparing' });

    const response = await test.app.inject({ method: 'GET', url: `/v1/guide-articles/${articleId}` });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.title).toBe('체크리스트');
    expect(body.body).toBeTruthy();
    expect(body.source).toBe('public_data');
    expect(body.lastVerifiedAt).toBeTruthy();
  });

  it('없는 글은 404다', async () => {
    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/guide-articles/00000000-0000-0000-0000-000000000000',
    });

    expect(response.statusCode).toBe(404);
  });
});
