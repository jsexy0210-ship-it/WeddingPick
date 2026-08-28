import { z } from 'zod';

import { idSchema } from './common';

/**
 * 기기 등록.
 *
 * 푸시 알림은 운영자에게만 간다 — 파기 예정 원본이 생겼다는 알림이다. 그런데
 * 등록 자체는 누구나 한다. 운영자인지 아닌지는 서버가 보낼 때 판단하고, 앱은
 * 자기가 운영자인지 알 필요가 없다.
 *
 * 이 경로로는 어떤 권한도 오르지 않는다. 토큰을 등록한다고 알림을 받게 되는 것이
 * 아니다 — 운영자 표시는 사람이 DB에서 직접 켠다.
 */
export const registerDeviceRequestSchema = z.object({
  /** Expo 푸시 토큰. `ExponentPushToken[...]` 꼴이 아니면 받지 않는다. */
  token: z.string().trim().min(1).max(500),
  platform: z.enum(['ios', 'android']),
});

export const registerDeviceResponseSchema = z.object({
  deviceId: idSchema,
});

export type RegisterDeviceRequest = z.infer<typeof registerDeviceRequestSchema>;
export type RegisterDeviceResponse = z.infer<typeof registerDeviceResponseSchema>;
