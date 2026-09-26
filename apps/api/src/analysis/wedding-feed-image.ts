import { z } from 'zod';

import { GeminiImageError } from './gemini-call';
import { FEED_IMAGE_PEOPLE_RULE, feedImagePlanLines, type FeedImagePlan } from './wedding-feed-diversity';

/**
 * 웨딩피드 이미지 — 요청 모양 · 프롬프트 · 받은 그림 검사. **모델을 부르지 않는다.**
 *
 * 부르는 자리는 `wedding-feed-writer.ts`의 `generateWeddingFeedImage` 하나다(2026-09-26).
 * 전에는 이 파일이 `fetch`로 Gemini를 직접 불러 `gemini-scope.test.ts`의 허용 목록 밖에
 * 있었다 — 「관리자 피드 자동생성」 파일 하나로 모았다.
 *
 * 글 작성 모델 설정(`config.geminiModel`)은 공유하지 않는다 — 그 모델은 글만 쓰고 그림은
 * 못 그린다. 2026-09-25 대표 지시 「이미지 생성 가능하도록 한다」로 표준
 * `models/{model}:generateContent`에 이미지 응답(`responseModalities`)을 켜는 방식이다.
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
  /** 어느 카테고리의 그림인가. 최근 그림과 다르게 만드는 기준이다. 없으면 전체에서 본다. */
  categoryLabel: z.string().trim().max(20).optional(),
});

export type FeedImageRequest = z.infer<typeof feedImageRequestSchema>;

export const MAX_FEED_IMAGE_BYTES = 10 * 1024 * 1024;

/** 저장소에 올릴 수 있는 꼴만 받는다. 머리 바이트로 한 번 더 확인한다. */
export const FEED_IMAGE_TYPES = {
  'image/png': { extension: 'png' },
  'image/jpeg': { extension: 'jpg' },
  'image/webp': { extension: 'webp' },
} as const;

export type FeedImageMime = keyof typeof FEED_IMAGE_TYPES;

export type WeddingFeedImage = {
  bytes: Buffer;
  mimeType: FeedImageMime;
  extension: string;
};

/** 옛 이름. 관리자 라우트와 시험이 이 이름으로 잡는다. */
export { GeminiImageError as WeddingFeedImageError };

/** 첫 바이트가 말하는 형식. 이름표(Content-Type)만 믿으면 아무 파일이나 그림 자리에 담긴다. */
export function sniffFeedImageType(bytes: Buffer): FeedImageMime | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** 모델이 준 그림을 저장해도 되는지 본다 — 선언한 형식과 실제 바이트가 같아야 한다. */
export function readFeedImage(input: { mimeType: string; bytes: Buffer }): WeddingFeedImage {
  const declared = input.mimeType as FeedImageMime;
  const type = FEED_IMAGE_TYPES[declared];

  if (
    !type ||
    input.bytes.length === 0 ||
    input.bytes.length > MAX_FEED_IMAGE_BYTES ||
    sniffFeedImageType(input.bytes) !== declared
  ) {
    throw new GeminiImageError('invalid_image');
  }

  return { bytes: input.bytes, mimeType: declared, extension: type.extension };
}

export function feedImageAspectRatio(kind: FeedImageRequest['kind']): string {
  return kind === 'thumbnail' ? '16:9' : '4:3';
}

/**
 * 그림 요청 글.
 *
 * 2026-09-25 대표 지시 — 「이미지 내 텍스트는 안나오도록한다. 그리고 실사 이미지 위주로
 * 생성한다」. 글자는 한글·영문·숫자·간판·표지판·자막·워터마크까지 전부 막고, 삽화·
 * 일러스트가 아니라 사진처럼 찍은 실사 장면으로 요청한다.
 *
 * 2026-09-26 대표 지시 — 「이미지도 대부분 다 비슷비슷하다. 다르게 생성되어야한다」 ·
 * 「가상 모델은 동양인 한국인 기준으로만 생성한다」.
 *  - 전에는 화풍 지시(자연광 · 얕은 심도 · 따뜻한 색감)와 「사람은 뒷모습 · 손 · 실루엣만」이
 *    모든 요청에서 같았다. 그것을 빼고 **촬영 계획**(`plan` — 장소 · 구도 · 시간 · 계절 ·
 *    색감 · 소품 · 인원)을 넣는다. 계획은 최근 그림과 다르게 고른다(`chooseFeedImagePlan`).
 *  - 사람 규칙은 공용 상수(`FEED_IMAGE_PEOPLE_RULE`) 하나를 넣는다 — 시험이 센다.
 */
export function buildFeedImagePrompt(input: FeedImageRequest, plan: FeedImagePlan): string {
  return [
    '한국의 결혼 준비 정보 글에 쓸 실사 사진 한 장을 만들어라.',
    '카메라로 실제 촬영한 것 같은 사실적인 사진이어야 한다. 삽화, 일러스트, 만화, 3D 렌더, 그래픽 디자인 스타일은 쓰지 마라.',
    '이미지 안에 어떤 글자도 넣지 마라 — 한글, 영문, 숫자, 간판, 표지판, 라벨, 자막, 워터마크, 로고, 가격표 모두 금지.',
    FEED_IMAGE_PEOPLE_RULE,
    '실제 업체, 상표는 넣지 마라.',
    'Photorealistic photograph only. Absolutely no text, letters, numbers, signage, captions, logos or watermarks anywhere in the image.',
    '이번 사진의 촬영 계획 — 최근 사진과 다르게 보이도록 정한 것이다. 그대로 따른다:',
    ...feedImagePlanLines(plan),
    '완성된 이미지 한 장만 출력한다.',
    `용도: ${input.kind === 'thumbnail' ? '웨딩피드 대표 썸네일' : '웨딩피드 본문 사진'}`,
    `제목: ${input.title}`,
    input.summary ? `요약: ${input.summary}` : '',
    input.body ? `본문 맥락: ${input.body.slice(0, 1200)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
