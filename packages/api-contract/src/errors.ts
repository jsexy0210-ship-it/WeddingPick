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
  /**
   * 만 14세 미만으로 확인됐다(핸드오프 v3.22 SPEC 3.5). 계정을 만들지 않았고,
   * 앱은 WP-AUTH-010(이용 불가 안내)으로 보낸다.
   */
  'under_age',
  /**
   * 나이를 **확인하지 못했다.** 제공자가 연령대를 주지 않았고 화면의 확인도 받지
   * 못한 경우다. 계정을 만들지 않았다.
   *
   * `under_age`와 가른다 — 저쪽은 「미달로 확인됨」이고 이쪽은 「확인 자체가
   * 안 됨」이다. 둘을 한 코드로 묶으면 연령대를 못 받는 일이 늘어나도 미달자가
   * 늘어난 것처럼 보여, 설정이 틀어진 것을 아무도 눈치채지 못한다.
   */
  'age_unverified',
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
