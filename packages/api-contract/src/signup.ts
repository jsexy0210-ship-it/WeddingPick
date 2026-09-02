import { CONSENT_ITEMS } from '@weddingpick/domain';
import { z } from 'zod';

import { dateSchema, timestampSchema } from './common';

const consentKeys = CONSENT_ITEMS.map((item) => item.key) as [string, ...string[]];

/**
 * 가입 완료 절차. 통합정책 v3.13 §N.
 *
 * 로그인은 대기 계정을 만들 뿐이다. 이 요청이 통과해야 계정이 살아난다.
 */
export const completeSignupRequestSchema = z.object({
  /**
   * 소셜 제공값이 없을 때만 직접 입력하는 생년월일. 서버가 세어보고 버린다.
   *
   * 정책 §N-3이 남기라고 한 것은 약관 판·항목·필수 여부·동의 일시다. 생년월일은
   * 그 목록에 없고, 직접 입력값은 저장하지 않는다. 제공자가 확인한 값은 신원 영역에 있다.
   */
  birthDate: dateSchema.optional(),
  /** 동의한 항목. 필수가 하나라도 빠지면 거절한다. */
  consents: z.array(z.enum(consentKeys)),
});

export const consentItemSchema = z.object({
  item: z.enum(consentKeys),
  label: z.string(),
  /** 필수와 선택을 화면에서도 DB에서도 가른다(§N-2). */
  required: z.boolean(),
  version: z.string(),
  /** 이미 동의했으면 그때. 아직이면 null. */
  grantedAt: timestampSchema.nullable(),
});

export const signupStateSchema = z.object({
  /** 가입이 끝났는가. false면 앱은 동의 화면부터 보여준다. */
  activated: z.boolean(),
  /** 연령 확인 결과. `blocked`면 되돌릴 길이 없다. */
  ageGate: z.enum(['pending', 'passed', 'blocked']),
  minimumAge: z.int().positive(),
  /** 소셜 제공자가 생년월일을 확인했는가. 값 자체는 다시 내려보내지 않는다. */
  birthDateVerified: z.boolean(),
  items: z.array(consentItemSchema),
  /** 아직 받지 못한 필수 항목. 빈 배열이면 활성화할 수 있다. */
  missingRequired: z.array(z.enum(consentKeys)),
});

export type CompleteSignupRequest = z.infer<typeof completeSignupRequestSchema>;
export type ConsentItemState = z.infer<typeof consentItemSchema>;
export type SignupState = z.infer<typeof signupStateSchema>;
