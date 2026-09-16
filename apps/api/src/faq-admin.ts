import type { Pool } from 'pg';

import { fillFaqPlaceholders, unknownFaqPlaceholders } from '@weddingpick/domain';

import { ApiError } from './errors';

/**
 * 자주 묻는 것 — 운영자가 직접 등록·수정·삭제한다.
 *
 * 2026-09-11 대표 지시로 표와 라우트가 생겼고, **2026-09-16 지시로 코드에 있던 일곱도
 * 표로 내려왔다** — 「관리자 faq처럼 이미 코드로 등록되어 있는것도 내가 직접 수정 삭제
 * 가능하도록 하라고」. 그래서 여기에 더 이상 「잠긴 항목」이 없다. 조회가 돌려주는 것은
 * 전부 표의 행이고 전부 고치고 지울 수 있다.
 *
 * **잠가 두었던 이유는 답 하나에만 해당했다.** `price-source`의 답이 공개 기준 건수를
 * 계산해 문장에 넣었고, 글자로 복사하면 기준이 바뀌는 날 사본이 옛 수를 말한다. 그
 * 하나는 자리표시자(`{{limited}}`)로 담았고 보여줄 때 코드가 채운다.
 *
 * **채울 수 없는 이름은 저장할 때 막는다.** `{{limitedd}}`가 사용자 화면에 그대로
 * 나가면 아무도 고장으로 보지 않는다 — 글자라서 문구의 일부로 읽힌다. 400으로
 * 돌려보내고 무엇이 틀렸는지 이름으로 적어준다.
 */
export type AdminFaqItem = {
  id: string;
  /** 코드에서 옮겨 온 항목의 고정 이름. 운영자가 등록한 항목은 `null`이다. */
  key: string | null;
  category: string;
  question: string;
  answer: string;
  /** 자리표시자를 채우기 «전» 글자. 운영자가 고치는 것은 이쪽이다. */
  answerSource: string;
  order: number;
  published: boolean;
};

export type AdminFaqData = {
  items: AdminFaqItem[];
  categories: string[];
};

/** 사용자 화면이 받는 모양. 답은 이미 채워져 있고 고칠 것이 없다. */
export type PublicFaqItem = {
  key: string;
  category: string;
  question: string;
  answer: string;
};

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

  /*
   * 채울 수 없는 자리표시자를 여기서 막는다. 통과시키면 `{{limitedd}}`가 그대로
   * 사용자 화면에 실리고, 글자라서 아무도 고장으로 보지 않는다.
   */
  const unknown = unknownFaqPlaceholders(answer);

  if (unknown.length) {
    throw new ApiError(
      'invalid_request',
      `답변에서 채울 수 없는 자리를 찾았어요 — ${unknown.map((name) => `{{${name}}}`).join(' · ')}. 아래 「쓸 수 있는 자리」에 있는 이름만 넣어주세요.`
    );
  }

  const order = Number(raw['order'] ?? 0);

  if (!Number.isInteger(order) || order < 0 || order > 9999) {
    throw new ApiError('invalid_request', '노출 순서는 0부터 9999까지의 정수예요.');
  }

  return { category, question, answer, order, published: raw['published'] === true };
}

/**
 * 표의 행을 가리키는 id인지 본다.
 *
 * uuid가 아닌 글자를 그대로 질의에 넣으면 PostgreSQL이 22P02로 끊고 500이 된다.
 * 여기서 걸러 「찾지 못했어요」로 돌려준다 — 없는 것을 찾은 것과 같은 답이다.
 */
function requireRowId(id: string): string {
  if (!UUID_RE.test(id)) throw new ApiError('not_found', '그 FAQ를 찾지 못했어요.');

  return id;
}

type FaqRow = {
  id: string;
  key: string | null;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  published: boolean;
};

export async function list(pool: Pool): Promise<AdminFaqData> {
  const { rows } = await pool.query<FaqRow>(
    `SELECT id, key, category, question, answer, sort_order, published
       FROM structured.faq_items
      ORDER BY category, sort_order, created_at`
  );

  const items: AdminFaqItem[] = rows.map((row) => ({
    id: row.id,
    key: row.key,
    category: row.category,
    question: row.question,
    /* 관리자 목록은 채운 글을 보여준다 — 사용자가 읽을 문장이 그것이다. */
    answer: fillFaqPlaceholders(row.answer),
    /* 고칠 때 여는 것은 원문이다. 채운 글을 되돌려 저장하면 숫자가 글자로 굳는다. */
    answerSource: row.answer,
    order: row.sort_order,
    published: row.published,
  }));

  return { items, categories: [...new Set(items.map((item) => item.category))] };
}

/**
 * 사용자 화면이 받는 목록.
 *
 * **공개한 것만, 순서대로.** 자리표시자는 여기서 채운다 — 화면마다 채우면 한 군데를
 * 빠뜨리고, 그 화면에서만 `{{limited}}`가 글자로 나간다.
 *
 * **로그인이 없다.** FAQ는 로그인하지 않아도 보는 화면이고(`why-locked`의 답이 그렇게
 * 적고 있다), 내보내는 것은 어차피 누구에게나 같은 문구다.
 *
 * `key`가 빈 행은 id를 키로 쓴다. 화면의 주소와 관련 질문 짝짓기가 이 값으로 걸린다.
 */
export async function publicList(pool: Pool): Promise<{ items: PublicFaqItem[] }> {
  const { rows } = await pool.query<FaqRow>(
    `SELECT id, key, category, question, answer, sort_order, published
       FROM structured.faq_items
      WHERE published
      ORDER BY sort_order, created_at`
  );

  return {
    items: rows.map((row) => ({
      key: row.key ?? row.id,
      category: row.category,
      question: row.question,
      answer: fillFaqPlaceholders(row.answer),
    })),
  };
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
      requireRowId(id),
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
    requireRowId(id),
  ]);

  if (!rowCount) throw new ApiError('not_found', '그 FAQ를 찾지 못했어요.');
}
