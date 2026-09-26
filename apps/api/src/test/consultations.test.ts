import { VISIT_NOTE_AUDIO_CONSENT_VERSION } from '@weddingpick/domain';

import type { LocalStorage } from '../storage/local';
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

  describe('같은 출처 올리기 — PUT /v1/consultations/:id/audio', () => {
    /*
     * 브라우저 → 카카오 Object Storage 서명 URL PUT은 CORS preflight에서 막힌다(e66dec7e).
     * 녹음 본문은 API가 받아 저장소로 흘려 보낸다 — 여기서 보는 것은 «정말 저장됐나 · 형식이
     * 맞게 적혔나 · 남이 못 올리나 · 형식 · 크기가 막히나»다.
     */
    const AUDIO = Buffer.from('ftypM4A-녹음 본문 대신 쓰는 바이트');

    function putAudio(
      headers: Record<string, string>,
      id: string,
      body: Buffer = AUDIO,
      extra: Record<string, string> = {}
    ) {
      return test.app.inject({
        method: 'PUT',
        url: `/v1/consultations/${id}/audio`,
        headers: { ...headers, 'content-type': 'audio/m4a', ...extra },
        payload: body,
      });
    }

    async function created(headers: Record<string, string>, weddingId: string) {
      const body = (await upload(headers, weddingId)).json();
      return body as { consultationId: string; uploadPath: string; storageKey: string };
    }

    it('올릴 자리가 같은 출처 경로를 준다 — 옛 서명 URL도 옛 앱을 위해 남는다', async () => {
      const { headers, weddingId } = await setUp();
      const body = await created(headers, weddingId);

      expect(body.uploadPath).toBe(`/v1/consultations/${body.consultationId}/audio`);
      expect((await upload(headers, weddingId)).json().uploadUrl).toBeTruthy();
    });

    it('본문이 저장소에 그 형식으로 들어가고, 도착 시각부터 24시간 시계가 다시 잡힌다', async () => {
      const { headers, weddingId } = await setUp();
      const { consultationId, uploadPath, storageKey } = await created(headers, weddingId);

      await test.context.pool.query(
        `UPDATE structured.consultation_records SET audio_delete_by = now() - interval '1 hour'
          WHERE id = $1`,
        [consultationId]
      );

      const response = await test.app.inject({
        method: 'PUT',
        url: uploadPath,
        headers: { ...headers, 'content-type': 'audio/m4a' },
        payload: AUDIO,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().id).toBe(consultationId);
      expect(response.json().confirmedAt).toBeNull();

      const storage = test.context.storage as LocalStorage;
      expect((await storage.download(storageKey)).equals(AUDIO)).toBe(true);
      expect(storage.mimeTypeOf(storageKey)).toBe('audio/m4a');

      const { rows } = await test.context.pool.query<{ due: Date }>(
        'SELECT audio_delete_by AS due FROM structured.consultation_records WHERE id = $1',
        [consultationId]
      );
      expect(rows[0]!.due.getTime()).toBeGreaterThan(Date.now());
    });

    it('형식 뒤 매개변수는 떼고 본다 · 같은 확장자의 다른 이름(audio/mp3 ↔ audio/mpeg)은 받는다', async () => {
      const { headers, weddingId } = await setUp();
      const { consultationId } = await created(headers, weddingId);

      expect(
        (await putAudio(headers, consultationId, AUDIO, { 'content-type': 'audio/m4a; codecs=mp4a' }))
          .statusCode
      ).toBe(200);

      const mp3 = (await upload(headers, weddingId, { mimeType: 'audio/mp3' })).json();
      const response = await putAudio(headers, mp3.consultationId, AUDIO, { 'content-type': 'audio/mpeg' });
      expect(response.statusCode).toBe(200);
      expect((test.context.storage as LocalStorage).mimeTypeOf(mp3.storageKey)).toBe('audio/mpeg');
    });

    it('비로그인은 막는다', async () => {
      const { headers, weddingId } = await setUp();
      const { consultationId } = await created(headers, weddingId);

      expect((await putAudio({}, consultationId)).statusCode).toBe(401);
    });

    it('남의 기록에는 못 올린다 — 없는 것과 같은 말로 답한다', async () => {
      const { headers, weddingId } = await setUp();
      const { consultationId, storageKey } = await created(headers, weddingId);
      const other = await signInAs(test, 'consult-other');

      expect((await putAudio(other.headers, consultationId)).statusCode).toBe(404);
      await expect(test.context.storage.download(storageKey)).rejects.toThrow();
    });

    it('녹음이 아닌 형식은 415로 막는다', async () => {
      const { headers, weddingId } = await setUp();
      const { consultationId, storageKey } = await created(headers, weddingId);

      for (const type of ['video/mp4', 'text/plain', 'audio/webm']) {
        const response = await putAudio(headers, consultationId, AUDIO, { 'content-type': type });
        expect(response.statusCode).toBe(415);
        /*
         * 상한 안의 본문은 끝까지 받고 답한다 — 연결을 끊으면 본문을 쓰던 운영 Nginx가 EPIPE를
         * 맞아 우리 415 대신 502를 낸다(렌더한 운영 설정으로 재 봤다).
         */
        expect(response.headers.connection).not.toBe('close');
      }
      await expect(test.context.storage.download(storageKey)).rejects.toThrow();
    });

    it('처음 알린 형식과 다른 녹음은 415로 막는다 — 열쇠의 확장자와 내용이 어긋나지 않게', async () => {
      const { headers, weddingId } = await setUp();
      const { consultationId } = await created(headers, weddingId);
      const response = await putAudio(headers, consultationId, AUDIO, { 'content-type': 'audio/wav' });

      expect(response.statusCode).toBe(415);
      expect(response.json().error.message).toContain('형식');
    });

    it('100MB를 넘는다고 알리면 본문을 읽기 전에 413으로 막는다', async () => {
      const { headers, weddingId } = await setUp();
      const { consultationId } = await created(headers, weddingId);
      const response = await putAudio(headers, consultationId, AUDIO, {
        'content-length': String(100 * 1024 * 1024 + 1),
      });

      expect(response.statusCode).toBe(413);
      expect(response.json().error.message).toBe('파일이 너무 커요. 100MB까지 올릴 수 있어요.');
      /* 상한을 넘는 본문은 받아 버리지 않고 끊는다(운영에서는 Nginx가 같은 상한으로 먼저 막는다). */
      expect(response.headers.connection).toBe('close');
    });

    it('알린 길이보다 긴 본문은 흐름 도중에 끊고 413 — 반쯤 저장된 파일이 남지 않는다', async () => {
      const { headers, weddingId } = await setUp();
      const { consultationId, storageKey } = await created(headers, weddingId);
      const response = await putAudio(headers, consultationId, AUDIO, { 'content-length': '4' });

      expect(response.statusCode).toBe(413);
      await expect(test.context.storage.download(storageKey)).rejects.toThrow();
    });

    it('빈 파일은 400', async () => {
      const { headers, weddingId } = await setUp();
      const { consultationId } = await created(headers, weddingId);

      expect((await putAudio(headers, consultationId, Buffer.alloc(0))).statusCode).toBe(400);
    });

    it('저장까지 마친 기록에는 다시 올리지 못한다', async () => {
      const { headers, weddingId } = await setUp();
      const { consultationId } = await created(headers, weddingId);

      await test.app.inject({ method: 'POST', url: `/v1/consultations/${consultationId}/confirm`, headers });

      expect((await putAudio(headers, consultationId)).statusCode).toBe(400);
    });
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
