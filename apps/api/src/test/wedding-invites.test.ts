import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

async function invite(headers: Record<string, string>, weddingId: string) {
  const response = await test.app.inject({
    method: 'POST',
    url: `/v1/weddings/${weddingId}/invites`,
    headers,
  });

  expect(response.statusCode).toBe(201);

  return response.json();
}

async function accept(headers: Record<string, string>, code: string) {
  return await test.app.inject({
    method: 'POST',
    url: '/v1/wedding-invites/accept',
    headers,
    payload: { code },
  });
}

async function preview(headers: Record<string, string>, code: string) {
  return await test.app.inject({
    method: 'POST',
    url: '/v1/wedding-invites/preview',
    headers,
    payload: { code },
  });
}

describeWithDb('배우자 초대', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('코드를 서버에 원문으로 두지 않는다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    const { rows } = await test.pool.query<{ code_hash: string }>(
      'SELECT code_hash FROM structured.wedding_invites'
    );

    // 세션 토큰과 같은 이유다. DB가 유출돼도 그것만으로 남의 웨딩에 들어갈 수 없다.
    expect(rows[0]!.code_hash).not.toBe(code);
    expect(rows[0]!.code_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('코드는 만들 때 한 번만 내려간다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    await invite(owner.headers, weddingId);

    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/weddings/${weddingId}/invites`,
      headers: owner.headers,
    });

    expect(response.json().invite).not.toBeNull();
    expect(JSON.stringify(response.json())).not.toContain('code');
  });

  it('받아들이기 전에 무엇이 공유되는지 알려준다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    const partner = await signInAs(test, 'partner');
    const body = (await preview(partner.headers, code)).json();

    // 동의는 무엇에 동의하는지 알 때만 동의다.
    expect(body.usable).toBe(true);
    expect(body.shared.length).toBeGreaterThan(0);
    expect(body.notShared.some((item: string) => item.includes('원본 문서 파일'))).toBe(true);
  });

  it('미리보기가 초대한 사람을 알려주지 않는다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    const partner = await signInAs(test, 'partner');
    const body = (await preview(partner.headers, code)).json();

    // 링크를 가진 사람이 늘 배우자인 것도 아니다.
    expect(JSON.stringify(body)).not.toContain(owner.userId);
    expect(JSON.stringify(body)).not.toContain(weddingId);
  });

  it('받아들이면 상대의 견적을 함께 본다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    const partner = await signInAs(test, 'partner');
    expect((await accept(partner.headers, code)).statusCode).toBe(200);

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/weddings/${weddingId}`,
      headers: partner.headers,
    });

    expect(detail.statusCode).toBe(200);
    expect(detail.json().partnerLinked).toBe(true);
  });

  it('상대방의 개인정보는 내려보내지 않는다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    const partner = await signInAs(test, 'partner');
    await accept(partner.headers, code);

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/weddings/${weddingId}`,
      headers: partner.headers,
    });

    const body = detail.json();

    // 이용약관 제5조. 누가 누구인지는 이름이 아니라 isMe로 구분한다.
    expect(JSON.stringify(body)).not.toContain(owner.userId);
    expect(body.members).toEqual([
      { role: 'owner', joinedAt: expect.any(String), isMe: false },
      { role: 'partner', joinedAt: expect.any(String), isMe: true },
    ]);
  });

  it('같은 초대를 두 번 쓸 수 없다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    const first = await signInAs(test, 'first');
    expect((await accept(first.headers, code)).statusCode).toBe(200);

    const second = await signInAs(test, 'second');
    expect((await accept(second.headers, code)).statusCode).toBeGreaterThanOrEqual(400);
  });

  it('기한이 지난 초대는 쓸 수 없다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    await test.pool.query(
      `UPDATE structured.wedding_invites SET expires_at = now() - interval '1 hour'`
    );

    const partner = await signInAs(test, 'partner');

    // 흘러나온 링크가 영원히 열려 있으면 언젠가 낯선 사람이 들어온다.
    expect((await preview(partner.headers, code)).json().reason).toBe('expired');
    expect((await accept(partner.headers, code)).statusCode).toBeGreaterThanOrEqual(400);
  });

  it('취소한 초대는 쓸 수 없다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code, inviteId } = await invite(owner.headers, weddingId);

    await test.app.inject({
      method: 'DELETE',
      url: `/v1/weddings/${weddingId}/invites/${inviteId}`,
      headers: owner.headers,
    });

    const partner = await signInAs(test, 'partner');
    expect((await preview(partner.headers, code)).json().reason).toBe('revoked');
  });

  it('새로 만들면 이전 초대는 죽는다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const first = await invite(owner.headers, weddingId);
    const second = await invite(owner.headers, weddingId);

    const partner = await signInAs(test, 'partner');

    // 취소한 줄 알았던 링크가 살아 있으면 안 된다.
    expect((await preview(partner.headers, first.code)).json().usable).toBe(false);
    expect((await preview(partner.headers, second.code)).json().usable).toBe(true);
  });

  it('자기 자신을 배우자로 연결할 수 없다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    expect((await accept(owner.headers, code)).statusCode).toBe(400);
  });

  it('이미 웨딩이 있으면 남의 웨딩에 들어갈 수 없다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    const other = await signInAs(test, 'other');
    await createWedding(test, other.headers);

    expect((await accept(other.headers, code)).statusCode).toBe(409);
  });

  it('배우자가 있으면 초대를 새로 만들 수 없다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    const partner = await signInAs(test, 'partner');
    await accept(partner.headers, code);

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/invites`,
      headers: owner.headers,
    });

    // 한 웨딩에 세 사람이 되는 길을 막는다.
    expect(response.statusCode).toBe(409);
  });

  it('남의 웨딩에 초대를 만들 수 없다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);

    const stranger = await signInAs(test, 'stranger');
    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/weddings/${weddingId}/invites`,
      headers: stranger.headers,
    });

    expect(response.statusCode).toBe(403);
  });

  it('어느 쪽이든 연결을 끊을 수 있다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    const partner = await signInAs(test, 'partner');
    await accept(partner.headers, code);

    // 한쪽이 붙잡아둘 수 있으면 그건 연결이 아니라 구속이다.
    const unlink = await test.app.inject({
      method: 'DELETE',
      url: `/v1/weddings/${weddingId}/partner`,
      headers: partner.headers,
    });

    expect(unlink.statusCode).toBe(204);

    const detail = await test.app.inject({
      method: 'GET',
      url: `/v1/weddings/${weddingId}`,
      headers: partner.headers,
    });

    expect(detail.statusCode).toBe(403);
  });

  it('연결을 끊으면 연결 시각도 함께 사라진다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    const partner = await signInAs(test, 'partner');
    await accept(partner.headers, code);

    await test.app.inject({
      method: 'DELETE',
      url: `/v1/weddings/${weddingId}/partner`,
      headers: owner.headers,
    });

    const { rows } = await test.pool.query<{ partner_joined_at: Date | null }>(
      'SELECT partner_joined_at FROM structured.weddings WHERE id = $1',
      [weddingId]
    );

    // "없는 사람이 언젠가 연결돼 있었다"는 상태를 만들지 않는다.
    expect(rows[0]!.partner_joined_at).toBeNull();
  });

  it('없는 코드는 있는 척하지 않는다', async () => {
    const partner = await signInAs(test, 'partner');
    const body = (await preview(partner.headers, 'made-up-code')).json();

    expect(body).toMatchObject({ usable: false, reason: 'not_found' });
  });
});
