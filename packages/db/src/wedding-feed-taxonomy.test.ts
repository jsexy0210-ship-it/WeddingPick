import { Client } from 'pg';

import { migrate } from './migrate';
import { resetSchema } from './reset';

/**
 * 웨딩피드의 탭과 카테고리 표(0421 → 0442).
 *
 * **2026-09-26부터 목록은 domain 상수 하나다**(`WEDDING_FEED_CHIPS` · `WEDDING_FEED_CATEGORIES`
 * — 정본 my.js `cats`). 대표 지적 「관리자 웨딩피드 카테고리와 앱웹 카테고리와 정보가 전혀
 * 다르다」에서 나왔다 — 관리자가 표에서 고친 탭을 그리는 앱 화면이 없었다. 표는 글이
 * `category_id`로 가리키는 자리라 남기고, 0442가 상수와 같은 모양으로 맞춘다.
 *
 * 이 패키지는 domain을 읽지 않아서 값을 여기 적는다. 상수와 표가 같은지는 api 쪽 실제 DB
 * 시험(`apps/api/src/test/wedding-feed-db.test.ts`)이 domain을 읽어 한 번 더 센다.
 */

const connectionString = process.env.DATABASE_URL;
const describeWithDb = connectionString ? describe : describe.skip;

if (!connectionString) {
  console.warn('DATABASE_URL이 없어 웨딩피드 분류 시험을 건너뛴다.');
}

let client: Client;

const CHIPS = ['웨딩홀', '스드메', '본식', '예물 · 신혼', '예산'];

/** 카테고리 → 칩(없으면 null). domain `WEDDING_FEED_CATEGORIES`와 같은 줄이다. */
const CATEGORY_CHIP: Record<string, string | null> = {
  웨딩홀: '웨딩홀',
  스튜디오: '스드메',
  드레스: '스드메',
  메이크업: '스드메',
  헤어변형: '스드메',
  본식스냅: '본식',
  허니문: '예물 · 신혼',
  예산: '예산',
  체크리스트: null,
  일정: null,
  하객: null,
  계약: null,
};

async function categories(): Promise<{ name: string; chip: string | null; active: boolean }[]> {
  const { rows } = await client.query<{ name: string; chip: string | null; active: boolean }>(
    `SELECT c.name, g.name AS chip, c.active
     FROM structured.wedding_feed_categories c
     LEFT JOIN structured.wedding_feed_groups g ON g.id = c.group_id
     ORDER BY c.sort_order, c.name`
  );

  return rows;
}

async function categoryId(name: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    'SELECT id FROM structured.wedding_feed_categories WHERE name = $1',
    [name]
  );

  return rows[0]!.id;
}

