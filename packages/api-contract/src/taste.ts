import { TASTE_CATEGORIES, TASTE_MIN_PICKS, TASTE_SET_SIZE, isTasteKey } from '@weddingpick/domain';
import { z } from 'zod';

/**
 * 취향. 온보딩 5/5(WP-APP-021) — 핸드오프 v3.19 «취향을 다음 미완료 업종 기준으로 개편».
 *
 * **한 번에 한 업종만** 받는다. 어느 업종인지는 준비 현황에서 완료하지 않은 첫
 * 업종이고(domain `nextTasteCategory`), 업종마다 세트가 다르다(domain `TASTE_SETS`).
 * 키는 그 업종의 세트에 있는 것만 받는다 — 다른 업종의 키가 서버에 남으면
 * 화면이 빈 칸을 그린다.
 *
 * 2026-09-08 이전의 `tastes: ['white', …]` 계약은 폐기했다. 저장돼 있던 값은 0089가
 * 스튜디오 세트(studio_*)로 옮겼다.
 */
export const tasteCategorySchema = z.enum(TASTE_CATEGORIES);

export const tasteKeySchema = z.string().min(1).max(40);

export const tasteListResponseSchema = z.object({
  /** 어느 업종의 취향인지. 아직 안 골랐으면 null이고 keys는 빈 배열이다. */
  category: tasteCategorySchema.nullable(),
  keys: z.array(tasteKeySchema),
});

/** 고른 전체를 그대로 덮어쓴다. 최소 1장 — 온보딩에서 유일한 필수 답이다. */
export const updateTasteRequestSchema = z
  .object({
    category: tasteCategorySchema,
    keys: z.array(tasteKeySchema).min(TASTE_MIN_PICKS).max(TASTE_SET_SIZE),
  })
  .superRefine((value, ctx) => {
    for (const [index, key] of value.keys.entries()) {
      if (!isTasteKey(value.category, key)) {
        ctx.addIssue({ code: 'custom', path: ['keys', index], message: '이 업종의 취향이 아니에요.' });
      }
    }

    if (new Set(value.keys).size !== value.keys.length) {
      ctx.addIssue({ code: 'custom', path: ['keys'], message: '같은 취향을 두 번 고를 수 없어요.' });
    }
  });

export type TasteCategory = z.infer<typeof tasteCategorySchema>;
export type TasteListResponse = z.infer<typeof tasteListResponseSchema>;
export type UpdateTasteRequest = z.infer<typeof updateTasteRequestSchema>;
