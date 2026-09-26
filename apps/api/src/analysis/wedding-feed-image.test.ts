import { FEED_IMAGE_PEOPLE_RULE, type FeedImagePlan } from './wedding-feed-diversity';
import {
  DEFAULT_WEDDING_FEED_IMAGE_MODEL,
  WeddingFeedImageError,
  buildFeedImagePrompt,
  sniffFeedImageType,
} from './wedding-feed-image';
import { generateWeddingFeedImage } from './wedding-feed-writer';

/**
 * 웨딩피드 그림 — 실제로 부르지 않는다(`fetch`를 가짜로). 무엇을 보내고 무엇을 받아
 * 어떻게 거르는지만 본다. 부르는 자리는 `wedding-feed-writer.ts` 하나다(`gemini-scope.test.ts`).
 */
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1]);
const JPEG = Buffer.from([255, 216, 255, 224, 0, 1]);

const PLAN: FeedImagePlan = {
  scene: 'garden',
  shot: 'low-angle',
  timeOfDay: 'blue-hour',
  season: 'autumn',
  palette: 'navy-burgundy',
  props: 'vase',
  people: 'group',
};

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
  }, PLAN);

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

/*
 * 2026-09-26 대표 지시 — 「가상 모델은 동양인 한국인 기준으로만 생성한다」 · 「이미지도 대부분
 * 다 비슷비슷하다. 다르게 생성되어야한다」. 사람 규칙이 모든 요청에 실리고, 모든 그림에
 * 같던 화풍 지시(자연광 · 얕은 심도 · 따뜻한 색감 · 뒷모습만) 대신 그림마다 다른 계획이 실린다.
 */
it('모든 그림 요청에 한국인 성인 규칙과 이번 촬영 계획이 실린다', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
    reply([{ inlineData: { mimeType: 'image/png', data: PNG.toString('base64') } }])
  );

  for (const kind of ['thumbnail', 'body'] as const) {
    await generateWeddingFeedImage('test-key', { kind, title: '하객 동선', summary: '', body: '' }, PLAN);
  }

  for (const [, request] of fetchMock.mock.calls) {
    const prompt: string = JSON.parse(String(request?.body)).contents[0].parts[0].text;

    expect(prompt).toContain(FEED_IMAGE_PEOPLE_RULE);
    expect(prompt).toContain('한국인(동아시아인) 성인');
    expect(prompt).toContain('- 장소: 잔디가 깔린 야외 가든 예식장');
    expect(prompt).toContain('- 구도: 낮은 곳에서 올려다본 앵글');
    expect(prompt).toContain('- 인물: 가족이나 친구 서너 명');
    expect(prompt).not.toContain('얕은 심도');
    expect(prompt).not.toContain('뒷모습');
  }
});

it('프롬프트 만들기 — 계획이 다르면 요청 글도 다르다', () => {
  const input = { kind: 'body' as const, title: '제목', summary: '', body: '' };
  const other = buildFeedImagePrompt(input, { ...PLAN, scene: 'chapel', palette: 'sage' });

  expect(buildFeedImagePrompt(input, PLAN)).not.toBe(other);
  expect(other).toContain('- 색감: 세이지 그린과 흰색');
});

it('모델은 GEMINI_IMAGE_MODEL로 바꿀 수 있고 JPEG 응답도 받는다', async () => {
  process.env.GEMINI_IMAGE_MODEL = 'other-image-model';
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
    reply([{ text: '설명' }, { inlineData: { mimeType: 'image/jpeg', data: JPEG.toString('base64') } }])
  );

  const image = await generateWeddingFeedImage('test-key', { kind: 'body', title: '제목', summary: '', body: '' }, PLAN);

  expect(image.mimeType).toBe('image/jpeg');
  expect(image.extension).toBe('jpg');
  expect(String(fetchMock.mock.calls[0]![0])).toContain('/models/other-image-model:generateContent');
});

it('이미지 없는 응답을 저장할 바이트로 취급하지 않는다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(reply([{ text: '그림을 못 그렸어요' }]));
  await expect(generateWeddingFeedImage('test-key', {
    kind: 'body', title: '제목', summary: '', body: '',
  }, PLAN)).rejects.toThrow('missing_image');
});

it('선언한 형식과 실제 바이트가 다르면 버린다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    reply([{ inlineData: { mimeType: 'image/png', data: JPEG.toString('base64') } }])
  );
  await expect(generateWeddingFeedImage('test-key', {
    kind: 'body', title: '제목', summary: '', body: '',
  }, PLAN)).rejects.toThrow('invalid_image');
});

it('제공자 오류의 상태 코드만 읽고 응답 본문은 노출하지 않는다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({ error: { status: 'NOT_FOUND', message: '프롬프트와 비밀 값' } }),
  } as Response);
  const failure = generateWeddingFeedImage('test-key', {
    kind: 'thumbnail', title: '제목', summary: '', body: '',
  }, PLAN);

  await expect(failure).rejects.toThrow('Gemini 이미지 요청 실패 (404 NOT_FOUND)');
  await expect(failure).rejects.toBeInstanceOf(WeddingFeedImageError);
});

it('시간이 다 되면 timeout으로 알린다 — nginx 60초 뒤에 끝나는 요청을 붙잡지 않는다', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));

  await expect(generateWeddingFeedImage('test-key', {
    kind: 'thumbnail', title: '제목', summary: '', body: '',
  }, PLAN, { timeoutMs: 10 })).rejects.toMatchObject({ reason: 'timeout' });
});

it('첫 바이트로 형식을 가른다 — RIFF만으로는 WebP가 아니다', () => {
  expect(sniffFeedImageType(PNG)).toBe('image/png');
  expect(sniffFeedImageType(JPEG)).toBe('image/jpeg');
  expect(sniffFeedImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1'))).toBe('image/webp');
  expect(sniffFeedImageType(Buffer.from('RIFF\0\0\0\0WAVEfmt ', 'latin1'))).toBeNull();
});
