import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 관리자 콘솔 «데이터 · 업체» 계열의 조작.
 *
 * 이 화면들의 단추는 부르는 라우트가 서버에 없거나(제보 재처리 · 업체 병합),
 * 있어도 화면과 메서드·응답 모양이 어긋나서(이미지 승인 · 업체 목록) 눌러도 아무
 * 일이 일어나지 않았다. 그래서 여기서 보는 것은 「함수가 맞게 도는가」가 아니라
 * **화면이 부르는 그대로 불렀을 때 실제로 DB가 바뀌는가**다.
 */
describeWithDb('관리자 — 데이터 · 업체 조작', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function operator(subject = `operator-${Math.random()}`) {
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

  async function makeVendor(name: string, category = 'studio') {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.vendors (name, category, region, source)
       VALUES ($1, $2::vendor_category, '서울', 'public_data') RETURNING id`,
      [name, category]
    );
    return rows[0]!.id;
  }

  async function makeUser() {
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
    );
    return rows[0]!.id;
  }

  async function makeWedding(ownerId: string) {
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
      [ownerId]
    );
    return rows[0]!.id;
  }

  // ── 업체 목록 ────────────────────────────────────────────────

  describe('업체 목록', () => {
    it('화면이 읽는 모양으로 나온다', async () => {
      const op = await operator();
      await makeVendor('강남 A 스튜디오');

      const body = (await get('/v1/admin/vendors', op.headers)).json() as {
        vendors: { name: string; status: string; dataCount: number; history: unknown[] }[];
        total: number;
      };

      // 예전에는 `{items, hasMore, nextCursor}`였다. 화면은 `vendors`를 읽으므로
      // 표가 언제나 비어 있었다 — 이 단언이 그 회귀를 잡는다.
      expect(body.total).toBe(1);
      expect(body.vendors[0]).toMatchObject({
        name: '강남 A 스튜디오',
        status: 'active',
        dataCount: 0,
      });
      expect(body.vendors[0]!.history).toEqual([]);
    });
  });

  // ── 상호 · 영업 상태 ─────────────────────────────────────────

  describe('상호 변경', () => {
    it('상호가 바뀌고 이력이 남는다', async () => {
      const op = await operator();
      const id = await makeVendor('옛 이름');

      const res = await patch(`/v1/admin/vendors/${id}/name`, op.headers, { name: '새 이름' });
      expect(res.statusCode).toBe(200);

      const { rows } = await test.pool.query<{ name: string }>(
        'SELECT name FROM structured.vendors WHERE id = $1',
        [id]
      );
      expect(rows[0]!.name).toBe('새 이름');

      const log = await test.pool.query<{ old_value: string; new_value: string; cause: string }>(
        `SELECT old_value, new_value, cause::text AS cause
           FROM structured.vendor_change_log WHERE vendor_id = $1`,
        [id]
      );
      expect(log.rows[0]).toMatchObject({
        old_value: '옛 이름',
        new_value: '새 이름',
        cause: 'admin',
      });
    });

    it('빈 상호는 거절한다', async () => {
      const op = await operator();
      const id = await makeVendor('그대로');
      const res = await patch(`/v1/admin/vendors/${id}/name`, op.headers, { name: '   ' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('영업 상태', () => {
    it('정지로 바꾸면 노출에서 빠지고 이유가 남는다', async () => {
      const op = await operator();
      const id = await makeVendor('정지될 업체');

      expect(
        (await patch(`/v1/admin/vendors/${id}/status`, op.headers, { status: 'suspended' }))
          .statusCode
      ).toBe(200);

      const { rows } = await test.pool.query<{
        is_active: boolean;
        suspended_at: Date | null;
        closed_at: Date | null;
      }>('SELECT is_active, suspended_at, closed_at FROM structured.vendors WHERE id = $1', [id]);

      // 정지는 폐업과 다르다. is_active로 노출에서 빠지되 closed_at은 비어 있어야
      // 「폐업한 업체」로 읽히지 않는다.
      expect(rows[0]!.is_active).toBe(false);
      expect(rows[0]!.suspended_at).not.toBeNull();
      expect(rows[0]!.closed_at).toBeNull();
    });

    it('영업중으로 되돌리면 정지 표시가 지워진다', async () => {
      const op = await operator();
      const id = await makeVendor('되살아날 업체');

      await patch(`/v1/admin/vendors/${id}/status`, op.headers, { status: 'suspended' });
      await patch(`/v1/admin/vendors/${id}/status`, op.headers, { status: 'active' });

      const { rows } = await test.pool.query<{ is_active: boolean; suspended_at: Date | null }>(
        'SELECT is_active, suspended_at FROM structured.vendors WHERE id = $1',
        [id]
      );
      expect(rows[0]!.is_active).toBe(true);
      expect(rows[0]!.suspended_at).toBeNull();
    });

    it('「병합됨」은 골라서 만들 수 없다', async () => {
      const op = await operator();
      const id = await makeVendor('업체');
      const res = await patch(`/v1/admin/vendors/${id}/status`, op.headers, { status: 'merged' });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── 병합 ─────────────────────────────────────────────────────

  describe('업체 병합', () => {
    /** 제보 · 후기 · Pick · 이미지가 한 건씩 달린 업체를 만든다. */
    async function vendorWithEverything(name: string) {
      const vendorId = await makeVendor(name);
      const userId = await makeUser();
      const weddingId = await makeWedding(userId);

      await test.pool.query(
        `INSERT INTO structured.price_reports
           (vendor_id, reporter_user_id, product_name, total_amount, contracted_on)
         VALUES ($1, $2, '기본 상품', 1500000, '2026-01-01')`,
        [vendorId, userId]
      );
      await test.pool.query(
        `INSERT INTO structured.payment_proofs
           (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
         VALUES ($1, $2, '가맹점', 1500000, now())`,
        [userId, vendorId]
      );
      await test.pool.query(
        `INSERT INTO structured.reviews
           (vendor_id, author_user_id, role, overall, title, body)
         VALUES ($1, $2, 'couple', 5, '좋았어요', $3)`,
        [vendorId, userId, '후기 본문을 쉰 자 이상 적어야 통과하므로 길게 적는다. '.repeat(2)]
      );
      await test.pool.query(
        `INSERT INTO structured.vendor_candidates (wedding_id, vendor_id) VALUES ($1, $2)`,
        [weddingId, vendorId]
      );
      await test.pool.query(
        `INSERT INTO structured.vendor_images
           (vendor_id, storage_key, copyright_basis, status)
         VALUES ($1, $2, 'vendor_provided', 'approved')`,
        [vendorId, `img-${vendorId}`]
      );

      return { vendorId, userId, weddingId };
    }

    it('미리보기가 무엇이 몇 건 옮겨 가는지 세어 준다 — 아무것도 바꾸지 않고', async () => {
      const op = await operator();
      const source = await vendorWithEverything('합쳐질 업체');
      const targetId = await makeVendor('남을 업체');

      const body = (
        await get(
          `/v1/admin/vendors/${source.vendorId}/merge-preview?targetId=${targetId}`,
          op.headers
        )
      ).json() as {
        counts: { label: string; moves: number }[];
        categoryDiffers: boolean;
      };

      const byLabel = Object.fromEntries(body.counts.map((c) => [c.label, c.moves]));
      expect(byLabel).toMatchObject({ 제보: 2, 후기: 1, Pick: 1, 이미지: 1 });
      expect(body.categoryDiffers).toBe(false);

      // 미리보기는 세기만 한다. 세는 것이 옮기기 시작하면 「확인하고 누른다」가
      // 성립하지 않는다.
      const still = await test.pool.query(
        'SELECT 1 FROM structured.reviews WHERE vendor_id = $1',
        [source.vendorId]
      );
      expect(still.rowCount).toBe(1);
    });

    it('병합하면 달린 것이 전부 옮겨 가고 상태가 바뀐다', async () => {
      const op = await operator();
      const source = await vendorWithEverything('합쳐질 업체');
      const targetId = await makeVendor('남을 업체');

      const res = await post(`/v1/admin/vendors/${source.vendorId}/merge`, op.headers, {
        targetId,
        reason: '같은 업체가 두 번 등록됐다',
      });
      expect(res.statusCode).toBe(200);

      for (const table of [
        'structured.price_reports',
        'structured.payment_proofs',
        'structured.reviews',
        'structured.vendor_candidates',
        'structured.vendor_images',
      ]) {
        const moved = await test.pool.query(`SELECT 1 FROM ${table} WHERE vendor_id = $1`, [
          targetId,
        ]);
        expect({ table, n: moved.rowCount }).toEqual({ table, n: 1 });

        const left = await test.pool.query(`SELECT 1 FROM ${table} WHERE vendor_id = $1`, [
          source.vendorId,
        ]);
        expect({ table, n: left.rowCount }).toEqual({ table, n: 0 });
      }

      const { rows } = await test.pool.query<{
        is_active: boolean;
        merged_into_vendor_id: string;
      }>(
        'SELECT is_active, merged_into_vendor_id FROM structured.vendors WHERE id = $1',
        [source.vendorId]
      );
      expect(rows[0]).toMatchObject({ is_active: false, merged_into_vendor_id: targetId });
    });

    /*
     * 예식이 이 업체로 «결정»까지 해둔 경우. category_decisions가
     * vendor_candidates (wedding_id, vendor_id)를 FK로 가리키는데 그 FK에는
     * ON UPDATE가 없어서, 후보의 vendor_id를 그냥 UPDATE하면 즉시 FK 위반으로
     * 터진다. 병합이 통째로 되돌아가고 운영자에게는 500만 보인다.
     */
    it('결정까지 해둔 예식이 있어도 병합된다', async () => {
      const op = await operator();
      const source = await vendorWithEverything('결정된 업체');
      const targetId = await makeVendor('남을 업체');

      await test.pool.query(
        `INSERT INTO structured.category_decisions (wedding_id, category, vendor_id)
         VALUES ($1, 'studio', $2)`,
        [source.weddingId, source.vendorId]
      );

      const res = await post(`/v1/admin/vendors/${source.vendorId}/merge`, op.headers, {
        targetId,
        reason: '중복 등록',
      });
      expect(res.statusCode).toBe(200);

      const { rows } = await test.pool.query<{ vendor_id: string }>(
        'SELECT vendor_id FROM structured.category_decisions WHERE wedding_id = $1',
        [source.weddingId]
      );
      // 결정이 사라지지 않고 대상 업체를 가리켜야 한다. 사라지면 그 커플의
      // 「우리는 여기로 정했다」가 소리 없이 없어진다.
      expect(rows[0]!.vendor_id).toBe(targetId);
    });

    it('같은 사람이 양쪽에 남긴 후기는 지우지 않고 남긴다', async () => {
      const op = await operator();
      const source = await vendorWithEverything('합쳐질 업체');
      const targetId = await makeVendor('남을 업체');

      // 같은 사람이 대상 업체에도 후기를 남겨 뒀다. reviews의
      // UNIQUE (vendor_id, author_user_id) 때문에 옮길 자리가 없다.
      await test.pool.query(
        `INSERT INTO structured.reviews (vendor_id, author_user_id, role, overall, title, body)
         VALUES ($1, $2, 'couple', 4, '여기도 좋았어요', $3)`,
        [targetId, source.userId, '두 번째 후기 본문도 쉰 자를 넘겨야 한다. '.repeat(3)]
      );

      const res = await post(`/v1/admin/vendors/${source.vendorId}/merge`, op.headers, {
        targetId,
        reason: '중복 등록',
      });
      expect(res.statusCode).toBe(200);

      // 옮기지 못한 후기는 원래 업체에 그대로 남는다. 지우면 사용자가 쓴 것이
      // 병합 때문에 사라진다.
      const left = await test.pool.query(
        'SELECT 1 FROM structured.reviews WHERE vendor_id = $1',
        [source.vendorId]
      );
      expect(left.rowCount).toBe(1);
    });

    it('사유 없이는 병합하지 않는다', async () => {
      const op = await operator();
      const sourceId = await makeVendor('A');
      const targetId = await makeVendor('B');

      const res = await post(`/v1/admin/vendors/${sourceId}/merge`, op.headers, {
        targetId,
        reason: '   ',
      });
      expect(res.statusCode).toBe(400);

      const { rows } = await test.pool.query<{ merged_into_vendor_id: string | null }>(
        'SELECT merged_into_vendor_id FROM structured.vendors WHERE id = $1',
        [sourceId]
      );
      expect(rows[0]!.merged_into_vendor_id).toBeNull();
    });

    it('옮긴 건수와 사유가 양쪽 이력에 남는다', async () => {
      const op = await operator();
      const source = await vendorWithEverything('합쳐질 업체');
      const targetId = await makeVendor('남을 업체');

      await post(`/v1/admin/vendors/${source.vendorId}/merge`, op.headers, {
        targetId,
        reason: '같은 업체가 두 번 등록됐다',
      });

      const { rows } = await test.pool.query<{ vendor_id: string; note: string }>(
        `SELECT vendor_id, note FROM structured.vendor_change_log
          WHERE field_name = 'merged_into_vendor_id'`
      );
      expect(rows).toHaveLength(2);

      const sourceNote = rows.find((r) => r.vendor_id === source.vendorId)!.note;
      expect(sourceNote).toContain('같은 업체가 두 번 등록됐다');
      // 옮기고 나면 원래 어디에 있었는지는 어디에도 안 남는다. 건수가 유일한 근거다.
      expect(sourceNote).toContain('제보 2건');

      expect(rows.find((r) => r.vendor_id === targetId)!.note).toContain('받음');
    });

    it('자기 자신·이미 병합된 업체로는 합칠 수 없다', async () => {
      const op = await operator();
      const a = await makeVendor('A');
      const b = await makeVendor('B');
      const c = await makeVendor('C');

      expect(
        (await post(`/v1/admin/vendors/${a}/merge`, op.headers, { targetId: a, reason: 'x' }))
          .statusCode
      ).toBe(400);

      await post(`/v1/admin/vendors/${a}/merge`, op.headers, { targetId: b, reason: '중복' });

      // A는 이미 병합됐다.
      expect(
        (await post(`/v1/admin/vendors/${a}/merge`, op.headers, { targetId: c, reason: '중복' }))
          .statusCode
      ).toBe(409);

      // A → B → C 사슬을 만들지 않는다.
      expect(
        (await post(`/v1/admin/vendors/${c}/merge`, op.headers, { targetId: a, reason: '중복' }))
          .statusCode
      ).toBe(409);
    });
  });

  // ── 제보 처리 재처리 ─────────────────────────────────────────

  describe('제보 처리 현황', () => {
    async function failedAnalysis(reason = 'internal') {
      const userId = await makeUser();
      const weddingId = await makeWedding(userId);
      const doc = await test.pool.query<{ id: string }>(
        `INSERT INTO originals.raw_documents (owner_user_id, page_count)
         VALUES ($1, 1) RETURNING id`,
        [userId]
      );
      const { rows } = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.analyses
           (raw_document_id, wedding_id, status, failure_reason, finished_at)
         VALUES ($1, $2, 'failed', $3::analysis_failure, now()) RETURNING id`,
        [doc.rows[0]!.id, weddingId, reason]
      );
      return rows[0]!.id;
    }

    it('실패 큐와 오늘 현황이 나온다', async () => {
      const op = await operator();
      await failedAnalysis('unreadable');

      const body = (await get('/v1/admin/data/pipeline', op.headers)).json() as {
        today: { received: number; manualRequired: number; failed: number };
        stages: { stage: string; count: number }[];
        failedQueue: { id: string; error: string; retryCount: number }[];
      };

      expect(body.today.received).toBe(1);
      // 읽을 수 없는 문서는 다시 돌린다고 달라지지 않는다 — 사람이 봐야 한다.
      expect(body.today.manualRequired).toBe(1);
      expect(body.today.failed).toBe(0);
      expect(body.failedQueue[0]).toMatchObject({ error: '읽을 수 없는 문서', retryCount: 0 });
      // 빈 단계도 0으로 그린다 — v3.27 「빈 상태가 정상 상태」.
      expect(body.stages.map((s) => s.stage)).toEqual(['대기', '분석 중', '실패']);
    });

    it('재처리하면 워커가 다시 집어갈 수 있는 상태가 된다', async () => {
      const op = await operator();
      const id = await failedAnalysis();

      expect((await post(`/v1/admin/data/pipeline/retry/${id}`, op.headers)).statusCode).toBe(204);

      const { rows } = await test.pool.query<{
        status: string;
        failure_reason: string | null;
        finished_at: Date | null;
        retry_count: number;
      }>(
        `SELECT status::text AS status, failure_reason::text AS failure_reason,
                finished_at, retry_count
           FROM structured.analyses WHERE id = $1`,
        [id]
      );

      // 워커의 claim()은 pending만 집는다. 셋을 같이 지우지 않으면 0002의 CHECK에
      // 걸려 트랜잭션이 통째로 되돌아간다.
      expect(rows[0]).toMatchObject({
        status: 'pending',
        failure_reason: null,
        finished_at: null,
        retry_count: 1,
      });
    });

    it('실패한 건만 다시 돌린다', async () => {
      const op = await operator();
      const id = await failedAnalysis();
      await post(`/v1/admin/data/pipeline/retry/${id}`, op.headers);

      // 이제 pending이다. 도는 중인 것을 또 밀면 워커 둘이 같은 문서를 잡는다.
      const again = await post(`/v1/admin/data/pipeline/retry/${id}`, op.headers);
      expect(again.statusCode).toBe(409);
    });

    it('전체 재처리는 계속 실패하는 건을 건너뛴다', async () => {
      const op = await operator();
      const id = await failedAnalysis('not_a_document');
      await test.pool.query('UPDATE structured.analyses SET retry_count = 3 WHERE id = $1', [id]);

      const body = (await post('/v1/admin/data/pipeline/retry-all', op.headers)).json() as {
        retried: number;
        skipped: number;
      };

      // 읽을 수 없는 문서 하나가 전체 재처리를 누를 때마다 모델을 부르며 영원히
      // 도는 것을 막는다. 건너뛴 건수를 돌려주므로 화면이 그 사실을 감추지 않는다.
      expect(body).toEqual({ retried: 0, skipped: 1 });
    });
  });

  // ── 이미지 ───────────────────────────────────────────────────

  describe('이미지 자동 수급', () => {
    it('화면이 부르는 POST로 승인된다', async () => {
      const op = await operator();
      const vendorId = await makeVendor('이미지 업체');
      const { rows } = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendor_images (vendor_id, storage_key, copyright_basis, status)
         VALUES ($1, 'k-1', 'unknown', 'pending') RETURNING id`,
        [vendorId]
      );

      // 서버는 PATCH로만 열려 있었다. 화면은 POST로 부르므로 404가 나던 자리다.
      const res = await post(`/v1/admin/data/images/${rows[0]!.id}/approve`, op.headers);
      expect(res.statusCode).toBe(204);

      const after = await test.pool.query<{ status: string }>(
        'SELECT status::text AS status FROM structured.vendor_images WHERE id = $1',
        [rows[0]!.id]
      );
      expect(after.rows[0]!.status).toBe('approved');
    });

    it('화면이 읽는 모양으로 목록이 나온다', async () => {
      const op = await operator();
      const vendorId = await makeVendor('이미지 업체');
      await test.pool.query(
        `INSERT INTO structured.vendor_images
           (vendor_id, storage_key, copyright_basis, status, rejection_reason)
         VALUES ($1, 'k-a', 'vendor_provided', 'approved', NULL),
                ($1, 'k-b', 'unknown', 'pending', NULL),
                ($1, 'k-c', 'vendor_provided', 'rights_rejected', '권리 미확인')`,
        [vendorId]
      );

      const body = (await get('/v1/admin/data/images', op.headers)).json() as {
        summary: { total: number; licensed: number; pending: number; rejected: number };
        items: { rightsStatus: string; vendorName: string }[];
      };

      // 예전에는 summary가 아예 없어서 `data.summary.total`에서 화면이 죽었다.
      expect(body.summary).toEqual({ total: 3, licensed: 1, pending: 1, rejected: 1 });
      // 폐기된 것은 권리가 확인됐어도 「폐기됨」이다 — 화면이 보는 것은
      // 「내보낼 수 있나」 하나다.
      expect(body.items.map((i) => i.rightsStatus).sort()).toEqual([
        'pending',
        'rejected',
        'vendor_provided',
      ]);
      expect(body.items[0]!.vendorName).toBe('이미지 업체');
    });

    it('폐기하면 이유가 함께 남는다', async () => {
      const op = await operator();
      const vendorId = await makeVendor('이미지 업체');
      const { rows } = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendor_images (vendor_id, storage_key, copyright_basis, status)
         VALUES ($1, 'k-x', 'unknown', 'pending') RETURNING id`,
        [vendorId]
      );

      // 0050 image_rejection_has_reason이 이유 없는 거부를 막는다. 예전 라우트는
      // 이유를 안 적어서 폐기를 누를 때마다 CHECK에 걸려 500이 났다.
      const res = await post(`/v1/admin/data/images/${rows[0]!.id}/reject`, op.headers);
      expect(res.statusCode).toBe(204);

      const after = await test.pool.query<{ status: string; rejection_reason: string | null }>(
        `SELECT status::text AS status, rejection_reason
           FROM structured.vendor_images WHERE id = $1`,
        [rows[0]!.id]
      );
      expect(after.rows[0]!.status).toBe('rights_rejected');
      expect(after.rows[0]!.rejection_reason).not.toBeNull();
    });

    it('없는 이미지를 승인하면 조용히 넘어가지 않는다', async () => {
      const op = await operator();
      const res = await post(
        '/v1/admin/data/images/00000000-0000-4000-8000-000000000000/approve',
        op.headers
      );
      // 예전에는 0건을 고치고도 204였다. 운영자에게는 「승인됐다」로 보였다.
      expect(res.statusCode).toBe(404);
    });
  });

  // ── 권한 ─────────────────────────────────────────────────────

  it('운영자가 아니면 어느 것도 부를 수 없다', async () => {
    const outsider = await signInAs(test, `outsider-${Math.random()}`);
    const vendorId = await makeVendor('업체');

    for (const res of [
      await get('/v1/admin/vendors', outsider.headers),
      await patch(`/v1/admin/vendors/${vendorId}/name`, outsider.headers, { name: 'x' }),
      await post(`/v1/admin/vendors/${vendorId}/merge`, outsider.headers, {
        targetId: vendorId,
        reason: 'x',
      }),
      await post('/v1/admin/data/pipeline/retry-all', outsider.headers),
    ]) {
      expect(res.statusCode).toBe(403);
    }
  });
});
