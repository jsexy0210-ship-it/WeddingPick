import Fastify from 'fastify';
import type { Pool } from 'pg';

import type { AppContext } from '../context';
import { registerAppRoutes } from '../routes/app';

/**
 * 홈이 부르는 공개 웨딩피드 라우트.
 *
 * MASTER 지시(2026-09-15) — 홈은 있는데 `listPublished`를 부르는 라우트가
 * 어디에도 없었다. 여기서 실제로 표를 읽는지, 공개된 것만 나가는지, 로그인
 * 없이도 되는지를 본다. 권한·부팅 통합은 `app-bootstrap.test.ts`가 DB로 본다.
 *
 * **2026-09-16부터 탭도 같은 응답으로 나간다**(대표 지시 — 「탭별 카테고리별로 다
 * 설정 가능해야한다」). 따로 부르면 목록이 먼저 그려지고 탭 줄이 나중에 끼어들어
 * 본문이 손가락 아래에서 밀린다. 그래서 질의가 셋이다 — 글 · 탭 · 카테고리.
 */
const pool = { query: jest.fn(), connect: jest.fn() };

function app() {
  const instance = Fastify();

  registerAppRoutes(instance, { pool, storage: null } as unknown as AppContext);

  return instance;
}

beforeEach(() => {
  pool.query.mockReset();
  // 글 질의 뒤에 분류표 질의 둘이 더 간다. 따로 세우지 않은 시험은 빈 분류표를 본다.
  pool.query.mockResolvedValue({ rows: [] });
});

/** 탭 질의 둘(그룹 · 카테고리)을 차례로 세운다. */
function mockTaxonomy(
  groups: { id: string; name: string; sort_order: number; active: boolean }[],
  categories: {
    id: string;
    name: string;
    group_id: string | null;
    sort_order: number;
    active: boolean;
  }[]
) {
  pool.query.mockResolvedValueOnce({ rows: groups }).mockResolvedValueOnce({ rows: categories });
}

describe('공개 웨딩피드', () => {
  it('로그인 없이 공개된 글만 받는다', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: '00000000-0000-4000-8000-0000000000f1',
          category_label: '예산',
          title: '스드메 예산 짜는 법',
          summary: '요약',
          body: '본문',
          image_key: null,
          status: 'published',
          source: 'manual',
          model: null,
          topic: null,
          sort_order: 0,
          published_at: new Date('2026-09-14T00:00:00Z'),
          created_at: new Date('2026-09-14T00:00:00Z'),
          updated_at: new Date('2026-09-14T00:00:00Z'),
        },
      ],
    });

    const response = await app().inject({ method: 'GET', url: '/v1/wedding-feed' });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ items: { id: string; title: string }[] }>();

    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ title: '스드메 예산 짜는 법' });
    expect(pool.query.mock.calls[0]?.[0]).toContain("status = 'published'");
  });

  it('탭을 같은 응답으로 준다 — 「전체」가 맨 앞이다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    mockTaxonomy(
      [{ id: 'g1', name: '준비·예산', sort_order: 1, active: true }],
      [{ id: 'c1', name: '예산', group_id: 'g1', sort_order: 1, active: true }]
    );

    const response = await app().inject({ method: 'GET', url: '/v1/wedding-feed' });
    const body = response.json<{ tabs: { key: string; label: string; categories: string[] }[] }>();

    expect(body.tabs).toEqual([
      { key: 'all', label: '전체', categories: [] },
      { key: 'g1', label: '준비·예산', categories: ['예산'] },
    ]);
  });

  it('카테고리가 하나도 없는 탭은 빠진다', async () => {
    // 눌렀는데 늘 비어 있는 탭은 있는 것이 없는 것보다 나쁘다.
    pool.query.mockResolvedValueOnce({ rows: [] });
    mockTaxonomy([{ id: 'g1', name: '계약·여행', sort_order: 1, active: true }], []);

    const response = await app().inject({ method: 'GET', url: '/v1/wedding-feed' });
    const body = response.json<{ tabs: { key: string }[] }>();

    expect(body.tabs.map((t) => t.key)).toEqual(['all']);
  });

  it('limit을 물으면 표에 그대로 넘긴다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await app().inject({ method: 'GET', url: '/v1/wedding-feed?limit=2' });

    expect(response.statusCode).toBe(200);
    expect(pool.query.mock.calls[0]?.[1]).toEqual([2]);
  });

  it('이상한 limit은 기본값(8)으로 대신한다', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await app().inject({ method: 'GET', url: '/v1/wedding-feed?limit=abc' });

    expect(response.statusCode).toBe(200);
    expect(pool.query.mock.calls[0]?.[1]).toEqual([8]);
  });
});
