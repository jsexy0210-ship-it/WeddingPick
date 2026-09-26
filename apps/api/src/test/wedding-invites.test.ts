import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { INVITE_CODE_SPACE, inviteGuessCeiling } from '@weddingpick/domain';

import {
  INVITE_ATTEMPT_WINDOW_MINUTES,
  INVITE_FAILURES_PER_IP,
  INVITE_FAILURES_PER_USER,
  generateInviteCode,
} from '../routes/wedding-invites';
import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

/** 저장소의 마이그레이션 폴더 — 0439의 UPDATE를 시험에서 그대로 다시 돌린다. */
const MIGRATIONS = join(__dirname, '..', '..', '..', '..', 'packages', 'db', 'migrations');

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
    const body = (await preview(partner.headers, '9999')).json();

    expect(body).toMatchObject({ usable: false, reason: 'not_found' });
  });

  it('초대 코드는 4자리 숫자다(2026-09-26 대표 지시)', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    expect(code).toMatch(/^\d{4}$/);
  });

  it('4자리 숫자가 아닌 코드는 받지 않는다 — 옛 6자리도', async () => {
    const partner = await signInAs(test, 'partner');

    expect((await preview(partner.headers, 'made-up-code')).statusCode).toBe(400);
    expect((await accept(partner.headers, '123')).statusCode).toBe(400);
    expect((await accept(partner.headers, '12345')).statusCode).toBe(400);
    expect((await preview(partner.headers, '123456')).statusCode).toBe(400);
  });

  it('실패 제한이 4자리의 1만 가지를 기한 안에 다 훑지 못하게 막는다', () => {
    const perUser = inviteGuessCeiling(INVITE_FAILURES_PER_USER, INVITE_ATTEMPT_WINDOW_MINUTES);
    const perIp = inviteGuessCeiling(INVITE_FAILURES_PER_IP, INVITE_ATTEMPT_WINDOW_MINUTES);

    expect(perUser).toBe(1_440);
    expect(perUser).toBeLessThan(INVITE_CODE_SPACE * 0.15);
    expect(perIp).toBeLessThan(INVITE_CODE_SPACE);
  });

  it('0439 — 대기 중인 옛 6자리 초대는 취소하고 4자리 초대는 그대로 둔다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    // 다른 웨딩에 옛 6자리 코드로 만든 대기 줄을 하나 둔다(0439 이전 API가 낸 것).
    const other = await signInAs(test, 'other-owner');
    const otherWedding = await createWedding(test, other.headers);
    const oldHash = createHash('sha256').update('482913').digest('hex');
    await test.pool.query(
      `INSERT INTO structured.wedding_invites (wedding_id, invited_by, code_hash, expires_at)
       VALUES ($1, $2, $3, now() + interval '1 day')`,
      [otherWedding, other.userId, oldHash]
    );

    // 마이그레이션의 UPDATE를 그대로 다시 돌린다 — 배포 순서와 무관하게 같은 결과여야 한다.
    const sql = readFileSync(join(MIGRATIONS, '0439_partner_invite_four_digit.sql'), 'utf8');
    const update = sql.slice(sql.indexOf('UPDATE structured.wedding_invites'), sql.indexOf(';', sql.indexOf('UPDATE structured.wedding_invites')) + 1);
    await test.pool.query(update);

    const { rows } = await test.pool.query<{ wedding_id: string; status: string }>(
      'SELECT wedding_id, status FROM structured.wedding_invites WHERE wedding_id = ANY($1::uuid[])',
      [[weddingId, otherWedding]]
    );
    expect(rows.find((row) => row.wedding_id === otherWedding)?.status).toBe('revoked');
    expect(rows.find((row) => row.wedding_id === weddingId)?.status).toBe('pending');

    const partner = await signInAs(test, 'partner');
    expect((await preview(partner.headers, code)).json().usable).toBe(true);
  });

  it('0439 — 코드 해시는 SHA-256 꼴만 받는다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);

    await expect(
      test.pool.query(
        `INSERT INTO structured.wedding_invites (wedding_id, invited_by, code_hash, expires_at)
         VALUES ($1, $2, '1234', now() + interval '1 day')`,
        [weddingId, owner.userId]
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('틀린 코드를 계정 한도만큼 넣으면 맞는 코드도 잠시 받지 않는다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);
    const partner = await signInAs(test, 'partner');
    const wrong = code === '0000' ? '0001' : '0000';

    for (let i = 0; i < INVITE_FAILURES_PER_USER; i += 1) {
      expect((await accept(partner.headers, wrong)).statusCode).toBe(400);
    }

    expect((await accept(partner.headers, code)).statusCode).toBe(429);
    expect((await preview(partner.headers, code)).statusCode).toBe(429);

    // 다른 계정은 계정 한도에 걸리지 않는다(같은 IP 한도 안에서).
    const other = await signInAs(test, 'other');
    expect((await preview(other.headers, code)).json().usable).toBe(true);
    expect(INVITE_FAILURES_PER_IP).toBeGreaterThan(INVITE_FAILURES_PER_USER);
  });

  it('틀린 코드를 IP 한도만큼 넣으면 그 IP의 다른 계정도 받지 않는다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);
    const wrong = code === '0000' ? '0001' : '0000';

    for (let i = 0; i < INVITE_FAILURES_PER_IP; i += 1) {
      const guesser = await signInAs(test, `guesser-${Math.floor(i / INVITE_FAILURES_PER_USER)}`);
      await preview(guesser.headers, wrong);
    }

    const partner = await signInAs(test, 'partner');
    expect((await preview(partner.headers, code)).statusCode).toBe(429);
  });

  it('기한이 지난 옛 초대와 같은 숫자가 다시 나와도 새 초대가 쓰인다', async () => {
    const owner = await signInAs(test, 'owner');
    const weddingId = await createWedding(test, owner.headers);
    const { code } = await invite(owner.headers, weddingId);

    // 같은 코드 해시를 가진 옛 줄을 하나 더 만든다(다른 웨딩 · 이미 쓰인 초대).
    const other = await signInAs(test, 'other-owner');
    const otherWedding = await createWedding(test, other.headers);
    await test.pool.query(
      `INSERT INTO structured.wedding_invites
         (wedding_id, invited_by, code_hash, status, expires_at, revoked_at, created_at)
       SELECT $1, $2, code_hash, 'revoked', now() - interval '1 day', now(), now() - interval '2 days'
         FROM structured.wedding_invites WHERE wedding_id = $3`,
      [otherWedding, other.userId, weddingId]
    );

    const partner = await signInAs(test, 'partner');
    expect((await preview(partner.headers, code)).json().usable).toBe(true);
    expect((await accept(partner.headers, code)).statusCode).toBe(200);
  });
});

describe('초대 코드 생성', () => {
  it('1만 번 뽑아도 전부 4자리 숫자다', () => {
    for (let i = 0; i < 10_000; i += 1) {
      expect(generateInviteCode()).toMatch(/^\d{4}$/);
    }
  });
});
