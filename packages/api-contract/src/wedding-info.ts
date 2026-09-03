import { z } from 'zod';

export const weddingInfoStageSchema = z.enum([
  'preparation',
  'venue',
  'dress',
  'photo',
  'beauty',
  'honeymoon',
  'after',
]);

export const weddingInfoCategorySchema = z.enum([
  'tips',
  'checklist',
  'review',
  'trend',
  'faq',
]);

export const weddingInfoItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  stage: weddingInfoStageSchema,
  category: weddingInfoCategorySchema,
  publishedAt: z.string().min(1),
  viewCount: z.int().nonnegative(),
});

export const weddingInfoDetailSchema = weddingInfoItemSchema.extend({
  body: z.string(),
  checklist: z.array(z.string()),
  relatedVendorIds: z.array(z.string()),
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
