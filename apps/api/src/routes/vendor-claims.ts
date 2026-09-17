import { createVendorClaimRequestSchema } from '@weddingpick/api-contract';
import {
  CLAIM_METHOD_RULES,
  CLAIM_RULE_VERSION,
  CLAIM_STATUS_LABEL,
  CLAIM_STATUS_NOTE,
  checkClaim,
  claimSignal,
  type ClaimEvidence,
  type ClaimMethod,
  type ClaimStatus,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { withTransaction } from '../db';
import { newEventId, recordDecision } from '../decisions';
import { ApiError, notFound } from '../errors';

type ClaimRow = {
  id: string;
  vendor_id: string;
  vendor_name: string;
  claimed_role: string;
  method: ClaimMethod;
  status: ClaimStatus;
  decision_note: string | null;
  created_at: Date;
};

/**
 * 업체 관계자 인증. 최종통합정책 v2.0 26·27번.
 *
 * **여기서 확인되는 것은 없다.** 접수하고, 규칙이 볼 수 있는 것만 심사 재료로
 * 남긴다. 도메인이 맞아떨어져도 그건 그 회사의 주소라는 뜻이지 신청한 사람이 그
 * 주소를 쓴다는 뜻이 아니다 — 결론은 사람이 낸다(`vendor-claim-admin`).
 */
export function registerVendorClaimRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.post('/v1/vendor-claims', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = createVendorClaimRequestSchema.parse(request.body);
    const evidence = body.evidence as ClaimEvidence;

    const check = checkClaim({ claimedRole: body.claimedRole, evidence });
    if (!check.ok) throw new ApiError('invalid_request', check.message);

    const vendor = await context.pool.query<{ id: string; official_domain: string | null }>(
      'SELECT id, official_domain FROM structured.vendors WHERE id = $1',
      [body.vendorId]
    );

    const found = vendor.rows[0];
    if (!found) throw notFound('업체');

    if (evidence.method === 'business_document') {
      /*
       * 남의 문서를 가리켜 자기 신청의 증빙으로 삼을 수 없다. 증빙은 낸 사람의
       * 것이어야 한다.
       */
      const document = await context.pool.query<{ id: string }>(
        `SELECT id FROM originals.raw_documents
         WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`,
        [evidence.documentId, userId]
      );

      if (document.rows.length === 0) throw notFound('증빙');
    }

    const open = await context.pool.query<{ id: string }>(
      `SELECT id FROM structured.vendor_claims
       WHERE vendor_id = $1 AND claimant_user_id = $2 AND status = 'pending'`,
      [body.vendorId, userId]
    );

    if (open.rows.length > 0) {
      // 표의 부분 유니크가 이미 막지만, 여기서 걸러야 읽을 수 있는 말을 받는다.
      throw new ApiError('conflict', '이미 확인 중인 신청이 있습니다.');
    }

    const claimId = await withTransaction(context.pool, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO structured.vendor_claims
           (vendor_id, claimant_user_id, claimed_role, method,
            contact_email, listed_at, evidence_document_id)
         VALUES ($1, $2, $3, $4::vendor_claim_method, $5, $6, $7)
         RETURNING id`,
        [
          body.vendorId,
          userId,
          body.claimedRole,
          evidence.method,
          evidence.method === 'business_document' ? null : evidence.email,
          evidence.method === 'listed_email' ? evidence.listedAt : null,
          evidence.method === 'business_document' ? evidence.documentId : null,
        ]
      );

      const id = rows[0]!.id;
      const signal = claimSignal({ evidence, officialDomain: found.official_domain });

      /*
       * 규칙이 본 것을 남긴다. **결정이 아니라 재료다** — 그래서 execution은
       * pending이고, 이 줄은 `open_decisions`에 남아 사람을 기다린다.
       *
       * 근거는 가리키기만 한다. 이메일 주소도 증빙 내용도 이 로그에 복사되지
       * 않는다(L장 · 추출규칙 10번).
       */
      await recordDecision(client, {
        eventId: newEventId(),
        workflow: 'vendor_claim',
        step: 'intake',
        subjectKind: 'vendor_claim',
        subjectId: id,
        decider: { kind: 'rule', ruleVersion: CLAIM_RULE_VERSION },
        decision: signal.domainMatches ? 'domain_matches' : 'needs_human_check',
        reasonCode: signal.reasonCode,
        evidence: [{ kind: 'vendor', id: body.vendorId }],
        execution: 'pending',
      });

      return id;
    });

    return reply.status(201).send({ claimId });
  });

  /**
   * 내가 낸 신청.
   *
   * **증빙도 연락처도 나가지 않는다.** 낸 사람에게도 다시 보여줄 이유가 없고,
   * 응답에 담기지 않으면 화면 어디로도 새지 않는다(v2.0 27번).
   */
  app.get('/v1/me/vendor-claims', auth, async (request) => {
    const userId = currentUserId(request);

    const { rows } = await context.pool.query<ClaimRow>(
      `SELECT c.id, c.vendor_id, v.name AS vendor_name, c.claimed_role, c.method,
              c.status, c.decision_note, c.created_at
       FROM structured.vendor_claims c
       JOIN structured.vendors v ON v.id = c.vendor_id
       WHERE c.claimant_user_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );

    return {
      claims: rows.map((row) => ({
        id: row.id,
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        claimedRole: row.claimed_role,
        method: row.method,
        methodLabel: CLAIM_METHOD_RULES[row.method].label,
        status: row.status,
        statusLabel: CLAIM_STATUS_LABEL[row.status],
        statusNote: CLAIM_STATUS_NOTE[row.status],
        decisionNote: row.decision_note,
        createdAt: row.created_at.toISOString(),
      })),
    };
  });
}
