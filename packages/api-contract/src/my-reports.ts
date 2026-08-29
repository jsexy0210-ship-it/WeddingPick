import { REPORT_KINDS } from '@weddingpick/domain';
import { z } from 'zod';

import { amountSchema, idSchema, timestampSchema } from './common';

/**
 * 내가 낸 자료 한 줄.
 *
 * 세 가지가 한 목록에 서지만 **합쳐지지 않는다** — 종류가 행마다 붙고, 그 자료가
 * 어디에 쓰이는지도 함께 붙는다. 내가 낸 것이 무엇에 쓰이는지 모르는 채로 쌓이면
 * 그건 제보가 아니라 수집이다.
 */
export const myReportSchema = z.object({
  id: idSchema,
  kind: z.enum(REPORT_KINDS),
  kindLabel: z.string().min(1),
  /** 이 자료가 어디에 쓰이는지. */
  use: z.string().min(1),
  /** 업체 이름. 아직 업체를 못 찾은 결제인증은 가맹점 이름이 온다. */
  subject: z.string().min(1),
  vendorId: idSchema.nullable(),
  amount: amountSchema.nullable(),
  reportedAt: timestampSchema,
  /**
   * 이 자료가 지금 쓰이고 있는가.
   *
   * 업체를 못 찾은 결제인증, 허위로 판단해 뺀 가격제보처럼 남아 있지만 쓰이지
   * 않는 것이 있다. 목록에 세워두고 쓰인다고 말하면 그건 거짓이다.
   */
  inUse: z.boolean(),
  note: z.string().nullable(),
});

export const myReportListResponseSchema = z.object({
  reports: z.array(myReportSchema),
});

export type MyReport = z.infer<typeof myReportSchema>;
export type MyReportListResponse = z.infer<typeof myReportListResponseSchema>;
