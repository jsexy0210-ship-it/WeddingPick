import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

/** 앱이 올릴 수 있는 형식. 견적서는 사진 아니면 PDF다. */
export const uploadMimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/heic', 'application/pdf']);

/**
 * 무엇을 찍은 것인가.
 *
 * **보관 기간이 이 값으로 갈린다** — 결제내역 24시간, 그 밖 30일. 그래서 등록할
 * 때가 아니라 올릴 때 받는다. 나중에 정하게 두면, 찍어만 두고 등록하지 않은
 * 결제내역이 30일짜리 문서로 남는다.
 */
export const originalKindSchema = z.enum(['document', 'payment_proof']);

export const createUploadRequestSchema = z.object({
  weddingId: idSchema,
  kind: originalKindSchema.default('document'),
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

export type OriginalKind = z.infer<typeof originalKindSchema>;
export type CreateUploadRequest = z.infer<typeof createUploadRequestSchema>;
export type CreateUploadResponse = z.infer<typeof createUploadResponseSchema>;
export type CompleteUploadResponse = z.infer<typeof completeUploadResponseSchema>;
