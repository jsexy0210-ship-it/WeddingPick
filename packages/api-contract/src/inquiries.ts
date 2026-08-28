import { INQUIRY_CATEGORIES, INQUIRY_STATUSES } from '@weddingpick/domain';
import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

export const inquiryCategorySchema = z.enum(INQUIRY_CATEGORIES);
export const inquiryStatusSchema = z.enum(INQUIRY_STATUSES);

export const inquirySubjectSchema = z.object({
  kind: z.enum(['planner', 'vendor', 'quote']),
  id: idSchema,
});

/**
 * 문의 접수.
 *
 * 필요 이상으로 받지 않는다 — 이름도 주소도 묻지 않고, 회신할 방법 하나만 받는다.
 * 로그인한 사용자는 앱으로 답을 받으므로 그것도 비워둘 수 있다.
 */
export const createInquiryRequestSchema = z.object({
  category: inquiryCategorySchema,
  body: z.string().trim().min(1).max(4000),
  /** 무엇에 대한 문의인지. 노출 중단 요청에는 반드시 있어야 한다. */
  subject: inquirySubjectSchema.optional(),
  /** 앱 말고 다른 곳으로 답을 받고 싶을 때. */
  contact: z.string().trim().min(1).max(200).optional(),
});

/**
 * 접수 응답.
 *
 * `status`가 `'received'` 하나뿐이다. 인증 신청과 같은 이유다 — 접수와 동시에 처리된
 * 것처럼 답할 방법을 계약에서 없앤다. 서비스정책서 6번의 재검토는 사람이 한다.
 */
export const createInquiryResponseSchema = z.object({
  inquiryId: idSchema,
  status: z.literal('received'),
  receivedAt: timestampSchema,
  /** 접수 확인 문구. 기한이 정해지기 전에는 날짜를 약속하지 않는다. */
  acknowledgement: z.string().min(1),
});

export const inquirySchema = z.object({
  id: idSchema,
  category: inquiryCategorySchema,
  body: z.string().min(1),
  status: inquiryStatusSchema,
  subject: inquirySubjectSchema.nullable(),
  receivedAt: timestampSchema,
  decidedAt: timestampSchema.nullable(),
  /** 어떻게 처리했는지. 아직 결론이 없으면 null. */
  resolution: z.string().nullable(),
});

export const inquiryListResponseSchema = z.object({
  inquiries: z.array(inquirySchema),
});

export type CreateInquiryRequest = z.infer<typeof createInquiryRequestSchema>;
export type CreateInquiryResponse = z.infer<typeof createInquiryResponseSchema>;
export type Inquiry = z.infer<typeof inquirySchema>;
export type InquiryListResponse = z.infer<typeof inquiryListResponseSchema>;
