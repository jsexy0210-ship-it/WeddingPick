import {
  REWARDS,
  decideGrant,
  type RewardKind,
} from '@weddingpick/domain';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

import { newEventId, recordDecision } from './decisions';
import { notify } from './notify';

/**
 * 보상 판정과 기록. 최종통합정책 v2.0 I장.
 *
 * I-3의 흐름 중 **여기서 끝나는 것은 판정까지다** —
 *
 *   조건확인 → 어뷰징검사 → 지급판정 → 한도확인 → (지급) → 기록
 *                                                  ↑ 돈을 보내는 수단이 아직 없다
 *
 * 그래서 `earned`(지급 대상)까지만 자동으로 간다. 지급은 `rewards` 도구로 사람이
 * 기록한다. 없는 것을 있는 척하지 않는 것이 요점이다.
 */

/**
 * 보상 한 줄을 남긴다.
 *
 * **결정을 내리는 코드와 같은 트랜잭션에서 부른다.** 조건은 찼는데 원장에만 안
 * 남으면, 그 사람은 영영 못 받고 우리는 그 사실도 모른다.
 */
export async function grantReward(
  db: Pool | PoolClient,
  input: {
    userId: string;
    kind: RewardKind;
    referralId?: string;
    promotionId?: string;
    suspectedAbuse?: boolean;
  }
): Promise<{ id: string; status: 'earned' | 'held' } | null> {
  /*
   * 이 종류로 이미 지급했거나 지급하기로 한 것이 몇 건인지. 한도는 캠페인 전체를
   * 두고 세는 값이라 사용자별이 아니다(I-1: 캠페인 최대 100건).
   */
  const counted = await db.query<{ count: string }>(
    `SELECT count(*) AS count FROM structured.reward_grants
     WHERE kind = $1::reward_kind AND status IN ('earned', 'paid')`,
    [input.kind]
  );

  const decision = decideGrant({
    kind: input.kind,
    paidCountSoFar: Number(counted.rows[0]?.count ?? 0),
    suspectedAbuse: input.suspectedAbuse ?? false,
  });

  const eventId = newEventId();

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO structured.reward_grants
       (user_id, kind, amount_krw, status, reason_code, referral_id, promotion_id)
     VALUES ($1, $2::reward_kind, $3, $4::reward_status, $5, $6, $7)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      input.userId,
      input.kind,
      REWARDS[input.kind].amountKrw,
      decision.status,
      decision.reasonCode,
      input.referralId ?? null,
      input.promotionId ?? null,
    ]
  );

  const id = rows[0]?.id;

  // 같은 근거로 두 번 만들지 않는다. 표의 UNIQUE가 막고, 여기서는 조용히 지나간다.
  if (!id) return null;

  /*
   * L장: 자동으로 내린 결정마다 근거를 남긴다. 돈이 걸린 판정이라 특히 그렇다 —
   * 나중에 "왜 이 사람은 받고 저 사람은 못 받았나"에 답할 수 있어야 한다.
   *
   * 근거는 가리키기만 한다. 금액도 계정도 이 로그에 복사되지 않는다.
   */
  await recordDecision(db, {
    eventId,
    workflow: 'reward',
    step: 'decide',
    subjectKind: 'reward_grant',
    subjectId: id,
    decider: { kind: 'rule', ruleVersion: `reward-${input.kind}-1` },
    decision: decision.status,
    reasonCode: decision.reasonCode,
    evidence: input.referralId
      ? [{ kind: 'referral', id: input.referralId }]
      : input.promotionId
        ? [{ kind: 'promotion', id: input.promotionId }]
        : [],
    // held는 사람을 기다린다. earned는 판정이 끝났고 지급만 남았다.
    execution: decision.status === 'held' ? 'pending' : 'succeeded',
  });

  return { id, status: decision.status };
}

/**
 * 초대받은 사람이 첫 결제인증을 냈을 때 부른다. I-1 · K-7.
 *
 * **가입이 아니라 이때가 조건이다.** 가입만으로 돈을 주면 가입만 하는 계정이
 * 모이고, 그 계정들이 만드는 것은 데이터가 아니라 비용이다.
 *
 * 실패해도 부르는 쪽을 막지 않는 것이 옳아 보이지만 그러지 않는다 — 결제인증
 * 등록과 같은 트랜잭션에 두면 둘 다 되거나 둘 다 안 되고, 그게 원장이 어긋나지
 * 않는 유일한 방법이다.
 */
export async function qualifyReferral(
  db: Pool | PoolClient,
  invitedUserId: string
): Promise<void> {
  const { rows } = await db.query<{ id: string; inviter_user_id: string }>(
    `UPDATE structured.referrals
     SET qualified_at = now()
     WHERE invited_user_id = $1 AND qualified_at IS NULL
     RETURNING id, inviter_user_id`,
    [invitedUserId]
  );

  const referral = rows[0];
  if (!referral) return;

  const granted = await grantReward(db, {
    userId: referral.inviter_user_id,
    kind: 'referral',
    referralId: referral.id,
  });

  if (!granted) return;

  await notify(db, {
    userId: referral.inviter_user_id,
    kind: 'notice',
    title: '초대한 분이 결제내역을 등록했어요',
    body:
      granted.status === 'earned'
        ? `친구초대 ${REWARDS.referral.amountKrw.toLocaleString('ko-KR')}원 지급 대상이 되셨어요. 지급되면 알림으로 알려드려요`
        : '한 번 더 확인하고 있어요. 확인이 끝나면 알림으로 알려드려요',
    targetId: granted.id,
  });
}

/** 코드를 만든다. 헷갈리는 글자는 도메인이 이미 빼뒀다. */
export function newReferralCode(alphabet: string, length: number): string {
  const bytes = randomUUID().replace(/-/g, '');
  let code = '';

  for (let i = 0; i < length; i += 1) {
    code += alphabet[parseInt(bytes.slice(i * 2, i * 2 + 2), 16) % alphabet.length];
  }

  return code;
}
