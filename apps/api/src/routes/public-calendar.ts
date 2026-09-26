import { dateSchema, type WeddingForecast } from '@weddingpick/api-contract';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { assertWeddingAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';

/**
 * 공휴일 · 예식일 예보 — 서버가 받아 둔 공공 자료를 읽기만 한다(0437).
 *
 * 2026-09-24 대표 지시 「A안으로 해, 문구도 그대로 진행」. 수집기는 공공 API 실제
 * 응답을 확인한 뒤 붙인다 — 그 전에는 두 표가 비어 있어 빈 목록 · null을 돌려주고,
 * 화면은 줄을 그리지 않는다.
 */

/** 한 번에 묻는 기간 상한. 달력 한 장(6주)이면 충분하다. */
const MAX_RANGE_DAYS = 62;

/**
 * 중기예보가 다루는 날 — 발표일로부터 4~10일 뒤. 그 밖은 예보가 없거나(더 멀다)
 * 단기예보 몫(더 가깝다)이라 이 줄을 그리지 않는다.
 */
export const FORECAST_MIN_DAYS = 4;
export const FORECAST_MAX_DAYS = 10;

/** 예보가 이보다 오래됐으면 보여주지 않는다. 하루 두 번(06·18시) 발표된다. */
const FORECAST_FRESH_HOURS = 36;

const holidayQuerySchema = z
  .object({ from: dateSchema, to: dateSchema })
  .refine(({ from, to }) => from <= to, { message: 'from이 to보다 늦다' })
  .refine(
    ({ from, to }) => (Date.parse(to) - Date.parse(from)) / 86_400_000 <= MAX_RANGE_DAYS,
    { message: `기간은 ${MAX_RANGE_DAYS}일 안쪽이어야 한다` }
  );

export function registerPublicCalendarRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get('/v1/public-holidays', auth, async (request) => {
    const { from, to } = holidayQuerySchema.parse(request.query);
    const { rows } = await context.pool.query<{ date: string; name: string }>(
      `SELECT to_char(holiday_date, 'YYYY-MM-DD') AS date, name
       FROM structured.public_holidays
       WHERE holiday_date BETWEEN $1 AND $2
       ORDER BY holiday_date`,
      [from, to]
    );

    return { holidays: rows };
  });

  app.get<{ Params: { weddingId: string } }>('/v1/weddings/:weddingId/forecast', auth, async (request) => {
    const userId = currentUserId(request);

    await assertWeddingAccess(context.pool, request.params.weddingId, userId);

    // 날짜 차이는 한국 날짜로 센다 — UTC로 세면 자정 전후 아홉 시간 동안 하루가 어긋난다.
    const { rows } = await context.pool.query<{
      date: string;
      rain_probability: number;
      temp_min: number;
      temp_max: number;
    }>(
      `SELECT to_char(f.forecast_date, 'YYYY-MM-DD') AS date,
              f.rain_probability, f.temp_min, f.temp_max
       FROM structured.weddings w
       JOIN structured.mid_forecasts f
         ON f.region = w.region AND f.forecast_date = w.wedding_date
       WHERE w.id = $1
         AND w.wedding_date - (now() AT TIME ZONE 'Asia/Seoul')::date BETWEEN $2 AND $3
         AND f.issued_at > now() - make_interval(hours => $4)`,
      [request.params.weddingId, FORECAST_MIN_DAYS, FORECAST_MAX_DAYS, FORECAST_FRESH_HOURS]
    );
    const row = rows[0];
    const forecast: WeddingForecast | null = row
      ? {
          date: row.date,
          rainProbability: row.rain_probability,
          tempMin: row.temp_min,
          tempMax: row.temp_max,
        }
      : null;

    return { forecast };
  });
}
