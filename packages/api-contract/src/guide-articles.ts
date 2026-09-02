import { LIFECYCLE_STAGES } from '@weddingpick/domain';
import { z } from 'zod';

import { idSchema, sourceTypeSchema, timestampSchema, vendorCategorySchema } from './common';

/**
 * WP-EXPO-003·004. 웨딩 정보 글.
 *
 * `stage`는 `packages/domain/src/lifecycle.ts`의 LIFECYCLE_STAGES를 그대로 쓴다 —
 * 사용자의 지금 단계를 저장하는 것과는 다른 얘기다. 여기서는 "이 글이 어느
 * 단계에 맞는 글인지" 운영이 붙인 분류일 뿐이다.
 */
export const guideArticleSummarySchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  stage: z.enum(LIFECYCLE_STAGES).nullable(),
  /** 카테고리별 가이드. 화면이 이 값으로 검색(카테고리 필터)에 연결한다. */
  relatedCategory: vendorCategorySchema.nullable(),
  publishedAt: timestampSchema,
});

export const guideArticleDetailSchema = guideArticleSummarySchema.extend({
  body: z.string().min(1),
  source: sourceTypeSchema,
  lastVerifiedAt: timestampSchema,
});

export const guideArticleListResponseSchema = z.object({
  articles: z.array(guideArticleSummarySchema),
  nextCursor: z.string().nullable(),
});

export type GuideArticleSummary = z.infer<typeof guideArticleSummarySchema>;
export type GuideArticleDetail = z.infer<typeof guideArticleDetailSchema>;
export type GuideArticleListResponse = z.infer<typeof guideArticleListResponseSchema>;
