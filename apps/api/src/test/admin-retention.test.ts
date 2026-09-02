import type { LocalStorage } from '../storage/local';
import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 보관 점검 HTTP API. `sweepExpiredDocuments`/`deleteDocument` 등의 규칙
 * 자체는 `retention.test.ts`가 이미 다 봤다 — 여기서는 관문과 라우트 배선만
 * 본다. `--operator`(운영자 지정/해제)는 의도적으로 라우트가 없다 — 자기
 * 자신을 운영자로 올리는 길을 API에 만들지 않기 위해서다.
 */
describeWithDb('보관 점검 API', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function anOperatorSession() {
    const session = await signInAs(test, `operator-${Math.random()}`);
    await test.pool.query('UPDATE structured.users SET is_operator = true WHERE id = $1', [
      session.userId,
    ]);

    return session;
  }

  /** 파기 예정일이 지난 원본 하나. 업로드 시각을 40일 전으로 옮긴다(0018 — 30일 기준). */
  async function anExpiredDocument(): Promise<string> {
    const user = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );
    const uploaded = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);

    const document = await test.pool.query<{ id: string }>(
      `INSERT INTO originals.raw_documents (owner_user_id, page_count, uploaded_at)
       VALUES ($1, 1, $2) RETURNING id`,
      [user.rows[0]!.id, uploaded]
    );
    const documentId = document.rows[0]!.id;
    const storage = test.context.storage as LocalStorage;
    const storageKey = `${documentId}/a.jpg`;
    storage.put(storageKey, Buffer.from('원본'));

    await test.pool.query(
      `INSERT INTO originals.raw_document_pages (raw_document_id, page_index, storage_key, mime_type)
       VALUES ($1, 0, $2, 'image/jpeg')`,
      [documentId, storageKey]
    );

    return documentId;
  }

  it('운영자가 아니면 403이다', async () => {
    const session = await signInAs(test, `not-operator-${Math.random()}`);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/retention/due',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('파기 예정일이 지난 원본을 목록에서 보고, 지울 수 있다', async () => {
    const operator = await anOperatorSession();
    const documentId = await anExpiredDocument();

    const due = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/retention/due',
      headers: operator.headers,
    });

    expect(due.statusCode).toBe(200);
    expect(due.json<{ due: { id: string }[] }>().due.map((d) => d.id)).toContain(documentId);

    const del = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/retention/documents/${documentId}/delete`,
      headers: operator.headers,
    });

    expect(del.statusCode).toBe(200);
    expect(del.json<{ keysDeleted: number }>().keysDeleted).toBe(1);

    const after = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/retention/due',
      headers: operator.headers,
    });

    expect(after.json<{ due: { id: string }[] }>().due.map((d) => d.id)).not.toContain(
      documentId
    );
  });

  it('아직 예정일이 아닌 문서를 지우려 하면 400이다', async () => {
    const operator = await anOperatorSession();
    const user = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );
    const document = await test.pool.query<{ id: string }>(
      `INSERT INTO originals.raw_documents (owner_user_id, page_count, uploaded_at)
       VALUES ($1, 1, now()) RETURNING id`,
      [user.rows[0]!.id]
    );

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/admin/retention/documents/${document.rows[0]!.id}/delete`,
      headers: operator.headers,
    });

    expect(response.statusCode).toBe(400);
  });

  it('자동 청소(sweep)로 만료된 원본을 한 번에 지울 수 있다', async () => {
    const operator = await anOperatorSession();
    const documentId = await anExpiredDocument();

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/admin/retention/sweep',
      headers: operator.headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ deleted: number; failed: number }>()).toEqual({
      deleted: 1,
      failed: 0,
    });

    const due = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/retention/due',
      headers: operator.headers,
    });

    expect(due.json<{ due: { id: string }[] }>().due.map((d) => d.id)).not.toContain(documentId);
  });

  it('손이 필요한 원본·집어가지 못한 문서 목록도 응답한다', async () => {
    const operator = await anOperatorSession();

    const attention = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/retention/attention',
      headers: operator.headers,
    });

    expect(attention.statusCode).toBe(200);
    expect(attention.json<{ attention: unknown[] }>().attention).toEqual([]);

    const collect = await test.app.inject({
      method: 'POST',
      url: '/v1/admin/retention/collect-unreachable',
      headers: operator.headers,
    });

    expect(collect.statusCode).toBe(200);
    expect(collect.json<{ moved: number }>().moved).toBe(0);
  });
});
