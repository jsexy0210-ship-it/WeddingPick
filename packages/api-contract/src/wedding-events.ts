import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

/* -------------------------------------------------------------------------- */
/* 일정                                                                       */
/* -------------------------------------------------------------------------- */
//
// 웨딩 스케줄(wedding-plan.ts의 weddingTaskSchema, 체크리스트)과 다른 개념이다.
// 여기는 일시·장소가 있는 실제 캘린더 이벤트다.

export const weddingEventSourceSchema = z.enum(['manual', 'auto']);

/** 저장하지 않는다. startsAt과 지금을 비교해 서버가 매번 계산한다. */
export const weddingEventStatusSchema = z.enum(['upcoming', 'done']);

export const weddingEventSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  startsAt: timestampSchema,
  location: z.string().nullable(),
  vendorId: idSchema.nullable(),
  vendorLabel: z.string().nullable(),
  memo: z.string().nullable(),
  notifyEnabled: z.boolean(),
  /** 지금은 항상 'manual'. 훗날 업체 결정에서 자동 생성될 자리만 미리 둔다. */
  source: weddingEventSourceSchema,
  status: weddingEventStatusSchema,
});

export const weddingEventListResponseSchema = z.object({
  events: z.array(weddingEventSchema),
});

export const createWeddingEventRequestSchema = z.object({
  title: z.string().trim().min(1).max(60),
  startsAt: timestampSchema,
  location: z.string().trim().max(120).optional(),
  vendorId: idSchema.optional(),
  vendorLabel: z.string().trim().max(60).optional(),
  memo: z.string().trim().max(1000).optional(),
  notifyEnabled: z.boolean().default(true),
});

export const updateWeddingEventRequestSchema = z.object({
  title: z.string().trim().min(1).max(60).optional(),
  startsAt: timestampSchema.optional(),
  location: z.string().trim().max(120).nullable().optional(),
  vendorId: idSchema.nullable().optional(),
  vendorLabel: z.string().trim().max(60).nullable().optional(),
  memo: z.string().trim().max(1000).nullable().optional(),
  notifyEnabled: z.boolean().optional(),
});

export type WeddingEventSource = z.infer<typeof weddingEventSourceSchema>;
export type WeddingEventStatus = z.infer<typeof weddingEventStatusSchema>;
export type WeddingEvent = z.infer<typeof weddingEventSchema>;
export type WeddingEventListResponse = z.infer<typeof weddingEventListResponseSchema>;
export type CreateWeddingEventRequest = z.infer<typeof createWeddingEventRequestSchema>;
export type UpdateWeddingEventRequest = z.infer<typeof updateWeddingEventRequestSchema>;
