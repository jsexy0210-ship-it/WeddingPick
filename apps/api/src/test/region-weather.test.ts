import {
  collectRegionWeather,
  nowcastBase,
  parseForecastSky,
  parseNowcast,
  ultraShortBase,
  weatherCondition,
  weatherUrl,
  WEATHER_GRID,
} from '../weather/region-weather';
import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

function envelope(item: Record<string, unknown>[], resultCode = '00') {
  return {
    response: {
      header: { resultCode, resultMsg: resultCode === '00' ? 'NORMAL_SERVICE' : 'ERROR' },
      body: { dataType: 'JSON', items: { item } },
    },
  };
}

/** 기상청 초단기실황 응답 모양(공공데이터포털 문서 · JSON). */
function nowcastBody(input: { date: string; time: string; T1H: number; PTY: number }, resultCode = '00') {
  return envelope(
    (['T1H', 'PTY', 'REH', 'RN1'] as const).map((category) => ({
      baseDate: input.date,
      baseTime: input.time,
      category,
      nx: 60,
      ny: 127,
      obsrValue: String(category === 'T1H' ? input.T1H : category === 'PTY' ? input.PTY : 0),
    })),
    resultCode
  );
}

/** 기상청 초단기예보 응답 모양 — 하늘상태만 본다. */
function forecastBody(slots: { time: string; SKY: number }[]) {
  return envelope(
    slots.flatMap((slot) => [
      { baseDate: '20260926', baseTime: '1330', category: 'SKY', fcstDate: '20260926', fcstTime: slot.time, fcstValue: String(slot.SKY), nx: 60, ny: 127 },
      { baseDate: '20260926', baseTime: '1330', category: 'T1H', fcstDate: '20260926', fcstTime: slot.time, fcstValue: '30', nx: 60, ny: 127 },
    ])
  );
}

