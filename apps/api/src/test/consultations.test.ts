import { VISIT_NOTE_AUDIO_CONSENT_VERSION } from '@weddingpick/domain';

import { createTestApp, createWedding, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 상담기록 — 녹음을 올리고 확인하고 저장한다.
 *
 * **여기서 지키는 것은 둘이다.** 남의 녹음을 못 읽게 하는 것과, 원본이 실제로
 * 지워지는 것. 둘 다 「그렇게 했다」고 적는 것으로는 부족해서 시험이 본다.
 */
describeWithDb('상담기록', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function upload(
    headers: Record<string, string>,
    weddingId: string,
    over: Record<string, unknown> = {}
  ) {
    return test.app.inject({
      method: 'POST',
      url: '/v1/consultations/uploads',
      headers,
      payload: {
        weddingId,
        mimeType: 'audio/m4a',
        seconds: 1800,
        byteSize: 8 * 1024 * 1024,
        consentVersion: VISIT_NOTE_AUDIO_CONSENT_VERSION,
        ...over,
      },
    });
  }

  async function setUp() {
    const { headers } = await signInAs(test, 'consult-owner');
    const weddingId = await createWedding(test, headers);

    return { headers, weddingId };
  }

  it('올릴 자리를 준다', async () => {
    const { headers, weddingId } = await setUp();
    const response = await upload(headers, weddingId);

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.uploadUrl).toBeTruthy();
    expect(body.storageKey).toContain('consultations/');
  });

  it('받지 않는 형식은 부르기 전에 막는다', async () => {
    // 거절당한 호출도 과금된다. 형식은 보내기 전에 알 수 있다.
    const { headers, weddingId } = await setUp();
    const response = await upload(headers, weddingId, { mimeType: 'video/mp4' });

    expect(response.statusCode).toBe(400);
  });

  it('너무 긴 녹음은 왜 막혔는지를 함께 말한다', async () => {
    /* 「올릴 수 없어요」만 보이면 사용자는 파일이 잘못된 줄 안다. */
    const { headers, weddingId } = await setUp();
    const response = await upload(headers, weddingId, { seconds: 5 * 60 * 60 });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toContain('시간');
  });

  it('너무 큰 파일도 막는다', async () => {
    // 길이와 따로 본다 — 길이는 비용을, 크기는 저장소와 전송을 정한다.
    const { headers, weddingId } = await setUp();
    const response = await upload(headers, weddingId, { byteSize: 200 * 1024 * 1024 });

    expect(response.statusCode).toBe(400);
  });

  it('옛 동의로는 올리지 못한다', async () => {
    /*
     * 문구가 바뀌면 예전 동의는 그 새 내용에 대한 동의가 아니다. 결제 증빙과
     * 같은 규칙이다.
     */
    const { headers, weddingId } = await setUp();
    const response = await upload(headers, weddingId, { consentVersion: '2000-01-01' });

    expect(response.statusCode).toBe(400);
  });

  it('남의 웨딩에는 못 올린다', async () => {
    const { headers } = await setUp();
    const other = await signInAs(test, 'consult-other');
    const otherWedding = await createWedding(test, other.headers);

    expect((await upload(headers, otherWedding)).statusCode).toBe(404);
  });

  it('남의 상담기록은 못 본다 — 없는 것과 같은 말로 답한다', async () => {
    /*
     * 「남의 것입니다」는 그 id가 있다는 사실을 알려준다. 녹음에는 대화가 통째로
     * 들어 있어 결제 증빙보다 더 민감하다.
     */
    const { headers, weddingId } = await setUp();
    const id = (await upload(headers, weddingId)).json().consultationId;

    const other = await signInAs(test, 'consult-other');
    const response = await test.app.inject({
      method: 'GET',
      url: `/v1/consultations/${id}`,
      headers: other.headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('비로그인은 막는다', async () => {
    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/consultations/11111111-1111-4111-8111-111111111111',
    });

    expect(response.statusCode).toBe(401);
  });

  it('올린 직후는 「확인 필요」다', async () => {
    // 모델이 뽑은 값은 확정이 아니다. 사용자가 보고 고친 뒤에 저장된다.
    const { headers, weddingId } = await setUp();
    const id = (await upload(headers, weddingId)).json().consultationId;

    const body = (
      await test.app.inject({ method: 'GET', url: `/v1/consultations/${id}`, headers })
    ).json();

    expect(body.confirmedAt).toBeNull();
    expect(body.audioDeletedAt).toBeNull();
  });

  it('사용자가 고친 것이 남는다', async () => {
    const { headers, weddingId } = await setUp();
    const id = (await upload(headers, weddingId)).json().consultationId;

    const response = await test.app.inject({
      method: 'PATCH',
      url: `/v1/consultations/${id}`,
      headers,
      payload: { vendorLabel: '강남 A 웨딩홀', common: { vendorName: '강남 A 웨딩홀' } },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().vendorLabel).toBe('강남 A 웨딩홀');
  });

  it('안 보낸 칸은 건드리지 않는다', async () => {
    /*
     * 한 칸만 고치는 것이 보통이다. 안 보낸 칸을 지우면 사용자는 고친 적 없는
     * 값이 사라지는 것을 본다.
     */
    const { headers, weddingId } = await setUp();
    const id = (await upload(headers, weddingId)).json().consultationId;

    await test.app.inject({
      method: 'PATCH',
      url: `/v1/consultations/${id}`,
      headers,
      payload: { vendorLabel: '강남 A 웨딩홀' },
    });

    const after = await test.app.inject({
      method: 'PATCH',
      url: `/v1/consultations/${id}`,
      headers,
      payload: { common: { mood: '조용했다' } },
    });

    expect(after.json().vendorLabel).toBe('강남 A 웨딩홀');
    expect(after.json().common).toEqual({ mood: '조용했다' });
  });

  it('저장하면 원본이 실제로 지워진다', async () => {
    /*
     * **이 시험이 이 기능의 약속을 지킨다.** 화면과 처리방침이 「바로 지워요」라고
     * 적었고, 지워졌다는 것이 표에도 보여야 한다.
     */
    const { headers, weddingId } = await setUp();
    const id = (await upload(headers, weddingId)).json().consultationId;

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/consultations/${id}/confirm`,
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().confirmedAt).not.toBeNull();
    expect(response.json().audioDeletedAt).not.toBeNull();

    const { rows } = await test.context.pool.query(
      'SELECT audio_key FROM structured.consultation_records WHERE id = $1',
      [id]
    );

    expect(rows[0]?.audio_key).toBeNull();
  });

  it('이미 저장한 기록은 고치지 못한다', async () => {
    const { headers, weddingId } = await setUp();
    const id = (await upload(headers, weddingId)).json().consultationId;

    await test.app.inject({ method: 'POST', url: `/v1/consultations/${id}/confirm`, headers });

    const response = await test.app.inject({
      method: 'PATCH',
      url: `/v1/consultations/${id}`,
      headers,
      payload: { vendorLabel: '다른 곳' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('남의 것은 저장도 못 시킨다', async () => {
    const { headers, weddingId } = await setUp();
    const id = (await upload(headers, weddingId)).json().consultationId;
    const other = await signInAs(test, 'consult-other');

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/consultations/${id}/confirm`,
      headers: other.headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('목록은 내 것만 준다', async () => {
    const { headers, weddingId } = await setUp();

    await upload(headers, weddingId);

    const other = await signInAs(test, 'consult-other');
    const otherWedding = await createWedding(test, other.headers);

    await upload(other.headers, otherWedding);

    const mine = (
      await test.app.inject({
        method: 'GET',
        url: `/v1/weddings/${weddingId}/consultations`,
        headers,
      })
    ).json();

    expect(mine.records).toHaveLength(1);
    expect(mine.records[0].weddingId).toBe(weddingId);
  });

  it('지우면 남지 않는다', async () => {
    const { headers, weddingId } = await setUp();
    const id = (await upload(headers, weddingId)).json().consultationId;

    expect(
      (await test.app.inject({ method: 'DELETE', url: `/v1/consultations/${id}`, headers }))
        .statusCode
    ).toBe(200);

    expect(
      (await test.app.inject({ method: 'GET', url: `/v1/consultations/${id}`, headers }))
        .statusCode
    ).toBe(404);
  });

  it('올리기를 알리면 24시간 시계가 다시 잡힌다', async () => {
    /*
     * 서명 URL을 받은 시각이 아니라 파일이 실제로 온 시각부터 센다. URL만 받고
     * 안 올린 줄이 24시간 뒤에 「파기 대상」으로 잡히면 지울 파일이 없는 것을
     * 지우려 든다.
     */
    const { headers, weddingId } = await setUp();
    const id = (await upload(headers, weddingId)).json().consultationId;

    await test.context.pool.query(
      `UPDATE structured.consultation_records SET audio_delete_by = now() - interval '1 hour'
        WHERE id = $1`,
      [id]
    );

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/consultations/${id}/complete`,
      headers,
    });

    expect(response.statusCode).toBe(200);

    const { rows } = await test.context.pool.query<{ due: Date }>(
      'SELECT audio_delete_by AS due FROM structured.consultation_records WHERE id = $1',
      [id]
    );

    expect(rows[0]!.due.getTime()).toBeGreaterThan(Date.now());
  });

  it('이미 지운 기록에는 알릴 것이 없다', async () => {
    const { headers, weddingId } = await setUp();
    const id = (await upload(headers, weddingId)).json().consultationId;

    await test.app.inject({ method: 'POST', url: `/v1/consultations/${id}/confirm`, headers });

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/consultations/${id}/complete`,
      headers,
    });

    expect(response.statusCode).toBe(400);
  });

  it('남의 것은 올리기 완료도 못 알린다', async () => {
    const { headers, weddingId } = await setUp();
    const id = (await upload(headers, weddingId)).json().consultationId;
    const other = await signInAs(test, 'consult-other');

    const response = await test.app.inject({
      method: 'POST',
      url: `/v1/consultations/${id}/complete`,
      headers: other.headers,
    });

    expect(response.statusCode).toBe(404);
  });

  it('녹취록을 담을 칸이 응답에 없다', async () => {
    // 담을 곳이 없으면 오갈 수도 없다.
    const { headers, weddingId } = await setUp();
    const id = (await upload(headers, weddingId)).json().consultationId;

    const body = (
      await test.app.inject({ method: 'GET', url: `/v1/consultations/${id}`, headers })
    ).json();

    for (const key of ['transcript', 'fullText', 'audioKey', 'audioUrl']) {
      expect(body).not.toHaveProperty(key);
    }
  });
});
