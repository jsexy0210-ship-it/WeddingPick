import {
  REPORT_KIND_LABEL,
  REPORT_KIND_USE,
  type PaymentProofField,
  type ReportKind,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';

type ReportRow = {
  id: string;
  kind: ReportKind;
  subject: string;
  vendor_id: string | null;
  amount: string | null;
  reported_at: Date;
  in_use: boolean;
  needs_check: boolean;
  note: string | null;
  pending_fields: PaymentProofField[];
};

/**
 * 내가 낸 자료. 디자인 핸드오프 20번.
 *
 * 셋을 UNION으로 모은다. 지출내역이 수기 입력과 결제인증을 합칠 때와 같은 판단이다 —
 * **다 내 것이라서 모을 수 있다.** 합치면 안 되는 것은 남의 자료였고, 여기엔 남의
 * 자료가 없다. 대신 종류를 행마다 달아 어느 것이 어디서 왔는지 잃지 않는다.
 */
export function registerMyReportRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get('/v1/me/reports', auth, async (request) => {
    const userId = currentUserId(request);

    const { rows } = await context.pool.query<ReportRow>(
      `SELECT p.id,
              'payment_proof'::text AS kind,
              -- 가맹점명도 못 읽었으면 접수했다는 사실만 남는다. 지어내지 않는다.
              coalesce(v.name, p.merchant_name, '확인 중인 자료') AS subject,
              p.vendor_id,
              p.paid_amount::text AS amount,
              p.created_at AS reported_at,
              /*
               * 업체를 못 찾았거나 아직 읽는 중인 제보는 남아 있지만 어디에도
               * 쓰이지 않는다. usable_payment_proofs가 보는 조건과 같다.
               */
              (p.vendor_id IS NOT NULL AND p.review_state = 'accepted') AS in_use,
              (p.review_state = 'pending_review') AS needs_check,
              CASE
                /*
                 * 보류 사유를 그대로 보여준다. 「못 읽었어요」로 끝내지 않고
                 * 무엇이 되는지를 말한다 — 화면의 «확인 필요»가 이 줄이다.
                 */
                WHEN p.review_state = 'pending_review'
                  THEN coalesce(p.review_note, '올려주신 자료를 확인하고 있어요')
                WHEN p.vendor_id IS NULL
                  THEN '어느 업체인지 찾지 못해 아직 쓰이지 않아요'
              END AS note,
              /*
               * 사람이 채울 수 있는 칸. **키만 보낸다** — 값도 사유 문장도 담지
               * 않는다(2026-09-14 지시). 화면은 이 키로 「직접 입력」(WP-RPT-004)을
               * 열고, 문구는 spec/strings.ko.json이 만든다.
               *
               * ::text[]로 꺼내는 이유는 node-pg가 우리가 만든 enum의 배열을
               * 풀어주지 못해 '{a,b}' 문자열 그대로 돌려주기 때문이다.
               *
               * 이미 사람이 적어둔 줄(claimed_fields가 찬 줄)은 다시 묻지 않는다 —
               * 적을 것이 남아 있지 않고, 기다리는 것은 검수다.
               */
              CASE
                WHEN p.review_state = 'pending_review' AND cardinality(p.claimed_fields) = 0
                  THEN p.pending_fields::text[]
                ELSE '{}'::text[]
              END AS pending_fields
       FROM structured.payment_proofs p
       LEFT JOIN structured.vendors v ON v.id = p.vendor_id
       WHERE p.reporter_user_id = $1

       UNION ALL

       SELECT r.id,
              'price_report'::text,
              v.name || ' · ' || r.product_name,
              r.vendor_id,
              r.total_amount::text,
              r.created_at,
              (r.rejected_at IS NULL),
              false,
              CASE WHEN r.rejected_at IS NOT NULL
                   THEN '확인 결과 쓰지 않기로 했어요'
              END,
              -- 가격 제보에는 기계가 읽는 자리가 없다. 채울 칸도 없다.
              '{}'::text[]
       FROM structured.price_reports r
       JOIN structured.vendors v ON v.id = r.vendor_id
       WHERE r.reporter_user_id = $1

       UNION ALL

       SELECT w.id,
              'review'::text,
              v.name,
              w.vendor_id,
              NULL,
              w.created_at,
              (vis.effective_status = 'published'),
              false,
              CASE WHEN vis.effective_status <> 'published'
                   THEN '이의 확인 중이라 지금은 보이지 않아요'
              END,
              '{}'::text[]
       FROM structured.reviews w
       JOIN structured.vendors v ON v.id = w.vendor_id
       /*
        * 저장된 status가 아니라 **지금 보이는가**를 본다(0050). 임시조치는 기간이
        * 지나면 저절로 끝나므로, status만 보면 이미 다시 보이는 글에 "확인 중"이라고
        * 적게 된다.
        */
       JOIN structured.review_visibility vis ON vis.review_id = w.id
       WHERE w.author_user_id = $1

       ORDER BY reported_at DESC`,
      [userId]
    );

    return {
      reports: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        kindLabel: REPORT_KIND_LABEL[row.kind],
        use: REPORT_KIND_USE[row.kind],
        subject: row.subject,
        vendorId: row.vendor_id,
        // bigint는 pg가 문자열로 준다. 큰 수가 조용히 부정확해지지 않게 한 번만 바꾼다.
        amount: row.amount === null ? null : Number(row.amount),
        reportedAt: row.reported_at.toISOString(),
        inUse: row.in_use,
        needsCheck: row.needs_check,
        note: row.note,
        pendingFields: row.pending_fields,
      })),
    };
  });
}
