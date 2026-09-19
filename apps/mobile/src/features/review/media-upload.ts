import type { CreateReviewRequest } from '@weddingpick/api-contract';

import { createReviewMediaUploadTarget } from '@/api/client';
import type { CapturedPage } from '@/features/capture/types';

const MAX_REVIEW_IMAGE_BYTES = 10 * 1024 * 1024;

export type UploadedReviewMedia = CreateReviewRequest['media'][number];

/**
 * 선택한 후기 사진 한 장을 서명 URL로 직접 올린다.
 * 반환값에는 서버가 다시 검증할 storageKey와 권리 확인만 남긴다.
 */
export async function uploadReviewMedia(page: CapturedPage): Promise<UploadedReviewMedia> {
  const blob = await fetch(page.uri).then((response) => response.blob());

  if (blob.size === 0 || blob.size > MAX_REVIEW_IMAGE_BYTES) {
    throw new Error('후기 사진은 10MB 이하만 올릴 수 있어요.');
  }

  const target = await createReviewMediaUploadTarget({ mimeType: page.mimeType as UploadedReviewMedia['mimeType'] });
  const response = await fetch(target.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': page.mimeType },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`사진 업로드 실패 (${response.status})`);
  }

  return {
    storageKey: target.storageKey,
    mimeType: page.mimeType as UploadedReviewMedia['mimeType'],
    rightsConfirmed: true,
  };
}
