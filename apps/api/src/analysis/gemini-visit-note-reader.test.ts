import { createGeminiVisitNoteReader } from './gemini-visit-note-reader';
import type { VisitNoteAudio } from './visit-note-reader';

/**
 * 상담 녹음을 Gemini로 읽는 경로.
 *
 * **실제로 부르지 않는다.** 호출마다 돈이 들고, 음성은 글자보다 세 배 비싸다.
 * `fetch`를 가짜로 끼워 「우리가 무엇을 보내고 무엇을 받아 어떻게 푸는지」만 본다.
 */

const AUDIO: VisitNoteAudio = {
  mimeType: 'audio/m4a',
  bytes: Buffer.from('가짜녹음'),
  seconds: 1800,
};

const READING = {
  vendorLabel: '강남 A 스튜디오',
  visitedOn: '2026-09-01',
  quotedAmount: 1_680_000,
  memo: '원본 50장 포함. 액자는 별도.',
  rejection: null,
  confidence: 0.88,
};

function okResponse(reading: unknown = READING, usage?: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(reading) }] } }],
      usageMetadata: usage ?? {
        promptTokenCount: 57_800,
        candidatesTokenCount: 90,
        promptTokensDetails: [
          { modality: 'TEXT', tokenCount: 200 },
          { modality: 'AUDIO', tokenCount: 57_600 },
        ],
      },
    }),
  } as unknown as Response;
}

function install(impl: jest.Mock): jest.Mock {
  global.fetch = impl as unknown as typeof fetch;

  return impl;
}

