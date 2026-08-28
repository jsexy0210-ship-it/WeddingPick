import { RETENTION_POLICY } from '@weddingpick/domain';

import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 보관 기간은 **검증이 끝난 날로부터** 30일이다.
 *
 * 업로드 기준이 아니다. 심사가 늦어지면 증빙 파일이 심사 전에 파기 대상이 되어
 * 심사자가 확인할 근거를 잃기 때문이다. 그 대신 심사가 열려 있는 동안에는
 * 일정이 서지 않는다 — 그 대가를 여기서 함께 지킨다.
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

  async function upload(headers: Record<string, string>, weddingId: string) {
    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/documents/uploads',
      headers,
      payload: { weddingId, pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }] },
    });

    expect(response.statusCode).toBe(201);

    return response.json<{ rawDocumentId: string }>().rawDocumentId;
  }

  async function schedule(documentId: string) {
    const { rows } = await test.pool.query<{
      days: string | null;
      awaiting_verification: boolean;
      anchor_is_upload: boolean;
    }>(
      `SELECT
         round(extract(epoch from (s.retention_until - s.verified_at)) / 86400)::text AS days,
         s.awaiting_verification,
         s.verified_at = s.uploaded_at AS anchor_is_upload
       FROM originals.document_retention_schedule s WHERE s.id = $1`,
      [documentId]
    );

    return rows[0]!;
  }

  it('SQL과 도메인이 같은 일수를 말한다', async () => {
    const { rows } = await test.pool.query<{ days: number }>(
      'SELECT originals.retention_days() AS days'
    );

    // 두 곳에 적혀 있는 값이다. 한쪽만 고치면 화면과 실제가 달라진다.
    expect(rows[0]!.days).toBe(RETENTION_POLICY.originalDays);
  });

  it('아무 일도 없으면 업로드가 기준이 된다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const documentId = await upload(headers, weddingId);

    const result = await schedule(documentId);

    // 분석되지 않고 버려진 업로드가 영원히 남지 않게 하는 바닥이다.
    expect(result.anchor_is_upload).toBe(true);
    expect(Number(result.days)).toBe(RETENTION_POLICY.originalDays);
  });

  it('사용자 확인을 마치면 그날부터 다시 센다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const documentId = await upload(headers, weddingId);

    // 업로드는 열흘 전, 확인은 방금.
    await test.pool.query(
      "UPDATE originals.raw_documents SET uploaded_at = now() - interval '10 days' WHERE id = $1",
      [documentId]
    );
    const quote = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes (wedding_id, raw_document_id, source, confirmed_at)
       VALUES ($1, $2, 'ai_extraction', now()) RETURNING id`,
      [weddingId, documentId]
    );

    const result = await schedule(documentId);

    expect(result.anchor_is_upload).toBe(false);
    expect(Number(result.days)).toBe(RETENTION_POLICY.originalDays);
    expect(quote.rows[0]!.id).toBeDefined();
  });

  it('심사가 열려 있으면 일정이 서지 않는다', async () => {
    const { headers, userId } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const documentId = await upload(headers, weddingId);

    const quote = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes (wedding_id, raw_document_id, source, confirmed_at)
       VALUES ($1, $2, 'ai_extraction', now()) RETURNING id`,
      [weddingId, documentId]
    );
    const request = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.verification_requests (quote_id, requested_by, target_level)
       VALUES ($1, $2, 'L2') RETURNING id`,
      [quote.rows[0]!.id, userId]
    );
    await test.pool.query(
      `INSERT INTO structured.verification_evidence (request_id, kind, raw_document_id)
       VALUES ($1, 'contract_document', $2)`,
      [request.rows[0]!.id, documentId]
    );

    const result = await schedule(documentId);

    // 지우면 심사자가 확인할 근거를 잃는다. 이게 기준을 바꾼 이유다.
    expect(result.awaiting_verification).toBe(true);
    expect(result.days).toBeNull();
  });

  it('심사가 열려 있으면 아무리 오래돼도 파기 대상이 아니다', async () => {
    const { headers, userId } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const documentId = await upload(headers, weddingId);

    await test.pool.query(
      "UPDATE originals.raw_documents SET uploaded_at = now() - interval '400 days' WHERE id = $1",
      [documentId]
    );
    const quote = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes (wedding_id, raw_document_id, source)
       VALUES ($1, $2, 'ai_extraction') RETURNING id`,
      [weddingId, documentId]
    );
    const request = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.verification_requests (quote_id, requested_by, target_level)
       VALUES ($1, $2, 'L2') RETURNING id`,
      [quote.rows[0]!.id, userId]
    );
    await test.pool.query(
      `INSERT INTO structured.verification_evidence (request_id, kind, raw_document_id)
       VALUES ($1, 'contract_document', $2)`,
      [request.rows[0]!.id, documentId]
    );

    const due = await test.pool.query('SELECT 1 FROM originals.documents_due_for_deletion');
    const held = await test.pool.query<{ id: string }>(
      'SELECT id FROM originals.retention_held_for_verification'
    );

    expect(due.rows).toHaveLength(0);
    // 그 대신 눈에 보인다. 조용히 쌓이는 것이 가장 나쁘다.
    expect(held.rows.map((row) => row.id)).toEqual([documentId]);
  });

  it('심사에 결론이 나면 그날부터 센다', async () => {
    const { headers, userId } = await signInAs(test);
    const reviewer = await signInAs(test, 'apple-reviewer');
    const weddingId = await createWedding(test, headers);
    const documentId = await upload(headers, weddingId);

    await test.pool.query(
      "UPDATE originals.raw_documents SET uploaded_at = now() - interval '100 days' WHERE id = $1",
      [documentId]
    );
    const quote = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes (wedding_id, raw_document_id, source)
       VALUES ($1, $2, 'ai_extraction') RETURNING id`,
      [weddingId, documentId]
    );
    const request = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.verification_requests (quote_id, requested_by, target_level)
       VALUES ($1, $2, 'L2') RETURNING id`,
      [quote.rows[0]!.id, userId]
    );
    await test.pool.query(
      `INSERT INTO structured.verification_evidence (request_id, kind, raw_document_id)
       VALUES ($1, 'contract_document', $2)`,
      [request.rows[0]!.id, documentId]
    );

    await test.pool.query(
      `UPDATE structured.verification_requests
       SET status = 'approved', decided_at = now(), decided_by = $2
       WHERE id = $1`,
      [request.rows[0]!.id, reviewer.userId]
    );

    const result = await schedule(documentId);

    // 100일 전에 올라왔지만 심사가 방금 끝났으므로 이제부터 30일이다.
    expect(result.awaiting_verification).toBe(false);
    expect(Number(result.days)).toBe(RETENTION_POLICY.originalDays);

    const due = await test.pool.query('SELECT 1 FROM originals.documents_due_for_deletion');

    expect(due.rows).toHaveLength(0);
  });

  it('예정일이 지나면 파기 목록에 오른다', async () => {
    const { headers } = await signInAs(test);
    const weddingId = await createWedding(test, headers);
    const documentId = await upload(headers, weddingId);

    await test.pool.query(
      "UPDATE originals.raw_documents SET uploaded_at = now() - interval '31 days' WHERE id = $1",
      [documentId]
    );

    const { rows } = await test.pool.query<{ id: string }>(
      'SELECT id FROM originals.documents_due_for_deletion'
    );

    expect(rows.map((row) => row.id)).toEqual([documentId]);
  });
});
