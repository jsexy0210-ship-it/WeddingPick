import {
  WEDDING_FEED_LIMITS,
  WEDDING_FEED_SOURCES,
  WEDDING_FEED_STATUSES,
} from '@weddingpick/domain';
import { z } from 'zod';

/**
 * 웨딩피드 — 홈의 읽을거리. 운영자가 관리하고 자동 작성이 쌓는다.
 *
 * **한도는 domain에서 온다.** 계약에 숫자를 다시 적으면 화면과 서버가 다른 길이를
 * 막게 되고, 그 차이는 긴 제목 하나가 들어온 날에야 드러난다.
 */

const trimmed = (max: number) => z.string().trim().max(max);

export const weddingFeedPostSchema = z.object({
  id: z.string().uuid(),
  categoryLabel: z.string(),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  /** 이미지 관리가 올린 키. 없으면 회색 판이다. */
  imageKey: z.string().nullable(),
  /** 화면이 바로 쓸 수 있는 주소. 키가 없으면 null. */
  imageUrl: z.string().nullable(),
  status: z.enum(WEDDING_FEED_STATUSES),
  source: z.enum(WEDDING_FEED_SOURCES),
  model: z.string().nullable(),
  topic: z.string().nullable(),
  sortOrder: z.number().int(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WeddingFeedPost = z.infer<typeof weddingFeedPostSchema>;

/** 운영자가 보내는 것. `source` · `model` · `topic`은 서버가 정한다 — 사람이 쓴 글은 manual이다. */
export const weddingFeedInputSchema = z.object({
  categoryLabel: trimmed(WEDDING_FEED_LIMITS.categoryLabel).min(1),
  title: trimmed(WEDDING_FEED_LIMITS.title).min(1),
  summary: trimmed(WEDDING_FEED_LIMITS.summary).default(''),
  body: z.string().max(WEDDING_FEED_LIMITS.body).default(''),
  imageKey: z.string().nullable().default(null),
  status: z.enum(WEDDING_FEED_STATUSES).default('draft'),
  sortOrder: z.number().int().default(0),
});

export type WeddingFeedInputPayload = z.input<typeof weddingFeedInputSchema>;

export const weddingFeedRunSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  createdCount: z.number().int(),
  model: z.string().nullable(),
  inputTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
  error: z.string().nullable(),
  trigger: z.enum(['schedule', 'manual']),
});

export const adminWeddingFeedResponseSchema = z.object({
  posts: z.array(weddingFeedPostSchema),
  /** 자동 작성이 돈 기록. 최근 것부터. */
  runs: z.array(weddingFeedRunSchema),
  /** 자동 작성이 쓸 수 있는 주제가 몇 개 남았나. 0이면 더 쓸 것이 없다. */
  remainingTopics: z.number().int(),
});

export type AdminWeddingFeedResponse = z.infer<typeof adminWeddingFeedResponseSchema>;

/** 앱 홈이 부르는 것. 공개된 글만 나간다. */
export const weddingFeedListResponseSchema = z.object({
  items: z.array(
    weddingFeedPostSchema.pick({
      id: true,
      categoryLabel: true,
      title: true,
      summary: true,
      imageUrl: true,
    })
  ),
});

export type WeddingFeedListResponse = z.infer<typeof weddingFeedListResponseSchema>;

export const weddingFeedGenerateResponseSchema = z.object({
  created: z.number().int(),
  /** 왜 아무것도 안 나왔는지. 만들어졌으면 null. */
  skipped: z.string().nullable(),
});
