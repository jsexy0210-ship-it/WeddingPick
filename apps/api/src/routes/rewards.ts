import {
  redeemReferralRequestSchema,
  submitPromotionRequestSchema,
} from '@weddingpick/api-contract';
import {
  MONTHLY_DRAW_AMOUNT_KRW,
  MONTHLY_DRAW_STATUS_LABEL,
  MONTHLY_DRAW_STATUS_NOTE,
  MONTHLY_DRAW_WINNERS_PER_MONTH,
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  REWARD_LABEL,
  REWARD_STATUS_LABEL,
  REWARD_STATUS_NOTE,
  allMissionsDone,
  checkPromotionUrl,
  checkRedeem,
  drawMonthOf,
  isReferralCode,
  type MembershipFacts,
  type MonthlyDrawStatus,
  type RewardKind,
  type RewardStatus,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { withTransaction } from '../db';
import { ApiError, notFound } from '../errors';
import { newReferralCode } from '../rewards';

type GrantRow = {
  id: string;
  kind: RewardKind;
  amount_krw: number;
  status: RewardStatus;
  decision_note: string | null;
  created_at: Date;
};

/**
 * 내 초대 코드. 없으면 이때 만든다.
 *
 * 미리 만들어두지 않는 이유는 안 쓰는 사람 몫까지 들고 있을 이유가 없어서다.
 * 부딪히면 다시 뽑는다 — 여섯 자리라 자주 부딪히지는 않는다.
 */
async function referralCodeOf(pool: Pool, userId: string): Promise<string> {
  const existing = await pool.query<{ code: string }>(
    'SELECT code FROM structured.referral_codes WHERE user_id = $1',
    [userId]
  );

  if (existing.rows[0]) return existing.rows[0].code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { rows } = await pool.query<{ code: string }>(
      `INSERT INTO structured.referral_codes (user_id, code)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING code`,
      [userId, newReferralCode(REFERRAL_CODE_ALPHABET, REFERRAL_CODE_LENGTH)]
    );

    if (rows[0]) return rows[0].code;

    // user_id로 부딪혔으면 다른 요청이 먼저 만든 것이다. 그것을 쓴다.
    const mine = await pool.query<{ code: string }>(
      'SELECT code FROM structured.referral_codes WHERE user_id = $1',
      [userId]
    );

    if (mine.rows[0]) return mine.rows[0].code;
  }

  throw new ApiError('conflict', '초대 코드를 만들지 못했습니다. 잠시 후 다시 시도해주세요.');
}

/**
 * 이벤트 보상. 최종통합정책 v2.0 I장.
 *
 * **이 경로들은 지급하지 않는다.** 조건이 찼다는 판정까지가 여기서 일어나고,
 * 지급은 사람이 한다 — 돈을 보내는 수단이 아직 없기 때문이고, 그 사실을 상태
 * 이름(`earned` / `paid`)이 말한다.
 */
