import { randomUUID } from 'node:crypto';

import { newEventId, recordDecision } from '../decisions';
import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 자동 결정 조회 HTTP API. `decisions-admin.ts`는 이전엔 `require.main ===
 * module` 관문이 없어 가져오기만 해도 CLI가 실행됐다 — 이번에 라우트로 열면서
 * 그 관문을 넣었다. 읽기 전용이라 도메인 함수 자체에는 `requireOperator`가
 * 필요 없고, HTTP 관문(`requireOperator` preHandler)만으로 충분하다.
 */
describeWithDb('자동 결정 조회 API', () => {
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

  async function aDecision(overrides: { execution?: 'succeeded' | 'pending' } = {}) {
    const eventId = newEventId();

    await recordDecision(test.pool, {
      eventId,
      workflow: 'vendor_claim',
      step: 'intake',
      subjectKind: 'vendor_claim',
      subjectId: randomUUID(),
      decider: { kind: 'rule', ruleVersion: 'v1' },
      decision: 'needs_human_check',
      reasonCode: 'domain_mismatch',
      evidence: [],
      execution: overrides.execution ?? 'pending',
    });

    return eventId;
  }

  it('운영자가 아니면 403이다', async () => {
    const session = await signInAs(test, `not-operator-${Math.random()}`);

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/decisions/briefing',
      headers: session.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('운영자는 브리핑·미해결 목록·사건 상세를 볼 수 있다', async () => {
    const operator = await anOperatorSession();
    const eventId = await aDecision();

    const briefing = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/decisions/briefing',
      headers: operator.headers,
    });

    expect(briefing.statusCode).toBe(200);
    const briefingRows = briefing.json<{
      briefing: { workflow: string; decisions: number }[];
    }>().briefing;
    expect(briefingRows.find((r) => r.workflow === 'vendor_claim')?.decisions).toBe(1);

    const open = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/decisions/open',
      headers: operator.headers,
    });

    expect(open.statusCode).toBe(200);
    expect(
      open.json<{ open: { workflow: string }[] }>().open.some((o) => o.workflow === 'vendor_claim')
    ).toBe(true);

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/admin/decisions/events/${eventId}`,
      headers: operator.headers,
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json<{ steps: { step: string }[] }>().steps).toHaveLength(1);
  });

  it('처리가 끝난 결정은 미해결 목록에서 빠진다', async () => {
    const operator = await anOperatorSession();
    await aDecision({ execution: 'succeeded' });

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/decisions/open',
      headers: operator.headers,
    });

    expect(response.json<{ open: unknown[] }>().open).toEqual([]);
  });

  it('없는 사건은 404다', async () => {
    const operator = await anOperatorSession();

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/admin/decisions/events/${randomUUID()}`,
      headers: operator.headers,
    });

    expect(response.statusCode).toBe(404);
  });
});
