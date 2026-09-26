import { CONSENT_ITEMS } from '@weddingpick/domain';
import { z } from 'zod';

import { timestampSchema } from './common';

const consentKeys = CONSENT_ITEMS.map((item) => item.key) as [string, ...string[]];

/**
 * 옛 앱이 아는 동의 항목 셋. **응답의 `items`는 이 셋만 담는다**(2026-09-26 대표 감사 8).
 *
 * 옛 앱은 `items[].item`을 `z.enum(['terms','privacy','marketing'])`으로 읽는다. 새 항목
 * (만 14세 · Pick 인증 …)이 `items`에 섞이면 옛 앱이 응답 전체를 거절하고, 가입 상태를
 * 묻는 로그인 복구까지 멈춘다 — API가 정적 화면보다 먼저 배포되는 사이에 실제로 난다.
 * 여덟 칸 전부는 새 칸 `agreements`에 담는다. 옛 앱의 zod는 모르는 칸을 버린다.
 */
export const LEGACY_SIGNUP_ITEMS = ['terms', 'privacy', 'marketing'] as const;

/**
 * 가입 완료 절차. 통합정책 v3.13 §3.5.
 *
 * 로그인은 대기 계정을 만들 뿐이다. 이 요청이 통과해야 계정이 살아난다.
 */
/**
 * **`ageVerified`를 받지 않는다**(2026-09-10). 예전에는 이 자리에 로그인 화면의
 * 체크박스 값이 들어왔고 서버가 그것으로 관문을 지켰는데, 앱은 늘 `true`를
 * 넣었다 — 관문이 아니라 통과 버튼이었다.
 *
 * 만 14세 확인은 로그인(`POST /v1/auth/sessions`)이 하고 결과는 DB에 있다. 이
 * 요청은 동의만 보낸다. 필드를 남겨두지 않는 이유는, 남아 있으면 다음 사람이
 * 다시 그것으로 관문을 지키기 때문이다.
 */
export const completeSignupRequestSchema = z.object({
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
  /** 가입이 끝났는가. false면 아직 동의가 남았다. */
  activated: z.boolean(),
  /**
   * 만 14세 이상 확인을 마쳤는가. 로그인이 이미 판정했으므로 세션을 가진 계정은
   * 언제나 true다 — false로 보이는 것은 관문이 생기기 전에 만들어진 계정뿐이고,
   * 그때는 이 요청이 `age_unverified`로 거절된다.
   */
  ageVerified: z.boolean(),
  minimumAge: z.int().positive(),
  /** 옛 앱과 맞춘 세 항목(`LEGACY_SIGNUP_ITEMS`). 새 화면은 `agreements`를 읽는다. */
  items: z.array(consentItemSchema),
  /**
   * 약관 동의(WP-AUTH-010)의 여덟 칸 전부. 옛 서버는 이 칸이 없어 비어 온다.
   * 항목 이름은 앞으로 늘 수 있어 문자열로 받는다 — 모르는 항목 하나로 응답을 버리지 않는다.
   */
  agreements: z.array(consentItemSchema.extend({ item: z.string() })).default([]),
  /** 아직 받지 못한 필수 항목. 빈 배열이면 활성화할 수 있다. */
  missingRequired: z.array(z.enum(consentKeys)),
});

export type CompleteSignupRequest = z.infer<typeof completeSignupRequestSchema>;
export type ConsentItemState = z.infer<typeof consentItemSchema>;
export type SignupState = z.infer<typeof signupStateSchema>;
