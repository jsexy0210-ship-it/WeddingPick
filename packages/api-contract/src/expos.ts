import { z } from 'zod';

import { idSchema, sourceTypeSchema, timestampSchema } from './common';

/**
 * WP-EXPO-001·002. 웨딩박람회 일정.
 *
 * 값마다 출처(source)와 마지막 확인일(lastVerifiedAt)을 함께 내려보낸다 — 업체
 * 데이터와 같은 규칙이다. 박람회 일정은 시간이 지나면 낡고, 언제 확인한
 * 값인지 없이 보여주면 지금도 맞는지 사용자가 알 수 없다.
 */
export const expoSummarySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  organizer: z.string().min(1).nullable(),
  region: z.string().min(1),
  venue: z.string().min(1).nullable(),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  source: sourceTypeSchema,
  lastVerifiedAt: timestampSchema,
});

export const expoDetailSchema = expoSummarySchema.extend({
  registrationUrl: z.string().min(1).nullable(),
  benefitsNote: z.string().min(1).nullable(),
});

export const expoListResponseSchema = z.object({
  expos: z.array(expoSummarySchema),
  nextCursor: z.string().nullable(),
});

/** 지역 필터. 목록에 실제로 뜨는 박람회의 지역만 모은다. */
export const expoRegionsResponseSchema = z.object({
  regions: z.array(z.object({ name: z.string().min(1), expoCount: z.int().positive() })),
});

export type ExpoSummary = z.infer<typeof expoSummarySchema>;
export type ExpoDetail = z.infer<typeof expoDetailSchema>;
export type ExpoListResponse = z.infer<typeof expoListResponseSchema>;
export type ExpoRegionsResponse = z.infer<typeof expoRegionsResponseSchema>;
