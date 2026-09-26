import type { Pool } from 'pg';
import type { WeddingFeedTopic } from '@weddingpick/domain';

import { imageDHash } from '../analysis/image-dhash';
import * as feedWriter from '../analysis/wedding-feed-writer';
import type { FeedWriter } from '../analysis/wedding-feed-writer';
import { feedImagePlanDistance, feedImagePlanSignature, type FeedImagePlan } from '../analysis/wedding-feed-diversity';
import {
  FeedDuplicateError,
  FeedImageDuplicateError,
  generateDistinctFeedImage,
  loadFeedImageHistory,
  loadRecentFeedPosts,
  writeDistinctDraft,
} from '../wedding-feed-generation';
import { create, runGeneration } from '../wedding-feed';
import { encodeRgbPng } from './png-fixture';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

/**
 * 웨딩피드 겹침 방지 파이프라인 — 2026-09-26 대표 지시 「같은 카테고리 이전 내용을 분석해서
 * 중첩되지 않는 내용으로 생성한다」 · 「이미지도 … 다르게 생성되어야한다」.
 *
 * Gemini는 부르지 않는다 — 작성기와 그림 생성을 가짜로 바꿔 «무엇을 넘기고 무엇을 버리는지»만 본다.
 */

const TOPIC: WeddingFeedTopic = { key: 'admin-웨딩홀', categoryLabel: '웨딩홀', brief: '웨딩홀 카테고리에서 확인할 것' };
const RECENT = [
  { title: '웨딩홀 투어에서 꼭 물어볼 것', summary: '보증인원과 식대 인상 조건을 먼저 확인하세요.', body: '' },
];
const DUPLICATE = { title: '웨딩홀 투어 때 꼭 물어봐야 할 질문', summary: '식대 인상 조건과 보증인원부터 확인하세요.', body: '겹친 글' };
const FRESH = { title: '웨딩홀 대관료 말고 따로 드는 비용', summary: '꽃장식과 음향, 주차 비용을 따로 확인하세요.', body: '새 글' };

function writerReturning(...drafts: { title: string; summary: string; body: string }[]): FeedWriter & { write: jest.Mock } {
  const write = jest.fn();
  for (const draft of drafts) write.mockResolvedValueOnce({ draft, usage: { inputTokens: 5, outputTokens: 7 } });
  return { write };
}

describe('겹치지 않는 초안', () => {
  it('처음 초안이 겹치지 않으면 한 번만 쓴다', async () => {
    const writer = writerReturning(FRESH);
    const outcome = await writeDistinctDraft({ writer, topic: TOPIC, recent: RECENT });

    expect(outcome).toMatchObject({ draft: FRESH, attempts: 1, rejected: [] });
    expect(writer.write).toHaveBeenCalledWith(TOPIC, [], { covered: RECENT, avoidTitles: [] });
  });

  it('겹친 초안은 버리고 그 제목을 피할 목록에 더해 다시 쓴다', async () => {
    const writer = writerReturning(DUPLICATE, FRESH);
    const outcome = await writeDistinctDraft({ writer, topic: TOPIC, recent: RECENT });

    expect(outcome.draft).toEqual(FRESH);
    expect(outcome.attempts).toBe(2);
    expect(outcome.usage).toEqual({ inputTokens: 10, outputTokens: 14 });
    expect(outcome.rejected[0]).toMatchObject({ title: DUPLICATE.title, against: RECENT[0]!.title });
    expect(writer.write.mock.calls[1]?.[2]).toEqual({ covered: RECENT, avoidTitles: [DUPLICATE.title] });
  });

  it('화면이 넘긴 방금 초안 제목과 겹쳐도 버린다', async () => {
    const writer = writerReturning(
      { title: '웨딩홀 대관료 말고 따로 드는 비용 정리', summary: '', body: '' },
      FRESH
    );
    const outcome = await writeDistinctDraft({
      writer,
      topic: TOPIC,
      recent: [],
      avoidTitles: ['웨딩홀 대관료 말고 따로 드는 비용'],
      maxAttempts: 2,
    }).catch((error: unknown) => error);

    /* 둘째도 같은 제목 계열이라 둘 다 버려진다 — 겹친 글은 내보내지 않는다. */
    expect(outcome).toBeInstanceOf(FeedDuplicateError);
  });

  it('끝까지 겹치면 글을 내주지 않고 이유와 쓴 토큰을 남긴다', async () => {
    const writer = writerReturning(DUPLICATE, DUPLICATE, DUPLICATE);
    const error = (await writeDistinctDraft({ writer, topic: TOPIC, recent: RECENT }).catch((e: unknown) => e)) as FeedDuplicateError;

    expect(error).toBeInstanceOf(FeedDuplicateError);
    expect(error.rejected).toHaveLength(3);
    expect(error.usage).toEqual({ inputTokens: 15, outputTokens: 21 });
    expect(error.message).toContain('이미 쓴 글과 겹쳐 3번 버렸어요');
  });

  it('시간이 다 되면 다시 쓰지 않는다 — nginx 60초 뒤의 글은 아무도 못 받는다', async () => {
    const writer = writerReturning(DUPLICATE, FRESH);
    let clock = 0;
    const error = await writeDistinctDraft({
      writer,
      topic: TOPIC,
      recent: RECENT,
      deadline: 10,
      now: () => (clock += 20),
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FeedDuplicateError);
    expect(writer.write).toHaveBeenCalledTimes(1);
  });
});

/** 한 장면과 그 장면을 살짝 밝게 한 것(닮음), 좌우를 뒤집은 것(다름). */
const scene = (x: number, y: number): [number, number, number] => {
  const v = Math.round(128 + 100 * Math.sin(x / 9) * Math.cos(y / 7));
  return [v, v, v];
};
const SCENE = encodeRgbPng(96, 54, scene);
const SCENE_BRIGHTER = encodeRgbPng(96, 54, (x, y) => scene(x, y).map((v) => Math.min(255, v + 12)) as [number, number, number]);
const MIRRORED = encodeRgbPng(96, 54, (x, y) => scene(95 - x, y));
const SCENE_HASH_PLAN: FeedImagePlan = {
  scene: 'chapel', shot: 'wide', timeOfDay: 'golden', season: 'spring',
  palette: 'ivory-gold', props: 'bouquet', people: 'couple',
};

function fakeImagePool(rows: { plan: unknown; dhash: string | null }[]) {
  const inserts: unknown[][] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('INSERT INTO structured.wedding_feed_generated_images')) {
      inserts.push(params);
      return { rows: [], rowCount: 1 };
    }
    return { rows };
  });

  return { pool: { query } as unknown as Pool, inserts, query };
}

