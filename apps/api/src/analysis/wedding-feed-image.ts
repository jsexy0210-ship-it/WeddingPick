import { z } from 'zod';

/** 웨딩피드 이미지에만 사용한다. 글 작성 모델 설정은 공유하지 않는다. */
export const WEDDING_FEED_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

export const feedImageRequestSchema = z.object({
  kind: z.enum(['thumbnail', 'body']),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(240).default(''),
  body: z.string().trim().max(4000).default(''),
});

export type FeedImageRequest = z.infer<typeof feedImageRequestSchema>;

const imageResponseSchema = z.object({
  status: z.string(),
  steps: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({
      type: z.string(),
      data: z.string().optional(),
      mime_type: z.string().optional(),
    })).optional(),
  })).optional(),
});

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function generateWeddingFeedImage(apiKey: string, input: FeedImageRequest): Promise<Buffer> {
  const prompt = [
    '한국의 결혼 준비 정보 글에 사용할 삽화 한 장을 만들어라.',
    '실제 업체, 상표, 로고, 글자, 가격표, 식별 가능한 인물은 넣지 마라.',
    '완성된 이미지 한 장만 출력한다. 차분하고 선명한 편집 디자인 스타일로 그린다.',
    `용도: ${input.kind === 'thumbnail' ? '웨딩피드 대표 썸네일' : '웨딩피드 본문 삽화'}`,
    `제목: ${input.title}`,
    input.summary ? `요약: ${input.summary}` : '',
    input.body ? `본문 맥락: ${input.body.slice(0, 1200)}` : '',
  ].filter(Boolean).join('\n');

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    signal: AbortSignal.timeout(120_000),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      model: WEDDING_FEED_IMAGE_MODEL,
      input: prompt,
      response_format: {
        type: 'image',
        mime_type: 'image/png',
        aspect_ratio: input.kind === 'thumbnail' ? '16:9' : '4:3',
        image_size: '1K',
      },
    }),
  });

  // 오류 본문에는 프롬프트가 되비칠 수 있으므로 응답 내용을 로그나 오류에 넣지 않는다.
  if (!response.ok) throw new Error(`웨딩피드 이미지 생성 요청 실패 (${response.status})`);
  const parsed = imageResponseSchema.safeParse(await response.json());
  if (!parsed.success || parsed.data.status !== 'completed') {
    throw new Error('웨딩피드 이미지 생성 응답이 완료되지 않았다.');
  }

  const image = parsed.data.steps
    ?.filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .find((part) => part.type === 'image' && part.mime_type === 'image/png' && part.data);
  if (!image?.data) throw new Error('웨딩피드 이미지 생성 응답에 PNG가 없다.');

  const bytes = Buffer.from(image.data, 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES ||
      !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('웨딩피드 이미지 생성 응답의 크기 또는 형식이 올바르지 않다.');
  }
  return bytes;
}
