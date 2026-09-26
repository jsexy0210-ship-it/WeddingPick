import { WEDDING_FEED_CATEGORIES, WEDDING_FEED_CHIPS, weddingFeedChipLabel } from '@weddingpick/domain';

import { create, listPublished, update } from '../wedding-feed';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

/**
 * 웨딩피드 저장을 **실제 DB**에 맞대어 본다(2026-09-25 운영 사고).
 *
 * 관리자 라우트 시험(admin-wedding-feed.test.ts)은 pool을 흉내 내서, SQL이 Postgres에서
 * 실제로 통과하는지는 보지 않았다. 그 사이 직접 쓴 새 글(모델 없음)의 INSERT가
 * 「could not determine data type of parameter $9」로 매번 실패했고, 관리자 화면에는
 * 「잠시 후 다시 시도해주세요」만 떴다.
 */
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

let test: TestApp;

const INPUT = {
  categoryLabel: '예산',
  title: '예산을 나누는 순서',
  summary: '어디부터 정할지',
  body: '웨딩홀부터 정하고 나머지를 나눈다.',
  imageKey: 'wedding-feed/thumbnail/a.png',
  bodyImageKey: null,
  status: 'published' as const,
  sortOrder: 3,
  generated: false,
};

describeWithDb('웨딩피드 저장(실제 DB)', () => {
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

  it('직접 쓴 새 글(모델 없음)이 저장된다', async () => {
    const saved = await create(test.pool, INPUT as never, null, null);

    const { rows } = await test.pool.query<{ source: string; model: string | null; published: boolean }>(
      `SELECT source, model, published_at IS NOT NULL AS published FROM structured.wedding_feed_posts WHERE id = $1`,
      [saved.id]
    );
    expect(rows[0]).toEqual({ source: 'manual', model: null, published: true });
  });

  it('자동으로 쓴 새 글은 모델 이름과 함께 저장된다', async () => {
    const saved = await create(test.pool, { ...INPUT, status: 'draft' } as never, null, 'gemini-test');

    const { rows } = await test.pool.query<{ source: string; model: string | null }>(
      'SELECT source, model FROM structured.wedding_feed_posts WHERE id = $1',
      [saved.id]
    );
    expect(rows[0]).toEqual({ source: 'generated', model: 'gemini-test' });
  });

  it('저장한 글을 고칠 수 있다', async () => {
    const saved = await create(test.pool, { ...INPUT, status: 'draft' } as never, null, null);

    await update(test.pool, saved.id, { ...INPUT, title: '고친 제목' } as never);

    const { rows } = await test.pool.query<{ title: string; published: boolean }>(
      'SELECT title, published_at IS NOT NULL AS published FROM structured.wedding_feed_posts WHERE id = $1',
      [saved.id]
    );
    expect(rows[0]).toEqual({ title: '고친 제목', published: true });
  });

  /**
   * 표(0421 · 0442)가 domain 목록과 같은가(2026-09-26 대표 지적 — 「관리자 웨딩피드
   * 카테고리와 앱웹 카테고리와 정보가 전혀 다르다」). 표는 글의 `category_id`를 잇는
   * 자리로만 남았지만, 열어 본 사람이 옛 탭을 현행으로 읽지 않게 같은 모양이어야 한다.
   */
  it('표의 탭 · 카테고리가 domain 칩 · 카테고리와 같다', async () => {
    const groups = await test.pool.query<{ name: string }>(
      'SELECT name FROM structured.wedding_feed_groups WHERE active ORDER BY sort_order'
    );
    const categories = await test.pool.query<{ name: string; chip: string | null }>(
      `SELECT c.name, g.name AS chip
       FROM structured.wedding_feed_categories c
       LEFT JOIN structured.wedding_feed_groups g ON g.id = c.group_id
       WHERE c.active
       ORDER BY c.sort_order`
    );

    expect(groups.rows.map((r) => r.name)).toEqual(
      WEDDING_FEED_CHIPS.filter((chip) => chip.key !== 'all').map((chip) => chip.label)
    );
    expect(categories.rows).toEqual(
      WEDDING_FEED_CATEGORIES.map((category) => ({
        name: category.label,
        chip: category.chip === null ? null : weddingFeedChipLabel(category.chip),
      }))
    );
  });

  it('관리자가 공개한 글은 앱 목록에 같은 카테고리 · 제목으로 나가고 표의 카테고리에 이어진다', async () => {
    const saved = await create(
      test.pool,
      { ...INPUT, categoryLabel: '일정', title: '본식 4개월 전, 무엇부터 할까' } as never,
      null,
      null
    );

    const linked = await test.pool.query<{ name: string }>(
      `SELECT c.name FROM structured.wedding_feed_posts p
       JOIN structured.wedding_feed_categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [saved.id]
    );
    const listed = await listPublished(test.pool, null, 100);

    expect(linked.rows[0]!.name).toBe('일정');
    expect(listed.items).toEqual([
      expect.objectContaining({ id: saved.id, categoryLabel: '일정', title: '본식 4개월 전, 무엇부터 할까' }),
    ]);
  });
});

