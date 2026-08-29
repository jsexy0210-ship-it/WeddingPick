import {
  createTestApp,
  createWedding,
  resetDatabase,
  signInAs,
  unlockPrices,
  type TestApp,
} from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

type Me = {
  spouseLinked: boolean;
  hasPaymentProof: boolean;
  tier: string;
  tierLabel: string;
};

/**
 * 이용 등급. 핸드오프 17번.
 *
 * 등급을 서버가 정하는 이유가 여기 있다. 앱이 세 값으로 직접 계산하면 화면마다
 * 조건을 다시 적게 되고, 언젠가 한 곳이 어긋나 같은 사람이 화면에 따라 다른
 * 등급으로 보인다.
 */
describeWithDb('이용 등급', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  const me = async (headers: Record<string, string>) =>
    (await test.app.inject({ method: 'GET', url: '/v1/me', headers })).json<Me>();

  async function link(owner: { headers: Record<string, string> }, weddingId: string) {
    const invite = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/invites`,
      headers: owner.headers,
    });

    const partner = await signInAs(test, 'partner-user');

    const accepted = await test.app.inject({
      method: 'POST',
      url: '/v1/wedding-invites/accept',
      headers: partner.headers,
      payload: { code: invite.json<{ code: string }>().code },
    });

    expect(accepted.statusCode).toBe(200);

    return partner;
  }

  it('로그인만 한 사람은 메이트다', async () => {
    const { headers } = await signInAs(test);

    const body = await me(headers);

    expect(body.tier).toBe('mate');
    expect(body.tierLabel).toBe('메이트');
    expect(body.spouseLinked).toBe(false);
    expect(body.hasPaymentProof).toBe(false);
  });

  it('배우자를 연결하면 프렌드다', async () => {
    const owner = await signInAs(test, 'owner-user');
    const weddingId = await createWedding(test, owner.headers);

    await link(owner, weddingId);

    expect((await me(owner.headers)).tier).toBe('friend');
  });

  it('연결은 양쪽 모두에게 보인다', async () => {
    /*
     * 등급이 초대한 사람에게만 오르면, 초대를 받은 쪽은 같은 웨딩을 보면서도
     * 자기만 아직 못 한 일이 있는 것처럼 보게 된다.
     */
    const owner = await signInAs(test, 'owner-user');
    const weddingId = await createWedding(test, owner.headers);

    const partner = await link(owner, weddingId);

    expect((await me(partner.headers)).tier).toBe('friend');
  });

  it('결제인증을 내면 패밀리다', async () => {
    const { headers, userId } = await signInAs(test);

    await unlockPrices(test, userId);

    const body = await me(headers);

    expect(body.tier).toBe('family');
    expect(body.tierLabel).toBe('패밀리');
    expect(body.hasPaymentProof).toBe(true);
  });

  it('배우자를 연결하지 않아도 결제인증만으로 패밀리다', async () => {
    // 핸드오프 표가 등급 조건을 그렇게 적었다. 등급 이름과 되는 일은 다르다 —
    // 패밀리라도 배우자가 없으면 공유는 여전히 안 된다.
    const { headers, userId } = await signInAs(test);

    await unlockPrices(test, userId);

    const body = await me(headers);

    expect(body.spouseLinked).toBe(false);
    expect(body.tier).toBe('family');
  });

  it('업체를 못 찾은 결제인증은 등급을 올리지 않는다', async () => {
    /*
     * 실제가격 열람과 같은 조건이다(usable_payment_proofs). 어느 업체의 결제인지
     * 모르는 자료는 남의 자료와 견줄 수 없고, 견줄 수 없는 자료로 등급을 주면
     * 등급이 실제가격을 여는 조건과 어긋난다.
     */
    const { headers, userId } = await signInAs(test);

    await test.pool.query(
      `INSERT INTO structured.payment_proofs
         (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
       VALUES ($1, NULL, '어디인지모를곳', 100000, now())`,
      [userId]
    );

    const body = await me(headers);

    expect(body.hasPaymentProof).toBe(false);
    expect(body.tier).toBe('mate');
  });

  it('로그인하지 않으면 등급을 묻는 자리조차 없다', async () => {
    // 게스트는 서버가 알려주는 등급이 아니라, 로그인하지 않았다는 사실 자체다.
    const response = await test.app.inject({ method: 'GET', url: '/v1/me' });

    expect(response.statusCode).toBe(401);
  });
});
