import type { RegionWeather, WeatherCondition } from '@weddingpick/api-contract';
import type { Pool } from 'pg';

/**
 * 지역 오늘 날씨 — 홈 히어로 카드 오른쪽 빈 자리(2026-09-26 대표 지시).
 *
 * 출처는 기상청 단기예보 조회서비스(공공데이터포털)다. 워커가 한 시간마다 여덟 지역을 받아
 * `structured.region_weather`(0447)에 덮어쓰고, 화면은 그 표만 읽는다 — 앱이 공공 API를 직접
 * 부르지 않는다. 모델 호출은 없다(Gemini 사용 범위 세 가지 밖이다 — CLAUDE.md).
 *
 * **「현재」와 「예보」를 섞지 않는다**(2026-09-26 대표 명세 3). 기온과 강수형태는
 * **초단기실황**(`getUltraSrtNcst` · 정시 관측)이고, 화면의 「14시 기준」은 그 관측 시각이다.
 * 실황에는 하늘상태(맑음 · 구름많음 · 흐림)가 없어 그것만 **초단기예보**(`getUltraSrtFcst`)의
 * 가장 이른 시각 값을 쓴다. 비 · 눈은 실황 강수형태로만 정한다 — 강수가 하늘상태보다 먼저다.
 *
 * **키가 없으면 아무것도 하지 않는다.** 표가 비어 있으면 읽는 쪽이 null을 돌려주고,
 * 화면은 날씨 자리를 그리지 않는다 — 빈 칸이나 오류를 보여주지 않는다.
 *
 * 키 이름은 `DATA_GO_KR_MY_KEY`다. 공공데이터포털 인증키는 계정당 하나라 대표님이 이미
 * 이 이름 하나로 GitHub에 등록해 둔 것을 그대로 쓴다(`.github/workflows/public-api-probe.yml`).
 * 그 키로 «기상청_단기예보 조회서비스»가 활용신청돼 있어야 한다.
 */

const WEATHER_BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';
export const NOWCAST_ENDPOINT = `${WEATHER_BASE}/getUltraSrtNcst`;
export const FORECAST_ENDPOINT = `${WEATHER_BASE}/getUltraSrtFcst`;

/**
 * 온보딩 짧은 꼴 지역 → 기상청 격자(nx, ny). 각 시·도 청사 자리다(경기는 수원).
 * 「그 외」는 한 점으로 대표할 수 없어 없다 — 그 사용자에게는 날씨를 그리지 않는다.
 */
export const WEATHER_GRID = {
  서울: { nx: 60, ny: 127 },
  경기: { nx: 60, ny: 121 },
  인천: { nx: 55, ny: 124 },
  부산: { nx: 98, ny: 76 },
  대구: { nx: 89, ny: 90 },
  대전: { nx: 67, ny: 100 },
  광주: { nx: 58, ny: 74 },
  울산: { nx: 102, ny: 84 },
} as const;

export type WeatherRegion = keyof typeof WEATHER_GRID;

export function isWeatherRegion(region: string | null | undefined): region is WeatherRegion {
  return typeof region === 'string' && Object.hasOwn(WEATHER_GRID, region);
}

/** 이보다 오래된 값은 «지금 날씨»가 아니다. 수집이 한두 번 끊겨도 버틴다. */
export const WEATHER_FRESH_HOURS = 3;

const pad = (value: number) => String(value).padStart(2, '0');

function kstParts(date: Date): { date: string; hour: number; minute: number } {
  const kst = new Date(date.getTime() + 9 * 3_600_000);
  return {
    date: `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}`,
    hour: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
  };
}

/** 초단기실황 발표 시각. 매시 정시 관측이 40분 뒤부터 나온다 — 지금에서 40분을 빼고 정시로 내린다. */
export function nowcastBase(now: Date): { baseDate: string; baseTime: string } {
  const at = kstParts(new Date(now.getTime() - 40 * 60_000));
  return { baseDate: at.date, baseTime: `${pad(at.hour)}00` };
}

