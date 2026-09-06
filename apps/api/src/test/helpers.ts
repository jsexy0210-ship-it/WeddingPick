import type { Extraction } from '../analysis/schema';
import { resetSchema } from '@weddingpick/db';
import { REQUIRED_CONSENTS } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import { Client, Pool } from 'pg';

import type { IdentityProvider, VerifiedIdentity } from '../auth/identity-provider';
import type { Mail } from '../auth/mailer';
import type { Config } from '../config';
import type { AppContext } from '../context';
import { buildServer } from '../server';
import { createLocalStorage } from '../storage/local';

export const connectionString = process.env.DATABASE_URL;

/** 제공자를 부르지 않고 신원을 정해준다. 실제 Apple·Kakao 검증은 여기서 확인하지 않는다. */
export function fakeProvider(identity: VerifiedIdentity): IdentityProvider {
  return { flow: 'id_token', verify: async () => identity };
}

export type TestApp = {
  app: FastifyInstance;
  pool: Pool;
  context: AppContext;
  /** 가짜 mailer가 잡아둔 메일. */
  mails: Mail[];
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
    analysisModel: 'test-analysis',
    corsOrigins: [],
    retentionMode: 'manual',
    retentionReminderHours: 24,
    proofReaderCheapModel: 'claude-haiku-4-5',
    proofReaderStrongModel: 'claude-opus-5',
    naverRedirectUris: [],
    mail: { driver: 'console' },
    passwordResetUrl: 'https://app.test/reset-password',
  };

  /* 보내지 않고 잡아둔다 — 테스트가 링크의 토큰을 꺼내 쓴다. */
  const mails: Mail[] = [];

  const context: AppContext = {
    pool,
    mailer: {
      async send(mail) {
        mails.push(mail);
      },
    },
    /*
     * 테스트에서는 모델을 부르지 않는다. 실제 호출은 돈이 들고 결과가 매번 다르다.
     * 부르려 하면 여기서 터져, 어느 테스트가 모델을 부르려 했는지 바로 드러난다.
     */
    proofReader: {
      async read() {
        throw new Error('테스트에서 결제내역 읽기 모델을 불렀다. 가짜를 끼워라.');
      },
    },
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
    mails,
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
    await resetSchema(client);
  } finally {
    await client.end();
  }
}

/**
 * 로그인해서 Authorization 헤더를 만든다.
 *
 * **가입까지 마친다.** 통합정책 v3.13 §N-2가 소셜 로그인 성공만으로 가입을
 * 끝내지 못하게 했으므로, 실전에서 로그인 뒤에 곧바로 오는 것이 동의 화면이다.
 * 여기서 같이 해주지 않으면 모든 시험이 대기 계정으로 돌아 실제와 달라진다.
 *
 * 대기 상태 자체를 보는 시험은 `completeSignup: false`로 부른다.
 */
export async function signInAs(
  test: TestApp,
  subject = 'apple-user-1',
  options: { completeSignup?: boolean } = {}
): Promise<{ token: string; userId: string; headers: Record<string, string> }> {
  test.context.providers.apple = fakeProvider({ provider: 'apple', subject });

  const response = await test.app.inject({
    method: 'POST',
    url: '/v1/auth/sessions',
    payload: { provider: 'apple', idToken: 'whatever' },
  });

  const body = response.json<{ token: string; userId: string }>();
  const headers = { authorization: `Bearer ${body.token}` };

  if (options.completeSignup !== false) {
    await test.app.inject({
      method: 'POST',
      url: '/v1/me/signup',
      headers,
      payload: { birthDate: '1995-03-15', consents: REQUIRED_CONSENTS },
    });
  }

  return { token: body.token, userId: body.userId, headers };
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

/**
 * 결제인증에 동의한다.
 *
 * 등록 경로가 동의를 요구하므로(핸드오프 10·19번), 결제내역을 넣는 테스트는
 * 이걸 먼저 불러야 실제와 같아진다 — 실전에서도 동의한 사람만 등록한다.
 */
export async function consentToPaymentProofs(
  test: TestApp,
  headers: Record<string, string>
): Promise<void> {
  const response = await test.app.inject({
    method: 'POST',
    url: '/v1/me/payment-consent',
    headers,
  });

  if (response.statusCode !== 200) {
    throw new Error(`동의를 남기지 못했다: ${response.statusCode}`);
  }
}

/** 로그인하고 실제가격 열람 자격까지 얻는다. 가격을 보는 테스트가 쓴다. */
export async function signInUnlocked(test: TestApp, subject?: string) {
  const session = await signInAs(test, subject);

  await unlockPrices(test, session.userId);

  return session;
}

/**
 * 분석 결과 한 벌. 관문·워커 테스트가 함께 쓴다.
 *
 * 스키마가 요구하는 칸이 많아 테스트마다 새로 지으면 빠뜨린 칸에서 터진다 —
 * 그러면 실제로 보려던 것과 상관없는 곳에서 실패한다.
 */
export function extractionFixture(overrides: Partial<Extraction> = {}): Extraction {
  return {
    documentKind: 'contract',
    documentKindConfidence: 0.95,
    unreadable: false,
    vendorName: { value: '테스트홀', confidence: 0.9 },
    plannerName: { value: null, confidence: 0 },
    productName: { value: '기본 패키지', confidence: 0.8 },
    totalAmount: { value: 3_280_000, confidence: 0.55 },
    discountAmount: { value: 200_000, confidence: 0.7 },
    depositAmount: { value: 500_000, confidence: 0.8 },
    balanceAmount: { value: 2_780_000, confidence: 0.8 },
    contractDate: { value: '2026-05-01', confidence: 0.9 },
    weddingDate: { value: '2027-03-20', confidence: 0.9 },
    hallName: { value: null, confidence: 0 },
    guaranteedGuests: { value: null, confidence: 0 },
    mealPricePerPerson: { value: null, confidence: 0 },
    subVendors: [
      { role: 'studio', name: '세컨드플로어', amount: 1_150_000 },
      { role: 'dress', name: '메종드로브', amount: 1_300_000 },
      { role: 'makeup', name: '제니하우스 청담', amount: 980_000 },
    ],
    lineItems: [
      { kind: 'included', label: '대관료', amount: 2_000_000, amountMin: null, amountMax: null, note: null },
      { kind: 'additional_candidate', label: '조명 추가', amount: null, amountMin: null, amountMax: null, note: '현장 결제' },
    ],
    terms: [
      { category: 'refund', body: '계약금은 환불되지 않습니다.', flagged: true, daysBeforeWedding: null, penaltyRate: null },
      { category: 'schedule', body: '날짜 변경은 1회 가능합니다.', flagged: false, daysBeforeWedding: null, penaltyRate: null },
    ],
    personalInfoKinds: ['name', 'phone'],
    ...overrides,
  };
}
