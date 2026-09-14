import {
  ACTIVITY_EVENT_NAMES,
  ACTIVITY_SURFACES,
  VENDOR_CATEGORIES,
  WEDDING_REGIONS,
} from '@weddingpick/domain';
import { z } from 'zod';

/**
 * 앱이 활동 원장에 보내는 줄.
 *
 * **서버가 볼 수 있는 것은 앱이 보내지 않는다.** 업체 열람·검색·Pick 담기는
 * 서버가 요청을 받는 자리에서 이미 안다(`activity-hook.ts`). 앱이 보내는 것은
 * 서버가 볼 수 없는 것뿐이다 — 화면 진입, 그리고 서버 호출이 따르지 않는 고르기.
 *
 * 같은 줄을 두 번 보내도 한 줄이다(`clientEventId`). 앱은 실패한 묶음을 마음 놓고
 * 다시 보낼 수 있다.
 */
export const activityEventSchema = z.object({
  /** 앱이 만든다. 재시도해도 같은 값이라 원장이 부풀지 않는다. */
  clientEventId: z.uuid(),
  eventName: z.enum(ACTIVITY_EVENT_NAMES),
  surface: z.enum(ACTIVITY_SURFACES),
  /** 앱에서 일어난 시각. 없으면 서버가 받은 시각으로 적는다. */
  occurredAt: z.iso.datetime().optional(),
  category: z.enum(VENDOR_CATEGORIES).optional(),
  /** 짧은 꼴 아홉만. 자유 입력은 집계층에서 접을 수 없다. */
  region: z.enum(WEDDING_REGIONS).optional(),
  /** 온보딩 몇 번째 단계인가. */
  step: z.number().int().min(1).max(9).optional(),
});

export type ActivityEvent = z.infer<typeof activityEventSchema>;

/**
 * 한 번에 보내는 묶음. **50줄까지다** — 앱이 오래 꺼져 있다 켜져도 한 요청이
 * 통째로 커지지 않게.
 */
export const recordActivityRequestSchema = z.object({
  events: z.array(activityEventSchema).min(1).max(50),
});

export type RecordActivityRequest = z.infer<typeof recordActivityRequestSchema>;

/**
 * 받은 줄 수. **앱은 이 값을 쓰지 않는다** — 원장이 안 적혔다고 화면이 달라질
 * 일은 없다. 시험과 관리자 쪽이 본다.
 */
export const recordActivityResponseSchema = z.object({
  accepted: z.number().int().min(0),
});

export type RecordActivityResponse = z.infer<typeof recordActivityResponseSchema>;
