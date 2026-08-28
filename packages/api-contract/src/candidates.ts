import { MAX_CANDIDATE_NOTE_LENGTH } from '@weddingpick/domain';
import { z } from 'zod';

import { idSchema, timestampSchema, vendorCategorySchema } from './common';

/**
 * 담아둔 업체 한 줄.
 *
 * 가격은 없다. 목록에 가격을 실으면 Level 3 잠금을 우회하는 길이 생기고, 무엇보다
 * 후보 목록은 "무엇을 견주는 중인가"를 보는 자리지 값을 보는 자리가 아니다.
 */
export const vendorCandidateSchema = z.object({
  id: idSchema,
  vendorId: idSchema,
  vendorName: z.string().min(1),
  category: vendorCategorySchema,
  region: z.string().min(1),
  note: z.string().nullable(),
  addedAt: timestampSchema,
  /** 배우자가 담았는지. 상대가 마음에 들어 한 곳인지 알아야 이야기가 된다. */
  addedByPartner: z.boolean(),
});

export const createCandidateRequestSchema = z.object({
  vendorId: idSchema,
  note: z.string().trim().max(MAX_CANDIDATE_NOTE_LENGTH).optional(),
});

/**
 * 후보 목록.
 *
 * 업종별로 나눠 내려간다. 서른 곳을 한 줄로 늘어놓으면 무엇을 견주는 중인지
 * 보이지 않는다. `comparable`은 그 업종에 두 곳 이상이 있어 비교를 시작할 수
 * 있다는 뜻이다 — 업종이 섞이면 그 표는 아무것도 말하지 않는다.
 */
export const candidateListResponseSchema = z.object({
  groups: z.array(
    z.object({
      category: vendorCategorySchema,
      categoryLabel: z.string().min(1),
      candidates: z.array(vendorCandidateSchema),
      comparable: z.boolean(),
    })
  ),
  total: z.int().nonnegative(),
  /** 몇 곳까지 담을 수 있는지. 화면이 남은 자리를 말할 수 있어야 한다. */
  limit: z.int().positive(),
});

export type VendorCandidate = z.infer<typeof vendorCandidateSchema>;
export type CreateCandidateRequest = z.infer<typeof createCandidateRequestSchema>;
export type CandidateListResponse = z.infer<typeof candidateListResponseSchema>;
