import { VERIFICATION_POLICY } from '@weddingpick/domain';

import { alertOperators } from '../retention/alert';
import type { Push, PushMessage } from '../push/port';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 심사가 밀리면 그 증빙 원본은 파기되지 않는다(0018). 그래서 적체는 심사만의
 * 문제가 아니라 개인정보가 오래 남는 문제다. 7일부터 밀린 것으로 본다.
 */
describeWithDb('인증 심사 적체', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  function fakePush() {
    const sent: PushMessage[] = [];
    const push: Push = {
      async send(messages) {
        sent.push(...messages);

        return messages.map((message) => ({ token: message.token, delivered: true as const }));
      },
    };

    return { push, sent };
  }

  const deps = (push: Push) => ({ pool: test.pool, push, reminderAfterHours: 24 });

  async function createOperator() {
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users (is_operator) VALUES (true) RETURNING id'
    );

    await test.pool.query(
      `INSERT INTO structured.device_tokens (user_id, token, platform)
       VALUES ($1, 'ExponentPushToken[operator]', 'ios')`,
      [rows[0]!.id]
    );

    return rows[0]!.id;
  }

  /** 접수한 지 며칠 된 인증 신청 하나. 증빙 원본도 함께 만든다. */
  async function createRequest(daysAgo: number) {
    const user = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );
    const userId = user.rows[0]!.id;
    const wedding = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
      [userId]
    );
    const document = await test.pool.query<{ id: string }>(
      'INSERT INTO originals.raw_documents (owner_user_id, page_count) VALUES ($1, 1) RETURNING id',
      [userId]
    );
    const quote = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes (wedding_id, raw_document_id, source)
       VALUES ($1, $2, 'ai_extraction') RETURNING id`,
      [wedding.rows[0]!.id, document.rows[0]!.id]
    );
    const request = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.verification_requests (quote_id, requested_by, target_level, received_at)
       VALUES ($1, $2, 'L2', now() - ($3 || ' days')::interval) RETURNING id`,
      [quote.rows[0]!.id, userId, String(daysAgo)]
    );

    await test.pool.query(
      `INSERT INTO structured.verification_evidence (request_id, kind, raw_document_id)
       VALUES ($1, 'contract_document', $2)`,
      [request.rows[0]!.id, document.rows[0]!.id]
    );

    return { requestId: request.rows[0]!.id, documentId: document.rows[0]!.id, userId };
  }

  it('SQL과 도메인이 같은 일수를 말한다', async () => {
    const { rows } = await test.pool.query<{ days: number }>(
      'SELECT structured.verification_backlog_days() AS days'
    );

    expect(rows[0]!.days).toBe(VERIFICATION_POLICY.backlogDays);
  });

  it('기준 일수를 넘겨야 밀린 것으로 본다', async () => {
    await createRequest(VERIFICATION_POLICY.backlogDays - 1);

    const { rows } = await test.pool.query(
      'SELECT 1 FROM structured.backlogged_verification_requests'
    );

    expect(rows).toHaveLength(0);
  });

  it('기준 일수가 지나면 밀린 목록에 오른다', async () => {
    const { requestId } = await createRequest(VERIFICATION_POLICY.backlogDays + 3);

    const { rows } = await test.pool.query<{ id: string; waiting_days: number }>(
      'SELECT id, waiting_days FROM structured.backlogged_verification_requests'
    );

    expect(rows.map((row) => row.id)).toEqual([requestId]);
    expect(rows[0]!.waiting_days).toBe(VERIFICATION_POLICY.backlogDays + 3);
  });

  it('심사를 시작해도 시계는 되돌아가지 않는다', async () => {
    const { requestId } = await createRequest(VERIFICATION_POLICY.backlogDays + 1);

    await test.pool.query(
      "UPDATE structured.verification_requests SET status = 'in_review' WHERE id = $1",
      [requestId]
    );

    // 시작은 결론이 아니다. 신청한 사람이 기다리는 것은 결론이다.
    const { rows } = await test.pool.query(
      'SELECT 1 FROM structured.backlogged_verification_requests'
    );

    expect(rows).toHaveLength(1);
  });

  it('결론이 나면 밀린 목록에서 빠진다', async () => {
    const { requestId } = await createRequest(VERIFICATION_POLICY.backlogDays + 1);
    const reviewer = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );

    await test.pool.query(
      `UPDATE structured.verification_requests
       SET status = 'rejected', decided_at = now(), decided_by = $2, rejection_reason = '사유'
       WHERE id = $1`,
      [requestId, reviewer.rows[0]!.id]
    );

    const { rows } = await test.pool.query(
      'SELECT 1 FROM structured.backlogged_verification_requests'
    );

    expect(rows).toHaveLength(0);
  });

  it('밀린 심사 때문에 파기가 미뤄지고 있는 원본을 함께 센다', async () => {
    const { documentId } = await createRequest(VERIFICATION_POLICY.backlogDays + 1);

    const { rows } = await test.pool.query<{ held_document_count: string }>(
      'SELECT held_document_count FROM structured.backlogged_verification_requests'
    );

    expect(Number(rows[0]!.held_document_count)).toBe(1);

    // 실제로 그 원본의 파기 일정이 서지 않았는지도 함께 본다.
    const held = await test.pool.query<{ id: string }>(
      'SELECT id FROM originals.retention_held_for_verification'
    );

    expect(held.rows.map((row) => row.id)).toEqual([documentId]);
  });

  it('운영자에게 알린다', async () => {
    await createOperator();
    await createRequest(VERIFICATION_POLICY.backlogDays + 2);

    const { push, sent } = fakePush();
    const result = await alertOperators(deps(push));

    expect(result.verification_backlog).toMatchObject({ dueCount: 1, notified: 1, delivered: 1 });
    expect(sent[0]!.title).toContain('심사');
    // 왜 급한지가 함께 간다.
    expect(sent[0]!.body).toContain('파기 일정');
  });

  it('푸시 본문에 개인정보를 담지 않는다', async () => {
    await createOperator();
    const { userId } = await createRequest(VERIFICATION_POLICY.backlogDays + 2);

    const { push, sent } = fakePush();
    await alertOperators(deps(push));

    const text = `${sent[0]!.title} ${sent[0]!.body}`;

    expect(text).not.toContain(userId);
    expect(text).toContain('1건');
  });

  it('파기 알림과 따로 센다', async () => {
    await createOperator();
    await createRequest(VERIFICATION_POLICY.backlogDays + 2);

    const { push } = fakePush();
    const result = await alertOperators(deps(push));

    /*
     * 두 종류를 하나로 합쳐 세면, 파기가 줄어드는 사이 심사가 쌓여도
     * "숫자가 그대로"라 조용해진다.
     */
    expect(result.retention_due.dueCount).toBe(0);
    expect(result.verification_backlog.dueCount).toBe(1);
  });

  it('같은 상황을 곧바로 다시 보내지 않는다', async () => {
    await createOperator();
    await createRequest(VERIFICATION_POLICY.backlogDays + 2);

    await alertOperators(deps(fakePush().push));

    const second = fakePush();
    await alertOperators(deps(second.push));

    expect(second.sent).toHaveLength(0);
  });

  it('밀린 것이 늘면 곧바로 다시 보낸다', async () => {
    await createOperator();
    await createRequest(VERIFICATION_POLICY.backlogDays + 2);

    await alertOperators(deps(fakePush().push));

    await createRequest(VERIFICATION_POLICY.backlogDays + 1);

    const second = fakePush();
    await alertOperators(deps(second.push));

    expect(second.sent).toHaveLength(1);
    expect(second.sent[0]!.body).toContain('2건');
  });
});
