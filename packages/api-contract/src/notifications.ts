import { NOTIFICATION_KINDS } from '@weddingpick/domain';
import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

/**
 * 알림 한 줄.
 *
 * **화면 경로가 없다.** 어디로 보낼지는 앱이 종류와 대상으로 정한다 — 경로를
 * 서버가 정해 내려보내면 화면 이름을 바꿀 때 이미 보낸 알림이 전부 막다른 길이
 * 된다.
 */
export const notificationSchema = z.object({
  id: idSchema,
  kind: z.enum(NOTIFICATION_KINDS),
  kindLabel: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  /** 무엇에 대한 알림인가. 종류마다 가리키는 것이 다르다. */
  targetId: idSchema.nullable(),
  createdAt: timestampSchema,
  readAt: timestampSchema.nullable(),
});

export const notificationListResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  /**
   * 안 읽은 개수. 홈의 빨간 점이 이 값을 본다.
   *
   * 목록에서 세지 않고 서버가 따로 준다 — 목록은 최근 것만 내려가므로, 세어서
   * 쓰면 오래된 안 읽은 알림이 점을 못 켠다.
   */
  unread: z.int().nonnegative(),
  total: z.int().nonnegative(),
});

/** 홈이 벨 하나 때문에 목록 전체를 받지 않아도 되게. */
export const notificationSummaryResponseSchema = z.object({
  unread: z.int().nonnegative(),
  total: z.int().nonnegative(),
});

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;
export type NotificationSummaryResponse = z.infer<typeof notificationSummaryResponseSchema>;
