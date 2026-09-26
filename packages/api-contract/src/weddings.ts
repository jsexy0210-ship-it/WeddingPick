import {
  INVITE_CODE_LENGTH,
  INVITE_CODE_PATTERN,
  MANUAL_DECISION_NAME_MAX,
  MAX_DISPLAY_NAME_LENGTH,
  MEMBER_TIERS,
  PREPARATION_GROUPS,
  STYLE_PICK_MIN,
  WEDDING_BUDGET_BRACKETS,
  WEDDING_STYLES,
  type PreparationGroupKey,
} from '@weddingpick/domain';
import { z } from 'zod';

import { dateSchema, idSchema, preparationCategorySchema, timestampSchema } from './common';
import { weddingStyleSchema } from './vendors';

/** 준비 현황(3/5) 카드 수 — 카드마다 업체 한 곳까지 고른다. */
export const PREPARED_VENDOR_MAX = 4;

/** 준비 묶음 키 — 온보딩 3/5 카드 넷 · Pick 칩 · `/pick?group=`이 같은 값을 쓴다. */
export const preparationGroupKeySchema = z.enum(
  PREPARATION_GROUPS.map((group) => group.key) as [PreparationGroupKey, ...PreparationGroupKey[]]
);

/**
 * 준비 현황(3/5) 카드에서 **직접 입력한** 곳(2026-09-26 대표 지시 「직접입력하는 방법
 * 고안하라」). 우리 목록에 없어 검색으로 못 고른 곳의 이름이다. 앞뒤 공백은 떼고 1~30자.
 */
export const preparedManualVendorSchema = z.object({
  group: preparationGroupKeySchema,
  name: z.string().trim().min(1).max(MANUAL_DECISION_NAME_MAX),
});

/** 온보딩 4/5 예산 스텝. 핸드오프 v3.19가 정한 여섯 구간 중 하나 — 자유 입력이 아니다. */
export const budgetBracketSchema = z.enum(WEDDING_BUDGET_BRACKETS);

/**
 * 준비 현황(온보딩 3/5 · v3.19). 이미 정한 업종. 빈 배열이 «아직 시작 전이에요»다.
 * 홈 준비현황에 «결정 완료»로 들어가고 추천·TOP3·취향 질문에서 건너뛴다.
 */
export const preparedCategoriesSchema = z.array(preparationCategorySchema).max(12);

export const weddingSchema = z.object({
  id: idSchema,
  weddingDate: dateSchema.nullable(),
  /** 배우자 연결 전에는 null. 연결 후 "우리 웨딩"이 된다. 사업계획서 12번. */
  partnerLinked: z.boolean(),
  /** 준비 현황에서 이미 정했다고 고른 업종. */
  preparedCategories: preparedCategoriesSchema,
  createdAt: timestampSchema,
});

/**
 * 원본 계약서와 개인정보는 배우자 연결 시에도 자동 공유하지 않는다(이용약관 제5조).
 * 그래서 이 응답에는 상대방의 개인정보가 들어갈 자리가 없다.
 */
export const weddingMemberSchema = z.object({
  role: z.enum(['owner', 'partner']),
  joinedAt: timestampSchema,
  /** 이 응답을 받는 사람 자신인지. 이름 대신 이걸로 구분한다. */
  isMe: z.boolean(),
});

export const weddingDetailSchema = weddingSchema.extend({
  members: z.array(weddingMemberSchema).min(1).max(2),
});

/** 아직 웨딩이 없는 계정이 하나 만든다. 날짜는 나중에 정해도 된다. */
export const createWeddingRequestSchema = z.object({
  weddingDate: dateSchema.nullable().optional(),
});

