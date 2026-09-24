import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 공휴일 · 예식일 예보(0432). 표에 든 값을 읽기만 한다 — 수집기는 공공 API 응답을
 * 확인한 뒤 붙인다.
 */
describeWithDb('공휴일 · 예식일 예보', () => {
  let test: TestApp;

  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(async () => {
    await resetDatabase();
    await test.context.pool.query('DELETE FROM structured.public_holidays');
    await test.context.pool.query('DELETE FROM structured.mid_forecasts');
  });

  /** 한국 날짜로 오늘부터 `days`일 뒤에 서울에서 올리는 웨딩. */
  async function weddingInDays(days: number, region: string | null = '서울') {
    const session = await signInAs(test);
    const weddingId = await createWedding(test, session.headers);
    await test.context.pool.query(
      `UPDATE structured.weddings
       SET wedding_date = (now() AT TIME ZONE 'Asia/Seoul')::date + $2::int, region = $3
       WHERE id = $1`,
      [weddingId, days, region]
    );
    return { session, weddingId };
  }

  async function putForecast(region: string, days: number, issuedHoursAgo = 1) {
    await test.context.pool.query(
      `INSERT INTO structured.mid_forecasts
         (region, forecast_date, rain_probability, temp_min, temp_max, issued_at)
       VALUES ($1, (now() AT TIME ZONE 'Asia/Seoul')::date + $2::int, 30, 12, 21,
               now() - make_interval(hours => $3))`,
      [region, days, issuedHoursAgo]
    );
  }

  async function getForecast(weddingId: string, headers: Record<string, string>) {
    return test.app.inject({ method: 'GET', url: `/v1/weddings/${weddingId}/forecast`, headers });
  }

  it('공휴일은 기간 안의 것만 날짜순으로 준다', async () => {
    const session = await signInAs(test);
    await test.context.pool.query(
      `INSERT INTO structured.public_holidays (holiday_date, name)
       VALUES ('2026-10-09', '한글날'), ('2026-10-03', '개천절'), ('2026-11-01', '시험일')`
    );

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/public-holidays?from=2026-10-01&to=2026-10-31',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      holidays: [
        { date: '2026-10-03', name: '개천절' },
        { date: '2026-10-09', name: '한글날' },
      ],
    });
  });

  it('공휴일 기간이 거꾸로거나 너무 길면 400이다', async () => {
    const session = await signInAs(test);
    for (const query of ['from=2026-10-31&to=2026-10-01', 'from=2026-01-01&to=2026-12-31', 'from=2026-10']) {
      const response = await test.app.inject({ method: 'GET', url: `/v1/public-holidays?${query}`, headers: session.headers });
      expect(response.statusCode).toBe(400);
    }
  });

  it('예식 4~10일 전이고 새 예보가 있으면 예보를 준다', async () => {
    const { session, weddingId } = await weddingInDays(7);
    await putForecast('서울', 7);

    const response = await getForecast(weddingId, session.headers);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      forecast: { rainProbability: 30, tempMin: 12, tempMax: 21 },
    });
  });

  it('중기예보 범위 밖 · 다른 지역 · 오래된 예보면 null이다', async () => {
    for (const [days, forecastRegion, hoursAgo] of [
      [3, '서울', 1],
      [11, '서울', 1],
      [7, '부산', 1],
      [7, '서울', 48],
    ] as const) {
      await resetDatabase();
      await test.context.pool.query('DELETE FROM structured.mid_forecasts');
      const { session, weddingId } = await weddingInDays(days);
      await putForecast(forecastRegion, days, hoursAgo);

      const response = await getForecast(weddingId, session.headers);

      expect(response.json()).toEqual({ forecast: null });
    }
  });

  it('남의 웨딩 예보는 볼 수 없다', async () => {
    const { weddingId } = await weddingInDays(7);
    const other = await signInAs(test, 'apple-other');

    const response = await getForecast(weddingId, other.headers);

    expect(response.statusCode).toBe(403);
  });
});
