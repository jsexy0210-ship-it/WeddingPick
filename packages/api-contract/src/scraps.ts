import { z } from 'zod';

export const weddingFeedScrapItemSchema = z.object({
  id: z.string().uuid(),
  categoryLabel: z.string(),
  title: z.string(),
  summary: z.string(),
  imageUrl: z.string().nullable(),
  savedAt: z.string(),
});

export const weddingFeedScrapListResponseSchema = z.object({
  items: z.array(weddingFeedScrapItemSchema),
});

export const weddingFeedScrapStateSchema = z.object({
  saved: z.boolean(),
});

export type WeddingFeedScrapItem = z.infer<typeof weddingFeedScrapItemSchema>;
export type WeddingFeedScrapListResponse = z.infer<typeof weddingFeedScrapListResponseSchema>;
export type WeddingFeedScrapState = z.infer<typeof weddingFeedScrapStateSchema>;
