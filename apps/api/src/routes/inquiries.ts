import { createInquiryRequestSchema } from '@weddingpick/api-contract';
import {
  INQUIRY_CATEGORY_RULES,
  canSubmitInquiry,
  inquiryAcknowledgement,
  withObject,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError, forbidden, notFound } from '../errors';

type InquiryRow = {
  id: string;
  category: string;
  body: string;
  status: string;
  subject_kind: string | null;
  subject_id: string | null;
  requester_user_id: string | null;
  received_at: Date;
  decided_at: Date | null;
  resolution: string | null;
};

function toInquiry(row: InquiryRow) {
  return {
    id: row.id,
    category: row.category,
    body: row.body,
    status: row.status,
    subject: row.subject_kind ? { kind: row.subject_kind, id: row.subject_id! } : null,
    receivedAt: row.received_at.toISOString(),
    decidedAt: row.decided_at?.toISOString() ?? null,
    resolution: row.resolution,
  };
}

export function registerInquiryRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  /**
   * 문의 접수.
   *
   * 여러 화면이 "알려주세요"라고 말해왔다. 여기가 그 말을 받는 곳이다.
   *
   * 접수만 한다. 서비스정책서 6번의 증빙 재검토는 사람이 하고, 응답 계약에는
   * 'received'밖에 없다 — 접수와 동시에 처리된 것처럼 답할 방법이 없다.
   */
  app.post('/v1/inquiries', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = createInquiryRequestSchema.parse(request.body);

    /*
     * 로그인 상태라 회신 경로는 늘 있다. 그래도 규칙을 여기서 한 번 더 본다 —
     * 로그인 없이 받는 창구가 생겼을 때 이 검사가 빠져 있으면 안 된다.
     */
    if (
      !canSubmitInquiry({
        category: body.category,
        body: body.body,
        hasSubject: body.subject !== undefined,
        hasReplyRoute: true,
      })
    ) {
      const rule = INQUIRY_CATEGORY_RULES[body.category];

      throw new ApiError(
        'invalid_request',
        `${withObject(rule.label)} 보내시려면 어느 대상에 대한 것인지 함께 알려주세요.`
      );
    }

    const { rows } = await context.pool.query<{ id: string; received_at: Date }>(
      `INSERT INTO structured.inquiries
         (category, body, requester_user_id, contact, subject_kind, subject_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, received_at`,
      [
        body.category,
        body.body,
        userId,
        body.contact ?? null,
        body.subject?.kind ?? null,
        body.subject?.id ?? null,
      ]
    );

    const created = rows[0]!;

    return reply.status(202).send({
      inquiryId: created.id,
      status: 'received',
      receivedAt: created.received_at.toISOString(),
      acknowledgement: inquiryAcknowledgement(),
    });
  });

  /** 내가 보낸 문의. 남의 문의는 여기서도 저기서도 보이지 않는다. */
  app.get('/v1/inquiries', auth, async (request) => {
    const userId = currentUserId(request);

    const { rows } = await context.pool.query<InquiryRow>(
      `SELECT id, category, body, status, subject_kind, subject_id, requester_user_id,
              received_at, decided_at, resolution
       FROM structured.inquiries
       WHERE requester_user_id = $1
       ORDER BY received_at DESC
       LIMIT 50`,
      [userId]
    );

    return { inquiries: rows.map(toInquiry) };
  });

  app.get<{ Params: { inquiryId: string } }>('/v1/inquiries/:inquiryId', auth, async (request) => {
    const userId = currentUserId(request);

    const { rows } = await context.pool.query<InquiryRow>(
      `SELECT id, category, body, status, subject_kind, subject_id, requester_user_id,
              received_at, decided_at, resolution
       FROM structured.inquiries WHERE id = $1`,
      [request.params.inquiryId]
    );

    const found = rows[0];

    if (!found) {
      throw notFound('문의');
    }

    if (found.requester_user_id !== userId) {
      throw forbidden();
    }

    return toInquiry(found);
  });
}
