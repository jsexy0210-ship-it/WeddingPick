import { z } from 'zod';

import { candidateListResponseSchema } from './candidates';
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
});

export type AppBootstrapResponse = z.infer<typeof appBootstrapResponseSchema>;
