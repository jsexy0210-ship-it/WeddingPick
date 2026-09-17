import { z } from 'zod';

export const expoStatusSchema = z.enum(['upcoming', 'ongoing', 'closed']);

export const expoItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  organizer: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  venue: z.string().min(1),
  region: z.string().min(1),
  status: expoStatusSchema,
  isDeadlineSoon: z.boolean(),
  sourceNote: z.string(),
  lastVerifiedAt: z.string().min(1),
});

export const expoDetailSchema = expoItemSchema.extend({
  address: z.string(),
  registrationDeadline: z.string().nullable(),
  benefits: z.array(z.string()),
  description: z.string(),
  notifyEnabled: z.boolean(),
  /**
   * 공식 신청 링크(없으면 공식 홈페이지). In-App Browser로 연다 — 앱을 떠나지
   * 않는다(대표 정정, docs/expo-agent-spec.md).
   */
  applyUrl: z.string().nullable(),
  officialWebsiteUrl: z.string().nullable(),
});

export const expoListResponseSchema = z.object({
  items: z.array(expoItemSchema),
  nextCursor: z.string().nullable(),
});

export const expoNotifyResponseSchema = z.object({
  notifyEnabled: z.boolean(),
});

export type ExpoStatus = z.infer<typeof expoStatusSchema>;
export type ExpoItem = z.infer<typeof expoItemSchema>;
export type ExpoDetail = z.infer<typeof expoDetailSchema>;
export type ExpoListResponse = z.infer<typeof expoListResponseSchema>;