const storage = () => ({
  upload: jest.fn().mockResolvedValue(undefined),
  getPublicUrl: jest.fn().mockResolvedValue('https://image.example/a.png'),
});

describe('최근 그림과 다른 그림', () => {
  it('최근 그림의 계획을 피하고, 계획과 지문을 기록에 남긴다', async () => {
    const { pool, inserts } = fakeImagePool([{ plan: SCENE_HASH_PLAN, dhash: imageDHash(MIRRORED, 'image/png') }]);
    const generate = jest.spyOn(feedWriter, 'generateWeddingFeedImage').mockResolvedValue({
      bytes: SCENE, mimeType: 'image/png', extension: 'png',
    });
    const store = storage();

    const result = await generateDistinctFeedImage({
      pool, storage: store, apiKey: 'k',
      request: { kind: 'thumbnail', title: '웨딩홀 투어', summary: '', body: '', categoryLabel: '웨딩홀' },
    });

    const plan = generate.mock.calls[0]![2];
    expect(feedImagePlanDistance(plan, SCENE_HASH_PLAN)).toBeGreaterThanOrEqual(4);
    expect(plan.scene).not.toBe('chapel');
    expect(result.attempts).toBe(1);
    expect(result.dhash).toMatch(/^[0-9a-f]{16}$/);
    expect(store.upload).toHaveBeenCalledWith(expect.stringMatching(/^wedding-feed\/thumbnail\/.+\.png$/), SCENE, 'image/png');
    expect(inserts[0]).toEqual([
      result.storageKey, '웨딩홀', 'thumbnail', JSON.stringify(plan), feedImagePlanSignature(plan),
      result.dhash, 'gemini-2.5-flash-image', 1,
    ]);
  });

  it('지문이 최근 그림과 닮으면 계획을 바꿔 다시 그린다', async () => {
    const { pool, inserts } = fakeImagePool([{ plan: SCENE_HASH_PLAN, dhash: imageDHash(SCENE, 'image/png') }]);
    const generate = jest
      .spyOn(feedWriter, 'generateWeddingFeedImage')
      .mockResolvedValueOnce({ bytes: SCENE_BRIGHTER, mimeType: 'image/png', extension: 'png' })
      .mockResolvedValueOnce({ bytes: MIRRORED, mimeType: 'image/png', extension: 'png' });
    const store = storage();
    const log = jest.fn();

    const result = await generateDistinctFeedImage({
      pool, storage: store, apiKey: 'k', log,
      request: { kind: 'body', title: '본문', summary: '', body: '', categoryLabel: '웨딩홀' },
    });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(feedImagePlanSignature(generate.mock.calls[1]![2])).not.toBe(feedImagePlanSignature(generate.mock.calls[0]![2]));
    expect(result.attempts).toBe(2);
    expect(store.upload).toHaveBeenCalledTimes(1);
    expect(store.upload.mock.calls[0]![1]).toBe(MIRRORED);
    expect(inserts[0]?.[7]).toBe(2);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('계획을 바꿔 다시 만든다'));
  });

  it('다시 그려도 닮으면 저장하지 않는다', async () => {
    const { pool, inserts } = fakeImagePool([{ plan: SCENE_HASH_PLAN, dhash: imageDHash(SCENE, 'image/png') }]);
    jest.spyOn(feedWriter, 'generateWeddingFeedImage').mockResolvedValue({
      bytes: SCENE_BRIGHTER, mimeType: 'image/png', extension: 'png',
    });
    const store = storage();

    await expect(
      generateDistinctFeedImage({
        pool, storage: store, apiKey: 'k',
        request: { kind: 'body', title: '본문', summary: '', body: '' },
      })
    ).rejects.toBeInstanceOf(FeedImageDuplicateError);
    expect(store.upload).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it('첫 그림이 오래 걸렸으면 다시 그리지 않는다 — 두 번째가 60초 안에 못 끝난다', async () => {
    const { pool } = fakeImagePool([{ plan: SCENE_HASH_PLAN, dhash: imageDHash(SCENE, 'image/png') }]);
    const generate = jest.spyOn(feedWriter, 'generateWeddingFeedImage').mockResolvedValue({
      bytes: SCENE_BRIGHTER, mimeType: 'image/png', extension: 'png',
    });
    let clock = 0;

    await expect(
      generateDistinctFeedImage({
        pool, storage: storage(), apiKey: 'k', now: () => (clock += 20_000),
        request: { kind: 'body', title: '본문', summary: '', body: '' },
      })
    ).rejects.toBeInstanceOf(FeedImageDuplicateError);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDb('겹침 방지 — 실제 DB', () => {
  let test: TestApp;

  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  const input = (title: string, categoryLabel = '웨딩홀') => ({
    categoryLabel, title, summary: `${title} 요약`, body: `${title} 본문`,
    imageKey: null, bodyImageKey: null, status: 'draft' as const, sortOrder: 0, generated: false,
  });

  it('같은 카테고리의 글만, 최근 것부터, 초안까지 읽는다', async () => {
    await create(test.pool, input('첫 글') as never, null, null);
    await create(test.pool, input('다른 카테고리', '예산') as never, null, null);
    await create(test.pool, input('둘째 글') as never, null, null);

    const recent = await loadRecentFeedPosts(test.pool, '웨딩홀');

    expect(recent.map((post) => post.title)).toEqual(['둘째 글', '첫 글']);
    expect(recent[0]).toEqual({ title: '둘째 글', summary: '둘째 글 요약', body: '둘째 글 본문' });
  });

  it('그림 기록(0443) — 남긴 계획과 지문을 다음 그림이 읽는다', async () => {
    jest.spyOn(feedWriter, 'generateWeddingFeedImage').mockResolvedValue({
      bytes: SCENE, mimeType: 'image/png', extension: 'png',
    });

    const first = await generateDistinctFeedImage({
      pool: test.pool, storage: storage(), apiKey: 'k',
      request: { kind: 'thumbnail', title: '웨딩홀', summary: '', body: '', categoryLabel: '웨딩홀' },
    });
    const history = await loadFeedImageHistory(test.pool, '웨딩홀');

    expect(history.ready).toBe(true);
    expect(history.plans).toEqual([first.plan]);
    expect(history.hashes).toEqual([first.dhash]);

    /* 다른 카테고리도 «전체» 쪽으로 같은 그림을 본다. */
    const other = await loadFeedImageHistory(test.pool, '예산');
    expect(other.hashes).toEqual([first.dhash]);

    /* 같은 그림이 또 나오면 다시 그려도 닮아서 저장하지 않는다. */
    await expect(
      generateDistinctFeedImage({
        pool: test.pool, storage: storage(), apiKey: 'k',
        request: { kind: 'body', title: '웨딩홀', summary: '', body: '', categoryLabel: '예산' },
      })
    ).rejects.toBeInstanceOf(FeedImageDuplicateError);

    const { rows } = await test.pool.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM structured.wedding_feed_generated_images'
    );
    expect(rows[0]?.n).toBe('1');
  });

  it('자동 작성 한 바퀴 — 겹친 초안은 저장하지 않고 기록에 이유를 남긴다', async () => {
    /* 주제 목록의 첫 주제(예산 · budget-sdm)와 겹치는 글이 이미 있다. */
    await create(test.pool, {
      ...input('스드메 예산을 넘기지 않게 짜는 방법', '예산'),
      summary: '항목별로 먼저 상한을 정해두면 흔들리지 않아요.',
    } as never, null, null);

    const write = jest.fn(async () => ({
      draft: {
        title: '스드메 예산 넘기지 않고 짜는 법',
        summary: '항목별 상한을 먼저 정해두면 예산이 흔들리지 않아요.',
        body: '본문',
      },
      usage: { inputTokens: 1, outputTokens: 1 },
    }));

    const result = await runGeneration({ pool: test.pool, writer: { write }, model: 'm', trigger: 'manual' });

    expect(result.created).toBe(0);
    const { rows } = await test.pool.query<{ error: string | null; input_tokens: number }>(
      'SELECT error, input_tokens FROM structured.wedding_feed_runs ORDER BY started_at DESC LIMIT 1'
    );
    expect(rows[0]?.error).toContain('budget-sdm: 이미 쓴 글과 겹쳐 3번 버렸어요');
    const posts = await test.pool.query('SELECT 1 FROM structured.wedding_feed_posts');
    expect(posts.rowCount).toBe(1);
  });
});
