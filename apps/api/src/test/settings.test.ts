import type { LocalStorage } from '../storage/local';
import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

type Settings = {
  pushEnabled: boolean;
  priceChangeEnabled: boolean;
  nightPushEnabled: boolean;
  marketingEnabled: boolean;
  marketingConsentAt: string | null;
  paymentConsent: boolean;
  paymentConsentAt: string | null;
  weddingDate: string | null;
  spouseLinked: boolean;
};

/**
 * 설정. 디자인 핸드오프 19번.
 *
 * 스위치는 **보내는 쪽이 보는 값**이어야 한다 — 끌 수 있게 만들어놓고 보내는 쪽이
 * 안 보면 그 스위치는 장식이다.
 */
describeWithDb('설정', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  const get = async (headers: Record<string, string>) =>
    (await test.app.inject({ method: 'GET', url: '/v1/me/settings', headers })).json<Settings>();

  const put = (headers: Record<string, string>, payload: Record<string, boolean>) =>
    test.app.inject({ method: 'PUT', url: '/v1/me/settings', headers, payload });

  it('설정을 만든 적이 없어도 기본값을 준다', async () => {
    /*
     * 로그인한 모든 사람에게 미리 행을 만들지 않는다 — 회원 수만큼 쓸모없는 행이
     * 쌓이고, 기본값을 바꾸려면 그 행들을 전부 손봐야 한다.
     */
    const { headers } = await signInAs(test);

    const settings = await get(headers);

    expect(settings.pushEnabled).toBe(true);
    expect(settings.priceChangeEnabled).toBe(true);

    const stored = await test.pool.query('SELECT 1 FROM structured.notification_settings');
    expect(stored.rows).toHaveLength(0);
  });

  it('보낸 값만 바꾼다', async () => {
    /*
     * 스위치 하나를 눌렀는데 다른 하나가 기본값으로 되돌아가면, 사용자는 자기가
     * 무엇을 눌렀는지 믿을 수 없게 된다.
     */
    const { headers } = await signInAs(test);

    await put(headers, { priceChangeEnabled: false });
    await put(headers, { pushEnabled: false });

    const settings = await get(headers);

    expect(settings.pushEnabled).toBe(false);
    expect(settings.priceChangeEnabled).toBe(false);
  });

  it('다시 켤 수 있다', async () => {
    const { headers } = await signInAs(test);

    await put(headers, { pushEnabled: false });
    await put(headers, { pushEnabled: true });

    expect((await get(headers)).pushEnabled).toBe(true);
  });

  it('예식일과 배우자 상태를 함께 준다', async () => {
    const owner = await signInAs(test, 'owner-user');
    const weddingId = await createWedding(test, owner.headers);

    const invite = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/invites`,
      headers: owner.headers,
    });

    const partner = await signInAs(test, 'partner-user');
    await test.app.inject({
      method: 'POST',
      url: '/v1/wedding-invites/accept',
      headers: partner.headers,
      payload: { code: invite.json<{ code: string }>().code },
    });

    expect((await get(owner.headers)).spouseLinked).toBe(true);
  });

  it('남의 설정을 보지 않는다', async () => {
    const other = await signInAs(test, 'other-user');
    await put(other.headers, { pushEnabled: false });

    const me = await signInAs(test, 'me');

    expect((await get(me.headers)).pushEnabled).toBe(true);
  });

  it('로그인해야 볼 수 있다', async () => {
    expect(
      (await test.app.inject({ method: 'GET', url: '/v1/me/settings' })).statusCode
    ).toBe(401);
  });

  /*
   * 야간 수신. 시안 13-my-sub WP-MY-007이 이 스위치를 **꺼진 상태로** 그렸고,
   * 정책(AGENTS.md)은 꺼져 있을 때 밤에 푸시를 생략한다.
   *
   * 다른 두 스위치는 «행이 없으면 켜진 것»이라 반대다. 기본값이 반대인 칸은
   * 읽는 쪽과 쓰는 쪽이 갈리기 쉬워 양쪽을 함께 못박는다.
   */
  it('야간 수신은 기본이 꺼짐이다', async () => {
    const { headers } = await signInAs(test);

    expect((await get(headers)).nightPushEnabled).toBe(false);

    /* 다른 스위치를 눌러 행이 생겨도 꺼진 채로 있다. */
    await put(headers, { pushEnabled: false });

    expect((await get(headers)).nightPushEnabled).toBe(false);
  });

  it('야간 수신을 켜고 끌 수 있다', async () => {
    const { headers } = await signInAs(test);

    await put(headers, { nightPushEnabled: true });
    expect((await get(headers)).nightPushEnabled).toBe(true);

    /* 다른 스위치를 눌러도 되돌아가지 않는다. */
    await put(headers, { priceChangeEnabled: false });
    expect((await get(headers)).nightPushEnabled).toBe(true);

    await put(headers, { nightPushEnabled: false });
    expect((await get(headers)).nightPushEnabled).toBe(false);
  });
});

/**
 * 마케팅 알림. 시안 13-my-sub WP-MY-007 «알림 수신» — 혜택 · 이벤트.
 *
 * **불리언 한 칸이 아니라 동의 이력이다.** 법적 동의 항목이라 켠 시각과 끈 시각에
 * 답할 수 있어야 하고, 마지막 상태만 남기면 그 답을 지운다.
 */
describeWithDb('마케팅 알림 동의', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  const get = async (headers: Record<string, string>) =>
    (await test.app.inject({ method: 'GET', url: '/v1/me/settings', headers })).json<Settings>();

  const put = (headers: Record<string, string>, payload: Record<string, boolean>) =>
    test.app.inject({ method: 'PUT', url: '/v1/me/settings', headers, payload });

  const consentRows = async (userId: string) =>
    (
      await test.pool.query<{ granted_at: Date; withdrawn_at: Date | null }>(
        `SELECT granted_at, withdrawn_at FROM structured.user_consents
         WHERE user_id = $1 AND item = 'marketing' ORDER BY granted_at`,
        [userId]
      )
    ).rows;

  it('선택 동의라 기본이 꺼짐이다', async () => {
    /* `signInAs`는 필수 동의만 남긴다. 선택 항목을 대신 켜주지 않는다(§N-2). */
    const { headers } = await signInAs(test);
    const settings = await get(headers);

    expect(settings.marketingEnabled).toBe(false);
    expect(settings.marketingConsentAt).toBeNull();
  });

  it('켜면 동의한 시각이 남는다', async () => {
    const { headers, userId } = await signInAs(test);

    await put(headers, { marketingEnabled: true });

    const settings = await get(headers);

    expect(settings.marketingEnabled).toBe(true);
    expect(settings.marketingConsentAt).not.toBeNull();

    const rows = await consentRows(userId);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.withdrawn_at).toBeNull();
  });

  it('끄면 지우지 않고 철회 시각을 적는다', async () => {
    const { headers, userId } = await signInAs(test);

    await put(headers, { marketingEnabled: true });
    await put(headers, { marketingEnabled: false });

    const settings = await get(headers);

    expect(settings.marketingEnabled).toBe(false);
    expect(settings.marketingConsentAt).toBeNull();

    /*
     * 줄이 사라지면 «언제 껐는지»에 답할 수 없다. 동의했던 사실 자체가 없던 일이
     * 되는 것이라, 법적 동의 항목에서는 지우는 것이 가장 나쁜 선택이다.
     */
    const rows = await consentRows(userId);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.withdrawn_at).not.toBeNull();
  });

  it('다시 켜면 새 줄이 쌓인다 — 이력이 덮이지 않는다', async () => {
    const { headers, userId } = await signInAs(test);

    await put(headers, { marketingEnabled: true });
    await put(headers, { marketingEnabled: false });
    await put(headers, { marketingEnabled: true });

    expect((await get(headers)).marketingEnabled).toBe(true);

    const rows = await consentRows(userId);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.withdrawn_at).not.toBeNull();
    expect(rows[1]?.withdrawn_at).toBeNull();
  });

  it('두 번 켜도 처음 동의한 시각을 지킨다', async () => {
    const { headers, userId } = await signInAs(test);

    await put(headers, { marketingEnabled: true });
    const first = (await get(headers)).marketingConsentAt;

    await put(headers, { marketingEnabled: true });

    expect((await get(headers)).marketingConsentAt).toBe(first);
    expect(await consentRows(userId)).toHaveLength(1);
  });

  it('보내지 않으면 건드리지 않는다', async () => {
    const { headers, userId } = await signInAs(test);

    await put(headers, { marketingEnabled: true });
    await put(headers, { pushEnabled: false });

    expect((await get(headers)).marketingEnabled).toBe(true);
    expect(await consentRows(userId)).toHaveLength(1);
  });
});

/**
 * 결제인증 동의. 핸드오프 10번(최초 1회) · 19번(철회).
 *
 * 동의를 어딘가에 남겨야 둘 다 할 수 있다. 화면만 지나가게 두면 "동의했다"는
 * 사실이 어디에도 없고, 철회는 지울 것이 없는 단추가 된다.
 */
describeWithDb('결제인증 동의', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  const grant = (headers: Record<string, string>) =>
    test.app.inject({ method: 'POST', url: '/v1/me/payment-consent', headers });

  const revoke = (headers: Record<string, string>) =>
    test.app.inject({ method: 'DELETE', url: '/v1/me/payment-consent', headers });

  /**
   * 사진 한 장을 올려 등록한다(v3.24). 금액을 보낼 자리가 없어 읽기가 먼저 돈다.
   *
   * **동의 관문을 두 번 지난다** — 올릴 때 한 번(`/v1/documents/uploads`), 등록할
   * 때 한 번. 철회한 사람에게는 올리는 쪽이 먼저 막히므로, 여기서 보는 것은
   * 「등록까지 갔는가」가 아니라 「어디서든 막혔는가」다.
   */
  async function register(headers: Record<string, string>) {
    test.context.proofReader.read = async (_images, model) => ({
      model,
      usage: { inputTokens: 10, outputTokens: 10, cachedInputTokens: 0 },
      reading: {
        merchantName: '가온예식홀',
        paidAmount: 3_000_000,
        paidAt: '2026-05-20T04:00:00.000Z',
        method: 'card' as const,
        maskedIdentifiers: [],
        rejection: null,
        confidence: 0.95,
      },
    });

    const weddingId = await createWedding(test, headers);
    const upload = await test.app.inject({
      method: 'POST',
      url: '/v1/documents/uploads',
      headers,
      payload: {
        weddingId,
        kind: 'payment_proof',
        pages: [{ mimeType: 'image/jpeg', sizeBytes: 1000 }],
      },
    });

    // 동의가 없으면 올리는 쪽에서 이미 막힌다. 그 상태를 그대로 돌려준다.
    if (upload.statusCode >= 400) return upload;

    const rawDocumentId = upload.json<{ rawDocumentId: string }>().rawDocumentId;
    const pages = await test.pool.query<{ storage_key: string }>(
      'SELECT storage_key FROM originals.raw_document_pages WHERE raw_document_id = $1',
      [rawDocumentId]
    );

    for (const page of pages.rows) {
      (test.context.storage as LocalStorage).put(page.storage_key, Buffer.from('receipt'));
    }

    return test.app.inject({
      method: 'POST',
      url: '/v1/payment-proofs',
      headers,
      payload: { rawDocumentId },
    });
  }

  it('동의 없이는 등록할 수 없다', async () => {
    /*
     * 관문은 뷰 하나다. 화면이 동의 화면을 지나게 하는 것으로 충분하다고 두면,
     * 철회한 사람이 옛 화면을 열어둔 채 등록하는 길이 남는다.
     */
    const { headers } = await signInAs(test);

    expect((await register(headers)).statusCode).toBe(403);
  });

  it('동의하면 등록할 수 있다', async () => {
    const { headers } = await signInAs(test);

    await grant(headers);

    expect((await register(headers)).statusCode).toBe(201);
  });

  it('두 번 눌러도 한 번만 남는다', async () => {
    // 핸드오프 10번 — 최초 1회만.
    const { headers } = await signInAs(test);

    await grant(headers);
    await grant(headers);

    const stored = await test.pool.query('SELECT 1 FROM structured.payment_consents');
    expect(stored.rows).toHaveLength(1);
  });

  it('철회하면 다시 막힌다', async () => {
    const { headers } = await signInAs(test);

    await grant(headers);
    expect((await revoke(headers)).statusCode).toBe(200);

    expect((await register(headers)).statusCode).toBe(403);
  });

  it('철회해도 기록은 지우지 않는다', async () => {
    /*
     * 언제 동의했고 언제 철회했는지는 나중에 물어볼 수 있는 질문이고, 덮어쓰면
     * 답할 수 없다.
     */
    const { headers } = await signInAs(test);

    await grant(headers);
    await revoke(headers);

    const { rows } = await test.pool.query<{ granted_at: Date; revoked_at: Date | null }>(
      'SELECT granted_at, revoked_at FROM structured.payment_consents'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.revoked_at).not.toBeNull();
  });

  it('철회해도 이미 낸 자료는 남는다', async () => {
    /*
     * 그건 다른 일이다(내 제보 내역에서 지운다). 철회 한 번으로 남의 통계에서
     * 조용히 빠지면 그건 철회가 아니라 되돌리기다.
     */
    const { headers } = await signInAs(test);

    await grant(headers);
    await register(headers);
    await revoke(headers);

    const stored = await test.pool.query('SELECT 1 FROM structured.payment_proofs');
    expect(stored.rows).toHaveLength(1);
  });

  it('철회한 뒤 다시 동의할 수 있다', async () => {
    const { headers } = await signInAs(test);

    await grant(headers);
    await revoke(headers);
    await grant(headers);

    expect((await register(headers)).statusCode).toBe(201);

    // 이력은 두 줄로 쌓인다.
    const stored = await test.pool.query('SELECT 1 FROM structured.payment_consents');
    expect(stored.rows).toHaveLength(2);
  });

  it('동의한 적이 없으면 철회할 것도 없다', async () => {
    const { headers } = await signInAs(test);

    expect((await revoke(headers)).statusCode).toBe(409);
  });

  it('무엇에 동의했는지 판을 남긴다', async () => {
    // 안내가 바뀌면 이전 동의는 다른 것에 대한 동의다.
    const { headers } = await signInAs(test);

    await grant(headers);

    const { rows } = await test.pool.query<{ consent_version: string }>(
      'SELECT consent_version FROM structured.payment_consents'
    );

    expect(rows[0]!.consent_version).toBeTruthy();
  });
});