const ENV = { GEMINI_API_KEY: '시험용-가짜-키' } as NodeJS.ProcessEnv;

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Gemini 상담 녹음 읽기', () => {
  it('키가 없으면 만들 때 바로 멈춘다', () => {
    expect(() => createGeminiVisitNoteReader({} as NodeJS.ProcessEnv)).toThrow('GEMINI_API_KEY');
  });

  it('키를 주소가 아니라 헤더로 보낸다', async () => {
    /* 주소는 프록시 로그·오류 보고에 그대로 남는다. 키가 거기 있으면 안 된다. */
    const fetchMock = install(jest.fn().mockResolvedValue(okResponse()));

    await createGeminiVisitNoteReader(ENV).read(AUDIO, 'gemini-2.5-flash-lite');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).not.toContain('시험용-가짜-키');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('시험용-가짜-키');
  });

  it('녹취록을 담을 칸이 아예 없다', async () => {
    /*
     * 「남기지 마라」고 부탁하는 대신 적을 곳을 없앤다. 결제내역에서 카드번호 칸을
     * 없앤 것과 같은 방식이다.
     */
    const fetchMock = install(jest.fn().mockResolvedValue(okResponse()));

    await createGeminiVisitNoteReader(ENV).read(AUDIO, 'gemini-2.5-flash-lite');

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    const fields = Object.keys(body.generationConfig.responseSchema.properties);

    expect(fields.sort()).toEqual(
      ['confidence', 'memo', 'quotedAmount', 'rejection', 'vendorLabel', 'visitedOn'].sort()
    );
  });

  it('같은 녹음은 같게 읽힌다', async () => {
    /* 뽑아내는 일이다. 모델이 매번 다르게 고르면 사용자는 무엇이 맞는지 알 수 없다. */
    const fetchMock = install(jest.fn().mockResolvedValue(okResponse()));

    await createGeminiVisitNoteReader(ENV).read(AUDIO, 'gemini-2.5-flash-lite');

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);

    expect(body.generationConfig.temperature).toBe(0);
  });

  it('음성 토큰을 따로 센다', async () => {
    /*
     * `promptTokenCount`는 글자와 음성을 합친 값이다. 그대로 글자로 넘기면 비싼
     * 음성이 싼 단가로 계산돼 비용이 3분의 1로 잡힌다.
     */
    install(jest.fn().mockResolvedValue(okResponse()));

    const outcome = await createGeminiVisitNoteReader(ENV).read(AUDIO, 'gemini-2.5-flash-lite');

    expect(outcome.usage).toEqual({ inputTokens: 200, outputTokens: 90, audioTokens: 57_600 });
  });

  it('음성 토큰을 글자에서 뺀 뒤 넘긴다', async () => {
    /* 빼지 않으면 같은 토큰을 두 번 센다 — 합계에 음성이 들어 있기 때문이다. */
    install(jest.fn().mockResolvedValue(okResponse()));

    const outcome = await createGeminiVisitNoteReader(ENV).read(AUDIO, 'gemini-2.5-flash-lite');

    expect(outcome.usage.inputTokens + outcome.usage.audioTokens).toBe(57_800);
  });

  it('음성 내역을 안 주면 0으로 둔다', async () => {
    /*
     * 모르는 값을 글자에서 빼지 않는다. 합계를 그대로 글자로 두면 적어도 과소
     * 계상은 아니다 — 모자란 쪽으로 틀리는 것이 예산에서 더 위험하다.
     */
    install(
      jest.fn().mockResolvedValue(
        okResponse(READING, { promptTokenCount: 57_800, candidatesTokenCount: 90 })
      )
    );

    const outcome = await createGeminiVisitNoteReader(ENV).read(AUDIO, 'gemini-2.5-flash-lite');

    expect(outcome.usage).toEqual({ inputTokens: 57_800, outputTokens: 90, audioTokens: 0 });
  });

  it('읽어낸 값을 그대로 넘긴다', async () => {
    install(jest.fn().mockResolvedValue(okResponse()));

    const outcome = await createGeminiVisitNoteReader(ENV).read(AUDIO, 'gemini-2.5-flash-lite');

    expect(outcome.reading).toEqual(READING);
    expect(outcome.model).toBe('gemini-2.5-flash-lite');
  });

  it('받지 않는 형식이면 부르기 전에 막는다', async () => {
    /* 거절당한 호출도 과금된다. 형식은 보내기 전에 알 수 있다. */
    const fetchMock = install(jest.fn().mockResolvedValue(okResponse()));

    await expect(
      createGeminiVisitNoteReader(ENV).read({ ...AUDIO, mimeType: 'video/mp4' }, 'gemini-2.5-flash-lite')
    ).rejects.toThrow('읽을 수 없는 녹음이다');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('너무 긴 녹음도 부르기 전에 막는다', async () => {
    /*
     * 실수로 긴 파일이 올라오면 한 번에 스무 배가 나간다. Gemini 자체는 9.5시간까지
     * 받으므로 우리가 막지 않으면 아무도 막지 않는다.
     */
    const fetchMock = install(jest.fn().mockResolvedValue(okResponse()));

    await expect(
      createGeminiVisitNoteReader(ENV).read({ ...AUDIO, seconds: 5 * 60 * 60 }, 'gemini-2.5-flash-lite')
    ).rejects.toThrow('읽을 수 없는 녹음이다');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('오류 본문을 메시지에 붙이지 않는다', async () => {
    /*
     * 오류 응답에 요청이 되비쳐 담기는 서비스가 있다. 그대로 붙이면 상담 녹음이
     * 로그로 나간다.
     */
    install(
      jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: '형식을 읽지 못했다' },
          request: { contents: '녹음이-되비쳐-담긴-자리' },
        }),
      } as unknown as Response)
    );

    await expect(
      createGeminiVisitNoteReader(ENV).read(AUDIO, 'gemini-2.5-flash-lite')
    ).rejects.toThrow(/400.*형식을 읽지 못했다/);

    await expect(
      createGeminiVisitNoteReader(ENV).read(AUDIO, 'gemini-2.5-flash-lite')
    ).rejects.not.toThrow(/되비쳐/);
  });

  it('한 번 실패해도 다시 부른다', async () => {
    const fetchMock = install(
      jest.fn().mockRejectedValueOnce(new Error('연결이 끊겼다')).mockResolvedValue(okResponse())
    );

    const outcome = await createGeminiVisitNoteReader(ENV).read(AUDIO, 'gemini-2.5-flash-lite');

    expect(outcome.reading.vendorLabel).toBe('강남 A 스튜디오');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('세 번까지만 부른다', async () => {
    /* 음성은 비싸다. 끝없이 재시도하면 실패한 호출값이 그대로 쌓인다. */
    const fetchMock = install(jest.fn().mockRejectedValue(new Error('계속 끊긴다')));

    await expect(
      createGeminiVisitNoteReader(ENV).read(AUDIO, 'gemini-2.5-flash-lite')
    ).rejects.toThrow('계속 끊긴다');

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
