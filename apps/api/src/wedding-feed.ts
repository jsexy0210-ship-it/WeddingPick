import type { Pool } from 'pg';

import {
  WEDDING_FEED_PER_RUN,
  WEDDING_FEED_TARGET_PUBLISHED,
  WEDDING_FEED_TOPICS,
  checkWeddingFeedInput,
  pickTopics,
  shouldGenerate,
  type WeddingFeedStatus,
} from '@weddingpick/domain';
import { weddingFeedInputSchema } from '@weddingpick/api-contract';

import { ApiError, notFound } from './errors';
import { listTabs } from './wedding-feed-taxonomy';
import type { FeedWriter } from './analysis/wedding-feed-writer';

/**
 * 웨딩피드 — 운영자가 관리하고 자동 작성이 쌓는 읽을거리.
 *
 * 2026-09-15 대표 지시 — 「관리자에 웨딩피드 콘텐츠 메뉴 만들어. 목록 등록 삭제 수정
 * 다 가능해야 하고 지속 콘텐츠 작성한다」.
 *
 * **초안이 기본이다.** 자동 작성이 붙어 있어서, 새로 써진 글이 사람 손을 거치지 않고
 * 바로 홈에 뜨면 안 된다. 사람이 읽고 `published`로 올린다.
 *
 * 그림 주소는 조회할 때마다 서명해서 내려준다 — 영구 URL을 저장해 두면 만료를 관리할
 * 방법이 없다(`routes/vendors.ts`의 업체 사진과 같은 방식).
 */

/** 스토리지에서 그림 주소를 받아 오는 쪽. 서명 URL의 수명은 한 시간이다. */
export type FeedStorage = { getPublicUrl(key: string, seconds: number): Promise<string> };

