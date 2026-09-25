import { DEFAULT_WEDDING_FEED_IMAGE_MODEL, generateWeddingFeedImage } from './wedding-feed-image';

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1]);
const JPEG = Buffer.from([255, 216, 255, 224, 0, 1]);

function reply(parts: unknown[]) {
  return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts } }] }) } as Response;
}

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.GEMINI_IMAGE_MODEL;
});

it('웨딩피드 이미지는 표준 generateContent에 이미지 응답을 켜서 만든다', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
    reply([{ inlineData: { mimeType: 'image/png', data: PNG.toString('base64') } }])
  );

  const image = await generateWeddingFeedImage('test-key', {
    kind: 'thumbnail', title: '계약서 확인', summary: '견적 항목', body: '',
  });

  expect(image).toEqual({ bytes: PNG, mimeType: 'image/png', extension: 'png' });
  const [url, request] = fetchMock.mock.calls[0]!;
  expect(url).toBe(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_WEDDING_FEED_IMAGE_MODEL}:generateContent`
  );
  expect(request?.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
  const sent = JSON.parse(String(request?.body));
  expect(sent).toMatchObject({
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
  });
  // 2026-09-25 대표 지시 — 이미지 안 글자 금지 · 실사 위주.
  const prompt: string = sent.contents[0].parts[0].text;
  expect(prompt).toContain('실사 사진');
  expect(prompt).toContain('어떤 글자도 넣지 마라');
  expect(prompt).toContain('Absolutely no text');
  expect(prompt).not.toContain('삽화 한 장');
});

it('모델은 GEMINI_IMAGE_MODEL로 바꿀 수 있고 JPEG 응답도 받는다', async () => {
  process.env.GEMINI_IMAGE_MODEL = 'other-image-model';
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
    reply([{ text: '설명' }, { inlineData: { mimeType: 'image/jpeg', data: JPEG.toString('base64') } }])
  );

  const image = await generateWeddingFeedImage('test-key', { kind: 'body', title: '제목', summary: '', body: '' });

  expect(image.mimeType).toBe('image/jpeg');
  expect(image.extension).toBe('jpg');
  expect(String(fetchMock.mock.calls[0]![0])).toContain('/models/other-image-model:generateContent');
});

it('이미지 없는 응답을 저장할 바이트로 취급하지 않는다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(reply([{ text: '그림을 못 그렸어요' }]));
  await expect(generateWeddingFeedImage('test-key', {
    kind: 'body', title: '제목', summary: '', body: '',
  })).rejects.toThrow('missing_image');
});

it('선언한 형식과 실제 바이트가 다르면 버린다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    reply([{ inlineData: { mimeType: 'image/png', data: JPEG.toString('base64') } }])
  );
  await expect(generateWeddingFeedImage('test-key', {
    kind: 'body', title: '제목', summary: '', body: '',
  })).rejects.toThrow('invalid_image');
});

it('제공자 오류의 상태 코드만 읽고 응답 본문은 노출하지 않는다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({ error: { status: 'NOT_FOUND', message: '프롬프트와 비밀 값' } }),
  } as Response);
  await expect(generateWeddingFeedImage('test-key', {
    kind: 'thumbnail', title: '제목', summary: '', body: '',
  })).rejects.toThrow('Gemini 이미지 요청 실패 (404 NOT_FOUND)');
});
