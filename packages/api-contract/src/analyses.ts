import { z } from 'zod';

import { idSchema, timestampSchema } from './common';

/** 분석 진행 상태. A-06 화면이 이 값을 그대로 쓴다. */
export const analysisStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed']);

/** 실패 이유는 앱이 다음 행동을 고를 수 있을 만큼만 나눈다. */
export const analysisFailureSchema = z.enum([
  /** 글씨를 읽을 수 없다 — 다시 찍어야 한다 */
  'unreadable',
  /** 견적서·계약서로 보이지 않는다 */
  'not_a_document',
  /** 서버 문제 — 사용자가 할 일은 재시도뿐 */
  'internal',
]);

export const analysisSchema = z.discriminatedUnion('status', [
  z.object({
    id: idSchema,
    status: z.literal('pending'),
    startedAt: timestampSchema.nullable(),
  }),
  z.object({
    id: idSchema,
    status: z.literal('running'),
    startedAt: timestampSchema,
  }),
  z.object({
    id: idSchema,
    status: z.literal('succeeded'),
    startedAt: timestampSchema,
    finishedAt: timestampSchema,
    /** 성공했으면 반드시 문서가 하나 나온다. */
    quoteId: idSchema,
  }),
  z.object({
    id: idSchema,
    status: z.literal('failed'),
    startedAt: timestampSchema,
    finishedAt: timestampSchema,
    reason: analysisFailureSchema,
  }),
]);

export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
