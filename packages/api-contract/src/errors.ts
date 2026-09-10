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
   * 나이를 **확인하지 못했다.** 미만으로 확인된 것과 다르다 — 카카오가 연령대를
   * 주지 않아 판정 자체를 못 한 경우다.
   *
   * 예전에는 이 자리를 로그인 화면의 「만 14세 이상이에요」 체크박스가 메웠다.
   * 핸드오프 v3.24가 그 체크박스를 없앴는데 서버는 「없으면 체크박스가 판정한다」
   * 그대로였고, 그래서 연령대를 못 받은 사람이 **아무 확인 없이 통과**했다
   * (2026-09-10 사용자 제보 — 만 14세 미만 계정이 실제로 가입됐다).
   *
   * 확인 못 한 것은 통과가 아니다. 계정을 만들지 않고 되돌린다.
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