describeWithDb('웨딩피드 — 탭과 카테고리 표', () => {
  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  beforeEach(() => resetSchema(client));

  describe('0442 뒤 — 표가 정본 칩과 같다', () => {
    it('탭은 정본 칩 다섯이다(«전체»는 표에 없다)', async () => {
      const { rows } = await client.query<{ name: string }>(
        'SELECT name FROM structured.wedding_feed_groups ORDER BY sort_order'
      );

      expect(rows.map((r) => r.name)).toEqual(CHIPS);
    });

    it('카테고리 열둘이 켜져 있고 칩 배정이 목록과 같다', async () => {
      const rows = await categories();

      expect(rows.every((r) => r.active)).toBe(true);
      expect(Object.fromEntries(rows.map((r) => [r.name, r.chip]))).toEqual(CATEGORY_CHIP);
    });

    it('옛 이름 · 은퇴한 이름은 없다', async () => {
      // «준비 순서»는 정본 이름 «일정»으로 옮겼다. 결정사는 2026-09-24에 걷었다(0433).
      const names = (await categories()).map((r) => r.name);

      for (const gone of ['준비 순서', '결정사', '스냅', '헤메', '플래너']) {
        expect(names).not.toContain(gone);
      }
    });
  });

  describe('0442가 이미 쌓인 값을 옮긴다', () => {
    /**
     * 0442 전 운영 상태를 흉내 낸다 — 0421의 옛 탭 셋, «준비 순서» 카테고리와 그 글,
     * 관리자가 따로 만든 탭 · 카테고리. 그다음 0442만 다시 돌린다.
     */
    async function rerun0442() {
      await client.query(`DELETE FROM public.schema_migrations WHERE version LIKE '0442%'`);
      await migrate(client);
    }

    beforeEach(async () => {
      await client.query(`DELETE FROM structured.wedding_feed_groups`);
      await client.query(
        `INSERT INTO structured.wedding_feed_groups (name, sort_order)
         VALUES ('준비·예산', 1), ('업체·서비스', 2), ('계약·여행', 3), ('운영자가 만든 탭', 4)`
      );
      await client.query(
        `UPDATE structured.wedding_feed_categories SET name = '준비 순서' WHERE name = '일정'`
      );
      await client.query(
        `UPDATE structured.wedding_feed_categories
         SET group_id = (SELECT id FROM structured.wedding_feed_groups WHERE name = '준비·예산')`
      );
      await client.query(
        `INSERT INTO structured.wedding_feed_categories (name, group_id)
         SELECT '웨딩 소식', id FROM structured.wedding_feed_groups WHERE name = '운영자가 만든 탭'`
      );
      await client.query(
        `INSERT INTO structured.wedding_feed_posts (category_label, category_id, title, status, published_at)
         VALUES
           ('준비 순서', (SELECT id FROM structured.wedding_feed_categories WHERE name = '준비 순서'),
            '무엇부터 정하나', 'published', now()),
           ('웨딩 소식', (SELECT id FROM structured.wedding_feed_categories WHERE name = '웨딩 소식'),
            '운영 소식', 'published', now()),
           ('웨딩홀 ', NULL, '뒤에 공백이 붙은 글', 'draft', NULL)`
      );
    });

    it('«준비 순서» 글과 카테고리는 «일정»으로 옮겨 가고 연결이 유지된다', async () => {
      await rerun0442();

      const { rows } = await client.query<{ category_label: string; name: string | null }>(
        `SELECT p.category_label, c.name
         FROM structured.wedding_feed_posts p
         LEFT JOIN structured.wedding_feed_categories c ON c.id = p.category_id
         WHERE p.title = '무엇부터 정하나'`
      );

      expect(rows[0]).toEqual({ category_label: '일정', name: '일정' });
    });

    it('옛 탭은 지우고 칩 다섯만 남긴다 · 칩 배정을 목록대로 다시 건다', async () => {
      await rerun0442();

      const groups = await client.query<{ name: string }>(
        'SELECT name FROM structured.wedding_feed_groups ORDER BY sort_order'
      );
      const rows = (await categories()).filter((r) => r.name in CATEGORY_CHIP);

      expect(groups.rows.map((r) => r.name)).toEqual(CHIPS);
      expect(Object.fromEntries(rows.map((r) => [r.name, r.chip]))).toEqual(CATEGORY_CHIP);
    });

    it('목록 밖 카테고리는 지우지 않고 끈다 — 그 글도 그대로 남는다', async () => {
      await rerun0442();

      const extra = (await categories()).find((r) => r.name === '웨딩 소식');
      const { rows } = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM structured.wedding_feed_posts WHERE category_label = '웨딩 소식'`
      );

      expect(extra).toEqual({ name: '웨딩 소식', chip: null, active: false });
      expect(Number(rows[0]!.n)).toBe(1);
    });

    it('이름이 어긋난 글은 추측해서 붙이지 않는다', async () => {
      await rerun0442();

      const { rows } = await client.query<{ category_id: string | null }>(
        `SELECT category_id FROM structured.wedding_feed_posts WHERE title = '뒤에 공백이 붙은 글'`
      );

      expect(rows[0]!.category_id).toBeNull();
    });

    it('«일정»이 이미 따로 있었으면 이름은 두고 글만 옮겨 «일정»에 잇는다', async () => {
      await client.query(`INSERT INTO structured.wedding_feed_categories (name) VALUES ('일정')`);

      await rerun0442();

      const { rows } = await client.query<{ name: string | null }>(
        `SELECT c.name
         FROM structured.wedding_feed_posts p
         LEFT JOIN structured.wedding_feed_categories c ON c.id = p.category_id
         WHERE p.title = '무엇부터 정하나'`
      );
      const old = (await categories()).find((r) => r.name === '준비 순서');

      expect(rows[0]!.name).toBe('일정');
      expect(old).toEqual({ name: '준비 순서', chip: null, active: false });
    });
  });

  describe('글과 카테고리의 연결', () => {
    it('쓰는 카테고리는 지워지지 않는다', async () => {
      // 글이 `category_id`로 가리키는 동안은 `ON DELETE RESTRICT`가 막는다.
      const id = await categoryId('웨딩홀');

      await client.query(
        `INSERT INTO structured.wedding_feed_posts (category_label, category_id, title)
         VALUES ('웨딩홀', $1, '딸린 글')`,
        [id]
      );

      await expect(
        client.query('DELETE FROM structured.wedding_feed_categories WHERE id = $1', [id])
      ).rejects.toThrow();
    });

    it('카테고리 이름은 겹치지 않는다', async () => {
      await expect(
        client.query(`INSERT INTO structured.wedding_feed_categories (name) VALUES ('예산')`)
      ).rejects.toThrow();
    });
  });
});
