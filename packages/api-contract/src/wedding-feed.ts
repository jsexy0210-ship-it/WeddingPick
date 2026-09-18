import {
  WEDDING_FEED_LIMITS,
  WEDDING_FEED_SOURCES,
  WEDDING_FEED_STATUSES,
  WEDDING_FEED_TAXONOMY_LIMITS,
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

/**
 * 앱이 그릴 탭 하나.
 *
 * `categories`는 **이름 배열**이다 — 글이 들고 있는 것이 `categoryLabel` 문자열이라
 * 앱은 그 이름으로 거른다. 「전체」는 빈 배열이고 아무것도 거르지 않는다.
 */
export const weddingFeedTabSchema = z.object({
  key: z.string(),
  label: z.string(),
  categories: z.array(z.string()),
});

/**
 * 앱 홈이 부르는 것. 공개된 글만 나간다.
 *
 * **탭을 글과 «같은 응답»으로 준다.** 따로 부르면 목록이 먼저 그려지고 탭 줄이
 * 나중에 끼어들어 본문이 손가락 아래에서 밀린다 — 홈은 이미 이 자리를 기다리지 않고
 * 부르는 중이라(`(tabs)/index.tsx`) 그 어긋남이 그대로 보인다. 한 번에 오면 탭과
 * 목록이 같이 나타나거나 같이 안 나타난다.
 */
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
  /** 맨 앞은 언제나 「전체」다. 카테고리가 하나도 없는 탭은 빠진다. */
  tabs: z.array(weddingFeedTabSchema),
});

export type WeddingFeedListResponse = z.infer<typeof weddingFeedListResponseSchema>;

/**
 * 글 하나. 카드를 눌러 들어가는 자리.
 *
 * **목록이 주지 않는 둘이 여기 있다 — `body`와 `publishedAt`.** 목록이 본문까지
 * 실어 보내면 여덟 편의 본문(각 4,000자까지)이 카드 여덟 장을 그리려고 통째로
 * 건너온다. 읽는 사람은 그중 한 편만 연다.
 *
 * **공개된 글만 나간다.** 초안과 내림은 없는 것으로 본다 — 주소를 아는 사람에게만
 * 검토 전 글이 보이는 자리를 만들지 않는다.
 */
export const weddingFeedDetailSchema = weddingFeedPostSchema.pick({
  id: true,
  categoryLabel: true,
  title: true,
  summary: true,
  body: true,
  imageUrl: true,
  publishedAt: true,
});

export type WeddingFeedDetail = z.infer<typeof weddingFeedDetailSchema>;

export const weddingFeedGenerateResponseSchema = z.object({
  created: z.number().int(),
  /** 왜 아무것도 안 나왔는지. 만들어졌으면 null. */
  skipped: z.string().nullable(),
});

/**
 * ── 탭과 카테고리 ─────────────────────────────────────────────────────────
 *
 * 2026-09-16 대표 지시 — 「웨딩피드는 탭별 카테고리별로 다 설정 가능해야한다」.
 * 값은 표(0421)에 있고 관리자가 고친다.
 */

export const weddingFeedGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number().int(),
  active: z.boolean(),
});

export const weddingFeedCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  /** 어느 탭인가. 탭이 지워지면 null이 된다. */
  groupId: z.string().uuid().nullable(),
  sortOrder: z.number().int(),
  active: z.boolean(),
  /** 이 카테고리로 쌓인 글이 몇 편인가. 지우기를 막는 근거이자 화면에 보여줄 수다. */
  postCount: z.number().int(),
});

export const weddingFeedGroupInputSchema = z.object({
  name: trimmed(WEDDING_FEED_TAXONOMY_LIMITS.groupName).min(1),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const weddingFeedCategoryInputSchema = z.object({
  name: trimmed(WEDDING_FEED_TAXONOMY_LIMITS.categoryName).min(1),
  groupId: z.string().uuid().nullable().default(null),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export type WeddingFeedGroupInputPayload = z.input<typeof weddingFeedGroupInputSchema>;
export type WeddingFeedCategoryInputPayload = z.input<typeof weddingFeedCategoryInputSchema>;

/**
 * 관리자가 받는 분류표.
 *
 * `ungrouped`를 **서버가 세어 준다** — 어느 탭에도 안 든 카테고리다. 화면이 직접
 * 세게 두면 화면마다 세는 법이 갈린다(꺼진 것을 셀 것인가 같은 자리에서).
 */
export const adminWeddingFeedTaxonomySchema = z.object({
  groups: z.array(weddingFeedGroupSchema),
  categories: z.array(weddingFeedCategorySchema),
  ungrouped: z.array(z.string()),
});

export type AdminWeddingFeedTaxonomy = z.infer<typeof adminWeddingFeedTaxonomySchema>;
