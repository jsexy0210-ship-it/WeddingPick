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
