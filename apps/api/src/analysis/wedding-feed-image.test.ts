import { generateWeddingFeedImage, WEDDING_FEED_IMAGE_MODEL } from './wedding-feed-image';

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1]);

afterEach(() => jest.restoreAllMocks());

it('웨딩피드 이미지만 지정 모델의 Interactions API로 생성한다', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      status: 'completed',
      steps: [{ type: 'model_output', content: [{
        type: 'image', mime_type: 'image/png', data: PNG.toString('base64'),
      }] }],
    }),
  } as Response);

  const bytes = await generateWeddingFeedImage('test-key', {
    kind: 'thumbnail', title: '계약서 확인', summary: '견적 항목', body: '',
  });

  expect(bytes).toEqual(PNG);
  expect(WEDDING_FEED_IMAGE_MODEL).toBe('gemini-3.1-flash-lite-image');
  const [url, request] = fetchMock.mock.calls[0]!;
  expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
  expect(request?.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
  expect(JSON.parse(String(request?.body))).toMatchObject({
    model: 'gemini-3.1-flash-lite-image',
    response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: '16:9', image_size: '1K' },
  });
});

it('이미지 없는 응답을 저장할 바이트로 취급하지 않는다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'completed', steps: [{ type: 'model_output', content: [] }] }),
  } as Response);
  await expect(generateWeddingFeedImage('test-key', {
    kind: 'body', title: '제목', summary: '', body: '',
  })).rejects.toThrow('PNG가 없다');
});
