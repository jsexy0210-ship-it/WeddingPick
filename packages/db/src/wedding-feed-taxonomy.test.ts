import { Client } from 'pg';

import { resetSchema } from './reset';

/**
 * 웨딩피드의 탭과 카테고리(0421).
 *
 * **이 시험이 여기 있는 이유.** 탭과 카테고리가 코드 상수였을 때는 「모든 카테고리가
 * 어느 그룹에 드는가」를 상수 배열을 세어 확인할 수 있었다. 값이 표로 옮겨 가면
 * 그 세기는 의미가 없어진다 — 상수는 늘 맞고, 틀릴 수 있는 것은 **운영자가 고친 뒤의
 * 표**다. 그래서 같은 성질을 DB에서 센다.
 *
 * 지켜야 할 성질은 하나다 — **어느 탭에도 안 든 카테고리가 있으면 관리자가 알 수
 * 있어야 한다.** 그 카테고리로 쓴 글은 「전체」에서만 보이는데 오류도 안 나고
 * 목록에서는 멀쩡해 보인다. 알아챌 방법이 없는 것이 이 표를 만든 이유다.
 */

const connectionString = process.env.DATABASE_URL;
const describeWithDb = connectionString ? describe : describe.skip;

if (!connectionString) {
  console.warn('DATABASE_URL이 없어 웨딩피드 분류 시험을 건너뛴다.');
}

let client: Client;

/** 관리자 화면 맨 위 경고줄이 세는 것과 같은 질의다. */
async function ungroupedNames(): Promise<string[]> {
  const { rows } = await client.query<{ name: string }>(
    `SELECT name FROM structured.wedding_feed_categories
     WHERE active AND group_id IS NULL
     ORDER BY name`
  );

  return rows.map((row) => row.name);
}

async function categoryId(name: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    'SELECT id FROM structured.wedding_feed_categories WHERE name = $1',
    [name]
  );

  return rows[0]!.id;
}

