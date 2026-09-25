import { create, update } from '../wedding-feed';
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
});
