import {
  REPORT_KIND_LABEL,
  REPORT_KIND_USE,
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
  note: string | null;
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
              coalesce(v.name, p.merchant_name) AS subject,
              p.vendor_id,
              p.paid_amount::text AS amount,
              p.created_at AS reported_at,
              -- 업체를 못 찾은 제보는 남아 있지만 어디에도 쓰이지 않는다.
              (p.vendor_id IS NOT NULL) AS in_use,
              CASE WHEN p.vendor_id IS NULL
                   THEN '어느 업체인지 찾지 못해 아직 쓰이지 않아요'
              END AS note
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
              CASE WHEN r.rejected_at IS NOT NULL
                   THEN '확인 결과 쓰지 않기로 했어요'
              END
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
              CASE WHEN vis.effective_status <> 'published'
                   THEN '이의 확인 중이라 지금은 보이지 않아요'
              END
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
        note: row.note,
      })),
    };
  });
}