describeWithDb('웨딩피드 — 탭과 카테고리', () => {
  beforeAll(async () => {
    client = new Client({ connectionString });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  beforeEach(() => resetSchema(client));

  describe('초기값', () => {
    it('탭 셋과 카테고리 열셋이 들어간다', async () => {
      const groups = await client.query<{ name: string }>(
        'SELECT name FROM structured.wedding_feed_groups ORDER BY sort_order'
      );
      const categories = await client.query<{ n: string }>(
        'SELECT count(*)::text AS n FROM structured.wedding_feed_categories'
      );

      expect(groups.rows.map((r) => r.name)).toEqual(['준비·예산', '업체·서비스', '계약·여행']);
      expect(Number(categories.rows[0]!.n)).toBe(13);
    });

    it('카테고리가 하나도 빠짐없이 어느 탭에 든다', async () => {
      /*
       * **이것이 핵심 시험이다.** 값이 코드에 있었을 때는 상수를 세어 확인했고, 이제는
       * 표를 센다. 씨앗을 넣은 직후에는 떨어진 것이 하나도 없어야 한다.
       */
      expect(await ungroupedNames()).toEqual([]);
    });

    it('탭 이름과 카테고리 이름은 겹치지 않는다', async () => {
      // 같은 이름이 둘이면 고르는 화면에서 어느 쪽인지 구별할 수 없다.
      await expect(
        client.query(
          `INSERT INTO structured.wedding_feed_categories (name) VALUES ('예산')`
        )
      ).rejects.toThrow();
      await expect(
        client.query(`INSERT INTO structured.wedding_feed_groups (name) VALUES ('계약·여행')`)
      ).rejects.toThrow();
    });

    it('한 카테고리는 탭 하나에만 든다', async () => {
      /*
       * 상수였을 때는 배열 셋에 같은 이름을 두 번 적을 수 있어서 **세어서** 막았다
       * (「한 카테고리가 두 그룹에 들지 않는다 — 들면 같은 글이 탭 둘에 뜬다」).
       * 표에서는 소속이 `group_id` 한 칸이라 두 번 적을 자리가 없다 — 세는 대신
       * 그 칸이 하나뿐인 것을 확인한다.
       */
      const { rows } = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n
         FROM information_schema.columns
         WHERE table_schema = 'structured'
           AND table_name = 'wedding_feed_categories'
           AND column_name = 'group_id'`
      );

      expect(Number(rows[0]!.n)).toBe(1);
    });

    it('업종 이름은 정본을 쓴다', async () => {
      // CLAUDE.md 2026-09-11 — 본식스냅 · 헤어변형 · 결정사.
      const { rows } = await client.query<{ name: string }>(
        'SELECT name FROM structured.wedding_feed_categories'
      );
      const names = rows.map((r) => r.name);

      expect(names).toContain('본식스냅');
      expect(names).toContain('헤어변형');
      expect(names).toContain('결정사');
      expect(names).not.toContain('스냅');
      expect(names).not.toContain('헤메');
      expect(names).not.toContain('플래너');
    });
  });

  describe('어느 탭에도 안 든 카테고리를 관리자가 알 수 있다', () => {
    it('탭을 지우면 딸린 카테고리가 남고 경고에 뜬다', async () => {
      /*
       * **딸린 카테고리를 함께 지우지 않는다**(`ON DELETE SET NULL`). 함께 지우면
       * 그 카테고리로 쌓인 글이 가리키던 값이 사라진다. 소속만 떼어내고 남겨서
       * 운영자가 어디로 옮길지 정할 때까지 눈에 남게 한다.
       */
      await client.query(`DELETE FROM structured.wedding_feed_groups WHERE name = '계약·여행'`);

      expect(await ungroupedNames()).toEqual(['계약', '허니문']);

      const { rows } = await client.query<{ n: string }>(
        'SELECT count(*)::text AS n FROM structured.wedding_feed_categories'
      );

      expect(Number(rows[0]!.n)).toBe(13);
    });

    it('꺼 둔 카테고리는 탭이 없어도 경고하지 않는다', async () => {
      // 꺼 둔 것은 애초에 앱에 안 나간다. 늘 켜져 있는 경고는 아무도 읽지 않는다.
      await client.query(
        `UPDATE structured.wedding_feed_categories
         SET group_id = NULL, active = false
         WHERE name = '하객'`
      );

      expect(await ungroupedNames()).toEqual([]);
    });
  });

  describe('글과 카테고리의 연결', () => {
    it('이름이 같은 기존 글은 마이그레이션이 붙여 준다', async () => {
      /*
       * 0421은 이미 쌓인 글을 이름으로 한 번 붙인다. 여기서는 그 뒤에 들어온 글이
       * 아니라 **붙이는 질의 자체**를 확인한다 — 0340 시절의 글을 흉내 내어
       * `category_id` 없이 넣고 같은 질의를 돌린다.
       */
      await client.query(
        `INSERT INTO structured.wedding_feed_posts (category_label, title)
         VALUES ('웨딩홀', '오래된 글'), ('웨딩홀 ', '뒤에 공백이 붙은 글')`
      );
      await client.query(
        `UPDATE structured.wedding_feed_posts p
         SET category_id = c.id
         FROM structured.wedding_feed_categories c
         WHERE p.category_label = c.name AND p.category_id IS NULL`
      );

      const { rows } = await client.query<{ title: string; category_id: string | null }>(
        'SELECT title, category_id FROM structured.wedding_feed_posts ORDER BY title'
      );

      // 정확히 같은 것만 붙는다. 「웨딩홀 」은 **일부러 안 붙인다** —
      // 여기서 추측해서 붙이면 무엇이 잘못 적혀 있었는지가 사라진다.
      expect(rows.find((r) => r.title === '오래된 글')!.category_id).not.toBeNull();
      expect(rows.find((r) => r.title === '뒤에 공백이 붙은 글')!.category_id).toBeNull();
    });

    it('쓰는 카테고리는 지워지지 않는다', async () => {
      /*
       * 지우면 그 글들이 어느 탭에도 안 뜨는데 화면은 멀쩡해 보인다 — 이 표가
       * 없애려던 바로 그 상태다. 화면이 막고 `ON DELETE RESTRICT`가 한 겹 더 막는다.
       */
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

    it('딸린 글이 없으면 지워진다', async () => {
      const id = await categoryId('하객');

      await client.query('DELETE FROM structured.wedding_feed_categories WHERE id = $1', [id]);

      const { rows } = await client.query<{ n: string }>(
        'SELECT count(*)::text AS n FROM structured.wedding_feed_categories'
      );

      expect(Number(rows[0]!.n)).toBe(12);
    });
  });
});