/** 초단기예보 발표 시각. 매시 30분 발표가 45분 뒤부터 나온다 — 45분을 빼고 그 시의 30분으로 내린다. */
export function ultraShortBase(now: Date): { baseDate: string; baseTime: string } {
  const at = kstParts(new Date(now.getTime() - 45 * 60_000));
  return { baseDate: at.date, baseTime: `${pad(at.hour)}30` };
}

/**
 * 하늘상태(SKY 1 맑음 · 3 구름많음 · 4 흐림)와 강수형태(PTY 0 없음 · 1 비 · 2 비/눈 · 3 눈 ·
 * 5 빗방울 · 6 빗방울눈날림 · 7 눈날림)를 다섯 가지로 합친다. 내리는 것이 있으면 그것이 먼저다.
 */
export function weatherCondition(sky: number, pty: number): WeatherCondition | null {
  if (pty === 3 || pty === 7) return 'snow';
  if (pty === 1 || pty === 2 || pty === 5 || pty === 6 || pty === 4) return 'rain';
  if (pty !== 0) return null;
  if (sky === 1) return 'clear';
  if (sky === 3) return 'partly_cloudy';
  if (sky === 4) return 'cloudy';
  return null;
}

type ResponseEnvelope = { response?: { header?: { resultCode?: unknown }; body?: { items?: { item?: unknown } } } };

/** 결과 코드가 정상(00)일 때만 항목 배열을 준다. 모양이 다르면 null — 틀린 값을 담느니 담지 않는다. */
function items(body: unknown): Record<string, unknown>[] | null {
  const response = (body as ResponseEnvelope)?.response;
  if (response?.header?.resultCode !== '00') return null;
  const list = response.body?.items?.item;
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : null;
}

export type Nowcast = { temperature: number; pty: number; observedAt: Date };

/** 초단기실황 — 기온(T1H) · 강수형태(PTY)와 관측 시각. */
export function parseNowcast(body: unknown): Nowcast | null {
  const list = items(body);
  if (list === null) return null;

  let temperature: number | undefined;
  let pty: number | undefined;
  let stamp: string | undefined;
  for (const item of list) {
    const value = Number(item.obsrValue);
    if (!Number.isFinite(value) || typeof item.baseDate !== 'string' || typeof item.baseTime !== 'string') continue;
    if (item.category === 'T1H') temperature = value;
    if (item.category === 'PTY') pty = value;
    stamp ??= `${item.baseDate}${item.baseTime}`;
  }
  if (temperature === undefined || pty === undefined || stamp === undefined || !/^\d{12}$/.test(stamp)) return null;
  if (temperature < -60 || temperature > 60) return null;

  return { temperature, pty, observedAt: kstStamp(stamp) };
}

/** 초단기예보 — 가장 이른 예보 시각의 하늘상태(SKY). */
export function parseForecastSky(body: unknown): number | null {
  const list = items(body);
  if (list === null) return null;

  let best: { stamp: string; sky: number } | null = null;
  for (const item of list) {
    if (item.category !== 'SKY' || typeof item.fcstDate !== 'string' || typeof item.fcstTime !== 'string') continue;
    const sky = Number(item.fcstValue);
    if (!Number.isFinite(sky)) continue;
    const stamp = `${item.fcstDate}${item.fcstTime}`;
    if (best === null || stamp < best.stamp) best = { stamp, sky };
  }
  return best?.sky ?? null;
}

function kstStamp(stamp: string): Date {
  return new Date(
    `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:00+09:00`
  );
}

export type WeatherFetch = (url: string) => Promise<unknown>;

const defaultFetch: WeatherFetch = async (url) => {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  /* 주소는 찍지 않는다 — 질의 문자열에 서비스 키가 들어 있다. */
  if (!response.ok) throw new Error(`기상청 응답 오류 ${response.status}`);
  return response.json();
};

