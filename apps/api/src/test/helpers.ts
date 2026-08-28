import { migrate } from '@weddingpick/db';
import type { FastifyInstance } from 'fastify';
import { Client, Pool } from 'pg';

import type { IdentityProvider, VerifiedIdentity } from '../auth/identity-provider';
import type { Config } from '../config';
import type { AppContext } from '../context';
import { buildServer } from '../server';
import { createLocalStorage } from '../storage/local';

export const connectionString = process.env.DATABASE_URL;

/** 제공자를 부르지 않고 신원을 정해준다. 실제 Apple·Kakao 검증은 여기서 확인하지 않는다. */
export function fakeProvider(identity: VerifiedIdentity): IdentityProvider {
  return { verify: async () => identity };
}

export type TestApp = {
  app: FastifyInstance;
  pool: Pool;
  context: AppContext;
  close(): Promise<void>;
};

export async function createTestApp(): Promise<TestApp> {
  if (!connectionString) {
    throw new Error('DATABASE_URL이 필요하다.');
  }

  const pool = new Pool({ connectionString, max: 4 });

  const config: Config = {
    databaseUrl: connectionString,
    port: 0,
    sessionTtlDays: 30,
    storage: { driver: 'local' },
    corsOrigins: [],
    retentionMode: 'manual',
    retentionReminderHours: 24,
  };

  const context: AppContext = {
    pool,
    config,
    storage: createLocalStorage(),
    providers: {
      apple: fakeProvider({ provider: 'apple', subject: 'apple-user-1' }),
      kakao: fakeProvider({ provider: 'kakao', subject: 'kakao-user-1' }),
    },
  };

  const app = buildServer(context);
  await app.ready();

  return {
    app,
    pool,
    context,
    async close() {
      await app.close();
      await pool.end();
    },
  };
}

/** 매 테스트마다 빈 스키마에서 시작한다. */
export async function resetDatabase(): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('DROP OWNED BY CURRENT_USER CASCADE');
    await migrate(client);
  } finally {
    await client.end();
  }
}

/** 로그인해서 Authorization 헤더를 만든다. */
export async function signInAs(
  test: TestApp,
  subject = 'apple-user-1'
): Promise<{ token: string; userId: string; headers: Record<string, string> }> {
  test.context.providers.apple = fakeProvider({ provider: 'apple', subject });

  const response = await test.app.inject({
    method: 'POST',
    url: '/v1/auth/sessions',
    payload: { provider: 'apple', idToken: 'whatever' },
  });

  const body = response.json<{ token: string; userId: string }>();

  return {
    token: body.token,
    userId: body.userId,
    headers: { authorization: `Bearer ${body.token}` },
  };
}

/** 로그인한 사용자의 웨딩 하나. */
export async function createWedding(test: TestApp, headers: Record<string, string>) {
  const response = await test.app.inject({
    method: 'POST',
    url: '/v1/weddings',
    headers,
    payload: {},
  });

  return response.json<{ id: string }>().id;
}

/**
 * 개인정보 재검토를 마쳤다고 표시한다.
 *
 * 서비스정책서 4번대로, 검토를 받지 않은 문서는 남들이 보는 면(시장 대표가격,
 * 비교표)으로 가지 않는다. 그래서 "비교에 잡히는 문서"를 심는 테스트는 이걸
 * 함께 해줘야 실제와 같아진다 — 실전에서도 사람이 한 번 본 뒤에야 잡힌다.
 */
export async function markPiiReviewed(test: TestApp, quoteIds: readonly string[]): Promise<void> {
  if (quoteIds.length === 0) return;

  const reviewer = await test.pool.query<{ id: string }>(
    'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
  );

  await test.pool.query(
    `UPDATE structured.quotes
     SET pii_review = 'clean', pii_reviewed_at = now(), pii_reviewed_by = $2
     WHERE id = ANY($1::uuid[])`,
    [quoteIds, reviewer.rows[0]!.id]
  );
}

/** 어느 웨딩에도 매이지 않은 시장 표본 전체를 검토 완료로. */
export async function markAllPiiReviewed(test: TestApp): Promise<void> {
  const reviewer = await test.pool.query<{ id: string }>(
    'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
  );

  await test.pool.query(
    `UPDATE structured.quotes
     SET pii_review = 'clean', pii_reviewed_at = now(), pii_reviewed_by = $1
     WHERE pii_review = 'pending'`,
    [reviewer.rows[0]!.id]
  );
}

/**
 * 실제가격을 볼 자격을 준다. 사업계획서 v3 7번 Level 3.
 *
 * 결제인증 제보를 한 건 넣는다. 가격을 보는 테스트는 이걸 함께 해줘야 실제와
 * 같아진다 — 실전에서도 자료를 낸 사람만 자료를 본다.
 */
export async function unlockPrices(test: TestApp, userId: string): Promise<void> {
  const vendor = await test.pool.query<{ id: string }>(
    `INSERT INTO structured.vendors (name, category, region, source)
     VALUES ('열쇠용 업체 ' || gen_random_uuid(), 'etc', '서울', 'public_data')
     RETURNING id`
  );

  await test.pool.query(
    `INSERT INTO structured.payment_proofs
       (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
     VALUES ($1, $2, '열쇠용 결제', 100000, now())`,
    [userId, vendor.rows[0]!.id]
  );
}

/** 로그인하고 실제가격 열람 자격까지 얻는다. 가격을 보는 테스트가 쓴다. */
export async function signInUnlocked(test: TestApp, subject?: string) {
  const session = await signInAs(test, subject);

  await unlockPrices(test, session.userId);

  return session;
}
