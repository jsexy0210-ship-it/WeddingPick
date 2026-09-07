import { CONSENT_ITEMS } from '@weddingpick/domain';
import { z } from 'zod';

import { timestampSchema } from './common';

const consentKeys = CONSENT_ITEMS.map((item) => item.key) as [string, ...string[]];

/**
 * 가입 완료 절차. 통합정책 v3.13 §3.5.
 *
 * 로그인은 대기 계정을 만들 뿐이다. 이 요청이 통과해야 계정이 살아난다.
 */
export const completeSignupRequestSchema = z.object({
  /**
   * 로그인 화면의 «만 14세 이상이에요» 체크박스. 생년월일을 받지 않고 자기
   * 신고로만 확인한다 — false를 보내면(또는 아예 체크하지 않고 화면을
   * 억지로 지나오면) 계정을 만들지 않고 거절한다.
   */
  ageVerified: z.boolean(),
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
  /** 가입이 끝났는가. false면 앱은 로그인 화면(체크박스)부터 다시 보여준다. */
  activated: z.boolean(),
  /** 만 14세 이상 확인을 마쳤는가. */
  ageVerified: z.boolean(),
  minimumAge: z.int().positive(),
  items: z.array(consentItemSchema),
  /** 아직 받지 못한 필수 항목. 빈 배열이면 활성화할 수 있다. */
  missingRequired: z.array(z.enum(consentKeys)),
});

export type CompleteSignupRequest = z.infer<typeof completeSignupRequestSchema>;
export type ConsentItemState = z.infer<typeof consentItemSchema>;
export type SignupState = z.infer<typeof signupStateSchema>;
