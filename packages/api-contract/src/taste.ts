import { z } from 'zod';

/**
 * 취향. 홈 C-1 시안 1 — 사진으로 «어떤 결혼식을 원하세요?»를 받는 자리.
 *
 * 시안이 정한 개수를 그대로 쓴다 — 여기서 항목을 늘리려면 사진이 먼저 있어야
 * 한다. v3.14가 온보딩 2단계(WP-APP-021) 2×3 격자로 늘리며 minimal·film 둘을
 * 더했다.
 */
export const TASTES = ['white', 'daylight', 'flower', 'classic', 'minimal', 'film'] as const;

export const tasteSchema = z.enum(TASTES);

export const tasteListResponseSchema = z.object({
  tastes: z.array(tasteSchema),
});

export const updateTasteRequestSchema = z.object({
  tastes: z.array(tasteSchema),
});

export type Taste = z.infer<typeof tasteSchema>;
export type TasteListResponse = z.infer<typeof tasteListResponseSchema>;
export type UpdateTasteRequest = z.infer<typeof updateTasteRequestSchema>;
