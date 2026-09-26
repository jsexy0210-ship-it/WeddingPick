import { CONSENT_ITEMS } from '@weddingpick/domain';
import type { PoolClient } from 'pg';

import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 약관 동의 제출(`POST /v1/me/signup`)이 DB를 몇 번 왕복하는가(2026-09-26 대표 지시 —
 * 「약관 동의 → 온보딩 이동 시 로딩이 발생한다. 로딩 시간을 대폭 감축한다」).
 *
 * 앱은 이 응답을 받아야 온보딩(`/setup`)으로 넘어간다 — 그 사이 화면은 멈춰 있다.
 * 전에는 여덟 동의를 **한 줄씩** 적었다: 항목마다 «공개된 판» 조회 한 번 + INSERT 한 번,
 * 합쳐 스물두 번을 차례로 기다렸다. DB가 API와 다른 곳에 있으면 그 왕복이 그대로 대기가 된다.
 *
 * 세는 시험으로 둔다 — 글로 적은 약속은 다음 사람이 한 줄 더하며 조용히 되돌린다.
 */
describeWithDb('약관 동의 제출의 DB 왕복', () => {
  let test: TestApp;

  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  /** 풀과 풀에서 빌린 연결의 query를 모두 센다. */
  function countQueries(): { count: () => number; restore: () => void } {
    let count = 0;
    const pool = test.pool;
    const originalQuery = pool.query.bind(pool);
    const originalConnect = pool.connect.bind(pool);

    (pool as unknown as { query: unknown }).query = (...args: unknown[]) => {
      count += 1;
      return (originalQuery as (...a: unknown[]) => unknown)(...args);
    };
    /* `pool.query`는 속에서 `connect(콜백)`을 부른다 — 그 길은 위에서 이미 셌으니 그대로 넘긴다. */
    (pool as unknown as { connect: unknown }).connect = async (...args: unknown[]) => {
      if (args.length > 0) return (originalConnect as (...a: unknown[]) => unknown)(...args);
      const client: PoolClient = await originalConnect();
      const clientQuery = client.query.bind(client);
      (client as unknown as { query: unknown }).query = (...args: unknown[]) => {
        count += 1;
        return (clientQuery as (...a: unknown[]) => unknown)(...args);
      };
      const release = client.release.bind(client);
      client.release = (err?: Error | boolean) => {
        (client as unknown as { query: unknown }).query = clientQuery;
        return release(err);
      };
      return client;
    };

    return {
      count: () => count,
      restore: () => {
        (pool as unknown as { query: unknown }).query = originalQuery;
        (pool as unknown as { connect: unknown }).connect = originalConnect;
      },
    };
  }

  it('여덟 동의를 모두 보내도 왕복은 항목 수와 무관하게 열 번 안이다 · 여덟 줄이 다 남는다', async () => {
    const session = await signInAs(test, 'apple-roundtrip', { completeSignup: false });
    const counter = countQueries();

    let response;
    try {
      response = await test.app.inject({
        method: 'POST',
        url: '/v1/me/signup',
        headers: session.headers,
        payload: { consents: CONSENT_ITEMS.map((item) => item.key) },
      });
    } finally {
      counter.restore();
    }

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ activated: true });
    if (process.env.PRINT_ROUNDTRIPS) process.stdout.write(`ROUNDTRIPS=${counter.count()}\n`);
    expect(counter.count()).toBeLessThanOrEqual(10);

    const { rows } = await test.pool.query<{ item: string }>(
      'SELECT item FROM structured.user_consents WHERE user_id = $1 ORDER BY item',
      [session.userId]
    );
    expect(rows.map((row) => row.item)).toEqual(CONSENT_ITEMS.map((item) => item.key).sort());
  });
});
