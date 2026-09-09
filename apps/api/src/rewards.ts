import {
  MISSION_COMPLETE_REWARD_NOTIFICATION,
  REWARDS,
  allMissionsDone,
  decideGrant,
  type RewardKind,
} from '@weddingpick/domain';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

import { newEventId, recordDecision } from './decisions';
import { assertFeatureEnabled } from './kill-switches';
import { notify } from './notify';

/**
 * 보상 판정과 기록. 최종통합정책 v2.0 I장 · 핸드오프 v3.22 «이벤트 예산 · 월 50만원».
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
   * 관리자가 «보상 지급»을 껐으면 여기서 멈춘다. **null을 돌려주지 않는다** — null은
   * 「한도가 찼다」는 정상 경로라 끈 것과 구분되지 않고, 부른 쪽은 조건을 충족했는데도
   * 아무 일이 없었다는 사실을 모르게 된다. 부르는 쪽이 트랜잭션 안이라 던지면 함께
   * 되감긴다 — 원장에 반쪽만 남지 않는다.
   */
  await assertFeatureEnabled(db, 'reward-payout');

  /*
   * 이 종류로 **이번 달에** 지급했거나 지급하기로 한 것이 몇 건인지. 한도는 달마다
   * 서비스 전체를 두고 세는 값이라 사용자별이 아니다(v3.22: 미션 40 · 초대 50 ·
   * 홍보 50 · 지원금 1). 소진되면 다음 달에 다시 연다.
   *
   * 달의 경계는 UTC다 — 응모 회차(`drawMonthOf`)와 같은 기준이어야 «이번 회차»가
   * 두 곳에서 다르게 읽히지 않는다.
   */
  const counted = await db.query<{ count: string }>(
    `SELECT count(*) AS count FROM structured.reward_grants
     WHERE kind = $1::reward_kind AND status IN ('earned', 'paid')
       AND date_trunc('month', created_at AT TIME ZONE 'UTC')
         = date_trunc('month', now() AT TIME ZONE 'UTC')`,
    [input.kind]
  );

  const decision = decideGrant({
    kind: input.kind,
    grantedThisMonth: Number(counted.rows[0]?.count ?? 0),
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

  // 같은 근거로 두 번 만들지 않는다. 표의 UNIQUE(미션은 0091a의 부분 인덱스)가
  // 막고, 여기서는 조용히 지나간다.
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

type MissionFactRow = {
  wedding_set: boolean;
  has_pick: boolean;
  spouse_linked: boolean;
  has_payment_proof: boolean;
};

/**
 * 미션 4개를 다 마쳤으면 미션 완주 보상(5,000원)을 한 번 만든다. v3.22.
 *
 * 미션은 설정 완료(`setup_completed_at`) · 첫 Pick · 배우자 연결 · Pick 인증 1건
 * (`usable_payment_proofs`)이다 — routes/weddings.ts가 화면에 보여주는 것과 같은
 * 사실이어야 한다. 화면은 다 했다는데 보상은 안 생기면 그 체크 표시가 거짓이 된다.
 *
 * **여러 번 불러도 한 번만 만든다.** 0091a의 부분 유니크 인덱스가 두 번째를 막고,
 * `grantReward`는 그때 null을 돌려준다. 그래서 «이미 있나»를 먼저 묻고, 없으면
 * 만들어보고, 만들어졌을 때만 알린다.
 *
 * 부르는 자리는 보상 화면(GET /v1/me/rewards)과 웨딩지원금 현황(GET /v1/me/monthly-draw)
 * 이다 — 마지막 미션(Pick 인증)이 끝나는 자리에 직접 걸지 않는 이유는, 결제인증
 * 등록 트랜잭션이 보상 판정까지 안고 가면 그쪽 실패가 이쪽을 끌어내리기 때문이다.
 * 사용자가 보상을 보러 오는 순간 만들어도 늦지 않다.
 */
export async function ensureMissionGrant(
  db: Pool | PoolClient,
  userId: string
): Promise<{ id: string; status: 'earned' | 'held' } | null> {
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM structured.reward_grants
     WHERE user_id = $1 AND kind = 'mission'::reward_kind`,
    [userId]
  );

  if (existing.rows[0]) return null;

  const { rows } = await db.query<MissionFactRow>(
    `SELECT
       coalesce(w.setup_completed_at IS NOT NULL, false) AS wedding_set,
       EXISTS (
         SELECT 1 FROM structured.vendor_candidates c WHERE c.wedding_id = w.id
       ) AS has_pick,
       coalesce(w.owner_user_id IS NOT NULL AND w.partner_user_id IS NOT NULL, false)
         AS spouse_linked,
       EXISTS (
         SELECT 1 FROM structured.usable_payment_proofs p WHERE p.reporter_user_id = u.id
       ) AS has_payment_proof
     FROM structured.users u
     LEFT JOIN LATERAL (
       SELECT id, setup_completed_at, owner_user_id, partner_user_id
       FROM structured.weddings
       WHERE owner_user_id = u.id OR partner_user_id = u.id
       ORDER BY created_at LIMIT 1
     ) w ON true
     WHERE u.id = $1`,
    [userId]
  );

  const row = rows[0];

  if (!row) return null;

  const done = allMissionsDone({
    loggedIn: true,
    weddingSet: row.wedding_set,
    hasPick: row.has_pick,
    spouseLinked: row.spouse_linked,
    hasPaymentProof: row.has_payment_proof,
    // 비교는 v3.22부터 미션이 아니다. 판정에 쓰이지 않지만 사실 꼴이 요구한다.
    hasCompared: false,
  });

  if (!done) return null;

  const granted = await grantReward(db, { userId, kind: 'mission' });

  if (!granted) return null;

  await notify(db, {
    userId,
    kind: 'notice',
    title: MISSION_COMPLETE_REWARD_NOTIFICATION.title,
    body:
      granted.status === 'earned'
        ? MISSION_COMPLETE_REWARD_NOTIFICATION.body
        : MISSION_COMPLETE_REWARD_NOTIFICATION.held,
    targetId: granted.id,
  });

  return granted;
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
