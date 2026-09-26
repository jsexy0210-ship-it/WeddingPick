import { randomUUID } from 'node:crypto';

import type { PublicStat, WeddingFeedTopic } from '@weddingpick/domain';
import type { Pool } from 'pg';

import { imageDHash } from './analysis/image-dhash';
import {
  FEED_DRAFT_MAX_ATTEMPTS,
  FEED_IMAGE_DUPLICATE_BITS,
  FEED_RECENT_LIMIT,
  chooseFeedImagePlan,
  feedImagePlanSignature,
  findNearDuplicate,
  hammingDistanceHex,
  parseFeedImagePlan,
  type FeedImagePlan,
  type FeedTextSample,
} from './analysis/wedding-feed-diversity';
import { weddingFeedImageModel, type FeedImageRequest, type WeddingFeedImage } from './analysis/wedding-feed-image';
import * as feedWriter from './analysis/wedding-feed-writer';
import type { FeedDraft, FeedWriter } from './analysis/wedding-feed-writer';

/**
 * 웨딩피드 자동 작성이 **이전 것과 겹치지 않게** 쓰고 그리는 자리 — DB와 저장소를 본다.
 *
 * 2026-09-26 대표 지시 — 「같은 카테고리 이전 내용을 분석해서 중첩되지 않는 내용으로
 * 생성한다. 전체적으로 이미지도 대부분 다 비슷비슷하다. 다르게 생성되어야한다」.
 *
 * 규칙(한도 · 유사도 · 계획 고르기 · 지문)은 `analysis/wedding-feed-diversity.ts`에 있고,
 * 여기는 그 규칙에 넘길 «최근 것»을 읽고 결과를 남긴다. 부르는 곳은 셋이다 — 관리자
 * 「자동 작성」(`/draft` · `/image/generate`)과 자동 작성 한 바퀴(`runGeneration`).
 */

type Usage = { inputTokens: number; outputTokens: number };

/**
 * 같은 카테고리의 최근 글. **초안과 내린 글도 센다** — 지금 안 보이는 글도 누가 올리면
 * 겹친 글이 둘이 된다.
 */
