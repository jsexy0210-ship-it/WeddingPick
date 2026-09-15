import { z } from 'zod';

import { candidateListResponseSchema } from './candidates';
import { amountSchema } from './common';
import { notificationSummaryResponseSchema } from './notifications';
import { vendorSummarySchema } from './vendors';
import { currentUserSchema } from './weddings';

/**
 * 홈이 한 번에 필요로 하는 것을 한 응답으로 묶는다. GET /v1/app/bootstrap.
 *
 * 홈은 원래 회원 · 알림 · 많이 확인된 곳 · 담아둔 후보 · 웨딩픽 추천을 다섯 번
 * 따로 물었다. 그중 뒤 셋은 앞의 답에 기대는 것도 있어(웨딩픽 추천은 담아둔
 * 후보가 지목한 업종을 봐야 나온다), 기기와 서버 사이를 여러 번 오가야 했다 —
 * 각 왕복이 인터넷을 타는 이상 서버 안에서 합치는 것과는 체감 속도가 다르다.
 *
 * 이 응답은 그 다섯을 서버 안에서 병렬로(정말 앞선 답에 기대는 것만 순서대로)
 * 모아 한 번에 내려보낸다. 비회원도 부를 수 있다 — `member`가 null이면 나머지
 * 개인화 자리도 비어 있다는 뜻이다.
 */
export const appBootstrapResponseSchema = z.object({
  member: currentUserSchema.nullable(),
  /** 로그인하지 않았으면 null. */
  notifications: notificationSummaryResponseSchema.nullable(),
  /** 많이 확인된 곳. 비회원에게도 보인다. */
  popularVendors: z.array(vendorSummarySchema),
  /** 로그인하지 않았으면 null. */
  candidates: candidateListResponseSchema.nullable(),
  /** 웨딩픽 추천. 지목된 업종이 없으면 빈 배열. */
  recommendations: z.array(vendorSummarySchema),
  /**
   * 히어로가 적는 «남은 예산 3,000만원 · 27% 사용». 숫자 예산을 안 정했으면 null이고,
   * 그때 히어로는 «예산을 정해볼까요?»로 바뀐다.
   *
   * **이 자리 때문에 왕복을 늘리지 않으려고 여기 얹었다.** 지출 요약
   * (`GET /v1/weddings/:id/expenses`)은 예산·지출·항목을 다 든 큰 응답이라 히어로 한 줄
   * 때문에 통째로 부르지 않는다. 지출 화면은 계속 그쪽을 쓴다.
   *
   * **`budgetBracket`만 고른 사람은 여기서 null이 아니다** — 온보딩의 «4,000만원 이상» ·
   * «아직 모르겠어요»는 상한이 없어 숫자 예산이 서지 않지만 이미 답한 사람이다. 그 사람에게
   * «예산을 정해볼까요?»를 다시 묻지 않도록 `bracketAnswered`를 함께 보낸다.
   */
  budget: z
    .object({
      total: amountSchema,
      spent: amountSchema,
      /** 넘겼으면 음수다. 화면이 그 사실을 말할 수 있어야 한다. */
      remaining: z.number(),
    })
    .nullable(),
  /** 예산 구간 질문에 답한 적이 있는가. 숫자 예산이 없어도 true일 수 있다. */
  bracketAnswered: z.boolean(),
  /**
   * 배우자 초대를 보내놓고 아직 수락되지 않았는가. 히어로가 «초대 수락을 기다리고 있어요»를
   * 적는 자리다. 이미 연결됐으면(`member.spouseLinked`) false다.
   */
  partnerInvitePending: z.boolean(),
});

export type AppBootstrapResponse = z.infer<typeof appBootstrapResponseSchema>;
