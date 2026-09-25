import { z } from 'zod';

import { dateSchema } from './common';

/* -------------------------------------------------------------------------- */
/* 공휴일 · 예식일 예보                                                        */
/* -------------------------------------------------------------------------- */
//
// 2026-09-24 대표 지시 — 「A안으로 해, 문구도 그대로 진행」.
// 공휴일은 한국천문연구원 특일 정보, 예보는 기상청 중기예보에서 온다. 서버가 받아
// 둔 값을 읽기만 한다 — 화면이 공공 API를 직접 부르지 않는다.

export const publicHolidaySchema = z.object({
  date: dateSchema,
  name: z.string().min(1),
});

export const publicHolidayListResponseSchema = z.object({
  holidays: z.array(publicHolidaySchema),
});

/**
 * 예식일 예보. 중기예보는 발표일로부터 4~10일 뒤만 나온다 — 그 밖이거나 예보가
 * 없으면 `forecast`가 null이고 화면은 줄을 그리지 않는다.
 */
export const weddingForecastSchema = z.object({
  date: dateSchema,
  /** 오전·오후 중 높은 쪽. 0~100. */
  rainProbability: z.int().min(0).max(100),
  tempMin: z.int(),
  tempMax: z.int(),
});

export const weddingForecastResponseSchema = z.object({
  forecast: weddingForecastSchema.nullable(),
});

export type PublicHoliday = z.infer<typeof publicHolidaySchema>;
export type PublicHolidayListResponse = z.infer<typeof publicHolidayListResponseSchema>;
export type WeddingForecast = z.infer<typeof weddingForecastSchema>;
export type WeddingForecastResponse = z.infer<typeof weddingForecastResponseSchema>;