export function registerRewardRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get('/v1/me/rewards', auth, async (request) => {
    const userId = currentUserId(request);

    const [code, counts, grants] = await Promise.all([
      referralCodeOf(context.pool, userId),
      context.pool.query<{ invited: string; qualified: string }>(
        `SELECT count(*) AS invited,
                count(*) FILTER (WHERE qualified_at IS NOT NULL) AS qualified
         FROM structured.referrals
         WHERE inviter_user_id = $1`,
        [userId]
      ),
      context.pool.query<GrantRow>(
        `SELECT id, kind, amount_krw, status, decision_note, created_at
         FROM structured.reward_grants
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      ),
    ]);

    return {
      referralCode: code,
      invitedCount: Number(counts.rows[0]?.invited ?? 0),
      qualifiedCount: Number(counts.rows[0]?.qualified ?? 0),
      grants: grants.rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        kindLabel: REWARD_LABEL[row.kind],
        amountKrw: row.amount_krw,
        status: row.status,
        statusLabel: REWARD_STATUS_LABEL[row.status],
        statusNote: REWARD_STATUS_NOTE[row.status],
        decisionNote: row.decision_note,
        createdAt: row.created_at.toISOString(),
      })),
    };
  });

  /**
   * 월간 웨딩지원금 현황.
   *
   * 4개 미션이 모두 완료됐으면 이번 달 응모 행을 만들고(없으면 upsert) 상태를 돌려준다.
   * 미션이 안 됐으면 'not_entered'를 돌려준다.
   *
   * 당첨 여부는 reward_grants에서 확인한다 — 추첨은 사람이 하고 grant 행이 당첨 증거다.
   */
  app.get('/v1/me/monthly-draw', auth, async (request) => {
    const userId = currentUserId(request);
    const month = drawMonthOf(new Date());

    // 미션 완료 여부를 확인한다.
    const { rows: factRows } = await context.pool.query<{
      wedding_set: boolean;
      has_pick: boolean;
      has_compared: boolean;
      spouse_linked: boolean;
    }>(
      `SELECT
         /* 설정을 마쳤는가 — routes/weddings.ts · auth/sessions.ts와 같은 판단(0088). */
         (w.setup_completed_at IS NOT NULL) AS wedding_set,
         EXISTS (
           SELECT 1 FROM structured.vendor_candidates c WHERE c.wedding_id = w.id
         ) AS has_pick,
         EXISTS (
           SELECT 1 FROM structured.comparisons x WHERE x.wedding_id = w.id
         ) AS has_compared,
         coalesce(w.owner_user_id IS NOT NULL AND w.partner_user_id IS NOT NULL, false)
           AS spouse_linked
       FROM structured.users u
       LEFT JOIN LATERAL (
         SELECT id, wedding_date, region, setup_completed_at, owner_user_id, partner_user_id
         FROM structured.weddings
         WHERE owner_user_id = u.id OR partner_user_id = u.id
         ORDER BY created_at LIMIT 1
       ) w ON true
       WHERE u.id = $1`,
      [userId]
    );

    const fr = factRows[0];
    const facts: MembershipFacts = {
      loggedIn: true,
      weddingSet: fr?.wedding_set ?? false,
      hasPick: fr?.has_pick ?? false,
      hasCompared: fr?.has_compared ?? false,
      spouseLinked: fr?.spouse_linked ?? false,
      hasPaymentProof: false, // 이 판단에 불필요
    };

    if (!allMissionsDone(facts)) {
      const status: MonthlyDrawStatus = 'not_entered';
      return {
        drawMonth: month,
        status,
        statusLabel: MONTHLY_DRAW_STATUS_LABEL[status],
        statusNote: MONTHLY_DRAW_STATUS_NOTE[status],
        amountKrw: MONTHLY_DRAW_AMOUNT_KRW,
        winnersPerMonth: MONTHLY_DRAW_WINNERS_PER_MONTH,
      };
    }

    // 미션 완료 — 이번 달 응모 행 upsert
    const { rows: entryRows } = await context.pool.query<{ id: string }>(
      `INSERT INTO structured.monthly_draw_entries (user_id, draw_month)
       VALUES ($1, $2)
       ON CONFLICT (user_id, draw_month) DO UPDATE SET draw_month = EXCLUDED.draw_month
       RETURNING id`,
      [userId, month]
    );

    const entryId = entryRows[0]!.id;

    // 이번 달 당첨 여부 확인
    const { rows: grantRows } = await context.pool.query<{ status: RewardStatus }>(
      `SELECT g.status
       FROM structured.reward_grants g
       WHERE g.draw_entry_id = $1
       LIMIT 1`,
      [entryId]
    );

    const grantStatus = grantRows[0]?.status;
    let status: MonthlyDrawStatus;

    if (grantStatus === 'paid' || grantStatus === 'earned') {
      status = 'won';
    } else if (grantStatus === 'blocked') {
      status = 'not_won';
    } else if (grantStatus === 'held') {
      status = 'pending';
    } else {
      // grant 행 없음 = 아직 발표 전
      status = 'entered';
    }

    return {
      drawMonth: month,
      status,
      statusLabel: MONTHLY_DRAW_STATUS_LABEL[status],
      statusNote: MONTHLY_DRAW_STATUS_NOTE[status],
      amountKrw: MONTHLY_DRAW_AMOUNT_KRW,
      winnersPerMonth: MONTHLY_DRAW_WINNERS_PER_MONTH,
    };
  });

  /**
   * 내 초대 코드 조회.
   *
   * 없으면 여기서 만든다 — 쓰지 않는 사람 몫까지 미리 만들지 않는다.
   */
  app.get('/v1/me/invite-code', auth, async (request) => {
    const userId = currentUserId(request);
    const [code, usesResult] = await Promise.all([
      referralCodeOf(context.pool, userId),
      context.pool.query<{ uses: string }>(
        `SELECT count(*) AS uses
         FROM structured.referrals
         WHERE inviter_user_id = $1
           AND qualified_at IS NOT NULL`,
        [userId]
      ),
    ]);
    return { code, uses: Number(usesResult.rows[0]?.uses ?? 0) };
  });

  /**
   * 초대 코드 넣기 — `/v1/referrals/redeem`의 별칭 경로.
   *
   * **여기서 보상이 생기지 않는다.** 초대받은 사람이 Pick 인증을 처음 등록할 때
   * 조건이 찬다(I-1 · K-7) — 가입만으로 돈을 주면 가입만 하는 계정이 모인다.
   */
  app.post('/v1/me/invite-use', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = redeemReferralRequestSchema.parse(request.body);
    const code = body.code.trim().toUpperCase();

    if (!isReferralCode(code)) {
      throw new ApiError('invalid_request', '초대 코드를 다시 확인해주세요');
    }

    const owner = await context.pool.query<{ user_id: string }>(
      'SELECT user_id FROM structured.referral_codes WHERE code = $1',
      [code]
    );

    const inviterId = owner.rows[0]?.user_id;
    if (!inviterId) throw notFound('초대 코드');

    const mine = await context.pool.query<{ id: string }>(
      'SELECT id FROM structured.referrals WHERE invited_user_id = $1',
      [userId]
    );

    const check = checkRedeem({
      code,
      isOwnCode: inviterId === userId,
      alreadyInvited: mine.rows.length > 0,
    });

    if (!check.ok) throw new ApiError('invalid_request', check.message);

    await context.pool.query(
      `INSERT INTO structured.referrals (inviter_user_id, invited_user_id)
       VALUES ($1, $2)
       ON CONFLICT (invited_user_id) DO NOTHING`,
      [inviterId, userId]
    );

    return reply.status(204).send();
  });

  /**
   * 초대 코드 넣기.
   *
   * **여기서 보상이 생기지 않는다.** 초대받은 사람이 Pick 인증을 처음 등록할 때
   * 조건이 찬다(I-1 · K-7) — 가입만으로 돈을 주면 가입만 하는 계정이 모인다.
   */
  app.post('/v1/referrals/redeem', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = redeemReferralRequestSchema.parse(request.body);
    const code = body.code.trim().toUpperCase();

    if (!isReferralCode(code)) {
      throw new ApiError('invalid_request', '초대 코드를 다시 확인해주세요');
    }

    const owner = await context.pool.query<{ user_id: string }>(
      'SELECT user_id FROM structured.referral_codes WHERE code = $1',
      [code]
    );

    const inviterId = owner.rows[0]?.user_id;
    if (!inviterId) throw notFound('초대 코드');

    const mine = await context.pool.query<{ id: string }>(
      'SELECT id FROM structured.referrals WHERE invited_user_id = $1',
      [userId]
    );

    const check = checkRedeem({
      code,
      isOwnCode: inviterId === userId,
      alreadyInvited: mine.rows.length > 0,
    });

    if (!check.ok) throw new ApiError('invalid_request', check.message);

    await context.pool.query(
      `INSERT INTO structured.referrals (inviter_user_id, invited_user_id)
       VALUES ($1, $2)
       ON CONFLICT (invited_user_id) DO NOTHING`,
      [inviterId, userId]
    );

    return reply.status(204).send();
  });

  /**
   * 홍보인증. I-2.
   *
   * **글을 열어보지 않는다.** 남의 사이트를 긁지 않기로 했고, 열어봐도 그 글이
   * 이 사람 것인지는 알 수 없다. 규칙이 보는 것은 주소의 꼴과 중복까지이고,
   * 글이 실제로 올라가 있는지는 사람이 확인한다.
   */
  app.post('/v1/promotions', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = submitPromotionRequestSchema.parse(request.body);
    const url = body.url.trim();

    const check = checkPromotionUrl(url);
    if (!check.ok) throw new ApiError('invalid_request', check.message);

    const promotionId = await withTransaction(context.pool, async (client) => {
      const already = await client.query<{ id: string }>(
        'SELECT id FROM structured.promotion_submissions WHERE user_id = $1',
        [userId]
      );

      // I-2: 1인 1회. 표가 아니라 여기서 막는 이유는 사람이 읽을 말을 주기 위해서다.
      if (already.rows.length > 0) {
        throw new ApiError('conflict', '홍보인증은 한 번만 참여하실 수 있어요.');
      }

      const created = await client.query<{ id: string }>(
        `INSERT INTO structured.promotion_submissions (user_id, url)
         VALUES ($1, $2)
         ON CONFLICT (url) DO NOTHING
         RETURNING id`,
        [userId, url]
      );

      // 같은 주소를 다른 사람이 이미 냈다. 복붙을 표가 막는다.
      if (!created.rows[0]) {
        throw new ApiError('conflict', '이미 등록된 글 주소예요.');
      }

      return created.rows[0].id;
    });

    return reply.status(201).send({ promotionId });
  });
}
