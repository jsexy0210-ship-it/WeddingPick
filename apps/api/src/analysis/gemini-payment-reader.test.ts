import { createGeminiPaymentReader } from './gemini-payment-reader';
import type { ProofImage } from './payment-reader';

/**
 * Gemini로 읽는 경로.
 *
 * **실제로 부르지 않는다.** 호출마다 돈이 들고 결과가 매번 다르다. `fetch`를 가짜로
 * 끼워 「우리가 무엇을 보내고 무엇을 받아 어떻게 푸는지」만 본다.
 */

const IMAGE: ProofImage = { mimeType: 'image/png', bytes: Buffer.from('가짜png') };

const READING = {
  merchantName: '강남 A 스튜디오',
  paidAmount: 1_680_000,
  paidAt: '2026-09-01T13:20:00',
  method: 'card',
  maskedIdentifiers: ['card_number'],
  rejection: null,
  confidence: 0.91,
};

function okResponse(reading: unknown = READING) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(reading) }] } }],
      usageMetadata: {
        promptTokenCount: 1200,
        candidatesTokenCount: 80,
        cachedContentTokenCount: 900,
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

describe('Gemini 결제내역 읽기', () => {
  it('키가 없으면 만들 때 바로 멈춘다', () => {
    /* 읽으려는 순간에 터지면 그 문서 하나가 실패로 남는다. 시작할 때 막는 편이 낫다. */
    expect(() => createGeminiPaymentReader({} as NodeJS.ProcessEnv)).toThrow('GEMINI_API_KEY');
  });

  it('키를 주소가 아니라 헤더로 보낸다', async () => {
    /* 주소는 프록시 로그·오류 보고에 그대로 남는다. 키가 거기 있으면 안 된다. */
    const fetchMock = install(jest.fn().mockResolvedValue(okResponse()));

    await createGeminiPaymentReader(ENV).read([IMAGE], 'gemini-2.5-flash-lite');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).not.toContain('시험용-가짜-키');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('시험용-가짜-키');
  });

  it('모델 이름을 부르는 쪽이 정한다', async () => {
    /* 모델은 환경변수로 갈아끼운다. 파일 안에 박아두면 바꿀 때 배포가 아니라 수정이 된다. */
    const fetchMock = install(jest.fn().mockResolvedValue(okResponse()));

    await createGeminiPaymentReader(ENV).read([IMAGE], 'gemini-3.1-flash-lite');

    expect(fetchMock.mock.calls[0]?.[0]).toContain('gemini-3.1-flash-lite');
  });

  it('카드번호를 담을 칸이 아예 없다', async () => {
    /*
     * 「적지 마라」고 부탁하는 대신 적을 곳을 없앤다. 모델에게 보내는 스키마에
     * 그런 이름의 칸이 있으면 안 된다.
     */
    const fetchMock = install(jest.fn().mockResolvedValue(okResponse()));

    await createGeminiPaymentReader(ENV).read([IMAGE], 'gemini-2.5-flash-lite');

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    const fields = Object.keys(body.generationConfig.responseSchema.properties);

    expect(fields).toEqual([
      'merchantName',
      'paidAmount',
      'paidAt',
      'method',
      'maskedIdentifiers',
      'rejection',
      'confidence',
    ]);
  });

  it('같은 영수증이 같게 읽히도록 temperature를 0으로 보낸다', async () => {
    const fetchMock = install(jest.fn().mockResolvedValue(okResponse()));

    await createGeminiPaymentReader(ENV).read([IMAGE], 'gemini-2.5-flash-lite');

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);

    expect(body.generationConfig.temperature).toBe(0);
  });

  it('읽은 값과 사용량을 그대로 돌려준다', async () => {
    install(jest.fn().mockResolvedValue(okResponse()));

    const outcome = await createGeminiPaymentReader(ENV).read([IMAGE], 'gemini-2.5-flash-lite');

    expect(outcome.reading.paidAmount).toBe(1_680_000);
    expect(outcome.usage).toEqual({ inputTokens: 1200, outputTokens: 80, cachedInputTokens: 900 });
  });

  it('스키마에 없는 값이 섞여 오면 받지 않는다', async () => {
    /*
     * 구조화 출력이라 나올 수 없지만, 나왔을 때 조용히 통과시키면 카드번호 같은 것이
     * 뒤로 흘러간다. 파싱에서 막는다.
     */
    install(jest.fn().mockResolvedValue(okResponse({ ...READING, confidence: 7 })));

    await expect(
      createGeminiPaymentReader(ENV).read([IMAGE], 'gemini-2.5-flash-lite')
    ).rejects.toThrow();
  });

  it('오류 본문을 메시지에 그대로 붙이지 않는다', async () => {
    /*
     * 오류 응답에 요청이 되비쳐 담기는 서비스가 있다. 그대로 붙이면 영수증 이미지가
     * 로그로 나간다. 상태코드와 메시지만 남긴다.
     */
    install(
      jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: '형식 오류' },
          echo: { inlineData: { data: '이미지본문이여기담겼다' } },
        }),
      } as unknown as Response)
    );

    await expect(
      createGeminiPaymentReader(ENV).read([IMAGE], 'gemini-2.5-flash-lite')
    ).rejects.toThrow(/400.*형식 오류/);

    await expect(
      createGeminiPaymentReader(ENV).read([IMAGE], 'gemini-2.5-flash-lite')
    ).rejects.not.toThrow(/이미지본문이여기담겼다/);
  });

  it('읽을 수 없는 형식은 부르기 전에 막는다', async () => {
    const fetchMock = install(jest.fn().mockResolvedValue(okResponse()));

    await expect(
      createGeminiPaymentReader(ENV).read(
        [{ mimeType: 'application/pdf', bytes: Buffer.from('x') }],
        'gemini-2.5-flash-lite'
      )
    ).rejects.toThrow('읽을 수 없는 형식');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('한 번 실패해도 다시 시도한다', async () => {
    const fetchMock = install(
      jest.fn().mockRejectedValueOnce(new Error('일시적 오류')).mockResolvedValue(okResponse())
    );

    const outcome = await createGeminiPaymentReader(ENV).read([IMAGE], 'gemini-2.5-flash-lite');

    expect(outcome.reading.merchantName).toBe('강남 A 스튜디오');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('계속 실패하면 정해진 횟수에서 멈춘다', async () => {
    /* 무한히 다시 부르면 워커가 붙잡히고 돈만 나간다. */
    const fetchMock = install(jest.fn().mockRejectedValue(new Error('계속 실패')));

    await expect(
      createGeminiPaymentReader(ENV).read([IMAGE], 'gemini-2.5-flash-lite')
    ).rejects.toThrow('계속 실패');

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
