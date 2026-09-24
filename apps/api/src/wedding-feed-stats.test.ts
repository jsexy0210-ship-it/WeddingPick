import { WEDDING_FEED_TOPICS } from '@weddingpick/domain';
import type { Pool } from 'pg';

import type { FeedWriter } from './analysis/wedding-feed-writer';
import { runGeneration } from './wedding-feed';

/**
 * 웨딩피드 자동 작성 — 공공 통계 주제(2026-09-24 대표 지시 「피드에는 써도 된다」).
 *
 * DB는 가짜다. 무엇을 넘기고, 무엇을 버리고, 무엇을 붙여 저장하는지만 본다.
 */
const STAT_ROW = {
  key: 'seoul.marriage.count',
  label: '서울 혼인 건수',
  value: '36324',
  unit: '건',
  period: '2025년',
  source_name: '서울특별시',
  source_url: 'https://www.data.go.kr/data/15000000/fileData.do',
};

const NON_STAT_KEYS = WEDDING_FEED_TOPICS.filter((topic) => !topic.statKeys).map((t) => t.key);

function fakePool(statKeys: string[]) {
  const inserts: unknown[][] = [];
  const updates: unknown[][] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('GROUP BY status')) return { rows: [] };
    if (sql.includes('SELECT DISTINCT topic')) return { rows: NON_STAT_KEYS.map((topic) => ({ topic })) };
    if (sql.includes('SELECT key FROM structured.public_stats')) {
      return { rows: statKeys.map((key) => ({ key })) };
    }
    if (sql.includes('FROM structured.public_stats WHERE key')) {
      return { rows: (params[0] as string[]).includes(STAT_ROW.key) ? [STAT_ROW] : [] };
    }
    if (sql.includes('INSERT INTO structured.wedding_feed_runs')) return { rows: [{ id: 'run-1' }] };
    if (sql.includes('INSERT INTO structured.wedding_feed_posts')) inserts.push(params);
    if (sql.includes('UPDATE structured.wedding_feed_runs')) updates.push(params);
    return { rows: [], rowCount: 1 };
  });

  return { pool: { query } as unknown as Pool, inserts, updates };
}

function writerReturning(body: string): FeedWriter & { write: jest.Mock } {
  return {
    write: jest.fn(async () => ({
      draft: { title: '서울 혼인 흐름', summary: '혼인 건수로 봐요.', body },
      usage: { inputTokens: 1, outputTokens: 1 },
    })),
  };
}

describe('웨딩피드 통계 주제', () => {
  it('통계가 표에 없으면 통계 주제를 고르지 않는다', async () => {
    const { pool } = fakePool([]);
    const writer = writerReturning('본문');

    const result = await runGeneration({ pool, writer, model: 'm', trigger: 'manual' });

    expect(writer.write).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, skipped: '쓸 주제가 남아 있지 않아요' });
  });

  it('넘긴 숫자만 쓴 글은 서버가 출처 줄을 붙여 저장한다', async () => {
    const { pool, inserts } = fakePool(['seoul.marriage.count']);
    const writer = writerReturning('2025년 서울 혼인은 36,324건이에요.');

    await runGeneration({ pool, writer, model: 'm', trigger: 'manual' });

    expect(writer.write).toHaveBeenCalledTimes(1);
    expect(writer.write.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({ key: 'seoul.marriage.count', value: 36324 }),
    ]);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.[3]).toBe(
      '2025년 서울 혼인은 36,324건이에요.\n\n출처: 서울특별시 2025년 (공공데이터포털)'
    );
  });

  it('넘기지 않은 숫자가 있으면 저장하지 않고 이유를 남긴다', async () => {
    const { pool, inserts, updates } = fakePool(['seoul.marriage.count']);
    const writer = writerReturning('36,324건 중 40%가 봄에 올려요.');

    await runGeneration({ pool, writer, model: 'm', trigger: 'manual' });

    expect(inserts).toHaveLength(0);
    expect(updates[0]?.[4]).toBe('stats-marriage-seoul: 넘기지 않은 숫자 40');
  });
});