type Row = {
  id: string;
  category_label: string;
  title: string;
  summary: string;
  body: string;
  image_key: string | null;
  status: WeddingFeedStatus;
  source: 'manual' | 'generated';
  model: string | null;
  topic: string | null;
  sort_order: number;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS = `id, category_label, title, summary, body, image_key, status, source,
                 model, topic, sort_order, published_at, created_at, updated_at`;

async function toPost(row: Row, storage: FeedStorage | null) {
  return {
    id: row.id,
    categoryLabel: row.category_label,
    title: row.title,
    summary: row.summary,
    body: row.body,
    imageKey: row.image_key,
    imageUrl:
      row.image_key && storage ? await storage.getPublicUrl(row.image_key, 3600) : null,
    status: row.status,
    source: row.source,
    model: row.model,
    topic: row.topic,
    sortOrder: row.sort_order,
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * 운영자가 보낸 것을 읽는다.
 *
 * 계약으로 한 번 거르고 domain의 검사로 한 번 더 본다. **두 번 보는 것이 겹치기가
 * 아니다** — 계약은 모양을, domain은 규칙을 본다. 자동 작성은 계약을 거치지 않고
 * domain 검사만 통과하므로, 규칙이 계약에만 있으면 자동 작성이 그 규칙을 비껴간다.
 */
export function parseFeedInput(body: unknown) {
  const parsed = weddingFeedInputSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError('invalid_request', '보낸 값을 읽지 못했어요.');
  }

  const problems = checkWeddingFeedInput({ ...parsed.data, imageKey: parsed.data.imageKey });

  if (problems.length > 0) {
    const first = problems[0]!;

    throw new ApiError('invalid_request', `${first.field}: ${first.message}`);
  }

  return parsed.data;
}

export type FeedInput = ReturnType<typeof parseFeedInput>;

export async function listForAdmin(pool: Pool, storage: FeedStorage | null) {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM structured.wedding_feed_posts
     ORDER BY sort_order ASC, created_at DESC`
  );

  const runs = await pool.query<{
    id: string;
    started_at: Date;
    finished_at: Date | null;
    created_count: number;
    model: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    error: string | null;
    trigger: 'schedule' | 'manual';
  }>(
    `SELECT id, started_at, finished_at, created_count, model, input_tokens,
            output_tokens, error, trigger
     FROM structured.wedding_feed_runs
     ORDER BY started_at DESC
     LIMIT 20`
  );

  const usedTopics = new Set(rows.map((row) => row.topic).filter((t): t is string => t !== null));

  return {
    posts: await Promise.all(rows.map((row) => toPost(row, storage))),
    runs: runs.rows.map((row) => ({
      id: row.id,
      startedAt: row.started_at.toISOString(),
      finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
      createdCount: row.created_count,
      model: row.model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      error: row.error,
      trigger: row.trigger,
    })),
    remainingTopics: WEDDING_FEED_TOPICS.filter((topic) => !usedTopics.has(topic.key)).length,
  };
}

/** 앱 홈이 부르는 것. **공개된 것만** 나간다. */
export async function listPublished(pool: Pool, storage: FeedStorage | null, limit: number) {
  const { rows } = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM structured.wedding_feed_posts
     WHERE status = 'published'
     ORDER BY sort_order ASC, published_at DESC
     LIMIT $1`,
    [limit]
  );

  const posts = await Promise.all(rows.map((row) => toPost(row, storage)));

  /*
   * **탭을 글과 같은 응답으로 준다.** 따로 부르면 목록이 먼저 그려지고 탭 줄이
   * 나중에 끼어들어 본문이 손가락 아래에서 밀린다. 한 번에 오면 둘이 같이 나타난다.
   */
  return {
    items: posts.map((post) => ({
      id: post.id,
      categoryLabel: post.categoryLabel,
      title: post.title,
      summary: post.summary,
      imageUrl: post.imageUrl,
    })),
    tabs: await listTabs(pool),
  };
}

export async function create(
  pool: Pool,
  input: FeedInput,
  createdBy: string | null
): Promise<{ id: string }> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO structured.wedding_feed_posts
       (category_label, category_id, title, summary, body, image_key, status, sort_order,
        published_at, created_by)
     VALUES ($1, (SELECT id FROM structured.wedding_feed_categories WHERE name = $1),
             $2, $3, $4, $5, $6, $7,
             CASE WHEN $6 = 'published' THEN now() ELSE NULL END, $8)
     RETURNING id`,
    [
      input.categoryLabel,
      input.title,
      input.summary,
      input.body,
      input.imageKey,
      input.status,
      input.sortOrder,
      createdBy,
    ]
  );

  return { id: rows[0]!.id };
}

/**
 * 고친다.
 *
 * **공개 시각은 상태를 따라간다.** 초안 → 공개일 때만 새로 찍고, 이미 공개된 글을
 * 고칠 때는 그대로 둔다 — 글자를 하나 고쳤다고 「방금 올라온 글」이 되면 홈의 순서가
 * 흔들린다. 공개 → 초안·내림이면 지운다(표의 CHECK가 그것을 요구한다).
 */
export async function update(pool: Pool, id: string, input: FeedInput): Promise<void> {
  const { rowCount } = await pool.query(
    `UPDATE structured.wedding_feed_posts
     SET category_label = $2,
         category_id = (SELECT id FROM structured.wedding_feed_categories WHERE name = $2),
         title = $3, summary = $4, body = $5, image_key = $6,
         status = $7, sort_order = $8,
         published_at = CASE
           WHEN $7 <> 'published' THEN NULL
           WHEN published_at IS NOT NULL THEN published_at
           ELSE now()
         END,
         updated_at = now()
     WHERE id = $1`,
    [
      id,
      input.categoryLabel,
      input.title,
      input.summary,
      input.body,
      input.imageKey,
      input.status,
      input.sortOrder,
    ]
  );

  if (rowCount === 0) throw notFound('글');
}

export async function remove(pool: Pool, id: string): Promise<void> {
  const { rowCount } = await pool.query(
    'DELETE FROM structured.wedding_feed_posts WHERE id = $1',
    [id]
  );

  if (rowCount === 0) throw notFound('글');
}

/** 지금 몇 편이 공개돼 있고 몇 편이 검토를 기다리나. 자동 작성이 돌지 말지를 여기서 본다. */
export async function counts(pool: Pool): Promise<{
  publishedCount: number;
  draftCount: number;
  usedTopics: string[];
}> {
  const { rows } = await pool.query<{ status: WeddingFeedStatus; n: string }>(
    `SELECT status, count(*)::text AS n
     FROM structured.wedding_feed_posts
     GROUP BY status`
  );
  const byStatus = new Map(rows.map((row) => [row.status, Number(row.n)]));

  const topics = await pool.query<{ topic: string }>(
    `SELECT DISTINCT topic FROM structured.wedding_feed_posts WHERE topic IS NOT NULL`
  );

  return {
    publishedCount: byStatus.get('published') ?? 0,
    draftCount: byStatus.get('draft') ?? 0,
    usedTopics: topics.rows.map((row) => row.topic),
  };
}

/**
 * 자동 작성 한 바퀴.
 *
 * **글이 안 나온 바퀴도 기록한다.** 아무것도 안 나오는 것과 안 도는 것은 화면에서
 * 구별되지 않는다 — 운영자가 「자동 작성이 죽었나」를 묻게 되는 자리다.
 *
 * 한 편이 실패해도 나머지는 계속 쓴다. 한 편 때문에 바퀴 전체를 버리면, 모델이 가끔
 * 마는 한 번의 실패가 그날의 글을 전부 없앤다.
 */
export async function runGeneration(input: {
  pool: Pool;
  writer: FeedWriter;
  model: string;
  trigger: 'schedule' | 'manual';
}): Promise<{ created: number; skipped: string | null }> {
  const { pool, writer, model, trigger } = input;
  const state = await counts(pool);

  if (!shouldGenerate(state)) {
    const reason =
      state.publishedCount >= WEDDING_FEED_TARGET_PUBLISHED
        ? '공개된 글이 충분해요'
        : state.draftCount >= WEDDING_FEED_PER_RUN
          ? '검토를 기다리는 초안이 있어요'
          : '쓸 주제가 남아 있지 않아요';

    return { created: 0, skipped: reason };
  }

  const topics = pickTopics(state.usedTopics, WEDDING_FEED_PER_RUN);
  const run = await pool.query<{ id: string }>(
    `INSERT INTO structured.wedding_feed_runs (model, trigger) VALUES ($1, $2) RETURNING id`,
    [model, trigger]
  );
  const runId = run.rows[0]!.id;

  let created = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const failures: string[] = [];

  for (const topic of topics) {
    try {
      const { draft, usage } = await writer.write(topic);

      inputTokens += usage.inputTokens;
      outputTokens += usage.outputTokens;

      /*
       * **모델이 넘긴 길이를 그대로 믿지 않는다.** 지시문에 한도를 적어도 넘겨서
       * 오고, 넘긴 글은 카드에서 잘려 보이는데 목록에서는 멀쩡해 보인다.
       */
      const problems = checkWeddingFeedInput({
        categoryLabel: topic.categoryLabel,
        title: draft.title,
        summary: draft.summary,
        body: draft.body,
        imageKey: null,
        status: 'draft',
        sortOrder: 0,
      });

      if (problems.length > 0) {
        failures.push(`${topic.key}: ${problems[0]!.field} ${problems[0]!.message}`);
        continue;
      }

      await pool.query(
        `INSERT INTO structured.wedding_feed_posts
           (category_label, category_id, title, summary, body, status, source, model, topic)
         VALUES ($1, (SELECT id FROM structured.wedding_feed_categories WHERE name = $1),
                 $2, $3, $4, 'draft', 'generated', $5, $6)`,
        [topic.categoryLabel, draft.title, draft.summary, draft.body, model, topic.key]
      );
      created += 1;
    } catch (error) {
      failures.push(`${topic.key}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  await pool.query(
    `UPDATE structured.wedding_feed_runs
     SET finished_at = now(), created_count = $2, input_tokens = $3, output_tokens = $4, error = $5
     WHERE id = $1`,
    [runId, created, inputTokens, outputTokens, failures.length > 0 ? failures.join(' · ') : null]
  );

  return { created, skipped: created === 0 ? (failures[0] ?? '글이 나오지 않았어요') : null };
}
