import { RETENTION_POLICY } from '@weddingpick/domain';

import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 보관 기간 30일이 실제로 붙는지.
 *
 * 정책은 한 곳(RETENTION_POLICY)에 있지만, 그 값이 문서에 실제로 적히는지는
 * 다른 문제다. 여기서 그 연결을 지킨다.
 */
describeWithDb('원본 보관 기간', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('올린 문서에 30일 뒤 파기 예정일이 붙는다', async () => {
    const { headers } = await signInAs(test);

    const weddingId = await createWedding(test, headers);

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/documents/uploads',
      headers,
      payload: { weddingId, pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }] },
    });

    expect(response.statusCode).toBe(201);

    const documentId = response.json<{ rawDocumentId: string }>().rawDocumentId;

    const { rows } = await test.pool.query<{ days: string }>(
      `SELECT round(extract(epoch from (retention_until - uploaded_at)) / 86400)::text AS days
       FROM originals.raw_documents WHERE id = $1`,
      [documentId]
    );

    expect(Number(rows[0]!.days)).toBe(RETENTION_POLICY.originalDays);
  });

  it('예정일이 지나기 전에는 파기 목록에 오르지 않는다', async () => {
    const { headers } = await signInAs(test);

    const weddingId = await createWedding(test, headers);

    await test.app.inject({
      method: 'POST',
      url: '/v1/documents/uploads',
      headers,
      payload: { weddingId, pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }] },
    });

    const { rows } = await test.pool.query(
      'SELECT 1 FROM originals.documents_due_for_deletion'
    );

    expect(rows).toHaveLength(0);
  });

  it('예정일이 지나면 파기 목록에 오른다', async () => {
    const { headers } = await signInAs(test);

    const weddingId = await createWedding(test, headers);

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/documents/uploads',
      headers,
      payload: { weddingId, pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }] },
    });

    const documentId = response.json<{ rawDocumentId: string }>().rawDocumentId;

    await test.pool.query(
      `UPDATE originals.raw_documents
       SET uploaded_at = now() - interval '31 days',
           retention_until = now() - interval '1 day'
       WHERE id = $1`,
      [documentId]
    );

    const { rows } = await test.pool.query<{ id: string }>(
      'SELECT id FROM originals.documents_due_for_deletion'
    );

    expect(rows.map((row) => row.id)).toEqual([documentId]);
  });
});
