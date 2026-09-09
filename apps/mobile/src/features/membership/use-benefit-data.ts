import type {
  CurrentUser,
  MyMonthlyDrawResponse,
  MyRewardPayoutResponse,
  MyRewardsResponse,
  RewardGrant,
} from '@weddingpick/api-contract';
import {
  MISSIONS,
  REWARDS,
  type MembershipFacts,
  isMissionDone,
  missionProgress,
} from '@weddingpick/domain';
import { useCallback, useEffect, useState } from 'react';

import { getCurrentUser, getMyMonthlyDraw, getMyRewardPayout, getMyRewards } from '@/api/client';

/**
 * 혜택 화면(WP-EVT-001~007)이 같이 쓰는 데이터. 세 응답을 한 번에 받는다.
 *
 * **숫자를 화면이 만들지 않는다.** 미션 진행은 `/v1/me`의 사실로, 지급 내역은 `/v1/me/rewards`로,
 * 웨딩지원금은 `/v1/me/monthly-draw`로만 센다. 응답이 없는 숫자(«27/40커플 남음»)는 적지 않는다.
 *
 * 하나가 실패해도 나머지는 그린다 — 웨딩지원금을 못 불러왔다고 미션까지 숨기지 않는다.
 */
export type BenefitData = {
  me: CurrentUser | null;
  rewards: MyRewardsResponse | null;
  draw: MyMonthlyDrawResponse | null;
  /** Npay 수령 현황(WP-EVT-006). 받을 수 있는 금액 · 열린 요청 · 지난 요청. */
  payout: MyRewardPayoutResponse | null;
  loading: boolean;
  /** 셋 다 실패했을 때만. 화면은 이때 ErrorView를 띄운다. */
  error: string | null;
  reload: () => void;
};

export function useBenefitData(): BenefitData {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [rewards, setRewards] = useState<MyRewardsResponse | null>(null);
  const [draw, setDraw] = useState<MyMonthlyDrawResponse | null>(null);
  const [payout, setPayout] = useState<MyRewardPayoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
   * 처음 한 번은 `loading`이 true로 시작한다. 다시 불러올 때는 스피너를 다시 세우지 않는다 —
   * 있던 화면 위에서 값만 바뀐다(effect 안에서 setState를 동기로 부르지 않는다).
   */
  const reload = useCallback(() => {
    void Promise.allSettled([getCurrentUser(), getMyRewards(), getMyMonthlyDraw(), getMyRewardPayout()]).then(
      ([meResult, rewardsResult, drawResult, payoutResult]) => {
        const nextMe = meResult.status === 'fulfilled' ? meResult.value : null;
        const nextRewards = rewardsResult.status === 'fulfilled' ? rewardsResult.value : null;
        const nextDraw = drawResult.status === 'fulfilled' ? drawResult.value : null;

        setMe(nextMe);
        setRewards(nextRewards);
        setDraw(nextDraw);
        setPayout(payoutResult.status === 'fulfilled' ? payoutResult.value : null);
        setError(
          !nextMe && !nextRewards && !nextDraw ? '혜택 정보를 불러오지 못했어요' : null
        );
        setLoading(false);
      }
    );
  }, []);

  useEffect(reload, [reload]);

  return { me, rewards, draw, payout, loading, error, reload };
}

// ─── 파생 값 — 응답에서 세기만 한다 ───────────────────────────────

export function factsOf(me: CurrentUser): MembershipFacts {
  return {
    loggedIn: true,
    spouseLinked: me.spouseLinked,
    hasPaymentProof: me.hasPaymentProof,
    weddingSet: me.setupComplete,
    hasPick: me.hasPick,
    hasCompared: me.hasCompared,
  };
}

export type MissionRow = { key: (typeof MISSIONS)[number]['key']; title: string; description: string; done: boolean };

export function missionRows(me: CurrentUser): MissionRow[] {
  const facts = factsOf(me);
  return MISSIONS.map((mission) => ({ ...mission, done: isMissionDone(mission.key, facts) }));
}

export function missionCount(me: CurrentUser): { done: number; total: number; remaining: number } {
  const progress = missionProgress(factsOf(me));
  return { ...progress, remaining: progress.total - progress.done };
}

/** «5,000원» — 금액은 REWARDS 한 곳에서 온다. */
export function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export const MISSION_REWARD = won(REWARDS.mission.amountKrw);
export const REFERRAL_REWARD = won(REWARDS.referral.amountKrw);
export const PROMOTION_REWARD = won(REWARDS.promotion.amountKrw);

export function grantsOf(rewards: MyRewardsResponse | null, kind: RewardGrant['kind']): RewardGrant[] {
  return rewards?.grants.filter((grant) => grant.kind === kind) ?? [];
}

/** 이미 지급된 금액 합계. `earned`(조건만 찬 것)는 넣지 않는다 — 아직 아무도 돈을 보내지 않았다. */
export function paidSum(grants: readonly RewardGrant[]): number {
  return grants.filter((grant) => grant.status === 'paid').reduce((sum, grant) => sum + grant.amountKrw, 0);
}

/**
 * 한글 개수 — «두 개 남았어요». 시안 WP-EVT-002 hero.
 * 4개짜리 미션에만 쓰니 넷까지만 적는다.
 */
export function countWord(n: number): string {
  switch (n) {
    case 1:
      return '하나';
    case 2:
      return '두 개';
    case 3:
      return '세 개';
    case 4:
      return '네 개';
    default:
      return `${n}개`;
  }
}

/**
 * 웨딩지원금 배지 색. 서버 상태 → 배지 종류.
 * won · entered는 초록, pending은 노랑, not_won은 회색, not_entered는 코랄(참여할 수 있다).
 */
export function drawBadgeKind(
  status: MyMonthlyDrawResponse['status']
): 'ok' | 'wait' | 'brand' | 'none' {
  switch (status) {
    case 'won':
    case 'entered':
      return 'ok';
    case 'pending':
      return 'wait';
    case 'not_won':
      return 'none';
    case 'not_entered':
      return 'brand';
  }
}

/** 지급 상태 → 배지. paid는 배지 대신 금액을 적으니 여기 오지 않는다. */
export function grantBadgeKind(status: RewardGrant['status']): 'ok' | 'wait' | 'no' | 'none' {
  switch (status) {
    case 'paid':
      return 'ok';
    case 'held':
      return 'wait';
    case 'blocked':
      return 'no';
    case 'earned':
      return 'none';
  }
}

/**
 * MY 홈 «혜택 · 이벤트 · N개 참여 가능». 지금 할 수 있는 캠페인만 센다 —
 * 미션(남은 게 있으면) · 친구 초대(늘) · 홍보 인증(아직 안 냈으면) · 웨딩지원금(응모 전이면).
 */
export function participableCount(data: {
  me: CurrentUser | null;
  rewards: MyRewardsResponse | null;
  draw: MyMonthlyDrawResponse | null;
}): number | null {
  if (!data.me || !data.rewards || !data.draw) return null;

  let count = 1; // 친구 초대는 늘 열려 있다.
  if (missionCount(data.me).remaining > 0) count += 1;
  if (grantsOf(data.rewards, 'promotion').length === 0) count += 1;
  if (data.draw.status === 'not_entered') count += 1;

  return count;
}
