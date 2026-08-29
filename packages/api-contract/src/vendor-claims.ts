import { CLAIM_METHODS, CLAIM_STATUSES, MIN_CLAIM_ROLE_LENGTH } from '@weddingpick/domain';
import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

/**
 * 업체 관계자 인증. 최종통합정책 v2.0 26·27번.
 *
 * **수단마다 필요한 것이 다르므로 갈래로 받는다.** 하나의 평평한 객체로 받으면
 * "공개된 이메일인데 어디에 공개돼 있는지 없는" 신청이 스키마를 통과하고, 그건
 * 심사하는 사람이 확인할 수 없는 신청이다.
 */
export const claimEvidenceSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('official_domain_email'),
    email: z.email().max(200),
  }),
  z.object({
    method: z.literal('listed_email'),
    email: z.email().max(200),
    /** 그 주소가 어디에 공개돼 있는지. 심사하는 사람이 그 자리를 열어본다. */
    listedAt: z.string().trim().min(1).max(300),
  }),
  z.object({
    method: z.literal('business_document'),
    documentId: idSchema,
  }),
]);

export const createVendorClaimRequestSchema = z.object({
  vendorId: idSchema,
  claimedRole: z.string().trim().min(MIN_CLAIM_ROLE_LENGTH).max(60),
  evidence: claimEvidenceSchema,
});

/**
 * 내가 낸 신청 한 줄.
 *
 * **증빙도 연락처도 돌려주지 않는다.** 낸 사람에게도 다시 보여줄 이유가 없고,
 * 응답에 담기지 않으면 화면 어디로도 새지 않는다(원문 27번).
 */
export const myVendorClaimSchema = z.object({
  id: idSchema,
  vendorId: idSchema,
  vendorName: z.string().min(1),
  claimedRole: z.string().min(1),
  method: z.enum(CLAIM_METHODS),
  methodLabel: z.string().min(1),
  status: z.enum(CLAIM_STATUSES),
  statusLabel: z.string().min(1),
  statusNote: z.string().min(1),
  decisionNote: z.string().nullable(),
  createdAt: timestampSchema,
});

export const vendorClaimListResponseSchema = z.object({
  claims: z.array(myVendorClaimSchema),
});

export type ClaimEvidenceInput = z.infer<typeof claimEvidenceSchema>;
export type CreateVendorClaimRequest = z.infer<typeof createVendorClaimRequestSchema>;
export type MyVendorClaim = z.infer<typeof myVendorClaimSchema>;
export type VendorClaimListResponse = z.infer<typeof vendorClaimListResponseSchema>;
