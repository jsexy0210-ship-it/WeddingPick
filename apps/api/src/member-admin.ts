import type { Pool } from 'pg';

/**
 * 회원 상세(360뷰). `GET /v1/admin/users/:id`.
 *
 * 2026-09-23 대표 지시 「회원에 대한 모든 활동과 모든 정보를 내가 확인할 수 있어야
 * 한다」에서 시작했다. 그전까지 관리자가 한 회원에 대해 볼 수 있는 것은 `users.tsx`의
 * 목록 행 하나(계정 정보)가 전부였다 — 그 회원이 쓴 후기, 낸 결제 제보, 담은 Pick,
 * 신청한 업체 소유 확인, 보낸 문의는 전부 **표는 있는데 회원 단위로 걸러 볼 자리가
 * 없었다**(조사 결과: 45개 넘는 회원 연계 표 중 users만 회원 단위 조회가 있었다).
 *
 * **새 표를 만들지 않는다.** 이미 있는 표를 회원 id로 묶어서 한 번에 보여줄 뿐이다.
 * 웨딩이 둘인 사람(연결 전 · 연결 후)까지 빠짐없이 잡으려고, 먼저 그 회원이
 * `owner_user_id` 또는 `partner_user_id`인 웨딩 id를 모으고 그 목록으로 나머지를 묶는다.
 *
 * 표마다 갯수만 세지 않고 **최근 몇 건은 실제로 보여준다** — 「제보 12건」이라는
 * 숫자만으로는 그 12건이 무엇인지 알 수 없고, 그걸 알아야 「모든 정보」다.
 */

const RECENT_LIMIT = 20;

export type MemberWedding = {
  id: string;
  role: 'owner' | 'partner';
  weddingDate: string | null;
  createdAt: string;
};

export type MemberCandidate = {
  id: string;
  vendorName: string;
  category: string;
  addedAt: string;
  addedByThisMember: boolean;
};

export type MemberDecision = {
  category: string;
  vendorName: string;
  decidedAt: string;
};

export type MemberReview = {
  id: string;
  vendorName: string;
  overall: number;
  status: string;
  createdAt: string;
};

export type MemberPaymentProof = {
  id: string;
  merchantName: string;
  vendorName: string | null;
  paidAmount: number;
  paidAt: string;
};

export type MemberVendorClaim = {
  id: string;
  vendorName: string;
  status: string;
  createdAt: string;
};

export type MemberRewardGrant = {
  id: string;
  kind: string;
  amountKrw: number;
  status: string;
  createdAt: string;
};

export type MemberRewardPayout = {
  id: string;
  amountKrw: number;
  status: string;
  requestedAt: string;
  settledAt: string | null;
};

export type MemberInquiry = {
  id: string;
  category: string;
  status: string;
  receivedAt: string;
};

export type MemberDetail = {
  id: string;
  displayName: string;
  provider: string | null;
  email: string | null;
  nickname: string | null;
  createdAt: string;
  activatedAt: string | null;
  lastLoginAt: string | null;
  deletedAt: string | null;
  isOperator: boolean;
  withdrawal: { status: string; failure: { message: string; attemptCount: number } | null } | null;

  weddings: MemberWedding[];
  candidateCount: number;
  candidates: MemberCandidate[];
  decisions: MemberDecision[];
  reviews: MemberReview[];
  paymentProofs: MemberPaymentProof[];
  vendorClaims: MemberVendorClaim[];
  consultationCount: number;
  inquiries: MemberInquiry[];

  referral: { code: string | null; invitedCount: number; qualifiedCount: number };
  rewardGrants: MemberRewardGrant[];
  rewardPayouts: MemberRewardPayout[];
};

