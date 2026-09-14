import { deliver, type Deliverable } from '../notify/send';
import type { Push, PushMessage } from '../push/port';
import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

function fakePush() {
  const sent: PushMessage[] = [];

  const push: Push = {
    async send(messages) {
      sent.push(...messages);

      return messages.map((message) => ({ token: message.token, delivered: true }));
    },
  };

  return { push, sent };
}

/*
 * 한국시간을 UTC 순간으로 적는다. KST = UTC + 9이고 한국은 서머타임을 쓰지 않는다.
 *
 * 시험이 «21시»라고 적고 그것이 UTC 12시임을 눈으로 확인할 수 있게 헬퍼를 둔다 —
 * 여기서 시간대를 틀리면 아홉 시간 어긋난 시험이 통과한다.
 */
const KST_OFFSET_HOURS = 9;

function kst(day: string, hour: number, minute = 0): Date {
  return new Date(Date.UTC(...dateParts(day), hour - KST_OFFSET_HOURS, minute));
}

function dateParts(day: string): [number, number, number] {
  const [year, month, date] = day.split('-').map(Number);

  return [year as number, (month as number) - 1, date as number];
}

/**
 * 야간 수신. AGENTS.md «WP-NOTI-003 야간 수신 끔»(사용자 승인 2026-09-06) —
 * 한국시간 21:00 이상 ~ 다음 날 08:00 미만 푸시를 생략한다.
 *
 * **스위치만 만들면 «꺼놨는데 온다»가 된다.** 눌러도 아무 일이 없는 것보다 나쁘다.
 * 그래서 스위치가 아니라 **발송 결과**를 확인한다.
 */
describeWithDb('야간 수신', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function userWithDevice(subject = 'apple-night-1') {
    const { headers, userId } = await signInAs(test, subject);

    await test.pool.query(
      `INSERT INTO structured.device_tokens (user_id, token, platform)
       VALUES ($1, $2, 'ios')`,
      [userId, `expo-${userId}`]
    );

    return { headers, userId };
  }

  const item = (userId: string, dedupeKey: string): Deliverable => ({
    userId,
    kind: 'notice',
    topic: 'schedule',
    title: '드레스 투어 7일 전이에요',
    body: '일정을 확인해보세요',
    dedupeKey,
  });

  it('야간 수신을 끄면 밤 9시에 푸시를 보내지 않는다', async () => {
    const { userId } = await userWithDevice();
    const { push, sent } = fakePush();

    /* 기본이 꺼짐이다. 행을 만들지 않은 사람도 야간에는 조용하다. */
    const result = await deliver(
      { pool: test.pool, push, now: () => kst('2026-09-11', 21) },
      [item(userId, 'task_due:night:7')]
    );

    expect(result.pushed).toBe(0);
    expect(result.quieted).toBe(1);
    expect(sent).toHaveLength(0);
  });

  it('알림함은 유지한다 — 푸시만 생략한다', async () => {
    const { headers, userId } = await userWithDevice();
    const { push } = fakePush();

    const result = await deliver(
      { pool: test.pool, push, now: () => kst('2026-09-11', 23, 30) },
      [item(userId, 'task_due:box:7')]
    );

    expect(result.stored).toBe(1);

    /*
     * 밤에 생긴 일도 아침에 열어보면 다 있다. 스위치는 «밀어서 알려줄지»를 정하는
     * 값이지 결과를 감추는 값이 아니다.
     */
    const list = await test.app.inject({ method: 'GET', url: '/v1/me/notifications', headers });
    const body = list.json<{ notifications: { title: string }[]; unread: number }>();

    expect(body.notifications.map((one) => one.title)).toContain('드레스 투어 7일 전이에요');
    expect(body.unread).toBe(1);
  });

  it('아침이 되어도 밤에 생략한 푸시를 다시 보내지 않는다', async () => {
    const { userId } = await userWithDevice();
    const { push, sent } = fakePush();
    const night = item(userId, 'task_due:morning:7');

    await deliver({ pool: test.pool, push, now: () => kst('2026-09-11', 22) }, [night]);

    /*
     * 아침 9시에 같은 일을 다시 돌린다. 워커는 실제로 이렇게 돈다.
     *
     * 생략한 푸시를 어디에도 쌓지 않으므로 아침에 보낼 것이 없다 — 같은 열쇠는
     * «건너뜀»이 되고 푸시는 0이다. 여기가 «밤에 안 받겠다»와 «아침에 몰아
     * 받겠다»가 갈리는 자리다.
     */
    const morning = await deliver(
      { pool: test.pool, push, now: () => kst('2026-09-12', 9) },
      [night]
    );

    expect(morning.skipped).toBe(1);
    expect(morning.stored).toBe(0);
    expect(morning.pushed).toBe(0);
    expect(sent).toHaveLength(0);

    /* 알림함에도 한 줄만 남는다. 두 번 돌았다고 두 줄이 되지 않는다. */
    const stored = await test.pool.query(
      'SELECT count(*) AS count FROM structured.notifications WHERE user_id = $1',
      [userId]
    );

    expect(Number(stored.rows[0].count)).toBe(1);
  });

  it('야간 수신을 켜면 밤에도 보낸다', async () => {
    const { headers, userId } = await userWithDevice();
    const { push, sent } = fakePush();

    await test.app.inject({
      method: 'PUT',
      url: '/v1/me/settings',
      headers,
      payload: { nightPushEnabled: true },
    });

    const result = await deliver(
      { pool: test.pool, push, now: () => kst('2026-09-11', 21) },
      [item(userId, 'task_due:on:7')]
    );

    expect(result.quieted).toBe(0);
    expect(result.pushed).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it('낮에는 야간 수신을 꺼도 보낸다', async () => {
    const { userId } = await userWithDevice();
    const { push } = fakePush();

    /* 20:59 KST는 아직 야간이 아니다. 경계를 한 시간 넓게 잡으면 여기서 걸린다. */
    const result = await deliver(
      { pool: test.pool, push, now: () => kst('2026-09-11', 20, 59) },
      [item(userId, 'task_due:day:7')]
    );

    expect(result.pushed).toBe(1);
    expect(result.quieted).toBe(0);
  });

  it('08:00 KST부터 다시 보낸다 — 끝은 미만이다', async () => {
    const { userId } = await userWithDevice();
    const { push } = fakePush();

    const before = await deliver(
      { pool: test.pool, push, now: () => kst('2026-09-12', 7, 59) },
      [item(userId, 'task_due:0759:7')]
    );

    expect(before.quieted).toBe(1);

    const after = await deliver(
      { pool: test.pool, push, now: () => kst('2026-09-12', 8) },
      [item(userId, 'task_due:0800:7')]
    );

    expect(after.pushed).toBe(1);
    expect(after.quieted).toBe(0);
  });
});
