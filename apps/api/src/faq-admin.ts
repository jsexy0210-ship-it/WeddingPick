import type { Pool } from 'pg';

import { FAQ_ITEMS } from '@weddingpick/domain';

import { ApiError } from './errors';

/**
 * 자주 묻는 것 — 운영자가 직접 등록·수정·삭제한다.
 *
 * 2026-09-11 대표 지시. 화면(`admin/faq.tsx`)은 전부터 있었고 서버가 없었다 —
 * 라우트 다섯이 등록만 돼 있고 GET은 빈 배열, POST는 임의 id, 나머지는 204만
 * 돌려줬다. 단추가 눌리고 아무것도 남지 않았다.
 *
 * **코드의 FAQ를 표로 복사하지 않는다.** `packages/domain/src/faq.ts`의 답은 공개
 * 기준 건수를 계산해 문장에 넣는다. 글자로 복사해 두면 기준이 바뀌는 날 사본이 옛
 * 수를 말하고, 문장이라서 고장으로 보이지 않는다. 그래서 조회는 **코드 항목과 표를
 * 겹쳐** 돌려주고, 코드 항목은 `editable: false`로 잠근 채 보여준다 — 운영자가
 * 「사용자가 지금 보는 것」을 한 자리에서 확인하면서 자기 항목만 고친다.
 *
 * **여기 등록한 항목이 아직 사용자에게 나가지는 않는다.** 앱 FAQ 화면과 웹 FAQ
 * 페이지는 코드의 FAQ_ITEMS를 직접 들고 있고, 그 둘을 고치는 것은 이번 작업의 범위
 * 밖이다(사용자 화면 · 약관 정본). 읽는 쪽을 붙이는 것이 다음 일이고, 그때 공개
 * 조회를 함께 만든다 — 부르는 데가 없는 라우트를 미리 열어 두지 않는다.
 */
export type AdminFaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
  order: number;
  published: boolean;
  /**
   * 고칠 수 있는 항목인지. 코드에 있는 항목은 `false`다 — 화면이 수정·삭제 단추를
   * 감추는 근거이고, 서버도 그 id로 오는 쓰기를 받지 않는다(id 형태가 다르다).
   */
  editable: boolean;
};

export type AdminFaqData = {
  items: AdminFaqItem[];
  categories: string[];
};

/** 코드 항목의 묶음 이름. 표의 묶음과 섞이지 않게 한 이름으로 모은다. */
const SPEC_CATEGORY = '코드에 있는 항목';

/** 코드 항목의 id. uuid가 아니어서 쓰기 경로의 uuid 검사에 걸린다 — 그것이 잠금이다. */
function specId(key: string): string {
  return `spec:${key}`;
}

export type FaqInput = {
  category: string;
  question: string;
  answer: string;
  order: number;
  published: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 화면이 보낸 것을 그대로 믿지 않는다. 빈 문자열은 표의 CHECK에 걸려 500이 되므로
 * 여기서 400으로 돌려준다 — 무엇이 비었는지 사람이 읽을 말로 적어야 고칠 수 있다.
 */
export function parseFaqInput(body: unknown): FaqInput {
  const raw = (body ?? {}) as Record<string, unknown>;
  const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

  const category = text(raw['category']);
  const question = text(raw['question']);
  const answer = text(raw['answer']);

  if (!category) throw new ApiError('invalid_request', '카테고리를 넣어주세요.');
  if (!question) throw new ApiError('invalid_request', '질문을 넣어주세요.');
  if (!answer) throw new ApiError('invalid_request', '답변을 넣어주세요.');
  if (category.length > 40) throw new ApiError('invalid_request', '카테고리는 40자까지예요.');
  if (question.length > 200) throw new ApiError('invalid_request', '질문은 200자까지예요.');
  if (answer.length > 4000) throw new ApiError('invalid_request', '답변은 4000자까지예요.');

  const order = Number(raw['order'] ?? 0);

  if (!Number.isInteger(order) || order < 0 || order > 9999) {
    throw new ApiError('invalid_request', '노출 순서는 0부터 9999까지의 정수예요.');
  }

  return { category, question, answer, order, published: raw['published'] === true };
}

function requireEditableId(id: string): string {
  if (!UUID_RE.test(id)) {
    throw new ApiError('invalid_request', '코드에 있는 항목은 이 화면에서 고칠 수 없어요.');
  }

  return id;
}

/** 코드 항목. 공개 기준 건수가 계산되어 든 문장을 그때그때 읽는다. */
function specItems(): AdminFaqItem[] {
  return FAQ_ITEMS.map((item, index) => ({
    id: specId(item.key),
    category: SPEC_CATEGORY,
    question: item.question,
    answer: item.answer,
    order: index,
    published: true,
    editable: false,
  }));
}

export async function list(pool: Pool): Promise<AdminFaqData> {
  const { rows } = await pool.query<{
    id: string;
    category: string;
    question: string;
    answer: string;
    sort_order: number;
    published: boolean;
  }>(
    `SELECT id, category, question, answer, sort_order, published
       FROM structured.faq_items
      ORDER BY category, sort_order, created_at`
  );

  const items: AdminFaqItem[] = [
    ...rows.map((row) => ({
      id: row.id,
      category: row.category,
      question: row.question,
      answer: row.answer,
      order: row.sort_order,
      published: row.published,
      editable: true,
    })),
    ...specItems(),
  ];

  return { items, categories: [...new Set(items.map((item) => item.category))] };
}

export async function create(pool: Pool, input: FaqInput, operatorId: string | null): Promise<{ id: string }> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO structured.faq_items (category, question, answer, sort_order, published, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
    [input.category, input.question, input.answer, input.order, input.published, operatorId]
  );

  return { id: rows[0]!.id };
}

export async function update(
  pool: Pool,
  id: string,
  input: FaqInput,
  operatorId: string | null
): Promise<void> {
  const { rowCount } = await pool.query(
    `UPDATE structured.faq_items
        SET category = $2, question = $3, answer = $4, sort_order = $5,
            published = $6, updated_at = now(), updated_by = $7
      WHERE id = $1`,
    [
      requireEditableId(id),
      input.category,
      input.question,
      input.answer,
      input.order,
      input.published,
      operatorId,
    ]
  );

  if (!rowCount) throw new ApiError('not_found', '그 FAQ를 찾지 못했어요.');
}

export async function remove(pool: Pool, id: string): Promise<void> {
  const { rowCount } = await pool.query('DELETE FROM structured.faq_items WHERE id = $1', [
    requireEditableId(id),
  ]);

  if (!rowCount) throw new ApiError('not_found', '그 FAQ를 찾지 못했어요.');
}
