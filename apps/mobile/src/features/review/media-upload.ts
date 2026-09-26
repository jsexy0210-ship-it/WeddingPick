import type { CreateReviewRequest } from '@weddingpick/api-contract';

import { ApiError, UploadTimeoutError, uploadReviewMediaFile } from '@/api/client';
import type { CapturedPage } from '@/features/capture/types';

/** 서버 상한(`reviews.ts` `REVIEW_IMAGE_MAX_BYTES`) · 운영 Nginx `= /v1/reviews/media`(10m)와 같은 값. */
const MAX_REVIEW_IMAGE_BYTES = 10 * 1024 * 1024;

export const REVIEW_PHOTO_TOO_LARGE = '후기 사진은 10MB 이하만 올릴 수 있어요.';
export const REVIEW_PHOTO_TIMEOUT = '사진을 올리는 시간이 너무 길어졌어요. 연결을 확인하고 다시 올려주세요.';

export type UploadedReviewMedia = CreateReviewRequest['media'][number];

/**
 * 선택한 후기 사진 한 장을 **같은 출처 API**로 올린다(`POST /v1/reviews/media`, 2026-09-26).
 *
 * 서명 URL로 저장소에 바로 올리던 길은 브라우저 CORS preflight에서 막혔다(e66dec7e) — 웹에서는
 * 사진 후기가 올라가지 않았다. 네이티브도 같은 길을 쓴다. 서버가 열쇠를 짓고 저장소로 흘려 보낸다.
 * 반환값에는 서버가 후기 쓰기에서 다시 검증할 storageKey와 권리 확인만 남긴다.
 */
export async function uploadReviewMedia(page: CapturedPage): Promise<UploadedReviewMedia> {
  const blob = await fetch(page.uri).then((response) => response.blob());

  if (blob.size === 0 || blob.size > MAX_REVIEW_IMAGE_BYTES) {
    throw new Error(REVIEW_PHOTO_TOO_LARGE);
  }

  const mimeType = page.mimeType as UploadedReviewMedia['mimeType'];

  try {
    const uploaded = await uploadReviewMediaFile(blob, mimeType);

    return {
      storageKey: uploaded.storageKey,
      mimeType: uploaded.mimeType,
      rightsConfirmed: true,
    };
  } catch (caught) {
    /* 운영 Nginx가 먼저 막은 413은 본문이 HTML이라 서버 문장이 없다. */
    if (caught instanceof ApiError && caught.status === 413) throw new Error(REVIEW_PHOTO_TOO_LARGE);
    if (caught instanceof UploadTimeoutError) throw new Error(REVIEW_PHOTO_TIMEOUT);
    throw caught;
  }
}
