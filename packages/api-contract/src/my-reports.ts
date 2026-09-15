import { PAYMENT_PROOF_FIELDS, REPORT_KINDS } from '@weddingpick/domain';
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
  /**
   * 아직 읽는 중이라 확인이 필요한가. WP-RPT-008의 «확인 필요».
   *
   * `inUse`가 거짓인 까닭은 둘이고, 사용자가 할 일이 다르다 — 업체를 못 찾은 것은
   * 우리가 이어붙이면 되고(할 일 없음), 자료를 못 읽은 것은 다시 올리면 된다.
   * 둘을 «반영 전» 하나로 적으면 어느 쪽인지 알 수 없다.
   */
  needsCheck: z.boolean(),
  note: z.string().nullable(),
  /**
   * 사람이 채울 수 있는 칸. WP-RPT-004 「직접 입력」으로 가는 길이 여기서 열린다.
   *
   * **칸 이름만 담는다**(2026-09-14 지시). 값도, 사람 이름도, 보류 사유 문장도 이
   * 배열에 들어가지 않는다 — 응답에 값을 실으면 그것은 목록이 아니라 유출이다.
   *
   * **문구는 서버가 만들지 않는다.** 「무엇을 더 적어야 하는지」를 서버가 문장으로
   * 내려보내면 카피 린트를 지나지 않은 말이 화면에 뜬다. 키만 주고 문장은
   * `spec/strings.ko.json`이 만든다.
   *
   * 결제인증이 아닌 줄과, 채울 것이 없는 줄은 빈 배열이다 — null을 두지 않는다.
   * 화면이 `?.length`로 물어보게 두면 어느 화면인가는 그것을 빠뜨린다.
   */
  pendingFields: z.array(z.enum(PAYMENT_PROOF_FIELDS)),
});

export const myReportListResponseSchema = z.object({
  reports: z.array(myReportSchema),
});

export type MyReport = z.infer<typeof myReportSchema>;
export type MyReportListResponse = z.infer<typeof myReportListResponseSchema>;
