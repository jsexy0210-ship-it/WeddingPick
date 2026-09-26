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

/**
 * 지역 오늘 날씨 — 홈 히어로 카드(2026-09-26 대표 지시). 기상청 초단기실황(기온 · 강수)과
 * 초단기예보(하늘상태)를 서버가 한 시간마다 받아 둔 값이다. 지역이 「그 외」거나 값이 없거나 오래됐으면 `weather`가 null이고
 * 화면은 날씨 자리를 그리지 않는다.
 */
export const WEATHER_CONDITIONS = ['clear', 'partly_cloudy', 'cloudy', 'rain', 'snow'] as const;
export const weatherConditionSchema = z.enum(WEATHER_CONDITIONS);

export const regionWeatherSchema = z.object({
  /** 온보딩 짧은 꼴 지역(서울 · 경기 …). */
  region: z.string().min(1),
  /** 기온(℃, 정수). */
  temperature: z.int(),
  condition: weatherConditionSchema,
  /**
   * 관측 기준 시각(ISO). 기온 · 강수는 기상청 초단기실황의 정시 관측이고, 화면의 「14시 기준」과
   * 낮 · 밤 구분이 이 값을 본다 — 예보가 아니라 관측이라는 것을 화면 문구와 맞춘다.
   */
  observedAt: z.string().min(1),
});

export const regionWeatherResponseSchema = z.object({
  weather: regionWeatherSchema.nullable(),
});

export type WeatherCondition = z.infer<typeof weatherConditionSchema>;
export type RegionWeather = z.infer<typeof regionWeatherSchema>;
export type RegionWeatherResponse = z.infer<typeof regionWeatherResponseSchema>;
export type PublicHoliday = z.infer<typeof publicHolidaySchema>;
export type PublicHolidayListResponse = z.infer<typeof publicHolidayListResponseSchema>;
export type WeddingForecast = z.infer<typeof weddingForecastSchema>;
export type WeddingForecastResponse = z.infer<typeof weddingForecastResponseSchema>;
