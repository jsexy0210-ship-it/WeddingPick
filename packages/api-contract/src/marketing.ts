import { z } from 'zod';

export const marketingChannelSchema = z.enum(['blog', 'instagram', 'shortform', 'community']);
export const marketingFormatSchema = z.enum(['product', 'feature', 'checklist', 'data']);
export const marketingStatusSchema = z.enum(['queued', 'simulated', 'failed']);

export type MarketingChannel = z.infer<typeof marketingChannelSchema>;
export type MarketingFormat = z.infer<typeof marketingFormatSchema>;
export type MarketingStatus = z.infer<typeof marketingStatusSchema>;

/** 검토된 홍보 소재. reviewed:true는 운영자의 원문 확인일 뿐, 자동 사실검증 보증이 아니다. */
export const marketingSourceSchema = z.object({
  id: z.string().min(1).max(64),
  factIds: z.array(z.string().min(1).max(64)).min(1).max(20),
  reviewed: z.boolean(),
  reviewedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  nextVerifyAt: z.string().datetime().nullable(),
  active: z.boolean(),
  note: z.string().max(500).optional(),
});
export type MarketingSource = z.infer<typeof marketingSourceSchema>;

/** 콘텐츠 생성 요청 */
export const contentGenerateRequestSchema = z.object({
  sourceId: z.string().min(1).max(64),
  channel: marketingChannelSchema,
  format: marketingFormatSchema,
  scheduledAt: z.string().datetime().optional(),
});
export type ContentGenerateRequest = z.infer<typeof contentGenerateRequestSchema>;

/** 생성된 콘텐츠 단위 */
export const marketingJobSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string(),
  channel: marketingChannelSchema,
  format: marketingFormatSchema,
  title: z.string(),
  body: z.string(),
  utmUrl: z.string().nullable(),
  status: marketingStatusSchema,
  scheduledAt: z.string().datetime().nullable(),
  simulatedAt: z.string().datetime().nullable(),
  failedAt: z.string().datetime().nullable(),
  failReason: z.string().nullable(),
  retryCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type MarketingJob = z.infer<typeof marketingJobSchema>;

/** 관리자 응답 — 목록 */
export const marketingListResponseSchema = z.object({
  summary: z.object({
    generated: z.number().int().nonnegative(),
    simulated: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    failRate: z.number().min(0).max(1),
  }),
  items: z.array(marketingJobSchema),
});
export type MarketingListResponse = z.infer<typeof marketingListResponseSchema>;

/** 계획 프롬프트 (AI 호출용 공통 계약 — 현재는 실제 호출 없음) */
export const planningPromptOutputSchema = z.object({
  channel: marketingChannelSchema,
  format: marketingFormatSchema,
  factIds: z.array(z.string()).min(1),
});
export type PlanningPromptOutput = z.infer<typeof planningPromptOutputSchema>;
