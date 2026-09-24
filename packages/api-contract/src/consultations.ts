import {
  CONSULTATION_CATEGORIES,
  CONSULTATION_STATUSES,
  STORED_CONSULTATION_CATEGORIES,
  VISIT_NOTE_AUDIO_TYPES,
} from '@weddingpick/domain';
import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

/**
 * 상담기록 — 녹음을 올리고, 읽어낸 것을 확인하고, 저장한다.
 *
 * **모델이 뽑은 값은 확정이 아니다**(2026-09-14 요청 §6). 계약이 그 사실을 담는다 —
 * `confirmedAt`이 비어 있는 동안은 「확인 필요」이고, 그 상태의 기록으로 방문노트를
 * 만들지 않는다.
 *
 * **녹취록을 주고받는 칸이 없다.** 담을 곳이 없으면 오갈 수도 없다.
 */

export const consultationCategorySchema = z.enum(CONSULTATION_CATEGORIES);
/** 응답이 읽는 분류 — 2026-09-24 전에 저장된 결정사 기록까지 받는다. */
export const storedConsultationCategorySchema = z.enum(STORED_CONSULTATION_CATEGORIES);
export const consultationStatusSchema = z.enum(CONSULTATION_STATUSES);

/**
 * 올리기 전에 말하는 것.
 *
 * 형식과 길이를 **미리** 받는다 — 거절당한 호출도 과금되므로 서버가 부르기 전에
 * 막는다. 파일 본체는 서명 URL로 스토리지에 바로 올린다(문서 업로드와 같은 길).
 */
export const createConsultationUploadRequestSchema = z.object({
  weddingId: idSchema,
  mimeType: z.enum(VISIT_NOTE_AUDIO_TYPES),
  /**
   * 앱이 아는 길이(초). **힌트다.**
   *
   * 보내면 서버가 올리기 전에 한 번 걸러 준다 — 두 시간짜리를 올리고 나서
   * 거절당하는 것보다 낫다. 다만 **이 값을 비용 기준으로 믿지 않는다.**
   * 보내는 쪽이 정하는 값이라 2시간짜리를 60초라고 적을 수 있다.
   *
   * 진짜 검사는 파일이 도착한 뒤 `ffprobe`가 잰 값으로 한다.
   */
  seconds: z.number().int().positive().optional(),
  byteSize: z.number().int().positive(),
  /** 사용자가 업체를 먼저 고른다. 못 고르면 1차 판정이 정한다. */
  vendorId: idSchema.optional(),
  vendorLabel: z.string().min(1).max(100).optional(),
  category: consultationCategorySchema.optional(),
  /** 무엇에 동의하고 올리는지. 문구가 바뀌면 예전 동의는 그 새 내용의 동의가 아니다. */
  consentVersion: z.string().min(1),
});

export const createConsultationUploadResponseSchema = z.object({
  consultationId: idSchema,
  uploadUrl: z.url(),
  storageKey: z.string().min(1),
  expiresAt: timestampSchema,
});

/** 금액 한 칸. 사용자가 고칠 수 있게 근거를 함께 준다. */
export const consultationMoneySchema = z.object({
  value: z.number().int().nullable(),
  confidence: z.number().min(0).max(1),
  /** 그 금액을 말한 대목. 40자를 넘지 않는다 — 넘으면 그것이 녹취록이다. */
  evidence: z.string().max(40).nullable(),
});

/**
 * 읽어낸 결과.
 *
 * `common`·`categoryData`·`after`는 **업종마다 칸이 달라** 열로 펴지 않는다.
 * 화면은 `spec/strings.ko.json`이 가진 이름표로 그린다 — **서버가 화면 문구를
 * 만들어 내려보내지 않는다.** 그러면 금지어 검사를 지나지 않은 말이 화면에 뜬다.
 */
export const consultationRecordSchema = z.object({
  id: idSchema,
  weddingId: idSchema,
  vendorId: idSchema.nullable(),
  vendorLabel: z.string().nullable(),

  status: consultationStatusSchema,
  category: storedConsultationCategorySchema.nullable(),
  confidence: z.number().min(0).max(1).nullable(),

  common: z.record(z.string(), z.unknown()),
  categoryData: z.record(z.string(), z.unknown()),
  after: z.record(z.string(), z.unknown()),

  /** 비어 있으면 「확인 필요」다. 사용자가 보고 고친 뒤에 찬다. */
  confirmedAt: timestampSchema.nullable(),
  /**
   * 원본을 지웠는가. **화면이 이것을 보여준다** — 「바로 지워요」라고 약속했으면
   * 지워졌다는 것도 보여야 한다.
   */
  audioDeletedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export const consultationListResponseSchema = z.object({
  records: z.array(consultationRecordSchema),
});

/**
 * 사용자가 고친 것.
 *
 * **셋 다 선택이다.** 한 칸만 고치는 것이 보통이고, 안 보낸 칸을 지우지 않는다.
 */
export const updateConsultationRequestSchema = z.object({
  vendorId: idSchema.nullable().optional(),
  vendorLabel: z.string().min(1).max(100).nullable().optional(),
  common: z.record(z.string(), z.unknown()).optional(),
  categoryData: z.record(z.string(), z.unknown()).optional(),
});

export type ConsultationRecord = z.infer<typeof consultationRecordSchema>;
export type CreateConsultationUploadRequest = z.infer<
  typeof createConsultationUploadRequestSchema
>;
export type CreateConsultationUploadResponse = z.infer<
  typeof createConsultationUploadResponseSchema
>;
export type ConsultationListResponse = z.infer<typeof consultationListResponseSchema>;
export type UpdateConsultationRequest = z.infer<typeof updateConsultationRequestSchema>;
