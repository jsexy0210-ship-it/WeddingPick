import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 심사가 있어야 등급이 오르고, 등급이 올라야 가격 비교가 선다. 그 길목에 있는
 * 규칙들을 여기서 고정한다 — 특히 자동승인과 본인 승인 금지(서비스정책서 7번)는
 * 되돌아가면 안 된다.
 */

/** 신청 하나. 증빙 종류를 넘기면 그것까지 붙인다. */
async function createRequest(
  requesterId: string,
  targetLevel: string,
  evidenceKinds: readonly string[]
): Promise<{ requestId: string; quoteId: string }> {
  const wedding = await test.pool.query<{ id: string }>(
    'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
    [requesterId]
  );
  const quote = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.quotes (wedding_id, source, total_amount)
     VALUES ($1, 'user_quote', 32800000) RETURNING id`,
    [wedding.rows[0]!.id]
  );
  const request = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.verification_requests (quote_id, requested_by, target_level)
     VALUES ($1, $2, $3::verification_level) RETURNING id`,
    [quote.rows[0]!.id, requesterId, targetLevel]
  );

  for (const kind of evidenceKinds) {
    const document = await test.pool.query<{ id: string }>(
      'INSERT INTO originals.raw_documents (owner_user_id, page_count) VALUES ($1, 1) RETURNING id',
      [requesterId]
    );

    await test.pool.query(
      `INSERT INTO structured.verification_evidence (request_id, kind, raw_document_id)
       VALUES ($1, $2::verification_evidence_kind, $3)`,
      [request.rows[0]!.id, kind, document.rows[0]!.id]
    );
  }

  return { requestId: request.rows[0]!.id, quoteId: quote.rows[0]!.id };
}

async function decide(requestId: string, status: string, decidedBy: string | null) {
  return await test.pool.query(
    `UPDATE structured.verification_requests
     SET status = $2::verification_status, decided_at = now(), decided_by = $3::uuid,
         rejection_reason = CASE WHEN $2::verification_status = 'rejected' THEN '사유' END
     WHERE id = $1::uuid`,
    [requestId, status, decidedBy]
  );
}

describeWithDb('인증 심사', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('접수하면 이력이 자동으로 남는다', async () => {
    const { userId } = await signInAs(test);
    const { requestId } = await createRequest(userId, 'L2', ['contract_document']);

    const { rows } = await test.pool.query<{ kind: string; actor_user_id: string | null }>(
      'SELECT kind, actor_user_id FROM structured.verification_events WHERE request_id = $1',
      [requestId]
    );

    expect(rows).toEqual([{ kind: 'received', actor_user_id: null }]);
  });

  it('신청자 본인은 자기 신청을 승인할 수 없다', async () => {
    const { userId } = await signInAs(test);
    const { requestId } = await createRequest(userId, 'L2', ['contract_document']);

    await expect(decide(requestId, 'approved', userId)).rejects.toThrow(
      /decision_has_reviewer_who_is_not_the_requester/
    );
  });

  it('신청자 본인은 자기 신청을 반려할 수도 없다', async () => {
    const { userId } = await signInAs(test);
    const { requestId } = await createRequest(userId, 'L2', ['contract_document']);

    await expect(decide(requestId, 'rejected', userId)).rejects.toThrow(
      /decision_has_reviewer_who_is_not_the_requester/
    );
  });

  it('심사자 없이는 결론이 나지 않는다', async () => {
    const { userId } = await signInAs(test);
    const { requestId } = await createRequest(userId, 'L2', ['contract_document']);

    await expect(decide(requestId, 'approved', null)).rejects.toThrow(
      /decision_has_reviewer_who_is_not_the_requester/
    );
  });

  it('다른 사람이면 승인할 수 있다', async () => {
    const { userId } = await signInAs(test);
    const reviewer = await signInAs(test, 'apple-reviewer');
    const { requestId } = await createRequest(userId, 'L2', ['contract_document']);

    await decide(requestId, 'approved', reviewer.userId);

    const { rows } = await test.pool.query<{ status: string }>(
      'SELECT status FROM structured.verification_requests WHERE id = $1',
      [requestId]
    );

    expect(rows[0]!.status).toBe('approved');
  });

  it('접수 외의 이력에는 사람이 반드시 남는다', async () => {
    const { userId } = await signInAs(test);
    const { requestId } = await createRequest(userId, 'L2', ['contract_document']);

    await expect(
      test.pool.query(
        `INSERT INTO structured.verification_events (request_id, kind)
         VALUES ($1, 'approved')`,
        [requestId]
      )
    ).rejects.toThrow(/human_action_has_actor/);
  });

  it('심사 대기 목록은 낸 증빙을 목표 등급과 함께 보여준다', async () => {
    const { userId } = await signInAs(test);
    await createRequest(userId, 'L2', ['quote_document']);

    const { rows } = await test.pool.query<{
      target_level: string;
      evidence_kinds: string[];
    }>('SELECT target_level, evidence_kinds FROM structured.pending_verification_requests');

    // 목표는 L2인데 낸 것은 견적서다 — 심사자가 이 어긋남을 보고 판단해야 한다.
    expect(rows).toEqual([{ target_level: 'L2', evidence_kinds: ['quote_document'] }]);
  });

  it('결론이 난 신청은 대기 목록에서 빠진다', async () => {
    const { userId } = await signInAs(test);
    const reviewer = await signInAs(test, 'apple-reviewer');
    const { requestId } = await createRequest(userId, 'L2', ['contract_document']);

    await decide(requestId, 'approved', reviewer.userId);

    const { rows } = await test.pool.query(
      'SELECT 1 FROM structured.pending_verification_requests'
    );

    expect(rows).toHaveLength(0);
  });
});