export async function detail(pool: Pool, userId: string): Promise<MemberDetail | null> {
  const { rows: accountRows } = await pool.query<{
    id: string;
    display_name: string | null;
    created_at: Date;
    activated_at: Date | null;
    deleted_at: Date | null;
    is_operator: boolean;
    provider: string | null;
    email: string | null;
    nickname: string | null;
    last_login_at: Date | null;
    withdrawal_status: string | null;
    failure_message: string | null;
    failure_attempts: number | null;
  }>(
    `SELECT
       u.id, u.display_name, u.created_at, u.activated_at, u.deleted_at, u.is_operator,
       i.provider::text AS provider, i.email, i.nickname, i.last_login_at,
       CASE
         WHEN u.deleted_at IS NULL THEN NULL
         WHEN EXISTS (
           SELECT 1 FROM structured.withdrawal_holds h
           WHERE h.user_id = u.id AND h.resolved_at IS NULL AND h.hold_until > now()
         ) THEN 'hold'
         WHEN f.user_id IS NOT NULL THEN 'failed'
         WHEN EXISTS (
           SELECT 1 FROM originals.raw_documents d
           WHERE d.owner_user_id = u.id AND d.status <> 'deleted'
         ) THEN 'pending'
         ELSE 'deletion_pending'
       END AS withdrawal_status,
       f.error_message AS failure_message,
       f.attempt_count AS failure_attempts
     FROM structured.users u
     LEFT JOIN LATERAL (
       SELECT provider, email, nickname, last_login_at
       FROM identity.identities
       WHERE user_id = u.id AND provider = 'kakao'
       ORDER BY last_login_at DESC
       LIMIT 1
     ) i ON true
     LEFT JOIN structured.withdrawal_deletion_failures f ON f.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  const account = accountRows[0];

  if (!account) return null;

  const { rows: weddingRows } = await pool.query<{
    id: string;
    role: 'owner' | 'partner';
    wedding_date: Date | null;
    created_at: Date;
  }>(
    `SELECT id, 'owner'::text AS role, wedding_date, created_at
       FROM structured.weddings WHERE owner_user_id = $1
     UNION ALL
     SELECT id, 'partner'::text AS role, wedding_date, created_at
       FROM structured.weddings WHERE partner_user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  const weddingIds = weddingRows.map((row) => row.id);

  const [
    candidateCountRow,
    candidateRows,
    decisionRows,
    reviewRows,
    paymentProofRows,
    vendorClaimRows,
    consultationCountRow,
    inquiryRows,
    referralCodeRow,
    referralCountRow,
    rewardGrantRows,
    rewardPayoutRows,
  ] = await Promise.all([
    weddingIds.length === 0
      ? Promise.resolve({ rows: [{ n: '0' }] })
      : pool.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM structured.vendor_candidates WHERE wedding_id = ANY($1::uuid[])`,
          [weddingIds]
        ),
    weddingIds.length === 0
      ? Promise.resolve({ rows: [] })
      : pool.query<{
          id: string;
          vendor_name: string;
          category: string;
          added_at: Date;
          added_by: string | null;
        }>(
          `SELECT c.id, v.name AS vendor_name, v.category::text AS category, c.added_at, c.added_by
             FROM structured.vendor_candidates c
             JOIN structured.vendors v ON v.id = c.vendor_id
            WHERE c.wedding_id = ANY($1::uuid[])
            ORDER BY c.added_at DESC LIMIT $2`,
          [weddingIds, RECENT_LIMIT]
        ),
    weddingIds.length === 0
      ? Promise.resolve({ rows: [] })
      : pool.query<{ category: string; vendor_name: string; decided_at: Date }>(
          /* 직접 입력한 결정(0440)은 업체가 없다 — 적어 둔 이름을 쓴다. */
          `SELECT cd.category::text AS category, coalesce(v.name, cd.manual_name) AS vendor_name, cd.decided_at
             FROM structured.category_decisions cd
             LEFT JOIN structured.vendors v ON v.id = cd.vendor_id
            WHERE cd.wedding_id = ANY($1::uuid[])
            ORDER BY cd.decided_at DESC`,
          [weddingIds]
        ),
    pool.query<{ id: string; vendor_name: string; overall: number; status: string; created_at: Date }>(
      `SELECT r.id, v.name AS vendor_name, r.overall, r.status::text AS status, r.created_at
         FROM structured.reviews r
         JOIN structured.vendors v ON v.id = r.vendor_id
        WHERE r.author_user_id = $1
        ORDER BY r.created_at DESC LIMIT $2`,
      [userId, RECENT_LIMIT]
    ),
    pool.query<{ id: string; merchant_name: string; vendor_name: string | null; paid_amount: string; paid_at: Date }>(
      `SELECT p.id, p.merchant_name, v.name AS vendor_name, p.paid_amount::text AS paid_amount, p.paid_at
         FROM structured.payment_proofs p
         LEFT JOIN structured.vendors v ON v.id = p.vendor_id
        WHERE p.reporter_user_id = $1
        ORDER BY p.paid_at DESC LIMIT $2`,
      [userId, RECENT_LIMIT]
    ),
    pool.query<{ id: string; vendor_name: string; status: string; created_at: Date }>(
      `SELECT c.id, v.name AS vendor_name, c.status::text AS status, c.created_at
         FROM structured.vendor_claims c
         JOIN structured.vendors v ON v.id = c.vendor_id
        WHERE c.claimant_user_id = $1
        ORDER BY c.created_at DESC LIMIT $2`,
      [userId, RECENT_LIMIT]
    ),
    weddingIds.length === 0
      ? Promise.resolve({ rows: [{ n: '0' }] })
      : pool.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM structured.consultation_records WHERE wedding_id = ANY($1::uuid[])`,
          [weddingIds]
        ),
    pool.query<{ id: string; category: string; status: string; received_at: Date }>(
      `SELECT id, category::text AS category, status::text AS status, received_at
         FROM structured.inquiries WHERE requester_user_id = $1
        ORDER BY received_at DESC LIMIT $2`,
      [userId, RECENT_LIMIT]
    ),
    pool.query<{ code: string }>(`SELECT code FROM structured.referral_codes WHERE user_id = $1`, [userId]),
    pool.query<{ invited: string; qualified: string }>(
      `SELECT count(*)::text AS invited, count(*) FILTER (WHERE qualified_at IS NOT NULL)::text AS qualified
         FROM structured.referrals WHERE inviter_user_id = $1`,
      [userId]
    ),
    pool.query<{ id: string; kind: string; amount_krw: number; status: string; created_at: Date }>(
      `SELECT id, kind::text AS kind, amount_krw, status::text AS status, created_at
         FROM structured.reward_grants WHERE user_id = $1
        ORDER BY created_at DESC LIMIT $2`,
      [userId, RECENT_LIMIT]
    ),
    pool.query<{ id: string; amount_krw: number; status: string; requested_at: Date; settled_at: Date | null }>(
      `SELECT id, amount_krw, status::text AS status, requested_at, settled_at
         FROM structured.reward_payouts WHERE user_id = $1
        ORDER BY requested_at DESC LIMIT $2`,
      [userId, RECENT_LIMIT]
    ),
  ]);

  return {
    id: account.id,
    displayName: account.display_name ?? '',
    provider: account.provider,
    email: account.email,
    nickname: account.nickname,
    createdAt: account.created_at.toISOString(),
    activatedAt: account.activated_at?.toISOString() ?? null,
    lastLoginAt: account.last_login_at?.toISOString() ?? null,
    deletedAt: account.deleted_at?.toISOString() ?? null,
    isOperator: account.is_operator,
    withdrawal: account.withdrawal_status
      ? {
          status: account.withdrawal_status,
          failure: account.failure_message
            ? { message: account.failure_message, attemptCount: account.failure_attempts ?? 1 }
            : null,
        }
      : null,

    weddings: weddingRows.map((row) => ({
      id: row.id,
      role: row.role,
      weddingDate: row.wedding_date ? row.wedding_date.toISOString().slice(0, 10) : null,
      createdAt: row.created_at.toISOString(),
    })),
    candidateCount: Number(candidateCountRow.rows[0]?.n ?? 0),
    candidates: candidateRows.rows.map((row) => ({
      id: row.id,
      vendorName: row.vendor_name,
      category: row.category,
      addedAt: row.added_at.toISOString(),
      addedByThisMember: row.added_by === userId,
    })),
    decisions: decisionRows.rows.map((row) => ({
      category: row.category,
      vendorName: row.vendor_name,
      decidedAt: row.decided_at.toISOString(),
    })),
    reviews: reviewRows.rows.map((row) => ({
      id: row.id,
      vendorName: row.vendor_name,
      overall: row.overall,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    })),
    paymentProofs: paymentProofRows.rows.map((row) => ({
      id: row.id,
      merchantName: row.merchant_name,
      vendorName: row.vendor_name,
      paidAmount: Number(row.paid_amount),
      paidAt: row.paid_at.toISOString(),
    })),
    vendorClaims: vendorClaimRows.rows.map((row) => ({
      id: row.id,
      vendorName: row.vendor_name,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    })),
    consultationCount: Number(consultationCountRow.rows[0]?.n ?? 0),
    inquiries: inquiryRows.rows.map((row) => ({
      id: row.id,
      category: row.category,
      status: row.status,
      receivedAt: row.received_at.toISOString(),
    })),

    referral: {
      code: referralCodeRow.rows[0]?.code ?? null,
      invitedCount: Number(referralCountRow.rows[0]?.invited ?? 0),
      qualifiedCount: Number(referralCountRow.rows[0]?.qualified ?? 0),
    },
    rewardGrants: rewardGrantRows.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      amountKrw: row.amount_krw,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    })),
    rewardPayouts: rewardPayoutRows.rows.map((row) => ({
      id: row.id,
      amountKrw: row.amount_krw,
      status: row.status,
      requestedAt: row.requested_at.toISOString(),
      settledAt: row.settled_at?.toISOString() ?? null,
    })),
  };
}
