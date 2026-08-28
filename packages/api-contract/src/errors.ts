import { z } from 'zod';

export const ERROR_CODES = [
  'unauthenticated',
  'forbidden',
  'not_found',
  'invalid_request',
  'conflict',
  /** 확인되지 않은 핵심 필드가 남아 있다. 서비스정책서 1번. */
  'confirmation_required',
  /** 분석이 아직 끝나지 않았다. */
  'analysis_pending',
  'rate_limited',
  'internal',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    /** 사용자에게 그대로 보여도 되는 한국어 문장 */
    message: z.string().min(1),
    /** 필드 단위 문제를 짚어야 할 때만 */
    details: z.record(z.string(), z.string()).optional(),
  }),
});

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
