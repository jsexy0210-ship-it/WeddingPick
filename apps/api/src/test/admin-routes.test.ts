import { randomUUID } from 'node:crypto';

import { recordDecision } from '../decisions';
import type { LocalStorage } from '../storage/local';
import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 관리자 콘솔 라우트. 13개의 CLI 전용 도구를 HTTP 위에 올린 것이 맞게 이어졌는지를
 * 본다. 각 도구의 판단 로직 자체(권한 확인 예외, 자동승인 금지 등)는 이미
 * `operator-authority.test.ts`와 도구별 시험이 지킨다 — 여기서는 라우트가 그
 * 함수를 맞게 부르고, 상태 코드와 응답이 화면이 기대하는 모양인지만 본다.
 */
describeWithDb('관리자 콘솔 라우트', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function operatorHeaders(subject = `operator-${Math.random()}`) {
    const session = await signInAs(test, subject);
    await test.pool.query('UPDATE structured.users SET is_operator = true WHERE id = $1', [
      session.userId,
    ]);
    return session;
  }

  const get = (url: string, headers?: Record<string, string>) =>
    test.app.inject({ method: 'GET', url, headers });
  const post = (url: string, headers: Record<string, string>, payload?: Record<string, unknown>) =>
    test.app.inject({ method: 'POST', url, headers, payload });
  const patch = (url: string, headers: Record<string, string>, payload?: Record<string, unknown>) =>
    test.app.inject({ method: 'PATCH', url, headers, payload });
  const del = (url: string, headers: Record<string, string>) =>
    test.app.inject({ method: 'DELETE', url, headers });

  /*
   * 수집을 늘리기 전에 멈출 수단이 먼저 있어야 한다. 화면의 스위치가 실제로
   * `structured.import_switches`를 바꾸는지를 본다 — 이 값을 `public-data/sync.ts`가
   * 임포트 직전에 읽어 `SOURCE_DISABLED`로 거부한다.
   */
  describe('수집 중단 스위치', () => {
    it('목록에 출처가 나오고, 끄면 import_switches가 바뀐다', async () => {
      const operator = await operatorHeaders();

      const listed = (await get('/v1/admin/kill-switches', operator.headers)).json() as {
        switches: { id: string; category: string; enabled: boolean }[];
      };
      expect(listed.switches.find((s) => s.id === 'import:localdata')).toMatchObject({
        category: '수집',
        enabled: true,
      });

      const off = await patch('/v1/admin/kill-switches/import:localdata', operator.headers, {
        enabled: false,
      });
      expect(off.statusCode).toBe(204);

      const { rows } = await test.pool.query<{ enabled: boolean; reason: string | null }>(
        `SELECT enabled, reason FROM structured.import_switches WHERE source_key = 'localdata'`
      );
      expect(rows[0]?.enabled).toBe(false);
      expect(rows[0]?.reason).toContain('중단');
    });

    it('없는 출처는 404다', async () => {
      const operator = await operatorHeaders();
      const response = await patch('/v1/admin/kill-switches/import:no-such-source', operator.headers, {
        enabled: false,
      });
      expect(response.statusCode).toBe(404);
    });
  });

  /*
   * 기능 스위치가 **실제로 기능을 끄는가.** 예전에는 인메모리 Map을 껐다 켤 뿐
   * 읽는 쪽이 한 곳도 없어서, 껐다고 표시돼도 기능은 계속 돌았다.
   */
  describe('기능 중지 스위치', () => {
    it('목록에 6종이 나오고 배선 여부가 함께 온다', async () => {
      const operator = await operatorHeaders();

      const listed = (await get('/v1/admin/kill-switches', operator.headers)).json() as {
        switches: { id: string; enabled: boolean; wired: boolean }[];
      };

      // 읽는 쪽을 만든 셋은 wired=true, 아직 못 만든 셋은 false다. 화면이
      // 「꺼도 아무 일이 안 일어난다」를 보여줄 수 있어야 한다.
      expect(listed.switches.find((s) => s.id === 'ai-recommendations')).toMatchObject({
        enabled: true,
        wired: true,
      });
      expect(listed.switches.find((s) => s.id === 'stats-update')).toMatchObject({ wired: false });
    });

    it('끄면 DB에 남고, 다시 조회하면 꺼져 있다', async () => {
      const operator = await operatorHeaders();

      const off = await patch('/v1/admin/kill-switches/ai-recommendations', operator.headers, {
        enabled: false,
      });
      expect(off.statusCode).toBe(204);

      const { rows } = await test.pool.query<{ enabled: boolean; updated_by: string | null }>(
        `SELECT enabled, updated_by FROM structured.kill_switches WHERE id = 'ai-recommendations'`
      );
      expect(rows[0]?.enabled).toBe(false);
      expect(rows[0]?.updated_by).toBe(operator.userId);
    });

    it('끈 기능을 부르면 503이다 — 빈 결과로 조용히 성공하지 않는다', async () => {
      const operator = await operatorHeaders();
      await patch('/v1/admin/kill-switches/ai-recommendations', operator.headers, {
        enabled: false,
      });

      const response = await get('/v1/recommendations/top3?category=hall', operator.headers);
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ error: { code: 'feature_disabled' } });
    });

    it('없는 스위치는 404다', async () => {
      const operator = await operatorHeaders();
      const response = await patch('/v1/admin/kill-switches/no-such-switch', operator.headers, {
        enabled: false,
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('관문', () => {
    it('토큰이 없으면 401이다', async () => {
      expect((await get('/v1/admin/decisions/open')).statusCode).toBe(401);
    });

    it('운영자가 아니면 403이다', async () => {
      const ordinary = await signInAs(test, 'ordinary-user');
      expect((await get('/v1/admin/decisions/open', ordinary.headers)).statusCode).toBe(403);
    });

    it('운영자면 지나간다', async () => {
      const operator = await operatorHeaders();
      const response = await get('/v1/admin/decisions/open', operator.headers);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ rows: [] });
    });
  });

  describe('결정 브리핑', () => {
    it('브리핑과 사건 이력을 본다', async () => {
      const operator = await operatorHeaders();

      expect((await get('/v1/admin/decisions/briefing', operator.headers)).json()).toEqual({
        rows: [],
      });

      const missing = await get('/v1/admin/decisions/events/00000000-0000-4000-8000-000000000000', operator.headers);
      expect(missing.statusCode).toBe(404);
    });
  });

  describe('계정 목록', () => {
    it('탈퇴를 접수한 계정도 상태와 함께 보인다', async () => {
      const operator = await operatorHeaders();
      const leaving = await signInAs(test, 'leaving-user');

      await test.pool.query(
        `UPDATE structured.users SET display_name = '떠난사람', deleted_at = now() WHERE id = $1`,
        [leaving.userId]
      );
      await test.pool.query(
        `INSERT INTO structured.withdrawal_deletion_failures (user_id, error_message)
         VALUES ($1, 'removed_candidates FK')`,
        [leaving.userId]
      );

      const all = await get('/v1/admin/users', operator.headers);

      expect(all.statusCode).toBe(200);

      const users = all.json<{ users: { id: string; withdrawal: unknown; provider: string | null }[] }>().users;
      const gone = users.find((u) => u.id === leaving.userId);

      expect(gone).toMatchObject({
        provider: 'apple',
        withdrawal: { status: 'failed', failure: { message: 'removed_candidates FK', attemptCount: 1 } },
      });
      expect(users.find((u) => u.id === operator.userId)).toMatchObject({ withdrawal: null, isOperator: true });

      const withdrawn = await get('/v1/admin/users?status=withdrawn', operator.headers);

      expect(withdrawn.json<{ users: { id: string }[]; total: number }>()).toMatchObject({ total: 1 });
      expect(withdrawn.json<{ users: { id: string }[] }>().users.map((u) => u.id)).toEqual([leaving.userId]);

      const searched = await get('/v1/admin/users?search=떠난', operator.headers);

      expect(searched.json<{ users: { id: string }[] }>().users.map((u) => u.id)).toEqual([leaving.userId]);
    });

    it('삭제에 실패한 탈퇴 계정을 다시 지운다', async () => {
      const operator = await operatorHeaders();
      const leaving = await signInAs(test, 'leaving-user');

      await test.pool.query('UPDATE structured.users SET deleted_at = now() WHERE id = $1', [leaving.userId]);
      await test.pool.query(
        `INSERT INTO structured.withdrawal_deletion_failures (user_id, error_message) VALUES ($1, 'x')`,
        [leaving.userId]
      );

      const retried = await post(`/v1/admin/withdrawals/${leaving.userId}/retry`, operator.headers);

      expect(retried.statusCode).toBe(200);
      expect(retried.json()).toMatchObject({ completed: true });

      const after = await get('/v1/admin/users?status=withdrawn', operator.headers);

      expect(after.json<{ total: number }>().total).toBe(0);
    });
  });

  describe('반론', () => {
    async function aPendingRebuttal() {
      const vendor = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
      );
      const author = await signInAs(test, 'review-author');

      const review = await test.app.inject({
        method: 'POST',
        url: `/v1/vendors/${vendor.rows[0]!.id}/reviews`,
        headers: author.headers,
        payload: {
          role: 'contractor',
          overall: 2,
          title: '주차가 아쉬웠습니다',
          body: '음식이 따뜻하게 나왔고 직원분들이 동선을 잘 안내해 주셨습니다. 주차는 조금 붐비는 편이었습니다.',
          aspects: [{ key: 'food_taste', rating: 3 }],
        },
      });
      const reviewId = review.json<{ reviewId: string }>().reviewId;

      const vendorSide = await signInAs(test, 'vendor-staff');
      const submitted = await test.app.inject({
        method: 'POST',
        url: '/v1/rebuttals',
        headers: vendorSide.headers,
        payload: {
          reviewId,
          claimedRole: '가온예식홀 예약팀장',
          body: '해당 날짜에는 주차 안내 인원을 두 명 더 배치했습니다. 확인해보겠습니다.',
        },
      });

      return submitted.json<{ rebuttalId: string }>().rebuttalId;
    }

    it('목록·상세를 보고 게시로 결론짓는다', async () => {
      const rebuttalId = await aPendingRebuttal();
      const operator = await operatorHeaders();

      const list = await get('/v1/admin/rebuttals', operator.headers);
      expect(list.json<{ rebuttals: { id: string }[] }>().rebuttals.map((r) => r.id)).toEqual([
        rebuttalId,
      ]);

      const show = await get(`/v1/admin/rebuttals/${rebuttalId}`, operator.headers);
      expect(show.statusCode).toBe(200);

      const publish = await post(`/v1/admin/rebuttals/${rebuttalId}/publish`, operator.headers, {
        note: '사업자등록증으로 소속 확인',
        withoutClaim: true,
      });
      expect(publish.statusCode).toBe(204);

      const after = await get(`/v1/admin/rebuttals/${rebuttalId}`, operator.headers);
      expect(after.json<{ status: string }>().status).toBe('published');
    });

    it('없는 반론을 심사하면 사람이 읽을 수 있는 400이다', async () => {
      const operator = await operatorHeaders();
      const response = await post(
        '/v1/admin/rebuttals/00000000-0000-4000-8000-000000000000/reject',
        operator.headers,
        { note: '아무거나' }
      );

      expect(response.statusCode).toBe(400);
      expect(response.json<{ error: { message: string } }>().error.message).toContain('없는 반론');
    });
  });

  describe('후기 이의', () => {
    async function aPublishedReview() {
      const vendor = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
      );
      const author = await signInAs(test, 'review-author-2');

      const review = await test.app.inject({
        method: 'POST',
        url: `/v1/vendors/${vendor.rows[0]!.id}/reviews`,
        headers: author.headers,
        payload: {
          role: 'contractor',
          overall: 4,
          title: '만족스러웠습니다',
          body: '음식이 따뜻하게 나왔고 직원분들이 동선을 잘 안내해 주셨습니다. 전반적으로 아주 좋았습니다.',
          aspects: [{ key: 'food_taste', rating: 4 }],
        },
      });

      return review.json<{ reviewId: string }>().reviewId;
    }

    it('내려두고 다시 올린다', async () => {
      const reviewId = await aPublishedReview();
      const operator = await operatorHeaders();

      const hold = await post(`/v1/admin/objections/${reviewId}/hold`, operator.headers, {
        note: '업체가 사실과 다르다고 이의 제기',
      });
      expect(hold.statusCode).toBe(204);

      const listed = await get('/v1/admin/objections', operator.headers);
      expect(listed.json<{ objections: { id: string }[] }>().objections.map((o) => o.id)).toEqual([
        reviewId,
      ]);

      const restore = await post(`/v1/admin/objections/${reviewId}/restore`, operator.headers, {
        note: '계약 사실 확인됨',
      });
      expect(restore.statusCode).toBe(204);

      expect((await get('/v1/admin/objections', operator.headers)).json<{ objections: unknown[] }>().objections).toHaveLength(0);
    });

    /*
     * 내리기는 되돌릴 수 없다. 화면의 「내리기」 단추가 실제로 후기를 내리는지와,
     * 운영자가 적은 사유가 남는지를 함께 본다 — 사유를 받아놓고 버리면 나중에
     * 「왜 내렸느냐」에 답할 수 없다(0110).
     */
    it('내리면 후기가 사라지고 적은 사유가 남는다', async () => {
      const reviewId = await aPublishedReview();
      const operator = await operatorHeaders();

      await post(`/v1/admin/objections/${reviewId}/hold`, operator.headers, {
        note: '업체가 계약한 적이 없다고 이의 제기',
      });

      const remove = await post(`/v1/admin/objections/${reviewId}/remove`, operator.headers, {
        note: '계약 사실이 확인되지 않음',
      });
      expect(remove.statusCode).toBe(204);

      const review = await test.pool.query<{ status: string }>(
        'SELECT status FROM structured.reviews WHERE id = $1',
        [reviewId]
      );
      expect(review.rows[0]?.status).toBe('removed');

      expect(
        (await get('/v1/admin/objections', operator.headers)).json<{ objections: unknown[] }>()
          .objections
      ).toHaveLength(0);

      const logged = await test.pool.query<{
        action: string;
        note: string;
        before_status: string;
        after_status: string;
      }>(
        `SELECT action, note, before_status, after_status
         FROM structured.review_objection_log
         WHERE review_id = $1 ORDER BY created_at`,
        [reviewId]
      );
      expect(logged.rows.map((row) => row.action)).toEqual(['hold', 'remove']);
      expect(logged.rows[1]).toMatchObject({
        note: '계약 사실이 확인되지 않음',
        before_status: 'under_objection',
        after_status: 'removed',
      });
    });

    it('사유 없이는 내리지 못한다', async () => {
      const reviewId = await aPublishedReview();
      const operator = await operatorHeaders();

      await post(`/v1/admin/objections/${reviewId}/hold`, operator.headers, { note: '확인 중' });

      const blank = await post(`/v1/admin/objections/${reviewId}/remove`, operator.headers, {
        note: '   ',
      });
      expect(blank.statusCode).toBe(400);

      const review = await test.pool.query<{ status: string }>(
        'SELECT status FROM structured.reviews WHERE id = $1',
        [reviewId]
      );
      expect(review.rows[0]?.status).toBe('under_objection');
    });
  });

  describe('인증 심사', () => {
    async function aVerificationRequest(requesterHeaders: Record<string, string>, requesterId: string) {
      const wedding = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
        [requesterId]
      );
      const quote = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.quotes (wedding_id, source, total_amount)
         VALUES ($1, 'user_quote', 32800000) RETURNING id`,
        [wedding.rows[0]!.id]
      );
      const request = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.verification_requests (quote_id, requested_by, target_level)
         VALUES ($1, $2, 'L2') RETURNING id`,
        [quote.rows[0]!.id, requesterId]
      );
      const document = await test.pool.query<{ id: string }>(
        'INSERT INTO originals.raw_documents (owner_user_id, page_count) VALUES ($1, 1) RETURNING id',
        [requesterId]
      );

      await test.pool.query(
        `INSERT INTO structured.verification_evidence (request_id, kind, raw_document_id)
         VALUES ($1, 'contract_document', $2)`,
        [request.rows[0]!.id, document.rows[0]!.id]
      );

      return request.rows[0]!.id;
    }

    it('목록에서 보고, 심사를 시작하고, 승인한다', async () => {
      const requester = await signInAs(test, 'verification-requester');
      const requestId = await aVerificationRequest(requester.headers, requester.userId);
      const operator = await operatorHeaders();

      const list = await get('/v1/admin/verifications', operator.headers);
      expect(list.json<{ requests: { id: string }[] }>().requests.map((r) => r.id)).toEqual([
        requestId,
      ]);

      expect((await post(`/v1/admin/verifications/${requestId}/review`, operator.headers)).statusCode).toBe(
        204
      );

      const approve = await post(`/v1/admin/verifications/${requestId}/approve`, operator.headers, {
        note: '계약서 3면 도장 확인',
      });
      expect(approve.statusCode).toBe(204);

      const show = await get(`/v1/admin/verifications/${requestId}`, operator.headers);
      expect(show.json<{ status: string }>().status).toBe('approved');
    });

    /*
     * 화면이 「반려」를 누르면 사유가 신청한 사람에게 그대로 간다. 사유 없이
     * 반려되면 신청한 쪽은 무엇을 고쳐야 할지 알 수 없으므로 라우트가 먼저 막는다.
     */
    it('반려는 사유를 요구하고, 적은 사유가 신청에 남는다', async () => {
      const requester = await signInAs(test, 'verification-requester-2');
      const requestId = await aVerificationRequest(requester.headers, requester.userId);
      const operator = await operatorHeaders();

      const blank = await post(`/v1/admin/verifications/${requestId}/reject`, operator.headers, {
        reason: '  ',
      });
      expect(blank.statusCode).toBe(400);

      const rejected = await post(`/v1/admin/verifications/${requestId}/reject`, operator.headers, {
        reason: '올린 문서가 계약서가 아니라 견적서다',
      });
      expect(rejected.statusCode).toBe(204);

      const { rows } = await test.pool.query<{ status: string; rejection_reason: string | null }>(
        'SELECT status, rejection_reason FROM structured.verification_requests WHERE id = $1',
        [requestId]
      );
      expect(rows[0]).toMatchObject({
        status: 'rejected',
        rejection_reason: '올린 문서가 계약서가 아니라 견적서다',
      });
    });

    /* 승인 메모는 선택이다. 화면이 빈 칸을 `null`로 보내는 것과 짝이다. */
    it('승인 메모 없이도 승인된다', async () => {
      const requester = await signInAs(test, 'verification-requester-3');
      const requestId = await aVerificationRequest(requester.headers, requester.userId);
      const operator = await operatorHeaders();

      const approve = await post(`/v1/admin/verifications/${requestId}/approve`, operator.headers, {
        note: null,
      });
      expect(approve.statusCode).toBe(204);

      const show = await get(`/v1/admin/verifications/${requestId}`, operator.headers);
      expect(show.json<{ status: string }>().status).toBe('approved');
    });

    it('밀린 신청 목록도 본다', async () => {
      const operator = await operatorHeaders();
      const backlog = await get('/v1/admin/verifications/backlog', operator.headers);
      expect(backlog.json()).toEqual({ requests: [] });
    });
  });

  describe('업체 관계자 인증', () => {
    async function aPendingClaim() {
      const vendor = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source, official_domain)
         VALUES ('가온예식홀', 'hall', '서울', 'public_data', 'gaon.co.kr') RETURNING id`
      );
      const claimant = await signInAs(test, 'claim-staff');

      const submitted = await test.app.inject({
        method: 'POST',
        url: '/v1/vendor-claims',
        headers: claimant.headers,
        payload: {
          vendorId: vendor.rows[0]!.id,
          claimedRole: '예약팀장',
          evidence: { method: 'official_domain_email', email: 'staff@gaon.co.kr' },
        },
      });

      return submitted.json<{ claimId: string }>().claimId;
    }

    it('목록·상세를 보고 승인한다', async () => {
      const claimId = await aPendingClaim();
      const operator = await operatorHeaders();

      const list = await get('/v1/admin/vendor-claims', operator.headers);
      expect(list.json<{ claims: { id: string }[] }>().claims.map((c) => c.id)).toEqual([claimId]);

      expect((await get(`/v1/admin/vendor-claims/${claimId}`, operator.headers)).statusCode).toBe(200);

      const approve = await post(`/v1/admin/vendor-claims/${claimId}/approve`, operator.headers, {
        note: '공식 도메인 주소로 회신 확인',
      });
      expect(approve.statusCode).toBe(204);
    });
  });

  describe('문의', () => {
    it('목록에서 보고, 심사를 시작하고, 답한다', async () => {
      const asker = await signInAs(test, 'inquiry-asker');
      const submitted = await test.app.inject({
        method: 'POST',
        url: '/v1/inquiries',
        headers: asker.headers,
        payload: { category: 'other', body: '문의합니다' },
      });
      const inquiryId = submitted.json<{ inquiryId: string }>().inquiryId;
      const operator = await operatorHeaders();

      const list = await get('/v1/admin/inquiries', operator.headers);
      expect(list.json<{ inquiries: { id: string }[] }>().inquiries.map((i) => i.id)).toEqual([
        inquiryId,
      ]);

      expect((await post(`/v1/admin/inquiries/${inquiryId}/review`, operator.headers)).statusCode).toBe(
        204
      );

      const answer = await post(`/v1/admin/inquiries/${inquiryId}/answer`, operator.headers, {
        resolution: '확인 후 안내드렸습니다.',
      });
      expect(answer.statusCode).toBe(204);

      const show = await get(`/v1/admin/inquiries/${inquiryId}`, operator.headers);
      expect(show.json<{ status: string }>().status).toBe('answered');
    });
  });

  describe('개인정보 재검토', () => {
    async function aPendingQuote() {
      const user = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );
      const wedding = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
        [user.rows[0]!.id]
      );
      const vendor = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('아펠가모 공덕', 'hall', '서울', 'public_data') RETURNING id`
      );
      const quote = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.quotes (wedding_id, source, doc_type, vendor_id, product_key, total_amount)
         VALUES ($1, 'ai_extraction', 'contract', $2, 'k', 32800000) RETURNING id`,
        [wedding.rows[0]!.id, vendor.rows[0]!.id]
      );

      return quote.rows[0]!.id;
    }

    it('목록·상세를 보고 깨끗하다고 정리한다', async () => {
      const quoteId = await aPendingQuote();
      const operator = await operatorHeaders();

      const list = await get('/v1/admin/pii-reviews', operator.headers);
      expect(list.json<{ reviews: { id: string }[] }>().reviews.map((r) => r.id)).toEqual([quoteId]);

      expect((await get(`/v1/admin/pii-reviews/${quoteId}`, operator.headers)).statusCode).toBe(200);

      const clean = await post(`/v1/admin/pii-reviews/${quoteId}/clean`, operator.headers);
      expect(clean.statusCode).toBe(204);

      const { rows } = await test.pool.query<{ pii_review: string }>(
        'SELECT pii_review FROM structured.quotes WHERE id = $1',
        [quoteId]
      );
      expect(rows[0]!.pii_review).toBe('clean');
    });
  });

  describe('결제인증 잇기', () => {
    it('목록·상세를 보고 업체를 잇는다', async () => {
      const vendor = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
      );
      const reporter = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );
      const proof = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.payment_proofs
           (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
         VALUES ($1, NULL, '가온예식홀', 3000000, now())
         RETURNING id`,
        [reporter.rows[0]!.id]
      );
      const operator = await operatorHeaders();

      const list = await get('/v1/admin/payment-proofs', operator.headers);
      expect(list.json<{ proofs: { id: string }[] }>().proofs.map((p) => p.id)).toEqual([
        proof.rows[0]!.id,
      ]);

      expect(
        (await get(`/v1/admin/payment-proofs/${proof.rows[0]!.id}`, operator.headers)).statusCode
      ).toBe(200);

      const link = await post(`/v1/admin/payment-proofs/${proof.rows[0]!.id}/link`, operator.headers, {
        vendorId: vendor.rows[0]!.id,
      });
      expect(link.statusCode).toBe(204);
    });
  });

  describe('보상 지급', () => {
    it('지급 대기 목록을 보고 지급으로 정한다', async () => {
      const pair = await test.pool.query<{ id: string }>(
        `WITH inviter AS (
           INSERT INTO structured.users DEFAULT VALUES RETURNING id
         ), invited AS (
           INSERT INTO structured.users DEFAULT VALUES RETURNING id
         )
         INSERT INTO structured.referrals (inviter_user_id, invited_user_id)
         SELECT inviter.id, invited.id FROM inviter, invited
         RETURNING id`
      );
      const grant = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.reward_grants (user_id, kind, amount_krw, status, reason_code, referral_id)
         SELECT r.inviter_user_id, 'referral', 3000, 'earned', 'referral_completed', r.id
         FROM structured.referrals r WHERE r.id = $1
         RETURNING id`,
        [pair.rows[0]!.id]
      );
      const operator = await operatorHeaders();

      const list = await get('/v1/admin/rewards?status=earned', operator.headers);
      expect(list.json<{ rewards: { id: string }[] }>().rewards.map((r) => r.id)).toEqual([
        grant.rows[0]!.id,
      ]);

      const pay = await post(`/v1/admin/rewards/${grant.rows[0]!.id}/pay`, operator.headers, {
        note: 'Npay 송금 완료',
      });
      expect(pay.statusCode).toBe(204);
    });
  });

  describe('회원탈퇴 운영자 개입', () => {
    it('보류를 걸고 해제한다', async () => {
      const account = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.users (deleted_at) VALUES (now()) RETURNING id'
      );
      const operator = await operatorHeaders();

      const list = await get('/v1/admin/withdrawals', operator.headers);
      expect(list.json<{ accounts: { userId: string }[] }>().accounts.map((a) => a.userId)).toEqual([
        account.rows[0]!.id,
      ]);

      const until = new Date(Date.now() + 86_400_000).toISOString();
      const hold = await post(`/v1/admin/withdrawals/${account.rows[0]!.id}/hold`, operator.headers, {
        reason: '사고 의심으로 확인 중',
        until,
      });
      expect(hold.statusCode).toBe(204);

      const resume = await post(`/v1/admin/withdrawals/${account.rows[0]!.id}/resume`, operator.headers, {
        reason: '확인 완료, 사고 아님',
      });
      expect(resume.statusCode).toBe(204);
    });

    it('실패 기록이 없는 계정은 재시도할 수 없다', async () => {
      const account = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.users (deleted_at) VALUES (now()) RETURNING id'
      );
      const operator = await operatorHeaders();

      const retry = await post(`/v1/admin/withdrawals/${account.rows[0]!.id}/retry`, operator.headers);
      expect(retry.statusCode).toBe(400);
    });
  });

  describe('보관 점검', () => {
    it('때가 된 원본을 보고 지운다', async () => {
      const user = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );
      const document = await test.pool.query<{ id: string }>(
        `INSERT INTO originals.raw_documents (owner_user_id, page_count, uploaded_at)
         VALUES ($1, 1, now() - interval '40 days') RETURNING id`,
        [user.rows[0]!.id]
      );

      const storage = test.context.storage as LocalStorage;
      const storageKey = `${document.rows[0]!.id}/a.jpg`;
      storage.put(storageKey, Buffer.from('원본'));

      await test.pool.query(
        `INSERT INTO originals.raw_document_pages (raw_document_id, page_index, storage_key, mime_type)
         VALUES ($1, 0, $2, 'image/jpeg')`,
        [document.rows[0]!.id, storageKey]
      );

      const operator = await operatorHeaders();

      const due = await get('/v1/admin/retention/due', operator.headers);
      expect(due.json<{ documents: { id: string }[] }>().documents.map((d) => d.id)).toEqual([
        document.rows[0]!.id,
      ]);

      const remove = await post(`/v1/admin/retention/${document.rows[0]!.id}/delete`, operator.headers);
      expect(remove.statusCode).toBe(200);
      expect(remove.json()).toEqual({ keysDeleted: 1 });
    });
  });

  describe('광고 지면', () => {
    it('자리를 잡고, 목록에서 보고, 내린다', async () => {
      const vendor = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('가온예식홀', 'hall', '서울', 'public_data') RETURNING id`
      );
      const operator = await operatorHeaders();

      const from = new Date().toISOString().slice(0, 10);
      const to = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

      const added = await post('/v1/admin/ad-placements', operator.headers, {
        vendorId: vendor.rows[0]!.id,
        surface: 'search',
        tier: 'standard',
        from,
        to,
      });
      expect(added.statusCode).toBe(201);
      const placementId = added.json<{ placementId: string }>().placementId;

      const list = await get('/v1/admin/ad-placements', operator.headers);
      expect(list.json<{ placements: { id: string }[] }>().placements.map((p) => p.id)).toEqual([
        placementId,
      ]);

      const firewall = await get('/v1/admin/ad-placements/firewall', operator.headers);
      expect(firewall.statusCode).toBe(200);

      const removed = await del(`/v1/admin/ad-placements/${placementId}`, operator.headers);
      expect(removed.statusCode).toBe(204);
    });
  });

  describe('AI 사용량과 예산', () => {
    it('한도를 정하고 없앤다', async () => {
      const operator = await operatorHeaders();

      const status = await get('/v1/admin/ai-budget/status', operator.headers);
      expect(status.statusCode).toBe(200);

      const usage = await get('/v1/admin/ai-budget/usage', operator.headers);
      expect(usage.statusCode).toBe(200);

      const set = await post('/v1/admin/ai-budget/document_extraction', operator.headers, {
        amount: 50,
      });
      expect(set.statusCode).toBe(204);

      const clear = await del('/v1/admin/ai-budget/document_extraction', operator.headers);
      expect(clear.statusCode).toBe(204);

      const badFeature = await post('/v1/admin/ai-budget/not_a_feature', operator.headers, {
        amount: 10,
      });
      expect(badFeature.statusCode).toBe(400);
    });
  });
  /*
   * 요약 대시보드(WP-ADM-001). 이 화면의 고장은 「틀린 숫자」가 아니라 **언제나
   * 같은 숫자**였다 — 예전 응답은 `reviewQueue.total`에 0을, 수익에 `₩0`을 박아
   * 두어서 큐가 쌓인 날에도 홈은 빈 화면이었다. 그래서 여기서 보는 것은 응답
   * 모양만이 아니라 **실제로 한 건 넣었을 때 그 줄이 오르는가**이다.
   */
  describe('요약 대시보드', () => {
    type Dashboard = {
      humanTotal: number;
      humanQueue: { key: string; label: string; why: string; count: number; tone: string }[];
      dashCards: { key: string; label: string; mode: string; value: string; unit: string; note: string }[];
      auto: {
        ratePct: number | null;
        segments: { key: string; label: string; count: number }[];
        keepRatePct: number | null;
        revertedCount: number;
        medianLatencyMs: number | null;
        byWorkflow: { workflow: string; concluded: number; failed: number; human: number; reverted: number; autoPct: number }[];
      };
      autoLog: { decision: string; subject: string; reasonCode: string; confidence: number | null; tone: string }[];
    };

    it('볼 일이 없으면 전부 0이고, 카드는 그대로 나온다', async () => {
      const operator = await operatorHeaders();

      const res = await get('/v1/admin/dashboard', operator.headers);
      expect(res.statusCode).toBe(200);

      const body = res.json<Dashboard>();
      expect(body.humanTotal).toBe(0);
      expect(body.humanQueue.map((q) => q.key)).toEqual([
        'queue',
        'rebuttal',
        'objections',
        'pii-reviews',
        'biz-queue',
      ]);
      /* 빈 큐가 정상 상태다 — 줄 자체를 지우지 않는다. 화면이 「확인할 것이 없어요」를 그린다. */
      expect(body.humanQueue.every((q) => q.count === 0)).toBe(true);
      expect(body.humanQueue.every((q) => q.why.length > 0)).toBe(true);

      /* 카드는 6장 · 3열 두 줄. 순서가 곧 설계다 — 위험 → 비용 → 지표 → 자동. */
      expect(body.dashCards.map((c) => c.mode)).toEqual(['위험', '비용', '비용', '지표', '지표', '자동']);
      expect(body.dashCards.every((c) => c.value.length > 0)).toBe(true);

      /*
       * 판정이 하나도 없으면 자동 처리율은 **null이지 0%가 아니다.** 0%는 「자동이
       * 하나도 못 끝냈다」는 뜻이고, 그건 들어온 게 없는 것과 완전히 다른 상태다.
       */
      expect(body.auto.ratePct).toBeNull();
      expect(body.auto.segments.map((seg) => seg.count)).toEqual([0, 0, 0]);
      expect(body.auto.byWorkflow).toEqual([]);
      expect(body.autoLog).toEqual([]);
    });

    it('자동 판정이 쌓이면 처리율 · 유지율 · 로그가 실제 기록에서 나온다', async () => {
      const event = randomUUID();
      const base = {
        eventId: event,
        workflow: 'payment_proof',
        step: 'verify',
        subjectKind: 'payment_proof',
        subjectId: null,
        evidence: [],
        latencyMs: 4200,
      } as const;

      /* 자동으로 끝난 둘 — 그중 하나는 사람이 되돌렸다. */
      await recordDecision(test.pool, {
        ...base,
        decider: { kind: 'model', model: 'test-model', confidence: 0.97 },
        decision: '승인',
        reasonCode: 'amount_within_band',
      });
      await recordDecision(test.pool, {
        ...base,
        decider: { kind: 'model', model: 'test-model', confidence: 0.94 },
        decision: '반려',
        reasonCode: 'evidence_missing',
        execution: 'rolled_back',
      });
      /* 사람이 결정한 하나 — 자동 처리율의 분모에는 들어가고 분자에는 들어가지 않는다. */
      const operator = await operatorHeaders();
      await recordDecision(test.pool, {
        ...base,
        decider: { kind: 'human', userId: operator.userId },
        decision: '보류',
        reasonCode: 'needs_human_review',
      });

      const body = (await get('/v1/admin/dashboard', operator.headers)).json<Dashboard>();

      /* 셋 중 둘이 자동으로 끝났다. 세 칸을 더하면 전체가 되어야 한다. */
      expect(body.auto.segments.map((seg) => seg.count)).toEqual([2, 0, 1]);
      expect(body.auto.ratePct).toBe(67);
      /* 자동 결론 둘 중 하나를 되돌렸다. */
      expect(body.auto.revertedCount).toBe(1);
      expect(body.auto.keepRatePct).toBe(50);
      expect(body.auto.medianLatencyMs).toBe(4200);

      expect(body.auto.byWorkflow).toEqual([
        { workflow: 'payment_proof', concluded: 2, failed: 0, human: 1, reverted: 1, autoPct: 67 },
      ]);

      /* 로그는 최신이 위. 판정 · 근거 · 확신을 함께 낸다. */
      expect(body.autoLog).toHaveLength(3);
      expect(body.autoLog[0]).toMatchObject({ decision: '보류', reasonCode: 'needs_human_review', tone: 'human' });
      expect(body.autoLog.find((r) => r.decision === '승인')).toMatchObject({
        subject: 'payment_proof',
        confidence: 0.97,
        tone: 'ok',
      });

      /* 카드의 자동 판정도 같은 값을 본다 — 한 화면에서 두 번 다르게 세지 않는다. */
      expect(body.dashCards.find((c) => c.key === 'decisions')).toMatchObject({
        value: '67%',
        unit: '자동 처리율',
        note: '최근 24시간 3건 · 되돌림 1건',
      });
    });

    it('업체 관계자 인증이 한 건 들어오면 그 줄과 합계가 함께 오른다', async () => {
      const vendor = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source, official_domain)
         VALUES ('가온예식홀', 'hall', '서울', 'public_data', 'gaon.co.kr') RETURNING id`
      );
      const claimant = await signInAs(test, 'dashboard-claim-staff');
      await test.app.inject({
        method: 'POST',
        url: '/v1/vendor-claims',
        headers: claimant.headers,
        payload: {
          vendorId: vendor.rows[0]!.id,
          claimedRole: '예약팀장',
          evidence: { method: 'official_domain_email', email: 'staff@gaon.co.kr' },
        },
      });

      const operator = await operatorHeaders();
      const body = (await get('/v1/admin/dashboard', operator.headers)).json<Dashboard>();

      const claims = body.humanQueue.find((q) => q.key === 'biz-queue');
      expect(claims?.count).toBe(1);
      /* 되돌릴 수 없는 결정이라 급한 쪽으로 센다 — 화면의 상단 배너가 이 값으로 빨강이 된다. */
      expect(claims?.tone).toBe('danger');
      expect(body.humanTotal).toBe(1);
    });

    it('회원 카드는 실제 계정 수를 센다', async () => {
      await signInAs(test, 'dashboard-member-a');
      await signInAs(test, 'dashboard-member-b');
      const operator = await operatorHeaders();

      const body = (await get('/v1/admin/dashboard', operator.headers)).json<Dashboard>();
      const members = body.dashCards.find((c) => c.key === 'users');

      /* 운영자 계정도 계정이다 — 위에서 만든 둘 + 운영자 하나. */
      expect(members?.value).toBe('3');
      expect(members?.unit).toBe('명');
    });
  });
});