export const currentUserSchema = z.object({
  userId: idSchema,
  weddingId: idSchema.nullable(),
  /** 부를 이름. 아직 안 정했으면 null. */
  displayName: z.string().nullable(),
  /** 예식일. 아직 안 정했으면 null. */
  weddingDate: dateSchema.nullable(),
  /** 준비 지역. «아직 정하지 않았어요»(v3.19)거나 아직 안 골랐으면 null. 업체 지역 목록과 같은 문자열이다. */
  region: z.string().nullable(),
  /** 준비 현황(온보딩 3/5)에서 이미 정했다고 고른 업종. 아직 시작 전이면 빈 배열. */
  preparedCategories: preparedCategoriesSchema,
  /**
   * 준비 예산 구간. 온보딩 4/5에서 고른 값 그대로다. 아직 안 골랐으면 null.
   *
   * `budgetAmount`는 지출 화면이 숫자 하나로 «예산 대비»를 그리려고 이 값에서
   * 서버가 파생한 상한값이다(packages/domain budgetBracketCeiling) — 화면에
   * 보여줄 값은 이 필드를 쓴다. 라벨은 «준비 예산».
   */
  budgetBracket: budgetBracketSchema.nullable(),
  /** budgetBracket에서 서버가 파생한 상한값. 화면 표시용이 아니라 지출 화면의 «예산 대비»용이다. */
  budgetAmount: z.int().positive().nullable(),
  /**
   * 초기 설정(5개 질문)을 마쳤는가.
   *
   * v3.19부터 예식일·지역·준비 현황·예산이 전부 «미정»일 수 있어(취향만 필수)
   * 값의 유무로는 알 수 없다 — 설정을 한 번 끝냈다는 사실을 서버가 따로 적는다.
   *
   * **앱이 이 값으로 첫 화면을 정한다.** 이름은 여기 들어가지 않는다 — 이름이
   * 없다고 첫 화면에 다시 붙잡아두면 그게 강제 가입이다.
   */
  setupComplete: z.boolean(),
  /**
   * 스타일(온보딩 5/5 · v3.22). 도시적인 · 자연스러운 · 로맨틱한 · 화려한 중 최소 1, 개수 제한
   * 없음(2026-09-26 대표 결정). 홈 조건 칩과 추천 정렬 · 업체 상세의 스타일 일치 표기가 이 값을 본다.
   * 넷보다 많을 수 없는 것은 종류가 넷뿐이라서다 — 상한이 아니다.
   */
  styleTags: z.array(weddingStyleSchema).max(WEDDING_STYLES.length),

  /** 배우자가 연결돼 있는가. 등급과 미션이 이 값을 본다. */
  spouseLinked: z.boolean(),
  /** 배우자의 부를 이름. 연결 전이거나 상대가 아직 안 정했으면 null. */
  partnerDisplayName: z.string().nullable(),
  /** 업체가 매칭된 결제인증이 있는가. Level 3 Unlock과 같은 조건이다. */
  hasPaymentProof: z.boolean(),
  /** 한 곳이라도 Pick했는가. 미션 ②가 본다. */
  hasPick: z.boolean(),
  /**
   * 한 업종이라도 비교해봤는가. 미션 ③이 본다.
   *
   * 비교할 수 있는 상태가 아니라 **비교한 사실**이다 — 후보 두 곳을 담았다고
   * 비교한 것은 아니다.
   */
  hasCompared: z.boolean(),
  /**
   * 지금 등급. 서버가 정한다.
   *
   * 앱이 세 값으로 계산하게 두면, 화면마다 조건을 다시 적게 되고 언젠가 한 곳이
   * 어긋난다 — 그러면 같은 사람이 화면에 따라 다른 등급으로 보인다.
   */
  tier: z.enum(MEMBER_TIERS),
  tierLabel: z.string().min(1),
});

/**
 * 부를 이름. MY에서 정한다.
 *
 * 최소 온보딩에서 뺀 값이라(v3.10 §3) 이 계약이 없으면 이름을 정할 방법이 없다.
 * null은 "안 부름"이다 — 한 번 적었다고 영영 못 지우게 할 이유가 없다.
 */
export const displayNameRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(MAX_DISPLAY_NAME_LENGTH).nullable(),
});

export const displayNameResponseSchema = z.object({
  displayName: z.string().nullable(),
});

/**
 * 초기 설정 — 5개 질문(핸드오프 v3.19~v3.22 · SPEC §13.6).
 *
 *   예식일 1/5 → 지역 2/5 → 준비 현황 3/5 → 예산 4/5 → 취향 5/5
 *
 * 취향(5/5)은 `/v1/me/taste`로 따로 보낸다 — 이 요청은 1~4를 한 번에 받는다.
 *
 * **이름을 받지 않는다.** v3.10이 닉네임을 최초 필수입력에서 뺐다 — 이름을 물어보는
 * 화면은 "가입" 냄새가 나고, 이 앱은 로그인을 앞세우지 않는다. 부를 이름은 MY에서
 * 따로 정한다.
 *
 * **미정을 억지로 받지 않는다.** 예식일 · 지역은 «아직 정하지 않았어요»(null), 준비
 * 현황은 «아직 시작 전이에요»(빈 배열), 예산은 «아직 모르겠어요»(`unknown`)가 된다.
 *
 * 예산과 준비 현황은 키를 아예 안 보내면 **건드리지 않는다** — 예식일만 고치러 온
 * 사람이 적어둔 값을 잃으면 안 된다. 명시적인 null(예산) · 빈 배열(준비 현황)만
 * 되돌린다.
 */
