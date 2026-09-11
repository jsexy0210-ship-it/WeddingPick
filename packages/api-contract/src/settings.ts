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
  /** Pick한 곳의 가격 변동 알림. v2.0 37번 — 서비스 알림과 따로 끈다. */
  priceChangeEnabled: z.boolean(),

  /**
   * 마케팅 알림(혜택 · 이벤트). 시안 13-my-sub WP-MY-007 «알림 수신».
   *
   * **다른 스위치와 저장하는 자리가 다르다.** 이건 법적 동의 항목이라
   * `notification_settings`의 불리언이 아니라 동의 이력(`user_consents`
   * `item = 'marketing'`)이 원본이다 — 언제 켰고 언제 껐는지에 답할 수 있어야
   * 하고, 불리언 한 칸은 마지막 상태만 남기고 그 답을 지운다.
   */
  marketingEnabled: z.boolean(),
  /** 지금 살아 있는 마케팅 동의를 언제 받았는가. 꺼져 있으면 null이다. */
  marketingConsentAt: timestampSchema.nullable(),

  /**
   * 야간(한국시간 21:00 이상 ~ 다음 날 08:00 미만) 푸시를 받는가.
   *
   * 꺼져 있으면 그 동안 푸시를 생략한다. 알림함은 그대로 남고, 아침에 누적 푸시를
   * 재발송하지 않는다(AGENTS.md · 사용자 승인 2026-09-06).
   *
   * **기본이 꺼짐이다.** 시안이 꺼진 상태로 그렸다(13-my-sub WP-MY-007).
   */
  nightPushEnabled: z.boolean(),

  /** 결제인증에 동의했는가. 안 했으면 등록 전에 동의 화면을 지난다. */
  paymentConsent: z.boolean(),
  paymentConsentAt: timestampSchema.nullable(),

  /**
   * 견적서 업로드에 동의했는가. 안 했으면 올리기 전에 동의 화면을 지난다.
   *
   * 결제인증과 따로 받는다 — 읽어가는 것도 쓰는 곳도 다르고, 한쪽만 하고 싶은
   * 사람이 다른 쪽까지 동의하게 되면 그건 동의가 아니라 묶음이다.
   */
  documentConsent: z.boolean(),
  documentConsentAt: timestampSchema.nullable(),

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
  /** 켜면 마케팅 동의를 새로 남기고, 끄면 살아 있는 동의를 철회한다. */
  marketingEnabled: z.boolean().optional(),
  nightPushEnabled: z.boolean().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>;
