import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

async function createExpo(input: {
  name: string;
  region?: string;
  startsInDays?: number;
  endsInDays?: number;
  source?: string;
  registrationUrl?: string | null;
  benefitsNote?: string | null;
}) {
  const startsInDays = input.startsInDays ?? 10;
  const endsInDays = input.endsInDays ?? startsInDays + 1;

  const { rows } = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.wedding_expos
       (name, region, starts_at, ends_at, source, registration_url, benefits_note)
     VALUES ($1, $2, now() + ($3 || ' days')::interval, now() + ($4 || ' days')::interval,
             $5, $6, $7)
     RETURNING id`,
    [
      input.name,
      input.region ?? '서울',
      String(startsInDays),
      String(endsInDays),
      input.source ?? 'external_schedule',
      input.registrationUrl ?? null,
      input.benefitsNote ?? null,
    ]
  );

  return rows[0]!.id;
}

async function list(query = '') {
  const response = await test.app.inject({ method: 'GET', url: `/v1/expos${query}` });

  expect(response.statusCode).toBe(200);

  return response.json();
}

describeWithDb('박람회 목록', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('로그인 없이 목록을 볼 수 있다', async () => {
    const response = await test.app.inject({ method: 'GET', url: '/v1/expos' });

    expect(response.statusCode).toBe(200);
  });

  it('기본은 지난 일정을 뺀다', async () => {
    await createExpo({ name: '예정된 박람회', startsInDays: 10 });
    await createExpo({ name: '지난 박람회', startsInDays: -20, endsInDays: -18 });

    const body = await list();

    expect(body.expos.map((e: { name: string }) => e.name)).toEqual(['예정된 박람회']);
  });

  it('includePast=true면 지난 일정도 준다', async () => {
    await createExpo({ name: '예정된 박람회', startsInDays: 10 });
    await createExpo({ name: '지난 박람회', startsInDays: -20, endsInDays: -18 });

    const body = await list('?includePast=true');

    expect(body.expos).toHaveLength(2);
  });

  it('일정순으로 정렬한다', async () => {
    await createExpo({ name: '늦은 박람회', startsInDays: 30 });
    await createExpo({ name: '이른 박람회', startsInDays: 5 });

    const body = await list();

    expect(body.expos.map((e: { name: string }) => e.name)).toEqual(['이른 박람회', '늦은 박람회']);
  });

  it('지역으로 좁힌다', async () => {
    await createExpo({ name: '서울 박람회', region: '서울' });
    await createExpo({ name: '부산 박람회', region: '부산' });

    const body = await list('?region=' + encodeURIComponent('부산'));

    expect(body.expos.map((e: { name: string }) => e.name)).toEqual(['부산 박람회']);
  });

  it('박람회가 있는 지역만 필터로 준다', async () => {
    await createExpo({ name: '서울 박람회', region: '서울' });
    await createExpo({ name: '지난 부산 박람회', region: '부산', startsInDays: -20, endsInDays: -18 });

    const response = await test.app.inject({ method: 'GET', url: '/v1/expos/regions' });

    // 지난 박람회의 지역은 필터에서 빠진다 — 골라도 빈 목록만 보게 되는 필터를 주지 않는다.
    expect(response.json().regions).toEqual([{ name: '서울', expoCount: 1 }]);
  });

  it('시작일이 끝일보다 늦을 수 없다', async () => {
    await expect(
      test.pool.query(
        `INSERT INTO structured.wedding_expos (name, region, starts_at, ends_at, source)
         VALUES ('거꾸로 박람회', '서울', now() + interval '10 days', now() + interval '5 days',
                 'external_schedule')`
      )
    ).rejects.toThrow(/wedding_expo_ends_after_starts/);
  });
});

describeWithDb('박람회 상세', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('사전등록 링크·혜택을 함께 준다', async () => {
    const expoId = await createExpo({
      name: '혜택 박람회',
      registrationUrl: 'https://example.com/register',
      benefitsNote: '사전등록 시 상담권 증정',
    });

    const response = await test.app.inject({ method: 'GET', url: `/v1/expos/${expoId}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      registrationUrl: 'https://example.com/register',
      benefitsNote: '사전등록 시 상담권 증정',
    });
  });

  it('없는 박람회는 404다', async () => {
    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/expos/00000000-0000-0000-0000-000000000000',
    });

    expect(response.statusCode).toBe(404);
  });
});