export const completeSetupRequestSchema = z.object({
  /** null = «아직 정하지 않았어요». 날짜 없이도 설정은 끝난 것이다 — 홈은 lifecycle의 «기대반 설렘반»으로 부른다. */
  weddingDate: dateSchema.nullable(),
  /** null = «아직 정하지 않았어요»(v3.19). 빈 문자열은 안 된다 — 미정은 null로만 적는다. */
  region: z.string().trim().min(1).nullable(),
  /** 준비 현황(3/5). 안 보내면 그대로, 빈 배열은 «아직 시작 전이에요». 새 웨딩의 기본은 빈 배열. */
  preparedCategories: preparedCategoriesSchema.optional(),
  budgetBracket: budgetBracketSchema.nullable().optional(),
  /**
   * 스타일(5/5). 안 보내면 그대로. 보내면 최소 1, 개수 제한 없음(2026-09-26 대표 결정) — 넷 다
   * 받는다. 겹친 값은 서버가 걷는다(`routes/weddings.ts`). 넷을 넘는 배열은 겹친 값뿐이라 거절한다.
   */
  styleTags: z.array(weddingStyleSchema).min(STYLE_PICK_MIN).max(WEDDING_STYLES.length).optional(),
  /**
   * 준비 현황(3/5)에서 검색 시트로 고른 업체(2026-09-26 대표 지시). 카드 넷(웨딩홀 · 스드메 ·
   * 본식 · 예물 · 신혼)마다 최대 한 곳이라 넷까지다. 업체의 업종은 같이 보낸
   * `preparedCategories` 안에 있어야 한다 — 업체를 골랐다는 것이 곧 그 카드가 «결정 완료»다.
   * 서버는 **같은 트랜잭션 안에서** 이 업체들을 Pick(`vendor_candidates`)에 담는다 — 이미 담긴 곳은 그대로 두어 다시 보내도
   * 겹치지 않는다. 안 보내거나 빈 배열이면 Pick을 건드리지 않는다(«아직 정한 곳이 없어요»).
   */
  preparedVendorIds: z.array(idSchema).max(PREPARED_VENDOR_MAX).optional(),
  /**
   * 목록에서 고른 업체(`preparedVendorIds`)는 Pick 담기와 함께 그 업종의 **결정**으로도
   * 남는다(2026-09-26 대표 지시 「결정으로 넣는다」). 직접 입력한 곳(이 칸)은 업체가 없어
   * 담기는 없고 결정만 남는다 — 묶음의 첫 업종에 이름으로(`manualDecisionCategory`).
   * 카드 하나에 업체 · 직접 입력 중 하나만 온다. 이미 결정이 있는 업종(배우자가 먼저 정한
   * 곳 포함)은 덮지 않는다.
   */
  preparedManualVendors: z.array(preparedManualVendorSchema).max(PREPARED_VENDOR_MAX).optional(),
});

/**
 * A-18 배우자 초대.
 *
 * `code`는 만들 때 한 번만 내려온다. 서버는 해시만 들고 있어 다시 보여줄 수 없다 —
 * 세션 토큰과 같다.
 */
export const createInviteResponseSchema = z.object({
  inviteId: idSchema,
  /** 4자리 숫자(2026-09-26 대표 지시 · `INVITE_CODE_PATTERN`). 앞자리 0도 코드의 일부다. */
  code: z.string().regex(INVITE_CODE_PATTERN),
  expiresAt: timestampSchema,
  /** 초대받은 사람이 볼 안내. 무엇이 공유되고 무엇이 안 되는지. */
  shared: z.array(z.string().min(1)).min(1),
  notShared: z.array(z.string().min(1)).min(1),
});

/** 지금 살아 있는 초대. 코드는 들어 있지 않다. */
export const weddingInviteSchema = z.object({
  inviteId: idSchema,
  expiresAt: timestampSchema,
  createdAt: timestampSchema,
});

export const weddingInviteListResponseSchema = z.object({
  invite: weddingInviteSchema.nullable(),
});

/**
 * 초대 미리보기.
 *
 * 받아들이기 전에 무엇에 동의하는지 본다 — 동의는 무엇에 동의하는지 알 때만 동의다.
 * 초대한 사람이 누구인지는 알려주지 않는다. 이름을 알려주려면 그 사람의 개인정보를
 * 꺼내야 하고, 링크를 가진 사람이 늘 배우자인 것도 아니다.
 */
export const invitePreviewResponseSchema = z.discriminatedUnion('usable', [
  z.object({
    usable: z.literal(true),
    expiresAt: timestampSchema,
    shared: z.array(z.string().min(1)).min(1),
    notShared: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    usable: z.literal(false),
    /** 왜 쓸 수 없는지. 값을 지어내는 대신 이유를 보낸다. */
    reason: z.enum(['expired', 'revoked', 'accepted', 'already_linked', 'not_found']),
    message: z.string().min(1),
  }),
]);

/**
 * 4자리 숫자만 받는다(2026-09-26 대표 지시). 옛 6자리 · 긴 코드는 더 받지 않는다 —
 * 대기 중이던 것은 0439가 취소했고, 남은 줄도 72시간 안에 모두 만료된다.
 */
export const acceptInviteRequestSchema = z.object({
  code: z.string().trim().regex(INVITE_CODE_PATTERN, `초대 코드는 숫자 ${INVITE_CODE_LENGTH}자리예요.`),
});

export type Wedding = z.infer<typeof weddingSchema>;
export type CreateInviteResponse = z.infer<typeof createInviteResponseSchema>;
export type WeddingInvite = z.infer<typeof weddingInviteSchema>;
export type WeddingInviteListResponse = z.infer<typeof weddingInviteListResponseSchema>;
export type InvitePreviewResponse = z.infer<typeof invitePreviewResponseSchema>;
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;
export type WeddingDetail = z.infer<typeof weddingDetailSchema>;
export type CreateWeddingRequest = z.infer<typeof createWeddingRequestSchema>;
export type CurrentUser = z.infer<typeof currentUserSchema>;
export type CompleteSetupRequest = z.infer<typeof completeSetupRequestSchema>;
export type BudgetBracket = z.infer<typeof budgetBracketSchema>;