export async function loadRecentFeedPosts(
  pool: Pool,
  categoryLabel: string,
  limit = FEED_RECENT_LIMIT
): Promise<FeedTextSample[]> {
  const { rows } = await pool.query<{ title: string; summary: string; body: string }>(
    `SELECT title, summary, body
       FROM structured.wedding_feed_posts
      WHERE category_label = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [categoryLabel, limit]
  );

  return (rows ?? []).map((row) => ({ title: row.title, summary: row.summary, body: row.body }));
}

export type RejectedDraft = { title: string; against: string; score: number };

/** 몇 번을 다시 써도 이전 글과 겹쳤다. 글은 내보내지 않는다. */
export class FeedDuplicateError extends Error {
  constructor(
    readonly rejected: readonly RejectedDraft[],
    readonly usage: Usage
  ) {
    super(
      `이미 쓴 글과 겹쳐 ${rejected.length}번 버렸어요 — ` +
        rejected
          .map((item) => `「${item.title}」≈「${item.against}」 ${item.score.toFixed(2)}`)
          .join(' · ')
    );
    this.name = 'FeedDuplicateError';
  }
}

/**
 * 겹치지 않는 초안 한 편.
 *
 * 1. 같은 카테고리의 최근 글(`recent`)을 「이미 쓴 글」로 넘겨 쓴다.
 * 2. 받은 초안을 서버가 잰다(`findNearDuplicate` · 모델 호출 없음).
 * 3. 한도를 넘으면 버리고, 그 제목을 「쓰지 말 제목」에 더해 다시 쓴다.
 * 4. `maxAttempts`번 다 겹치거나 시간이 다 되면 `FeedDuplicateError` — **겹친 글은 내보내지 않는다.**
 *
 * `deadline`은 관리자 요청이 넘긴다. nginx가 60초에 끊어서, 그 뒤에 쓴 글은 아무도 못 받는다.
 */
export async function writeDistinctDraft(input: {
  writer: FeedWriter;
  topic: WeddingFeedTopic;
  stats?: readonly PublicStat[];
  recent: readonly FeedTextSample[];
  avoidTitles?: readonly string[];
  maxAttempts?: number;
  deadline?: number;
  now?: () => number;
}): Promise<{ draft: FeedDraft; usage: Usage; attempts: number; rejected: RejectedDraft[] }> {
  const now = input.now ?? Date.now;
  const maxAttempts = input.maxAttempts ?? FEED_DRAFT_MAX_ATTEMPTS;
  const avoidTitles = [...(input.avoidTitles ?? [])];
  const compareWith: FeedTextSample[] = [
    ...input.recent,
    ...avoidTitles.map((title) => ({ title, summary: '' })),
  ];
  const rejected: RejectedDraft[] = [];
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1 && input.deadline !== undefined && now() >= input.deadline) break;

    const written = await input.writer.write(input.topic, input.stats ?? [], {
      covered: input.recent,
      avoidTitles: [...avoidTitles],
    });

    usage.inputTokens += written.usage.inputTokens;
    usage.outputTokens += written.usage.outputTokens;

    const near = findNearDuplicate(written.draft, compareWith, {
      categoryLabel: input.topic.categoryLabel,
    });

    if (!near) return { draft: written.draft, usage, attempts: attempt, rejected };

    rejected.push({ title: written.draft.title, against: near.post.title, score: near.score });
    avoidTitles.push(written.draft.title);
    compareWith.push(written.draft);
  }

  throw new FeedDuplicateError(rejected, usage);
}

// ─── 그림 ─────────────────────────────────────────────────────────────────

type ImageStore = {
  upload(storageKey: string, bytes: Buffer, mimeType: string): Promise<void>;
  getPublicUrl(storageKey: string, expiresInSeconds: number): Promise<string>;
};

type ImageHistory = { plans: FeedImagePlan[]; hashes: string[]; ready: boolean };

/** 표가 아직 없다(0443을 운영에 올리기 전). */
function isMissingTable(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === '42P01');
}

/**
 * 최근에 만든 그림 — 같은 카테고리 30장과 전체 30장을 합쳐 최근 순으로.
 *
 * **전체도 본다.** 대표님 말씀이 「전체적으로 … 비슷비슷하다」였다. 카테고리 안에서만
 * 다르게 하면 카테고리끼리는 같은 그림이 된다.
 *
 * **표가 없으면 빈 기록으로 계속한다**(DB 마이그레이션은 배포와 따로 돈다 — CLAUDE.md).
 * 그 사이에도 계획은 무작위로 골라지므로 전처럼 한 가지 화풍으로 몰리지 않는다.
 */
export async function loadFeedImageHistory(
  pool: Pool,
  categoryLabel: string,
  limit = FEED_RECENT_LIMIT
): Promise<ImageHistory> {
  try {
    const { rows } = await pool.query<{ plan: unknown; dhash: string | null }>(
      `SELECT plan, dhash, created_at FROM (
         (SELECT storage_key, plan, dhash, created_at
            FROM structured.wedding_feed_generated_images
           WHERE category_label = $1
           ORDER BY created_at DESC
           LIMIT $2)
         UNION
         (SELECT storage_key, plan, dhash, created_at
            FROM structured.wedding_feed_generated_images
           ORDER BY created_at DESC
           LIMIT $2)
       ) recent
       ORDER BY created_at DESC`,
      [categoryLabel, limit]
    );

    return {
      plans: rows.map((row) => parseFeedImagePlan(row.plan)).filter((plan): plan is FeedImagePlan => plan !== null),
      hashes: rows.map((row) => row.dhash).filter((hash): hash is string => typeof hash === 'string'),
      ready: true,
    };
  } catch (error) {
    if (isMissingTable(error)) return { plans: [], hashes: [], ready: false };
    throw error;
  }
}

/** 몇 번을 다시 만들어도 최근 그림과 닮았다. 저장하지 않는다. */
export class FeedImageDuplicateError extends Error {
  constructor(readonly attempts: number, readonly bits: number) {
    super(`최근 그림과 ${bits}비트 차이 — ${attempts}번 만들어도 다르게 나오지 않았어요`);
    this.name = 'FeedImageDuplicateError';
  }
}

/** 첫 그림이 이 시간 안에 나왔을 때만 다시 만든다. 두 번째가 60초(nginx) 안에 끝나야 한다. */
export const FEED_IMAGE_REGENERATE_WITHIN_MS = 25_000;
/** 관리자 요청 하나가 그림에 쓸 수 있는 시간. nginx `proxy_read_timeout 60s`보다 짧게. */
export const FEED_IMAGE_BUDGET_MS = 55_000;
export const FEED_IMAGE_MAX_ATTEMPTS = 2;

export type GeneratedFeedImage = {
  storageKey: string;
  imageUrl: string;
  plan: FeedImagePlan;
  dhash: string | null;
  attempts: number;
};

/**
 * 최근 그림과 다른 웨딩피드 그림 한 장을 만들어 저장한다.
 *
 * 1. 최근 그림의 계획을 보고 이번 계획을 고른다(`chooseFeedImagePlan`) — 장소 · 구도 · 시간 ·
 *    계절 · 색감 · 소품 · 인원을 덜 쓴 값으로, 같은 조합은 다시 고르지 않는다.
 * 2. 그린다(`generateWeddingFeedImage` — `wedding-feed-writer.ts`).
 * 3. 지문(dHash)을 최근 그림과 견준다. 10비트 이하로 다르면 계획을 바꿔 다시 그린다.
 * 4. 저장소에 올리고 계획 · 지문을 표(0443)에 남긴다 — 다음 그림이 이것을 피한다.
 *
 * 저장하지 않고 버린 그림도 기록에 남는다. 관리자가 마음에 안 들어 다시 누르면, 다음
 * 그림은 방금 것과도 달라야 한다.
 */
export async function generateDistinctFeedImage(input: {
  pool: Pool;
  storage: ImageStore;
  apiKey: string;
  request: FeedImageRequest;
  random?: () => number;
  now?: () => number;
  maxAttempts?: number;
  log?: (message: string) => void;
}): Promise<GeneratedFeedImage> {
  const now = input.now ?? Date.now;
  const started = now();
  const category = input.request.categoryLabel?.trim() ?? '';
  const history = await loadFeedImageHistory(input.pool, category);
  const maxAttempts = input.maxAttempts ?? FEED_IMAGE_MAX_ATTEMPTS;
  const tried: FeedImagePlan[] = [];
  let accepted: { image: WeddingFeedImage; plan: FeedImagePlan; hash: string | null } | null = null;
  let closest = 64;
  let attempts = 0;

  if (!history.ready) input.log?.('웨딩피드 그림 기록 표(0443)가 없어 최근 그림과 견주지 못했다');

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1 && now() - started > FEED_IMAGE_REGENERATE_WITHIN_MS) break;

    const plan = chooseFeedImagePlan({
      categoryLabel: category,
      recent: [...tried, ...history.plans],
      random: input.random,
    });
    const timeoutMs = Math.max(5_000, Math.min(50_000, FEED_IMAGE_BUDGET_MS - (now() - started)));
    const image = await feedWriter.generateWeddingFeedImage(input.apiKey, input.request, plan, { timeoutMs });
    const hash = imageDHash(image.bytes, image.mimeType);
    attempts = attempt;

    if (!hash) input.log?.(`웨딩피드 그림 지문을 못 쟀다(${image.mimeType}) — 계획만으로 다르게 만든다`);

    const nearest = hash
      ? Math.min(64, ...history.hashes.map((previous) => hammingDistanceHex(previous, hash)))
      : 64;

    if (nearest > FEED_IMAGE_DUPLICATE_BITS) {
      accepted = { image, plan, hash };
      break;
    }

    closest = Math.min(closest, nearest);
    input.log?.(`웨딩피드 그림이 최근 그림과 ${nearest}비트 차이 — 계획을 바꿔 다시 만든다`);
    tried.unshift(plan);
  }

  if (!accepted) throw new FeedImageDuplicateError(attempts, closest);

  const storageKey = `wedding-feed/${input.request.kind}/${randomUUID()}.${accepted.image.extension}`;

  await input.storage.upload(storageKey, accepted.image.bytes, accepted.image.mimeType);

  if (history.ready) {
    try {
      await input.pool.query(
        `INSERT INTO structured.wedding_feed_generated_images
           (storage_key, category_label, kind, plan, plan_signature, dhash, model, attempts)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
        [
          storageKey,
          category,
          input.request.kind,
          JSON.stringify(accepted.plan),
          feedImagePlanSignature(accepted.plan),
          accepted.hash,
          weddingFeedImageModel(),
          attempts,
        ]
      );
    } catch (error) {
      /* 기록을 못 남겨도 그림은 이미 올라갔다 — 관리자에게는 그림을 준다. */
      if (!isMissingTable(error)) input.log?.('웨딩피드 그림 기록을 남기지 못했다');
    }
  }

  return {
    storageKey,
    imageUrl: await input.storage.getPublicUrl(storageKey, 3600),
    plan: accepted.plan,
    dhash: accepted.hash,
    attempts,
  };
}
