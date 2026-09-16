import type { Pool } from 'pg';

import {
  buildFeedTabs,
  findUngroupedCategories,
  type WeddingFeedCategory,
  type WeddingFeedGroup,
  type WeddingFeedTab,
} from '@weddingpick/domain';
import {
  weddingFeedCategoryInputSchema,
  weddingFeedGroupInputSchema,
} from '@weddingpick/api-contract';

import { ApiError, notFound } from './errors';

/**
 * 웨딩피드의 탭과 카테고리.
 *
 * 2026-09-16 대표 지시 — 「웨딩피드는 탭별 카테고리별로 다 설정 가능해야한다」.
 *
 * **전에는 카테고리가 자유 문자열이었다.** 관리자 글 작성 칸이 자유 입력이라
 * 「웨딩홀 」(뒤 공백)처럼 적으면 그 글은 어느 탭에도 안 걸리는데 오류도 안 나고
 * 목록에서는 멀쩡해 보였다 — 알아챌 방법이 없었다. 이제 고를 수 있는 값이 표에
 * 있고(0422) 운영자가 그 표를 고친다.
 *
 * 「전체」는 여기 없다 — 거르지 않는다는 뜻이라 담을 카테고리가 없다.
 * `WEDDING_FEED_ALL_TAB`(domain)에 있고 `buildFeedTabs`가 맨 앞에 붙인다.
 */

type GroupRow = { id: string; name: string; sort_order: number; active: boolean };
type CategoryRow = GroupRow & { group_id: string | null; post_count: string };

const toGroup = (row: GroupRow): WeddingFeedGroup => ({
  id: row.id,
  name: row.name,
  sortOrder: row.sort_order,
  active: row.active,
});

const toCategory = (row: CategoryRow): WeddingFeedCategory & { postCount: number } => ({
  id: row.id,
  name: row.name,
  groupId: row.group_id,
  sortOrder: row.sort_order,
  active: row.active,
  postCount: Number(row.post_count),
});

async function readAll(pool: Pool) {
  const groups = await pool.query<GroupRow>(
    `SELECT id, name, sort_order, active
     FROM structured.wedding_feed_groups
     ORDER BY sort_order ASC, created_at ASC`
  );

  /*
   * 글 수를 같이 센다. **지우기를 막는 근거가 이 수다** — 화면이 「몇 편이 딸려
   * 있는지」를 보여준 뒤에 묻는다(CLAUDE.md — 위험한 조작은 무엇이 바뀌는지
   * 항목으로 보여준 뒤 한 번 더 확인).
   */
  const categories = await pool.query<CategoryRow>(
    `SELECT c.id, c.name, c.group_id, c.sort_order, c.active,
            count(p.id)::text AS post_count
     FROM structured.wedding_feed_categories c
     LEFT JOIN structured.wedding_feed_posts p ON p.category_id = c.id
     GROUP BY c.id
     ORDER BY c.sort_order ASC, c.created_at ASC`
  );

  return { groups: groups.rows.map(toGroup), categories: categories.rows.map(toCategory) };
}

/**
 * 관리자가 보는 분류표.
 *
 * `ungrouped`를 **서버가 세어 준다** — 어느 탭에도 안 든 카테고리 이름이다.
 * 그 카테고리의 글은 「전체」에서만 보이고, 운영자가 「왜 이 글이 탭에 안 뜨지」를
 * 묻기 전까지 아무도 모른다.
 */
export async function listTaxonomy(pool: Pool) {
  const { groups, categories } = await readAll(pool);

  return {
    groups,
    categories,
    ungrouped: findUngroupedCategories(categories).map((category) => category.name),
  };
}

/** 앱이 그릴 탭 줄. 꺼진 것은 빠지고 「전체」가 맨 앞이다. */
export async function listTabs(pool: Pool): Promise<readonly WeddingFeedTab[]> {
  const { groups, categories } = await readAll(pool);

  return buildFeedTabs(groups, categories);
}

/** 글 작성에서 고를 수 있는 카테고리 이름. 켜진 것만. */
export async function activeCategoryNames(pool: Pool): Promise<readonly string[]> {
  const { rows } = await pool.query<{ name: string }>(
    `SELECT name FROM structured.wedding_feed_categories
     WHERE active
     ORDER BY sort_order ASC, created_at ASC`
  );

  return rows.map((row) => row.name);
}

export function parseGroupInput(body: unknown) {
  const parsed = weddingFeedGroupInputSchema.safeParse(body);

  if (!parsed.success) throw new ApiError('invalid_request', '보낸 값을 읽지 못했어요.');

  return parsed.data;
}

export function parseCategoryInput(body: unknown) {
  const parsed = weddingFeedCategoryInputSchema.safeParse(body);

  if (!parsed.success) throw new ApiError('invalid_request', '보낸 값을 읽지 못했어요.');

  return parsed.data;
}

/**
 * 이름이 겹치는지 본다.
 *
 * **표의 UNIQUE가 이미 막지만 여기서 한 번 더 본다.** 제약이 튕기면 화면에는
 * 영문 오류가 그대로 올라가고, 운영자는 무엇이 잘못됐는지 읽을 수 없다.
 */
