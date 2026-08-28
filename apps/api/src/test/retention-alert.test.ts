import { RETENTION_POLICY } from '@weddingpick/domain';

import { alertOperators } from '../retention/alert';
import type { Push, PushMessage, PushOutcome } from '../push/port';
import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/** 보낸 것을 기억하는 가짜 푸시. 결과는 테스트가 정한다. */
function fakePush(outcomeFor: (token: string) => PushOutcome = (token) => ({
  token,
  delivered: true,
})) {
  const sent: PushMessage[] = [];

  const push: Push = {
    async send(messages) {
      sent.push(...messages);

      return messages.map((message) => outcomeFor(message.token));
    },
  };

  return { push, sent };
}

describeWithDb('파기 일정 알림', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function createUser({ operator = false } = {}) {
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users (is_operator) VALUES ($1) RETURNING id',
      [operator]
    );

    return rows[0]!.id;
  }

  async function registerDevice(userId: string, token: string) {
    await test.pool.query(
      `INSERT INTO structured.device_tokens (user_id, token, platform)
       VALUES ($1, $2, 'ios')`,
      [userId, token]
    );
  }

  /**
   * 파기 예정일이 지난 원본 하나.
   *
   * 예정일은 저장하지 않고 계산한다(0018). 아무 일도 없는 문서는 업로드가
   * 기준이므로, 보관 일수보다 그만큼 더 오래된 것으로 만든다.
   */
  async function createDueDocument(ownerId: string, daysOverdue = 2) {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO originals.raw_documents
         (owner_user_id, page_count, uploaded_at, personal_info_kinds)
       VALUES ($1, 1, now() - ($2 || ' days')::interval, ARRAY['name']) RETURNING id`,
      [ownerId, String(RETENTION_POLICY.originalDays + daysOverdue)]
    );

    return rows[0]!.id;
  }

  const deps = (push: Push) => ({ pool: test.pool, push, reminderAfterHours: 24 });

  it('운영자에게만 간다', async () => {
    const operator = await createUser({ operator: true });
    const member = await createUser();

    await registerDevice(operator, 'ExponentPushToken[operator]');
    await registerDevice(member, 'ExponentPushToken[member]');
    await createDueDocument(member);

    const { push, sent } = fakePush();
    const result = (await alertOperators(deps(push))).retention_due;

    // 파기 대상은 일반 사용자의 문서지만, 그 사실을 그 사람에게 알리는 것은
    // 우리 일이 아니다. 사용자는 앱 화면에서 예정일을 본다.
    expect(sent.map((message) => message.token)).toEqual(['ExponentPushToken[operator]']);
    expect(result).toMatchObject({ dueCount: 1, notified: 1, delivered: 1 });
  });

  it('푸시 본문에 개인정보를 담지 않는다', async () => {
    const operator = await createUser({ operator: true });

    await registerDevice(operator, 'ExponentPushToken[operator]');
    await createDueDocument(operator);

    const { push, sent } = fakePush();
    (await alertOperators(deps(push))).retention_due;

    // 푸시는 잠금화면에 뜬다. 파기해야 할 개인정보를 알리려다 흘리면 안 된다.
    const text = `${sent[0]!.title} ${sent[0]!.body}`;

    expect(text).not.toContain(operator);
    expect(text).toContain('1건');
  });

  it('지울 것이 없으면 보내지 않는다', async () => {
    const operator = await createUser({ operator: true });

    await registerDevice(operator, 'ExponentPushToken[operator]');

    const { push, sent } = fakePush();

    expect((await alertOperators(deps(push))).retention_due).toMatchObject({ dueCount: 0, notified: 0 });
    expect(sent).toHaveLength(0);
  });

  it('같은 상황을 곧바로 다시 보내지 않는다', async () => {
    const operator = await createUser({ operator: true });

    await registerDevice(operator, 'ExponentPushToken[operator]');
    await createDueDocument(operator);

    const first = fakePush();
    await alertOperators(deps(first.push));

    const second = fakePush();
    await alertOperators(deps(second.push));

    // 10분마다 같은 말을 하면 사람은 알림을 끈다. 그러면 알림이 있으나 마나가 된다.
    expect(second.sent).toHaveLength(0);
  });

  it('일이 늘면 곧바로 다시 보낸다', async () => {
    const operator = await createUser({ operator: true });

    await registerDevice(operator, 'ExponentPushToken[operator]');
    await createDueDocument(operator);

    await alertOperators(deps(fakePush().push));

    await createDueDocument(operator);

    const second = fakePush();
    await alertOperators(deps(second.push));

    expect(second.sent).toHaveLength(1);
    expect(second.sent[0]!.body).toContain('2건');
  });

  it('기기가 없어도 기록을 남겨 매번 다시 쏘지 않는다', async () => {
    const operator = await createUser({ operator: true });

    await createDueDocument(operator);

    const result = (await alertOperators(deps(fakePush().push))).retention_due;

    // 닿지 못했다는 사실이 드러나야 하지만, 그렇다고 10분마다 다시 시도하면
    // 발송이 무한히 반복된다.
    expect(result).toMatchObject({ notified: 1, delivered: 0 });

    const second = fakePush();
    await alertOperators(deps(second.push));

    expect(second.sent).toHaveLength(0);
  });

  it('기기가 사라졌다고 하면 그 토큰을 끈다', async () => {
    const operator = await createUser({ operator: true });

    await registerDevice(operator, 'ExponentPushToken[gone]');
    await createDueDocument(operator);

    const { push } = fakePush((token) => ({
      token,
      delivered: false,
      error: 'DeviceNotRegistered',
    }));

    expect((await alertOperators(deps(push))).retention_due).toMatchObject({ disabledTokens: 1 });

    const { rows } = await test.pool.query<{ disabled_reason: string | null }>(
      'SELECT disabled_reason FROM structured.device_tokens WHERE token = $1',
      ['ExponentPushToken[gone]']
    );

    expect(rows[0]!.disabled_reason).toBe('DeviceNotRegistered');
  });

  it('일시적인 실패로는 토큰을 끄지 않는다', async () => {
    const operator = await createUser({ operator: true });

    await registerDevice(operator, 'ExponentPushToken[busy]');
    await createDueDocument(operator);

    const { push } = fakePush((token) => ({
      token,
      delivered: false,
      error: 'MessageRateExceeded',
    }));

    // 한 번 끄면 그 기기는 다시 등록하기 전까지 알림을 못 받는다.
    expect((await alertOperators(deps(push))).retention_due).toMatchObject({ disabledTokens: 0 });
  });

  it('방금 올린 문서로는 알리지 않는다', async () => {
    const operator = await createUser({ operator: true });

    await registerDevice(operator, 'ExponentPushToken[operator]');
    await test.pool.query(
      'INSERT INTO originals.raw_documents (owner_user_id, page_count) VALUES ($1, 1)',
      [operator]
    );

    const { push, sent } = fakePush();

    expect((await alertOperators(deps(push))).retention_due).toMatchObject({ dueCount: 0 });
    expect(sent).toHaveLength(0);
  });

  it('심사가 열려 있는 문서로는 알리지 않는다', async () => {
    const operator = await createUser({ operator: true });

    await registerDevice(operator, 'ExponentPushToken[operator]');

    const documentId = await createDueDocument(operator, 400);
    const wedding = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
      [operator]
    );
    const quote = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.quotes (wedding_id, raw_document_id, source)
       VALUES ($1, $2, 'ai_extraction') RETURNING id`,
      [wedding.rows[0]!.id, documentId]
    );
    const request = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.verification_requests (quote_id, requested_by, target_level)
       VALUES ($1, $2, 'L2') RETURNING id`,
      [quote.rows[0]!.id, operator]
    );
    await test.pool.query(
      `INSERT INTO structured.verification_evidence (request_id, kind, raw_document_id)
       VALUES ($1, 'contract_document', $2)`,
      [request.rows[0]!.id, documentId]
    );

    const { push, sent } = fakePush();

    /*
     * 400일이 지났어도 심사가 열려 있으면 셈이 시작되지 않는다. 그래서 알림도
     * 오지 않는다 — 조용한 것을 안전하다고 읽으면 안 되는 이유다. 이 상태는
     * retention_held_for_verification에 따로 드러난다.
     */
    expect((await alertOperators(deps(push))).retention_due).toMatchObject({ dueCount: 0 });
    expect(sent).toHaveLength(0);

    const { rows } = await test.pool.query(
      'SELECT 1 FROM originals.retention_held_for_verification'
    );

    expect(rows).toHaveLength(1);
  });
});
