import {
  redeemReferralRequestSchema,
  submitPromotionRequestSchema,
} from '@weddingpick/api-contract';
import {
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  REWARD_LABEL,
  REWARD_STATUS_LABEL,
  REWARD_STATUS_NOTE,
  checkPromotionUrl,
  checkRedeem,
  isReferralCode,
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
   * 초대 코드 넣기.
   *
   * **여기서 보상이 생기지 않는다.** 초대받은 사람이 결제내역을 처음 등록할 때
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