async function ensureNameFree(
  pool: Pool,
  table: 'wedding_feed_groups' | 'wedding_feed_categories',
  name: string,
  exceptId: string | null
) {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM structured.${table} WHERE name = $1 AND ($2::uuid IS NULL OR id <> $2)`,
    [name, exceptId]
  );

  if (rows.length > 0) {
    throw new ApiError('conflict', `「${name}」은 이미 있어요. 다른 이름을 써 주세요.`);
  }
}

export type GroupInput = ReturnType<typeof parseGroupInput>;
export type CategoryInput = ReturnType<typeof parseCategoryInput>;

export async function createGroup(pool: Pool, input: GroupInput): Promise<{ id: string }> {
  await ensureNameFree(pool, 'wedding_feed_groups', input.name, null);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO structured.wedding_feed_groups (name, sort_order, active)
     VALUES ($1, $2, $3) RETURNING id`,
    [input.name, input.sortOrder, input.active]
  );

  return { id: rows[0]!.id };
}

export async function updateGroup(pool: Pool, id: string, input: GroupInput): Promise<void> {
  await ensureNameFree(pool, 'wedding_feed_groups', input.name, id);

  const { rowCount } = await pool.query(
    `UPDATE structured.wedding_feed_groups
     SET name = $2, sort_order = $3, active = $4, updated_at = now()
     WHERE id = $1`,
    [id, input.name, input.sortOrder, input.active]
  );

  if (rowCount === 0) throw notFound('탭');
}

/**
 * 탭을 지운다.
 *
 * **딸린 카테고리는 함께 지우지 않는다.** 표의 `ON DELETE SET NULL`이 카테고리를
 * 남기고 소속만 떼어낸다 — 그 카테고리로 쌓인 글은 그대로 있고 「전체」에서 계속
 * 보인다. 카테고리까지 지우면 글이 가리키던 값이 사라진다.
 *
 * 떨어져 나온 카테고리는 관리자 화면 맨 위 경고줄에 뜬다. **조용히 사라지지 않는
 * 것이 요점이다** — 운영자가 어디로 옮길지 정할 때까지 눈에 남는다.
 */
export async function removeGroup(pool: Pool, id: string): Promise<{ orphaned: number }> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM structured.wedding_feed_categories WHERE group_id = $1`,
    [id]
  );
  const { rowCount } = await pool.query(
    'DELETE FROM structured.wedding_feed_groups WHERE id = $1',
    [id]
  );

  if (rowCount === 0) throw notFound('탭');

  return { orphaned: Number(rows[0]?.n ?? 0) };
}

export async function createCategory(pool: Pool, input: CategoryInput): Promise<{ id: string }> {
  await ensureNameFree(pool, 'wedding_feed_categories', input.name, null);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO structured.wedding_feed_categories (name, group_id, sort_order, active)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.name, input.groupId, input.sortOrder, input.active]
  );

  return { id: rows[0]!.id };
}

/**
 * 카테고리를 고친다.
 *
 * **이름을 고치면 그 값으로 쌓인 글의 `category_label`도 함께 고친다.** 글은 id로
 * 붙어 있어서 이름만 바꿔도 연결은 안 끊어지지만, 카드 위 작은 줄과 목록은
 * `category_label` 문자열을 그대로 그린다 — 안 맞추면 **관리자 표에는 새 이름,
 * 앱 화면에는 옛 이름**이 나란히 남는다. 한 트랜잭션에서 둘을 같이 옮긴다.
 */
export async function updateCategory(pool: Pool, id: string, input: CategoryInput): Promise<void> {
  await ensureNameFree(pool, 'wedding_feed_categories', input.name, id);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rowCount } = await client.query(
      `UPDATE structured.wedding_feed_categories
       SET name = $2, group_id = $3, sort_order = $4, active = $5, updated_at = now()
       WHERE id = $1`,
      [id, input.name, input.groupId, input.sortOrder, input.active]
    );

    if (rowCount === 0) throw notFound('카테고리');

    await client.query(
      `UPDATE structured.wedding_feed_posts
       SET category_label = $2, updated_at = now()
       WHERE category_id = $1 AND category_label <> $2`,
      [id, input.name]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 카테고리를 지운다.
 *
 * **쓰는 카테고리는 지우지 못한다.** 지우면 그 글들이 어느 탭에도 안 뜨고 「전체」
 * 에서만 보이는데, 오류도 안 나고 목록에서는 멀쩡해 보여서 알아챌 방법이 없다 —
 * 이 기능이 없애려던 바로 그 상태다. 몇 편이 딸려 있는지 세어 돌려주고, 대신
 * **끄는 쪽을 권한다** — 끄면 고를 수 없게 되고 쌓인 글은 그대로 남는다.
 *
 * 표의 `ON DELETE RESTRICT`가 같은 것을 한 겹 더 막는다. 화면을 거치지 않는 길이
 * 생겨도 DB가 거절한다.
 */
export async function removeCategory(pool: Pool, id: string): Promise<void> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM structured.wedding_feed_posts WHERE category_id = $1`,
    [id]
  );
  const used = Number(rows[0]?.n ?? 0);

  if (used > 0) {
    throw new ApiError(
      'conflict',
      `이 카테고리로 쓴 글이 ${used.toLocaleString('ko-KR')}편 있어요. 글을 옮기거나 지운 뒤에 지울 수 있어요. 당장 감추려면 끄기를 쓰세요.`
    );
  }

  const { rowCount } = await pool.query(
    'DELETE FROM structured.wedding_feed_categories WHERE id = $1',
    [id]
  );

  if (rowCount === 0) throw notFound('카테고리');
}