/** 공공데이터포털 키는 인코딩된 채로도, 풀린 채로도 들어온다. 한 번 풀어 두 번 인코딩되지 않게 한다. */
function normalizeServiceKey(apiKey: string): string {
  try {
    return decodeURIComponent(apiKey);
  } catch {
    return apiKey;
  }
}

export function weatherUrl(
  kind: 'nowcast' | 'forecast',
  apiKey: string,
  region: WeatherRegion,
  now: Date
): string {
  const { baseDate, baseTime } = kind === 'nowcast' ? nowcastBase(now) : ultraShortBase(now);
  const url = new URL(kind === 'nowcast' ? NOWCAST_ENDPOINT : FORECAST_ENDPOINT);
  url.searchParams.set('serviceKey', normalizeServiceKey(apiKey));
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '60');
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('base_date', baseDate);
  url.searchParams.set('base_time', baseTime);
  url.searchParams.set('nx', String(WEATHER_GRID[region].nx));
  url.searchParams.set('ny', String(WEATHER_GRID[region].ny));
  return url.toString();
}

/**
 * 여덟 지역을 받아 담는다. 한 지역이 실패해도 나머지는 담는다 — 실패한 지역은 이전 값이
 * 남고, 그 값이 오래되면 읽는 쪽이 버린다.
 */
export async function collectRegionWeather(input: {
  pool: Pool;
  apiKey: string;
  now?: Date;
  fetchJson?: WeatherFetch;
}): Promise<{ stored: number; failed: number }> {
  const now = input.now ?? new Date();
  const fetchJson = input.fetchJson ?? defaultFetch;
  let stored = 0;
  let failed = 0;

  for (const region of Object.keys(WEATHER_GRID) as WeatherRegion[]) {
    try {
      const nowcast = parseNowcast(await fetchJson(weatherUrl('nowcast', input.apiKey, region, now)));
      if (nowcast === null) {
        failed += 1;
        continue;
      }
      /* 비 · 눈이면 하늘상태를 묻지 않는다. 아니면 예보의 하늘상태가 있어야 맑음 · 흐림을 가른다. */
      const sky = nowcast.pty === 0
        ? parseForecastSky(await fetchJson(weatherUrl('forecast', input.apiKey, region, now)))
        : 0;
      const condition = sky === null ? null : weatherCondition(sky, nowcast.pty);
      if (condition === null) {
        failed += 1;
        continue;
      }
      await input.pool.query(
        `INSERT INTO structured.region_weather (region, temperature, condition, observed_at, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (region) DO UPDATE
           SET temperature = EXCLUDED.temperature,
               condition = EXCLUDED.condition,
               observed_at = EXCLUDED.observed_at,
               updated_at = now()`,
        [region, Math.round(nowcast.temperature), condition, nowcast.observedAt]
      );
      stored += 1;
    } catch {
      failed += 1;
    }
  }

  return { stored, failed };
}

/** 표가 아직 없다(0447을 운영에 올리기 전). 날씨는 곁가지라 없으면 조용히 null이다. */
function isMissingTable(error: unknown): boolean {
  return (error as { code?: unknown })?.code === '42P01';
}

export async function readRegionWeather(pool: Pool, region: string | null | undefined): Promise<RegionWeather | null> {
  if (!isWeatherRegion(region)) return null;

  try {
    const { rows } = await pool.query<{ temperature: number; condition: WeatherCondition; observed_at: Date }>(
      `SELECT temperature, condition, observed_at
       FROM structured.region_weather
       WHERE region = $1 AND observed_at > now() - make_interval(hours => $2)`,
      [region, WEATHER_FRESH_HOURS]
    );
    const row = rows[0];
    return row
      ? { region, temperature: row.temperature, condition: row.condition, observedAt: row.observed_at.toISOString() }
      : null;
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}
