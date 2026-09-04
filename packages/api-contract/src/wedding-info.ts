import { z } from 'zod';

export const weddingInfoStageSchema = z.enum(['early', 'mid', 'late', 'all']);

export const weddingInfoCategorySchema = z.enum([
  'planning',
  'venue',
  'dress',
  'photo',
  'beauty',
  'catering',
  'honeymoon',
]);

export const weddingInfoItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  stage: weddingInfoStageSchema,
  category: weddingInfoCategorySchema,
  publishedAt: z.string().min(1),
  thumbnailUrl: z.string().nullable(),
});

export const weddingInfoDetailSchema = weddingInfoItemSchema.extend({
  body: z.string(),
  checklist: z.array(
    z.object({ id: z.string(), label: z.string(), done: z.boolean() })
  ),
  relatedVendors: z.array(
    z.object({ id: z.string(), name: z.string(), category: z.string() })
  ),
});

export const weddingInfoListResponseSchema = z.object({
  items: z.array(weddingInfoItemSchema),
  nextCursor: z.string().nullable(),
});

export type WeddingInfoStage = z.infer<typeof weddingInfoStageSchema>;
export type WeddingInfoCategory = z.infer<typeof weddingInfoCategorySchema>;
export type WeddingInfoItem = z.infer<typeof weddingInfoItemSchema>;
export type WeddingInfoDetail = z.infer<typeof weddingInfoDetailSchema>;
export type WeddingInfoListResponse = z.infer<typeof weddingInfoListResponseSchema>;
