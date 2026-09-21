import { z } from 'zod';

import { idSchema, timestampSchema, vendorCategorySchema } from './common';

export const favoriteVendorSchema = z.object({
  id: idSchema,
  vendorId: idSchema,
  vendorName: z.string().min(1),
  category: vendorCategorySchema,
  region: z.string().min(1),
  imageUrl: z.string().nullable(),
  createdAt: timestampSchema,
});

export const favoriteVendorListResponseSchema = z.object({
  items: z.array(favoriteVendorSchema),
  total: z.int().nonnegative(),
});

export const createFavoriteVendorRequestSchema = z.object({
  vendorId: idSchema,
});

export type FavoriteVendor = z.infer<typeof favoriteVendorSchema>;
export type FavoriteVendorListResponse = z.infer<typeof favoriteVendorListResponseSchema>;
export type CreateFavoriteVendorRequest = z.infer<typeof createFavoriteVendorRequestSchema>;
