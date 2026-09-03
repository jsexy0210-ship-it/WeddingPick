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
  description: z.string(),
  registrationUrl: z.string().nullable(),
  notifyEnabled: z.boolean(),
});

export const expoListResponseSchema = z.object({
  items: z.array(expoItemSchema),
  nextCursor: z.string().nullable(),
});

export type ExpoStatus = z.infer<typeof expoStatusSchema>;
export type ExpoItem = z.infer<typeof expoItemSchema>;
export type ExpoDetail = z.infer<typeof expoDetailSchema>;
export type ExpoListResponse = z.infer<typeof expoListResponseSchema>;
