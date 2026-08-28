import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

/** 앱이 올릴 수 있는 형식. 견적서는 사진 아니면 PDF다. */
export const uploadMimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/heic', 'application/pdf']);

export const createUploadRequestSchema = z.object({
  weddingId: idSchema,
  pages: z
    .array(
      z.object({
        mimeType: uploadMimeTypeSchema,
        sizeBytes: z.int().positive().max(20 * 1024 * 1024),
      })
    )
    .min(1)
    .max(30),
});

/**
 * 파일 본체는 API 서버를 거치지 않고 스토리지로 바로 올린다.
 * 서명된 URL이라 스토리지 제공자가 바뀌어도 계약은 그대로다.
 */
export const createUploadResponseSchema = z.object({
  rawDocumentId: idSchema,
  uploads: z
    .array(
      z.object({
        pageIndex: z.int().nonnegative(),
        uploadUrl: z.url(),
        storageKey: z.string().min(1),
        expiresAt: timestampSchema,
      })
    )
    .min(1),
});

/** 업로드가 끝났음을 알리면 분석이 시작된다. */
export const completeUploadResponseSchema = z.object({
  rawDocumentId: idSchema,
  analysisId: idSchema,
});

export type CreateUploadRequest = z.infer<typeof createUploadRequestSchema>;
export type CreateUploadResponse = z.infer<typeof createUploadResponseSchema>;
export type CompleteUploadResponse = z.infer<typeof completeUploadResponseSchema>;
