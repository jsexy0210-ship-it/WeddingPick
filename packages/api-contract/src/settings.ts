import { z } from 'zod';

import { timestampSchema } from './common';

/**
 * 설정. 디자인 핸드오프 19번.
 *
 * **스위치는 보내는 쪽이 보는 값이어야 한다.** v2.0 36번이 "사용자가 알림을 끄면
 * 발송하지 않는다"고 정했다 — 끌 수 있게 만들어놓고 보내는 쪽이 안 보면 그 스위치는
 * 장식이다.
 */
export const settingsSchema = z.object({
  /** 계정 ID. 운영자 지정(CLI `--operator <user-id>`)·문의 때 본인이 읽어 줄 값. */
  userId: z.string(),
  /** 서비스 알림 전체. */
  pushEnabled: z.boolean(),
  /** 관심업체 가격 변동 알림. v2.0 37번 — 서비스 알림과 따로 끈다. */
  priceChangeEnabled: z.boolean(),

  /** 결제인증에 동의했는가. 안 했으면 등록 전에 동의 화면을 지난다. */
  paymentConsent: z.boolean(),
  paymentConsentAt: timestampSchema.nullable(),

  /** 예식일·지역과 배우자. 설정에서 바로 보이고 눌러서 바꾼다. */
  weddingDate: z.string().nullable(),
  region: z.string().nullable(),
  spouseLinked: z.boolean(),

  /**
   * 부를 이름. 최소 온보딩에서 뺀 값이라 여기가 정하는 자리다(v3.10 §3).
   *
   * null은 "안 부름"이다. 홈은 그때 이름 없이 인사한다 — 없는 이름을 지어내
   * 부르지 않는다.
   */
  displayName: z.string().nullable(),
});

export const updateSettingsRequestSchema = z.object({
  pushEnabled: z.boolean().optional(),
  priceChangeEnabled: z.boolean().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;
