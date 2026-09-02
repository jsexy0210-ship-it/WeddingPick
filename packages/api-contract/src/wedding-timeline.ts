import { z } from 'zod';

import { amountSchema, timestampSchema, vendorCategorySchema } from './common';

/**
 * WP-OUR-012 준비 타임라인. Pick·최종결정·지출·(사용자가 더한) 일정 넷을
 * 시간순으로 섞는다. "완료 기록"은 없다 — `wedding_tasks`가 완료 시각을
 * 저장하지 않아서 낼 수 없다(`apps/api/src/routes/wedding-timeline.ts` 참조).
 */
export const weddingTimelineEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pick'),
    at: timestampSchema,
    vendorName: z.string().min(1),
    category: vendorCategorySchema,
  }),
  z.object({
    kind: z.literal('decision'),
    at: timestampSchema,
    vendorName: z.string().min(1),
    category: vendorCategorySchema,
  }),
  z.object({
    kind: z.literal('expense'),
    at: timestampSchema,
    label: z.string().min(1),
    amount: amountSchema,
  }),
  z.object({
    kind: z.literal('task'),
    at: timestampSchema,
    label: z.string().min(1),
  }),
]);

export const weddingTimelineResponseSchema = z.object({
  events: z.array(weddingTimelineEventSchema),
});

export type WeddingTimelineEvent = z.infer<typeof weddingTimelineEventSchema>;
export type WeddingTimelineResponse = z.infer<typeof weddingTimelineResponseSchema>;