describe('지역 날씨 — 기상청 실황 · 예보 읽기', () => {
  it('실황은 한국 시각에서 40분을 빼고 정시, 예보는 45분을 빼고 그 시의 30분이다', () => {
    // 05:50 UTC = 14:50 KST
    expect(nowcastBase(new Date('2026-09-26T05:50:00Z'))).toEqual({ baseDate: '20260926', baseTime: '1400' });
    expect(ultraShortBase(new Date('2026-09-26T05:50:00Z'))).toEqual({ baseDate: '20260926', baseTime: '1430' });
    // 05:35 UTC = 14:35 KST → 실황 13:55 → 1300 · 예보 13:50 → 1330
    expect(nowcastBase(new Date('2026-09-26T05:35:00Z'))).toEqual({ baseDate: '20260926', baseTime: '1300' });
    expect(ultraShortBase(new Date('2026-09-26T05:35:00Z'))).toEqual({ baseDate: '20260926', baseTime: '1330' });
    // 15:20 UTC = 00:20 KST 다음 날 → 전날 23시대
    expect(nowcastBase(new Date('2026-09-26T15:20:00Z'))).toEqual({ baseDate: '20260926', baseTime: '2300' });
    expect(ultraShortBase(new Date('2026-09-26T15:20:00Z'))).toEqual({ baseDate: '20260926', baseTime: '2330' });
  });

  it('강수가 하늘상태보다 먼저다 — 다섯 가지로 합친다', () => {
    expect(weatherCondition(1, 0)).toBe('clear');
    expect(weatherCondition(3, 0)).toBe('partly_cloudy');
    expect(weatherCondition(4, 0)).toBe('cloudy');
    expect(weatherCondition(1, 1)).toBe('rain');
    expect(weatherCondition(1, 5)).toBe('rain');
    expect(weatherCondition(1, 3)).toBe('snow');
    expect(weatherCondition(4, 7)).toBe('snow');
    expect(weatherCondition(2, 0)).toBeNull();
  });

  it('실황에서 기온 · 강수와 관측 시각을, 예보에서 가장 이른 하늘상태를 뽑는다', () => {
    expect(parseNowcast(nowcastBody({ date: '20260926', time: '1400', T1H: 21.6, PTY: 0 }))).toEqual({
      temperature: 21.6,
      pty: 0,
      observedAt: new Date('2026-09-26T14:00:00+09:00'),
    });
    expect(parseForecastSky(forecastBody([{ time: '1600', SKY: 4 }, { time: '1500', SKY: 3 }]))).toBe(3);
  });

  it('결과 코드가 정상이 아니거나 모양이 다르면 담지 않는다', () => {
    expect(parseNowcast(nowcastBody({ date: '20260926', time: '1400', T1H: 20, PTY: 0 }, '03'))).toBeNull();
    expect(parseNowcast({ response: { header: { resultCode: '00' }, body: {} } })).toBeNull();
    expect(parseNowcast('<OpenAPI_ServiceResponse>')).toBeNull();
    expect(parseForecastSky(envelope([]))).toBeNull();
  });

  it('주소에 격자와 발표 시각이 들어가고, 인코딩된 키는 한 번만 인코딩된다', () => {
    const now = new Date('2026-09-26T05:50:00Z');
    const nowcast = new URL(weatherUrl('nowcast', 'a%2Bb%3D%3D', '부산', now));
    expect(nowcast.pathname).toMatch(/getUltraSrtNcst$/);
    expect(nowcast.searchParams.get('serviceKey')).toBe('a+b==');
    expect(nowcast.searchParams.get('nx')).toBe(String(WEATHER_GRID.부산.nx));
    expect(nowcast.searchParams.get('ny')).toBe(String(WEATHER_GRID.부산.ny));
    expect(nowcast.searchParams.get('base_time')).toBe('1400');
    expect(nowcast.searchParams.get('dataType')).toBe('JSON');
    const forecast = new URL(weatherUrl('forecast', 'k', '부산', now));
    expect(forecast.pathname).toMatch(/getUltraSrtFcst$/);
    expect(forecast.searchParams.get('base_time')).toBe('1430');
  });
});

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb('지역 날씨 — 수집 · 조회(0447)', () => {
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
    await test.context.pool.query('DELETE FROM structured.region_weather');
  });

  async function getWeather(region: string | null) {
    const session = await signInAs(test);
    const query = region === null ? '' : `?region=${encodeURIComponent(region)}`;
    return test.app.inject({ method: 'GET', url: `/v1/weather/today${query}`, headers: session.headers });
  }

  it('여덟 지역을 담고, 한 지역이 실패해도 나머지는 담는다 — 비가 오면 하늘상태를 묻지 않는다', async () => {
    const now = new Date();
    const at = new Date(now.getTime() + 9 * 3_600_000 - 40 * 60_000);
    const date = at.toISOString().slice(0, 10).replace(/-/g, '');
    const time = `${String(at.getUTCHours()).padStart(2, '0')}00`;
    const asked: string[] = [];

    const result = await collectRegionWeather({
      pool: test.context.pool,
      apiKey: 'test-key',
      now,
      fetchJson: async (url) => {
        const parsed = new URL(url);
        const nx = parsed.searchParams.get('nx');
        const kind = parsed.pathname.endsWith('getUltraSrtNcst') ? 'nowcast' : 'forecast';
        asked.push(`${kind}:${nx}`);
        if (nx === String(WEATHER_GRID.울산.nx)) throw new Error('끊김');
        if (kind === 'forecast') return forecastBody([{ time: '2300', SKY: 3 }]);
        const rainy = nx === String(WEATHER_GRID.부산.nx);
        return nowcastBody({ date, time, T1H: 18.2, PTY: rainy ? 1 : 0 });
      },
    });
    expect(result).toEqual({ stored: 7, failed: 1 });
    expect(asked).not.toContain(`forecast:${WEATHER_GRID.부산.nx}`);

    const seoul = await getWeather('서울');
    expect(seoul.statusCode).toBe(200);
    expect(seoul.json()).toEqual({
      weather: { region: '서울', temperature: 18, condition: 'partly_cloudy', observedAt: expect.any(String) },
    });
    expect((await getWeather('부산')).json().weather.condition).toBe('rain');
    expect((await getWeather('울산')).json()).toEqual({ weather: null });
  });

  it('「그 외」 · 모르는 지역 · 지역 없음 · 오래된 값은 null이다', async () => {
    await test.context.pool.query(
      `INSERT INTO structured.region_weather (region, temperature, condition, observed_at)
       VALUES ('서울', 20, 'clear', now() - interval '4 hours'), ('부산', 23, 'rain', now())`
    );

    expect((await getWeather('서울')).json()).toEqual({ weather: null });
    expect((await getWeather('부산')).json()).toEqual({
      weather: { region: '부산', temperature: 23, condition: 'rain', observedAt: expect.any(String) },
    });
    expect((await getWeather('그 외')).json()).toEqual({ weather: null });
    expect((await getWeather('제주')).json()).toEqual({ weather: null });
    expect((await getWeather(null)).json()).toEqual({ weather: null });
  });

  it('로그인하지 않으면 401이다', async () => {
    const response = await test.app.inject({ method: 'GET', url: '/v1/weather/today?region=서울' });
    expect(response.statusCode).toBe(401);
  });
});
