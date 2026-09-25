import { z } from 'zod';

/**
 * 웨딩피드 이미지에만 사용한다. 글 작성 모델 설정(`config.geminiModel`)은 공유하지 않는다 —
 * 그 모델은 글만 쓰고 그림은 못 그린다.
 *
 * 2026-09-25 대표 지시 「이미지 생성 가능하도록 한다」. 이전 구현은 `v1beta/interactions`
 * 주소와 `gemini-3.1-flash-lite-image` 모델을 불렀는데, 시험이 fetch를 통째로 흉내 내서
 * 실제 서버에 한 번도 맞대어 본 적이 없었고 운영에서 계속 실패했다. 글쓰기(`gemini-call.ts`)
 * 와 같은 표준 `models/{model}:generateContent` 호출에 이미지 응답(`responseModalities`)을
 * 켜는 방식으로 바꿨다. 모델은 `GEMINI_IMAGE_MODEL`로 바꿀 수 있다.
 */
export const DEFAULT_WEDDING_FEED_IMAGE_MODEL = 'gemini-2.5-flash-image';

export function weddingFeedImageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_WEDDING_FEED_IMAGE_MODEL;
}

export const feedImageRequestSchema = z.object({
  kind: z.enum(['thumbnail', 'body']),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(240).default(''),
  body: z.string().trim().max(4000).default(''),
});

export type FeedImageRequest = z.infer<typeof feedImageRequestSchema>;

const imageResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({
            parts: z
              .array(
                z.object({
                  text: z.string().optional(),
                  inlineData: z.object({ mimeType: z.string(), data: z.string() }).optional(),
                })
              )
              .optional(),
          })
          .optional(),
      })
    )
    .optional(),
});

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** 저장소에 올릴 수 있는 꼴만 받는다. 머리 바이트로 한 번 더 확인한다. */
const IMAGE_TYPES = {
  'image/png': { extension: 'png', magic: [137, 80, 78, 71, 13, 10, 26, 10] },
  'image/jpeg': { extension: 'jpg', magic: [255, 216, 255] },
  'image/webp': { extension: 'webp', magic: [82, 73, 70, 70] },
} as const;

export type WeddingFeedImage = {
  bytes: Buffer;
  mimeType: keyof typeof IMAGE_TYPES;
  extension: string;
};

export class WeddingFeedImageError extends Error {
  constructor(readonly reason: 'provider' | 'incomplete' | 'missing_image' | 'invalid_image', readonly providerStatus?: number, readonly providerCode?: string) {
    super(reason === 'provider' ? `Gemini 이미지 요청 실패 (${providerStatus}${providerCode ? ` ${providerCode}` : ''})` : `Gemini 이미지 응답 오류 (${reason})`);
    this.name = 'WeddingFeedImageError';
  }
}

export async function generateWeddingFeedImage(apiKey: string, input: FeedImageRequest): Promise<WeddingFeedImage> {
  const prompt = [
    '한국의 결혼 준비 정보 글에 사용할 삽화 한 장을 만들어라.',
    '실제 업체, 상표, 로고, 글자, 가격표, 식별 가능한 인물은 넣지 마라.',
    '완성된 이미지 한 장만 출력한다. 차분하고 선명한 편집 디자인 스타일로 그린다.',
    `용도: ${input.kind === 'thumbnail' ? '웨딩피드 대표 썸네일' : '웨딩피드 본문 삽화'}`,
    `제목: ${input.title}`,
    input.summary ? `요약: ${input.summary}` : '',
    input.body ? `본문 맥락: ${input.body.slice(0, 1200)}` : '',
  ].filter(Boolean).join('\n');

  const model = weddingFeedImageModel();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(120_000),
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: input.kind === 'thumbnail' ? '16:9' : '4:3' },
        },
      }),
    }
  );

  // 오류 본문에는 프롬프트가 되비칠 수 있으므로 응답 내용을 로그나 오류에 넣지 않는다.
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const candidate = body && typeof body === 'object' && 'error' in body ? (body as { error?: unknown }).error : null;
    const code = candidate && typeof candidate === 'object' && 'status' in candidate ? (candidate as { status?: unknown }).status : null;
    const providerCode = typeof code === 'string' && /^[A-Z_]{1,50}$/.test(code) ? code : undefined;
    throw new WeddingFeedImageError('provider', response.status, providerCode);
  }
  const parsed = imageResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new WeddingFeedImageError('incomplete');
  }

  const image = (parsed.data.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.inlineData)
    .find((data): data is { mimeType: string; data: string } => Boolean(data?.data));
  if (!image) throw new WeddingFeedImageError('missing_image');

  const type = IMAGE_TYPES[image.mimeType as keyof typeof IMAGE_TYPES];
  const bytes = Buffer.from(image.data, 'base64');
  if (!type || !bytes.length || bytes.length > MAX_IMAGE_BYTES ||
      !bytes.subarray(0, type.magic.length).equals(Buffer.from(type.magic))) {
    throw new WeddingFeedImageError('invalid_image');
  }
  return { bytes, mimeType: image.mimeType as keyof typeof IMAGE_TYPES, extension: type.extension };
}
