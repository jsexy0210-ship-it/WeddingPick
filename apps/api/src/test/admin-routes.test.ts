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
});
