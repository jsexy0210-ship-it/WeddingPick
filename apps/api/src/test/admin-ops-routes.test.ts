import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';
import { DISCLOSURE_THRESHOLDS } from '@weddingpick/domain';
import { publishTerms } from '../admin-ops';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 관리자 콘솔 «운영 · 시스템» 계열 라우트.
 *
 * 여기서 보는 것은 둘이다.
 *
 *   1. **화면이 부르는 대로 서버가 받는가.** 주소 · 메서드 · 본문 · 응답 모양을
 *      `apps/mobile/src/app/admin/`의 `apiFetch(` 자리와 맞춰 본다. 화면이 PATCH를
 *      보내는데 서버가 POST만 받으면 단추는 잠긴 것과 같다.
 *   2. **가드가 실제로 잡는가.** 롤백은 승인 없이 실행될 수 없고, 공개된 약관은
 *      고쳐지지 않으며, 광고 실운영 승인은 «켜짐»을 만들지 않는다.
 *
 * 2번은 라우트와 스키마 두 겹으로 막혀 있다. **두 겹을 각각 확인한다** — 라우트만
 * 보면 나중에 그 한 줄이 지워졌을 때 아무도 모른다.
 */
describeWithDb('관리자 운영·시스템 라우트', () => {
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

  const get = (url: string, headers: Record<string, string>) =>
    test.app.inject({ method: 'GET', url, headers });
  const post = (url: string, headers: Record<string, string>, payload?: Record<string, unknown>) =>
    test.app.inject({ method: 'POST', url, headers, payload });
  const patch = (url: string, headers: Record<string, string>, payload?: Record<string, unknown>) =>
    test.app.inject({ method: 'PATCH', url, headers, payload });
  const put = (url: string, headers: Record<string, string>, payload?: Record<string, unknown>) =>
    test.app.inject({ method: 'PUT', url, headers, payload });

  /** 실패한 결정 한 줄. DLQ와 복구가 셀 대상이다. */
  async function failedDecision(workflow: string): Promise<string> {
    const { rows } = await test.pool.query<{ id: string }>(
      `INSERT INTO structured.decisions
         (event_id, workflow, step, subject_kind, decider, rule_version,
          decision, reason_code, policy_version, execution_status)
       VALUES (gen_random_uuid(), $1, 'run', 'test_subject', 'rule', 'v1',
               'failed', 'boom', 'v1', 'failed')
       RETURNING id`,
      [workflow]
    );
    return rows[0]!.id;
  }

  // ── 자동화 상태 ─────────────────────────────────────────────

  describe('자동화 상태', () => {
    it('화면이 읽는 모양으로 준다 — overall과 workflows', async () => {
      const operator = await operatorHeaders();

      const body = (await get('/v1/admin/automation', operator.headers)).json() as {
        overall: { healthyCount: number; degradedCount: number; downCount: number };
        workflows: { id: string; status: string; successRate: number; dlqSize: number }[];
      };

      expect(body.workflows.length).toBeGreaterThan(0);
      expect(body.overall.healthyCount).toBe(body.workflows.length);
      // 한 번도 돌지 않은 워크플로를 0%로 읽지 않는다. 그러면 전부 «중단»이 된다.
      expect(body.workflows.every((w) => w.successRate === 1)).toBe(true);
    });

    it('복구는 실패한 줄을 지우지 않고 대기로 되돌린다', async () => {
      const operator = await operatorHeaders();
      const decisionId = await failedDecision('reward');

      const response = await post('/v1/admin/automation/reward/recover', operator.headers);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ requeued: 1 });

      const { rows } = await test.pool.query<{ execution_status: string }>(
        'SELECT execution_status FROM structured.decisions WHERE id = $1',
        [decisionId]
      );
      // 줄이 남아 있다. 감사 기록을 지우지 않는다.
      expect(rows[0]?.execution_status).toBe('pending');
    });

    it('DLQ 비우기는 지우는 것이 아니라 «확인함»을 적는다', async () => {
      const operator = await operatorHeaders();
      const decisionId = await failedDecision('review_report');

      const response = await post('/v1/admin/automation/review_report/drain-dlq', operator.headers);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ drained: 1 });

      const { rows } = await test.pool.query<{
        execution_status: string;
        dlq_drained_at: Date | null;
      }>('SELECT execution_status, dlq_drained_at FROM structured.decisions WHERE id = $1', [
        decisionId,
      ]);
      expect(rows[0]?.execution_status).toBe('failed');
      expect(rows[0]?.dlq_drained_at).not.toBeNull();

      const body = (await get('/v1/admin/automation', operator.headers)).json() as {
        workflows: { id: string; dlqSize: number }[];
      };
      expect(body.workflows.find((w) => w.id === 'review_report')?.dlqSize).toBe(0);
    });

    it('없는 워크플로는 404다', async () => {
      const operator = await operatorHeaders();
      const response = await post('/v1/admin/automation/no-such-flow/recover', operator.headers);
      expect(response.statusCode).toBe(404);
    });

    it('운영자가 아니면 403이다', async () => {
      const outsider = await signInAs(test, `outsider-${Math.random()}`);
      const response = await post('/v1/admin/automation/reward/recover', outsider.headers);
      expect(response.statusCode).toBe(403);
    });
  });

  // ── 정책 규칙 ───────────────────────────────────────────────

  describe('정책 규칙', () => {
    /*
     * 화면(`policy-engine.tsx`)은 고친 줄을 `draft`에 모아 «변경 사항 저장» 한 번으로
     * 보낸다 — 주소에 id가 없고 본문에 `changes` 배열이 온다.
     */
    it('화면이 보내는 batch PATCH를 받는다', async () => {
      const operator = await operatorHeaders();

      const response = await patch('/v1/admin/policy-engine', operator.headers, {
        changes: [
          { key: 'automation.dlq_alert_size', value: '4' },
          { key: 'automation.success_rate_down', value: '0.7' },
        ],
      });

      expect(response.statusCode).toBe(204);

      const body = (await get('/v1/admin/policy-engine', operator.headers)).json() as {
        policies: { key: string; value: string; defaultValue: string }[];
      };
      expect(body.policies.find((p) => p.key === 'automation.dlq_alert_size')).toMatchObject({
        value: '4',
        defaultValue: '10',
      });
      expect(body.policies.find((p) => p.key === 'automation.success_rate_down')?.value).toBe('0.7');
    });

    /*
     * 한 트랜잭션이다. 중간이 틀리면 앞의 것도 남지 않는다 — 앞의 것만 적용되면
     * 화면이 보여주는 값과 표가 갈라진다.
     */
    it('한 줄이 틀리면 같이 보낸 것도 남지 않는다', async () => {
      const operator = await operatorHeaders();

      const response = await patch('/v1/admin/policy-engine', operator.headers, {
        changes: [
          { key: 'automation.dlq_alert_size', value: '4' },
          { key: 'automation.success_rate_down', value: '80' },
        ],
      });
      expect(response.statusCode).toBe(400);

      const body = (await get('/v1/admin/policy-engine', operator.headers)).json() as {
        policies: { key: string; value: string }[];
      };
      expect(body.policies.find((p) => p.key === 'automation.dlq_alert_size')?.value).toBe('10');
    });

    it('실제 공개에 연결되지 않은 기준은 수정할 수 없다', async () => {
      const operator = await operatorHeaders();

      /*
       * 이 시험이 지키는 것은 「고쳐도 아무 일도 안 일어나는 값을 두지 않는다」이다.
       * 0095가 `wired` 열을 만들어야 했던 이유와 같다.
       */
      const before = (await get('/v1/admin/data/price-stats', operator.headers)).json() as {
        summary: { stage0: number };
      };
      expect(before.summary).toBeDefined();

      const response = await patch('/v1/admin/policy-engine', operator.headers, {
        changes: [{ key: 'public_stage.stage1_min', value: '99' }],
      });
      expect(response.statusCode).toBe(400);
      const rules = (await get('/v1/admin/policy-engine', operator.headers)).json() as {
        policies: { key: string; value: string; readOnlyReason: string | null }[];
      };
      expect(rules.policies.find((p) => p.key === 'public_stage.stage1_min')).toMatchObject({
        value: '3', readOnlyReason: expect.any(String),
      });

      const after = (await get('/v1/admin/data/price-stats', operator.headers)).json() as {
        summary: unknown;
      };
      expect(after.summary).toBeDefined();
    });

    it('숫자 칸에 말을 넣으면 거부한다', async () => {
      const operator = await operatorHeaders();
      const response = await patch('/v1/admin/policy-engine', operator.headers, {
        changes: [{ key: 'automation.dlq_alert_size', value: '곧' }],
      });
      expect(response.statusCode).toBe(400);
    });

    it('비율은 0과 1 사이만 받는다', async () => {
      const operator = await operatorHeaders();
      const response = await patch('/v1/admin/policy-engine', operator.headers, {
        changes: [{ key: 'automation.success_rate_down', value: '80' }],
      });
      expect(response.statusCode).toBe(400);
    });

    it('고치면 되돌릴 자리가 하나 생긴다', async () => {
      const operator = await operatorHeaders();

      await patch('/v1/admin/policy-engine', operator.headers, {
        changes: [{ key: 'automation.dlq_alert_size', value: '6' }],
      });

      const body = (await get('/v1/admin/rollback', operator.headers)).json() as {
        items: { type: string; status: string; requiresApproval: boolean }[];
      };
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({ type: 'policy', requiresApproval: true });
    });
  });

  // ── 공개 기준 반례 검수 (2026-09-11) ─────────────────────────

  describe('공개 기준 차단을 반례로 뚫어본다', () => {
    /**
     * 정상 키 여럿과 공개 기준 하나를 섞어 보낸다.
     *
     * 가드가 루프 안에 있었다면 앞의 것들만 써지고 뒤에서 막혀 **부분 적용**이 남는다.
     * 화면은 「저장됨」과 「실패」를 동시에 보이게 되고, 어느 값이 살아 있는지 아무도 모른다.
     */
    it('정상 키 뒤에 섞어 보내도 앞의 값이 남지 않는다', async () => {
      const operator = await operatorHeaders();

      const response = await patch('/v1/admin/policy-engine', operator.headers, {
        changes: [
          { key: 'automation.dlq_alert_size', value: '20' },
          { key: 'automation.success_rate_degraded', value: '0.9' },
          { key: 'public_stage.stage2_min', value: '99' },
        ],
      });
      expect(response.statusCode).toBe(400);

      const body = (await get('/v1/admin/policy-engine', operator.headers)).json() as {
        policies: { key: string; value: string }[];
      };
      const valueOf = (key: string) => body.policies.find((p) => p.key === key)?.value;

      expect(valueOf('automation.dlq_alert_size')).toBe('10');
      expect(valueOf('automation.success_rate_degraded')).toBe('0.95');
      expect(valueOf('public_stage.stage2_min')).toBe(String(DISCLOSURE_THRESHOLDS.normal));

      // 되돌릴 자리도 생기지 않았다 — 쓰이지 않은 변경의 롤백 대상이 남으면 그것이 다음 혼란이다.
      const { rows } = await test.pool.query<{ n: string }>(
        `SELECT count(*) AS n FROM structured.rollback_targets WHERE kind = 'policy'`
      );
      expect(rows[0]!.n).toBe('0');
    });

    /** 이름을 비틀어 가드를 지나가도 DB의 값은 그대로다. */
    it.each([
      'public_stage.stage3_min ',
      ' public_stage.stage3_min',
      'PUBLIC_STAGE.STAGE3_MIN',
    ])('%j로 비틀어 보내도 값이 바뀌지 않는다', async (key) => {
      const operator = await operatorHeaders();

      const response = await patch('/v1/admin/policy-engine', operator.headers, {
        changes: [{ key, value: '99' }],
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(400);

      const { rows } = await test.pool.query<{ value: string }>(
        `SELECT value FROM structured.policy_rules WHERE key = 'public_stage.stage3_min'`
      );
      expect(rows[0]!.value).toBe(String(DISCLOSURE_THRESHOLDS.detailed));
    });

    /**
     * 관리자 통계의 사다리가 domain과 **정말** 같은가.
     *
     * 경계에서만 갈린다. 2·3·4 / 4·5·6 / 9·10·11을 넣어 단계가 어디서 올라가는지 본다 —
     * 「3/5/10을 쓴다」고 적어 두는 것과 3에서 실제로 올라가는 것은 다른 말이다.
     */
    it.each([
      [2, 0], [3, 1], [4, 1],
      [4, 1], [5, 2], [6, 2],
      [9, 2], [10, 3], [11, 3],
    ])('실 제보 %i건이면 공개 단계는 %i다', async (count, expected) => {
      const operator = await operatorHeaders();

      const { rows } = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('경계 업체 ' || gen_random_uuid(), 'etc', '서울', 'public_data')
         RETURNING id`
      );
      const vendorId = rows[0]!.id;

      for (let i = 0; i < count; i += 1) {
        await test.pool.query(
          `INSERT INTO structured.payment_proofs
             (reporter_user_id, vendor_id, merchant_name, paid_amount, paid_at)
           VALUES ($1, $2, '경계 결제', 1000000, now())`,
          [operator.userId, vendorId]
        );
      }

      const body = (await get('/v1/admin/data/price-stats', operator.headers)).json() as {
        vendors: { vendorId: string; dataCount: number; publicStage: number }[];
      };
      const found = body.vendors.find((v) => v.vendorId === vendorId);

      expect(found).toMatchObject({ dataCount: count, publicStage: expected });
    });
  });


  // ── 롤백 ────────────────────────────────────────────────────

  describe('롤백', () => {
    async function policyRollbackTarget(headers: Record<string, string>): Promise<string> {
      await patch('/v1/admin/policy-engine', headers, {
        changes: [{ key: 'automation.dlq_alert_size', value: '12' }],
      });
      const { rows } = await test.pool.query<{ id: string }>(
        'SELECT id FROM structured.rollback_targets LIMIT 1'
      );
      return rows[0]!.id;
    }

    it('승인하지 않은 롤백은 실행되지 않는다', async () => {
      const operator = await operatorHeaders();
      const id = await policyRollbackTarget(operator.headers);

      const response = await post(`/v1/admin/rollback/${id}/trigger`, operator.headers);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { message: expect.stringContaining('승인') },
      });

      const { rows } = await test.pool.query<{ triggered_at: Date | null }>(
        'SELECT triggered_at FROM structured.rollback_targets WHERE id = $1',
        [id]
      );
      expect(rows[0]?.triggered_at).toBeNull();
    });

    /*
     * **가드를 도로 빼고 확인한 자리.** 라우트의 `if (!found.approved_at)`를 지운
     * 채로 이 흐름을 돌리면 라우트는 통과하고, 대신 0130의
     * `trigger_follows_approval`이 쓰기를 거부한다 — 두 겹이 각각 산다.
     *
     * 여기서는 스키마 쪽만 따로 겨눈다. 라우트를 지나지 않고 직접 쓴다.
     */
    it('스키마가 승인 없는 실행을 거부한다 — 라우트를 지나지 않아도', async () => {
      const operator = await operatorHeaders();
      const id = await policyRollbackTarget(operator.headers);

      await expect(
        test.pool.query(
          `UPDATE structured.rollback_targets
           SET triggered_at = now(), triggered_by = $2::uuid, trigger_reason = '몰래'
           WHERE id = $1`,
          [id, operator.userId]
        )
      ).rejects.toThrow(/trigger_follows_approval/);
    });

    it('두 단계를 거치면 정책 값이 실제로 되돌아간다', async () => {
      const operator = await operatorHeaders();
      const id = await policyRollbackTarget(operator.headers);

      expect((await post(`/v1/admin/rollback/${id}/approve`, operator.headers)).statusCode).toBe(
        204
      );

      const triggered = await post(`/v1/admin/rollback/${id}/trigger`, operator.headers);
      expect(triggered.statusCode).toBe(200);
      expect(triggered.json()).toMatchObject({ restored: true });

      const { rows } = await test.pool.query<{ value: string }>(
        `SELECT value FROM structured.policy_rules WHERE id = 'automation.dlq_alert_size'`
      );
      expect(rows[0]?.value).toBe('10');
    });

    it('승인 뒤에야 화면에 실행 단추가 뜬다', async () => {
      const operator = await operatorHeaders();
      const id = await policyRollbackTarget(operator.headers);

      const before = (await get('/v1/admin/rollback', operator.headers)).json() as {
        items: { id: string; requiresApproval: boolean }[];
      };
      // 화면은 requiresApproval이 false일 때만 «즉시 롤백»을 그린다.
      expect(before.items.find((i) => i.id === id)?.requiresApproval).toBe(true);

      await post(`/v1/admin/rollback/${id}/approve`, operator.headers);

      const after = (await get('/v1/admin/rollback', operator.headers)).json() as {
        items: { id: string; requiresApproval: boolean }[];
      };
      expect(after.items.find((i) => i.id === id)?.requiresApproval).toBe(false);
    });

    it('같은 롤백을 두 번 승인하지 않는다', async () => {
      const operator = await operatorHeaders();
      const id = await policyRollbackTarget(operator.headers);

      await post(`/v1/admin/rollback/${id}/approve`, operator.headers);
      const again = await post(`/v1/admin/rollback/${id}/approve`, operator.headers);

      expect(again.statusCode).toBe(400);
    });
  });

  // ── 약관 ────────────────────────────────────────────────────

  describe('약관 · 방침', () => {
    /*
     * **초안을 만들지 않는다. 0420이 심어 둔 것을 쓴다.**
     *
     * 한 문서에 초안은 하나뿐이라(`terms_one_draft_per_doc`) 여기서 또 넣으면
     * 겹친다. 그리고 심어 둔 것을 쓰는 편이 실제와 같다 — 운영자가 여는 것이
     * 바로 그 초안이다.
     */
    async function seededDraft(doc = 'terms'): Promise<{ versionId: string; clauseId: string }> {
      const { rows } = await test.pool.query<{ version_id: string; id: string }>(
        `SELECT c.id, c.version_id
         FROM structured.terms_clauses c
         JOIN structured.terms_versions v ON v.id = c.version_id
         WHERE v.doc = $1::terms_doc_kind AND v.published_at IS NULL
         ORDER BY c.position
         LIMIT 1`,
        [doc]
      );
      return { versionId: rows[0]!.version_id, clauseId: rows[0]!.id };
    }

    const docOf = (body: unknown, type: string) =>
      (body as { documents: TermsDocView[] }).documents.find((d) => d.type === type);

    type TermsDocView = {
      type: string;
      currentVersion: string;
      latestDraftVersion: string | null;
      effectiveOn: string | null;
      clauses: { id: string; body: string; bodyTable: unknown; removalWarning: string | null }[];
    };

    it('심어 둔 본문은 웹에 나가 있던 그대로다', async () => {
      const operator = await operatorHeaders();
      const body = (await get('/v1/admin/terms', operator.headers)).json();

      expect(docOf(body, 'terms')?.clauses).toHaveLength(21);
      expect(docOf(body, 'privacy')?.clauses).toHaveLength(13);
      // 마케팅은 저장소에 본문이 한 번도 없었다. 없는 법적 문서를 지어내지 않는다.
      expect(docOf(body, 'marketing')?.clauses).toHaveLength(0);
      expect(docOf(body, 'terms')?.clauses[0]?.body).toContain('이 약관은 픽랩');
    });

    /**
     * **심어 둔 방침이 무엇을 적고 있는가.**
     *
     * 2026-09-16까지 이 확인은 `apps/web/src/legal-pages.test.ts`에 있었다. 본문이
     * 코드에 있었기 때문이다. 0420이 본문을 표로 옮겼으므로 확인도 따라온다 —
     * 시험이 보는 것은 «사용자에게 나가는 글»이고, 그 글은 이제 여기 있다.
     *
     * **이 시험이 지키는 것은 «심은 것»이지 «앞으로의 모든 판»이 아니다.** 대표님이
     * 고치시면 여기는 빨개지지 않는다 — 고치라고 연 편집을 시험이 도로 막으면 안
     * 된다. 실수로 지우는 것을 막는 자리는 `removal_warning`이고, 그쪽은 저장 전에
     * 무엇이 사라지는지 보인다.
     *
     * 고지가 이전보다 먼저다(개인정보보호법 제28조의8). 국외 이전 자체가 위법이
     * 아니라 고지 없이 이전하는 것이 위법이라, 이 문장들이 빠진 채 배포되면 그
     * 구간이 통째로 미고지 이전이 된다.
     */
    it('심어 둔 방침이 국외 이전과 상담 녹음 처리를 적는다', async () => {
      const operator = await operatorHeaders();
      const body = (await get('/v1/admin/terms', operator.headers)).json();
      const clauses = docOf(body, 'privacy')!.clauses;
      const all = JSON.stringify(clauses);

      // 국외 이전 표 — 「국가」는 회사 소재지가 아니라 서버 리전이다.
      const transfer = clauses.find((c) => c.removalWarning?.includes('제28조의8'))!;
      const table = transfer.bodyTable as { rows: string[][] };
      const row = (needle: string) => table.rows.find((r) => r.join(' ').includes(needle))!.join(' ');

      for (const vendor of ['neon.tech', 'privacy@render.com']) {
        expect(row(vendor)).toContain('싱가포르');
      }
      expect(row('privacy@render.com')).toContain('싱가포르(운영 API 및 백그라운드 처리)');
      // 자료 분석과 푸시 중계는 그대로 미국이다. 전부 싱가포르로 뭉뚱그리지 않는다.
      expect(row('650 Industries')).toContain('미국 ·');
      // 상담 녹음을 읽어내는 이전. 이 줄이 없으면 첫 호출이 곧 미고지 이전이다.
      expect(row('Google LLC')).toContain('상담 녹음');

      // 수탁자 목록도 지우면 안 되는 절로 표시돼 있다(개인정보보호법 제26조).
      expect(clauses.filter((c) => c.removalWarning !== null)).toHaveLength(2);

      // 상담 녹음 — 언제 지우는지. 「끝나면 지운다」만 적으면 안 끝난 파일이 영원히 남는다.
      expect(all).toContain('읽어내기가 끝나는 즉시 삭제');
      expect(all).toContain('업로드 시점부터 24시간을 넘겨 보관하지 않습니다');
      expect(all).toContain('녹취록은 만들지');

      // 권익침해 구제 창구.
      expect(all).toContain('https://privacy.kisa.or.kr');
    });

    it('초안 조문을 고친다', async () => {
      const operator = await operatorHeaders();
      const { clauseId } = await seededDraft();

      const response = await put(`/v1/admin/terms/terms/clauses/${clauseId}`, operator.headers, {
        body: '고친 내용',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ saved: true });

      const body = (await get('/v1/admin/terms', operator.headers)).json();
      expect(docOf(body, 'terms')?.clauses[0]?.body).toBe('고친 내용');
    });

    /*
     * **국외 이전 고지는 이전보다 먼저다**(CLAUDE.md · 개인정보보호법 제28조의8).
     * 막지 않는다 — 대표님이 고치실 수 있어야 한다. 무엇이 사라지는지 보이고
     * 한 번 더 받는 것이 전부다(v3.27).
     */
    it('국외 이전 절에서 수탁자가 빠지면 저장 전에 무엇이 사라지는지 보인다', async () => {
      const operator = await operatorHeaders();
      const { rows } = await test.pool.query<{ id: string; body_table: { rows: string[][] } }>(
        `SELECT c.id, c.body_table
         FROM structured.terms_clauses c
         JOIN structured.terms_versions v ON v.id = c.version_id
         WHERE v.doc = 'privacy' AND v.published_at IS NULL AND c.removal_warning IS NOT NULL
         ORDER BY c.position DESC
         LIMIT 1`
      );
      const clause = rows[0]!;
      const table = clause.body_table;

      const response = await put(`/v1/admin/terms/privacy/clauses/${clause.id}`, operator.headers, {
        body: '남은 설명',
        bodyTable: { ...table, rows: table.rows.slice(0, 1) },
      });

      expect(response.statusCode).toBe(200);
      const result = response.json() as { saved: boolean; warning: string; removing: string[] };
      expect(result.saved).toBe(false);
      expect(result.warning).toContain('제28조의8');
      expect(result.removing.length).toBe(table.rows.length - 1);

      // 확인 전에는 표가 그대로다 — 「보여주기」가 저장을 겸하지 않는다.
      const before = (await get('/v1/admin/terms', operator.headers)).json();
      const kept = docOf(before, 'privacy')?.clauses.find((c) => c.id === clause.id);
      expect((kept?.bodyTable as { rows: string[][] }).rows).toHaveLength(table.rows.length);

      // 확인하면 저장된다. 막는 것이 아니라 가르는 것이다.
      const confirmed = await put(
        `/v1/admin/terms/privacy/clauses/${clause.id}`,
        operator.headers,
        { body: '남은 설명', bodyTable: { ...table, rows: table.rows.slice(0, 1) }, confirm: true }
      );
      expect(confirmed.json()).toMatchObject({ saved: true });
    });

    it('표시가 없는 절은 한 번에 저장된다', async () => {
      const operator = await operatorHeaders();
      const { clauseId } = await seededDraft();

      const response = await put(`/v1/admin/terms/terms/clauses/${clauseId}`, operator.headers, {
        body: '한 줄만 남김',
      });
      expect(response.json()).toMatchObject({ saved: true });
    });

    /*
     * **마케팅 정보 수신 동의는 이 길로 시작한다.** 저장소에 본문이 한 번도 없어서
     * 0420이 빈 초안만 두었다 — 없는 법적 문서를 지어내지 않았다. 더하는 자리가
     * 없으면 「수정 가능하도록」이 반만 열린 셈이다.
     */
    it('빈 문서에 조문을 더해 공개까지 간다', async () => {
      const operator = await operatorHeaders();

      const added = await post('/v1/admin/terms/marketing/clauses', operator.headers, {
        title: '제1조 목적',
        body: '혜택 소식을 받는 것에 대한 동의예요.',
      });
      expect(added.statusCode).toBe(200);

      const body = (await get('/v1/admin/terms', operator.headers)).json();
      expect(docOf(body, 'marketing')?.clauses).toHaveLength(1);
      expect(docOf(body, 'marketing')?.clauses[0]?.body).toContain('혜택 소식');

      const published = await publishTerms(
        test.pool,
        'marketing',
        operator.userId,
        '첫 판',
        '2026-10-01'
      );
      expect(published.effectiveOn).toBe('2026-10-01');
    });

    it('빈 제목이나 빈 내용은 조문이 되지 않는다', async () => {
      const operator = await operatorHeaders();

      for (const payload of [
        { title: '  ', body: '내용' },
        { title: '제목', body: '  ' },
      ]) {
        const response = await post('/v1/admin/terms/marketing/clauses', operator.headers, payload);
        expect(response.statusCode).toBe(400);
      }
    });

    it('보호 표시가 없는 조문은 한 번에 지워진다', async () => {
      const operator = await operatorHeaders();
      const { clauseId } = await seededDraft();

      const response = await test.app.inject({
        method: 'DELETE',
        url: `/v1/admin/terms/terms/clauses/${clauseId}?confirm=false`,
        headers: operator.headers,
      });
      expect(response.json()).toMatchObject({ saved: true });

      const body = (await get('/v1/admin/terms', operator.headers)).json();
      expect(docOf(body, 'terms')?.clauses).toHaveLength(20);
    });

    /* 절이 통째로 없어지면 그 순간부터 미고지 이전이 된다(제28조의8). 보이고 받는다. */
    it('국외 이전 절을 지울 때는 무엇이 사라지는지 먼저 보인다', async () => {
      const operator = await operatorHeaders();
      const { rows } = await test.pool.query<{ id: string }>(
        `SELECT c.id
         FROM structured.terms_clauses c
         JOIN structured.terms_versions v ON v.id = c.version_id
         WHERE v.doc = 'privacy' AND v.published_at IS NULL AND c.removal_warning IS NOT NULL
         ORDER BY c.position DESC
         LIMIT 1`
      );
      const clauseId = rows[0]!.id;
      const del = (confirm: boolean) =>
        test.app.inject({
          method: 'DELETE',
          url: `/v1/admin/terms/privacy/clauses/${clauseId}?confirm=${confirm}`,
          headers: operator.headers,
        });

      const asked = (await del(false)).json() as { saved: boolean; removing: string[] };
      expect(asked.saved).toBe(false);
      expect(asked.removing.length).toBeGreaterThan(1);

      // 확인 전에는 그대로 있다.
      const still = (await get('/v1/admin/terms', operator.headers)).json();
      expect(docOf(still, 'privacy')?.clauses.some((c) => c.id === clauseId)).toBe(true);

      expect((await del(true)).json()).toMatchObject({ saved: true });
      const gone = (await get('/v1/admin/terms', operator.headers)).json();
      expect(docOf(gone, 'privacy')?.clauses.some((c) => c.id === clauseId)).toBe(false);
    });

    it('공개하면 판을 보존하고 시행일을 붙이고 다음 초안을 만든다', async () => {
      const operator = await operatorHeaders();

      const published = await publishTerms(
        test.pool,
        'terms',
        operator.userId,
        '분리된 DB 검증',
        '2026-10-01'
      );
      expect(published).toMatchObject({
        version: 'v0.1',
        nextDraft: 'v0.2',
        effectiveOn: '2026-10-01',
      });

      const body = (await get('/v1/admin/terms', operator.headers)).json();
      const doc = docOf(body, 'terms');
      expect(doc?.currentVersion).toBe('v0.1');
      expect(doc?.effectiveOn).toBe('2026-10-01');
      // 새 초안이 없으면 공개 직후 그 문서는 편집할 수 없는 상태가 된다.
      expect(doc?.latestDraftVersion).toBe('v0.2');
    });

    it('시행일 없이는 공개할 수 없다', async () => {
      const operator = await operatorHeaders();
      const response = await post('/v1/admin/terms/terms/publish', operator.headers, {});
      expect(response.statusCode).toBe(400);
    });

    /*
     * 표의 CHECK도 같은 것을 막는다. 라우트의 검사가 지워지는 날 여기가 남는다.
     */
    it('스키마가 시행일 없는 공개를 거부한다', async () => {
      await expect(
        test.pool.query(
          `UPDATE structured.terms_versions
           SET published_at = now(), published_by = NULL
           WHERE doc = 'terms' AND published_at IS NULL`
        )
      ).rejects.toThrow();
    });

    /* 조문이 없는 판을 공개하면 사용자에게 빈 약관이 나가고, 그 판은 얼어붙는다. */
    it('조문이 없는 초안은 공개할 수 없다', async () => {
      const operator = await operatorHeaders();
      await expect(
        publishTerms(test.pool, 'marketing', operator.userId, '빈 초안', '2026-10-01')
      ).rejects.toThrow(/조문/);
    });

    it('공개된 판의 조문은 라우트가 거부한다', async () => {
      const operator = await operatorHeaders();
      const { clauseId } = await seededDraft();
      await publishTerms(test.pool, 'terms', operator.userId, '분리된 DB 검증', '2026-10-01');

      const response = await put(`/v1/admin/terms/terms/clauses/${clauseId}`, operator.headers, {
        body: '몰래 고침',
      });
      expect(response.statusCode).toBe(400);
    });

    /*
     * **가드를 도로 빼고 확인한 자리.** 라우트의 `if (found.published_at !== null)`을
     * 지우면 위 시험은 통과해 버린다. 그때 막는 것이 0130의 트리거다.
     */
    it('스키마 트리거가 공개된 판의 조문 쓰기를 거부한다', async () => {
      const operator = await operatorHeaders();
      const { clauseId } = await seededDraft();
      await publishTerms(test.pool, 'terms', operator.userId, '분리된 DB 검증', '2026-10-01');

      await expect(
        test.pool.query('UPDATE structured.terms_clauses SET body = $2 WHERE id = $1', [
          clauseId,
          '몰래 고침',
        ])
      ).rejects.toThrow(/공개된 판/);
    });

    /*
     * 동의 기록이 초안을 가리키면, 그 뒤 초안이 고쳐지면서 동의한 글이 소리 없이
     * 바뀐다. 0130이 조문을 얼리는 것과 같은 이유이고 여기가 나머지 반쪽이다.
     */
    it('공개되지 않은 판에는 동의를 받을 수 없다', async () => {
      const session = await signInAs(test, `consenter-${Math.random()}`);
      const { versionId } = await seededDraft();

      await expect(
        test.pool.query(
          `INSERT INTO structured.user_consents (user_id, item, terms_version, is_required, terms_version_id)
           VALUES ($1, 'terms', 'v0.1', true, $2)`,
          [session.userId, versionId]
        )
      ).rejects.toThrow(/공개되지 않은 판/);
    });

    it('마케팅은 초안 만들기로 시작한다', async () => {
      const operator = await operatorHeaders();
      // 0420이 빈 초안을 이미 두었다. 하나뿐이라는 규칙을 여기서도 지킨다.
      const again = await post('/v1/admin/terms', operator.headers, { doc: 'marketing' });
      expect(again.statusCode).toBe(400);
    });

    it('공개할 초안이 없으면 거부한다', async () => {
      const operator = await operatorHeaders();
      await publishTerms(test.pool, 'privacy', operator.userId, '검증', '2026-10-01');
      // 공개하면 다음 초안이 생기므로, 그것까지 치우고 나서 본다.
      await test.pool.query(
        `DELETE FROM structured.terms_versions WHERE doc = 'privacy' AND published_at IS NULL`
      );

      const response = await post('/v1/admin/terms/privacy/publish', operator.headers, {
        effectiveOn: '2026-10-01',
      });
      expect(response.statusCode).toBe(400);
    });

    it('없는 문서 갈래는 404다', async () => {
      const operator = await operatorHeaders();
      const response = await post('/v1/admin/terms/no-such-doc/publish', operator.headers, {
        effectiveOn: '2026-10-01',
      });
      expect(response.statusCode).toBe(404);
    });

    /* 웹이 빌드할 때 읽는 자리. 초안은 나가지 않는다. */
    describe('공개 조회', () => {
      it('공개 전에는 문서가 비어 있다', async () => {
        const response = await test.app.inject({ method: 'GET', url: '/v1/legal/terms' });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ document: null });
      });

      it('공개하면 그 판이 나간다', async () => {
        const operator = await operatorHeaders();
        await publishTerms(test.pool, 'terms', operator.userId, '검증', '2026-10-01');

        const response = await test.app.inject({ method: 'GET', url: '/v1/legal/terms' });
        const doc = (response.json() as { document: { version: string; effectiveOn: string; clauses: unknown[] } })
          .document;
        expect(doc).toMatchObject({ version: 'v0.1', effectiveOn: '2026-10-01' });
        expect(doc.clauses).toHaveLength(21);
      });

      it('없는 문서는 404다', async () => {
        const response = await test.app.inject({ method: 'GET', url: '/v1/legal/no-such-doc' });
        expect(response.statusCode).toBe(404);
      });
    });
  });

  // ── 광고 실운영 게이트 ───────────────────────────────────────

  describe('광고 실운영 전환 게이트', () => {
    async function bothReports(): Promise<void> {
      await test.pool.query(
        `INSERT INTO ads.launch_reports (tier, analyst, verdict, recommended_on, findings)
         VALUES ('light', 'gpt', 'open', current_date, '{"ctr": "측정값"}'::jsonb),
                ('light', 'claude', 'hold', NULL, '{"ctr": "측정값"}'::jsonb)`
      );
    }

    it('보고서 2건이 없으면 승인하지 않는다', async () => {
      const operator = await operatorHeaders();
      const response = await post('/v1/admin/ads-gate/approve', operator.headers);
      expect(response.statusCode).toBe(400);
    });

    /**
     * **승인은 전환이 아니다.** 켜는 길이 생긴 뒤에도(2026-09-11 대표 지시) 이것은
     * 그대로다 — 승인 단추 하나로 광고가 나가면 「열기로 정했다」와 「지금 나간다」가
     * 한 번의 실수로 붙는다.
     */
    it('승인해도 실운영은 꺼진 채다', async () => {
      const operator = await operatorHeaders();
      await bothReports();

      const response = await post('/v1/admin/ads-gate/approve', operator.headers);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ activated: false });

      const { rows } = await test.pool.query<{ activated: boolean; approved_at: Date | null }>(
        'SELECT activated, approved_at FROM ads.production_gate WHERE id = true'
      );
      expect(rows[0]?.approved_at).not.toBeNull();
      expect(rows[0]?.activated).toBe(false);

      const gate = (await get('/v1/admin/ads-gate', operator.headers)).json() as {
        steps: { id: string; status: string }[];
        readyForProduction: boolean;
        activated: boolean;
        canActivate: boolean;
      };
      /* 승인 뒤에는 「켤 수 있음」이다. 켜진 것이 아니다. */
      expect(gate.steps.find((s) => s.id === 'production')?.status).toBe('in_progress');
      expect(gate.activated).toBe(false);
      expect(gate.canActivate).toBe(true);
      expect(gate.readyForProduction).toBe(false);
    });

    /**
     * 두 겹으로 막혀 있다 — 라우트가 먼저 보고, 그 줄이 없어도 스키마의
     * `activation_follows_approval`이 막는다.
     *
     * **그래서 상태 코드만 보면 라우트 가드를 확인하지 못한다.** 가드를 빼고
     * 돌려 보니 여전히 400이었다(2026-09-11 실측). 라우트가 하는 일은 막는 것이
     * 아니라 **왜 막혔는지 사람에게 말해 주는 것**이라, 그 말을 확인한다 —
     * 제약이 던지는 오류는 이유를 알려주지 않는다.
     */
    it('승인 전에는 켤 수 없고, 왜 막혔는지 말해 준다', async () => {
      const operator = await operatorHeaders();

      const response = await post('/v1/admin/ads-gate/activate', operator.headers);
      expect(response.statusCode).toBe(400);
      expect(response.json<{ error: { message: string } }>().error.message).toContain('먼저 승인');

      const { rows } = await test.pool.query<{ activated: boolean }>(
        'SELECT activated FROM ads.production_gate WHERE id = true'
      );
      expect(rows[0]?.activated).toBe(false);
    });

    /**
     * 2026-09-11 대표 지시 — 「광고도 진행해. 단, 관리자에서 내가 컨트롤할 수 있어야
     * 한다」. **켜는 것과 끄는 것이 둘 다 있어야 컨트롤이다.**
     */
    it('승인 뒤에는 켜고 다시 끌 수 있다', async () => {
      const operator = await operatorHeaders();
      await bothReports();
      await post('/v1/admin/ads-gate/approve', operator.headers);

      const on = await post('/v1/admin/ads-gate/activate', operator.headers);
      expect(on.statusCode).toBe(200);
      expect(on.json()).toMatchObject({ activated: true });

      const afterOn = (await get('/v1/admin/ads-gate', operator.headers)).json() as {
        activated: boolean;
        canActivate: boolean;
        steps: { id: string; status: string }[];
      };
      expect(afterOn.activated).toBe(true);
      expect(afterOn.canActivate).toBe(false);
      expect(afterOn.steps.find((s) => s.id === 'production')?.status).toBe('done');

      const off = await post('/v1/admin/ads-gate/deactivate', operator.headers);
      expect(off.statusCode).toBe(200);
      expect(off.json()).toMatchObject({ activated: false });

      /* 끄는 것과 승인을 무르는 것은 다른 일이다 — 승인 기록은 남는다. */
      const { rows } = await test.pool.query<{ activated: boolean; approved_at: Date | null }>(
        'SELECT activated, approved_at FROM ads.production_gate WHERE id = true'
      );
      expect(rows[0]?.activated).toBe(false);
      expect(rows[0]?.approved_at).not.toBeNull();
    });

    it('이미 켜진 것을 또 켜지 않는다', async () => {
      const operator = await operatorHeaders();
      await bothReports();
      await post('/v1/admin/ads-gate/approve', operator.headers);
      await post('/v1/admin/ads-gate/activate', operator.headers);

      const again = await post('/v1/admin/ads-gate/activate', operator.headers);
      expect(again.statusCode).toBe(400);
    });

    it('두 번 승인하지 않는다', async () => {
      const operator = await operatorHeaders();
      await bothReports();

      await post('/v1/admin/ads-gate/approve', operator.headers);
      const again = await post('/v1/admin/ads-gate/approve', operator.headers);
      expect(again.statusCode).toBe(400);
    });

    it('전체 관문과 상품이 모두 열려야 광고가 보이고 전체 끄기가 노출을 멈춘다', async () => {
      const operator = await operatorHeaders();
      const { rows: vendors } = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('광고 관문 검증홀', 'hall', '서울 강남구', 'public_data') RETURNING id`
      );
      await test.pool.query(
        `INSERT INTO ads.placements (vendor_id, surface, tier, starts_on, ends_on)
         VALUES ($1, 'search', 'standard', current_date - 1, current_date + 1)`,
        [vendors[0]!.id]
      );
      const sponsored = async () =>
        (await test.app.inject({ method: 'GET', url: '/v1/vendors' })).json<{ sponsored: unknown[] }>().sponsored;

      expect((await put('/v1/admin/ad-tiers/standard', operator.headers, { state: 'live' })).statusCode).toBe(200);
      expect(await sponsored()).toEqual([]);
      await bothReports();
      expect((await post('/v1/admin/ads-gate/approve', operator.headers)).statusCode).toBe(200);
      expect(await sponsored()).toEqual([]);
      expect((await post('/v1/admin/ads-gate/activate', operator.headers)).statusCode).toBe(200);
      expect(await sponsored()).toHaveLength(1);
      expect((await put('/v1/admin/ad-tiers/standard', operator.headers, { state: 'withheld' })).statusCode).toBe(200);
      expect(await sponsored()).toEqual([]);
      expect((await put('/v1/admin/ad-tiers/standard', operator.headers, { state: 'live' })).statusCode).toBe(200);
      expect(await sponsored()).toHaveLength(1);
      expect((await post('/v1/admin/ads-gate/deactivate', operator.headers)).statusCode).toBe(200);
      expect(await sponsored()).toEqual([]);
      expect((await post('/v1/admin/ads-gate/activate', operator.headers)).statusCode).toBe(200);
      expect(await sponsored()).toHaveLength(1);
    });

    it('승인 없이는 켜짐이 될 수 없다 — 스키마가 막는다', async () => {
      await expect(
        test.pool.query(
          'UPDATE ads.production_gate SET activated = true, activated_at = now() WHERE id = true'
        )
      ).rejects.toThrow(/activation_follows_approval/);
    });
  });

  // ── 광고 상품(등급)별 실운영 상태 ────────────────────────────

  /**
   * **검색 화면이 실제로 보는 스위치가 이것이다**(`routes/vendors.ts`가
   * `ads.tier_state`를 `state = 'live'`로 건다). 전체 관문과 다른 자리라 따로 본다.
   */
  describe('광고 상품별 실운영 상태', () => {
    const tiersOf = (body: unknown) => (body as { tiers: { tier: string; state: string }[] }).tiers;
    const stateOf = (body: unknown, tier: string) =>
      tiersOf(body).find((t) => t.tier === tier)?.state;

    it('아무것도 안 정하면 전부 테스트다', async () => {
      const operator = await operatorHeaders();

      const response = await get('/v1/admin/ad-tiers', operator.headers);
      expect(response.statusCode).toBe(200);

      const tiers = tiersOf(response.json());
      expect(tiers.length).toBeGreaterThan(0);
      expect(tiers.every((t) => t.state === 'test')).toBe(true);
    });

    it('실운영으로 열고 테스트로 되돌린다', async () => {
      const operator = await operatorHeaders();

      const opened = await put('/v1/admin/ad-tiers/standard', operator.headers, { state: 'live' });
      expect(opened.statusCode).toBe(200);
      expect(stateOf(opened.json(), 'standard')).toBe('live');
      /* 한 등급을 연다고 다른 등급이 따라 열리지 않는다. */
      expect(stateOf(opened.json(), 'light')).toBe('test');

      const back = await test.app.inject({
        method: 'DELETE',
        url: '/v1/admin/ad-tiers/standard',
        headers: operator.headers,
      });
      expect(back.statusCode).toBe(200);
      expect(stateOf(back.json(), 'standard')).toBe('test');
    });

    it('사람 없이 실운영이 되지 않는다 — 정한 사람이 남는다', async () => {
      const operator = await operatorHeaders();
      await put('/v1/admin/ad-tiers/light', operator.headers, { state: 'live' });

      const { rows } = await test.pool.query<{ decided_by: string | null }>(
        "SELECT decided_by FROM ads.launch_decisions WHERE tier = 'light'"
      );
      expect(rows[0]?.decided_by).toBe(operator.userId);
    });

    it('상품 결정을 지운 뒤에도 감사 기록에서 어느 상품을 바꿨는지 구분한다', async () => {
      const operator = await operatorHeaders();
      for (const tier of ['light', 'standard']) {
        expect((await put(`/v1/admin/ad-tiers/${tier}`, operator.headers, { state: 'live' })).statusCode).toBe(200);
        expect((await test.app.inject({
          method: 'DELETE', url: `/v1/admin/ad-tiers/${tier}`, headers: operator.headers,
        })).statusCode).toBe(200);
      }

      const { rows } = await test.pool.query<{
        reason_code: string; evidence_refs: { kind: string; id: string }[];
      }>("SELECT reason_code, evidence_refs FROM structured.decisions WHERE workflow = 'ads_launch'");
      expect(rows).toHaveLength(4);
      for (const tier of ['light', 'standard']) {
        for (const reason of ['ad_tier_live', 'ad_tier_test']) {
          expect(rows).toContainEqual({
            reason_code: reason, evidence_refs: [{ kind: 'ad_tier', id: tier }],
          });
        }
      }
      expect((await test.pool.query('SELECT tier FROM ads.launch_decisions')).rows).toEqual([]);
    });

    /*
     * test는 시작 상태이지 결정이 아니다. 표의 `decision_is_not_test`가 막고 있고,
     * 라우트 스키마도 받지 않는다 — 두 겹을 각각 확인한다.
     */
    it('test를 결정으로 적지 않는다 — 라우트가 막는다', async () => {
      const operator = await operatorHeaders();

      const response = await put('/v1/admin/ad-tiers/light', operator.headers, { state: 'test' });
      expect(response.statusCode).toBe(400);
    });

    it('test를 결정으로 적지 않는다 — 스키마가 막는다', async () => {
      const person = await test.pool.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );

      await expect(
        test.pool.query(
          `INSERT INTO ads.launch_decisions (tier, state, decided_by)
           VALUES ('light', 'test', $1::uuid)`,
          [person.rows[0]!.id]
        )
      ).rejects.toThrow(/decision_is_not_test/);
    });

    it('이미 테스트인 것을 또 되돌리지 않는다', async () => {
      const operator = await operatorHeaders();

      const response = await test.app.inject({
        method: 'DELETE',
        url: '/v1/admin/ad-tiers/premium',
        headers: operator.headers,
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // ── 감사 기록 ───────────────────────────────────────────────

  describe('감사 기록', () => {
    it('화면이 읽는 칸 이름으로 준다', async () => {
      const operator = await operatorHeaders();
      await failedDecision('reward');

      const body = (await get('/v1/admin/audit-log', operator.headers)).json() as {
        items: { eventId: string; decision: string; actorType: string; evidence: string[] }[];
        total: number;
        hasMore: boolean;
        cursor: string | null;
      };

      expect(body.total).toBeGreaterThan(0);
      expect(body.hasMore).toBe(false);
      expect(body.cursor).toBeNull();
      expect(body.items[0]).toMatchObject({
        // 실패한 결정은 사람에게 넘어간 것이다.
        decision: 'escalated',
        actorType: 'system',
      });
      expect(Array.isArray(body.items[0]?.evidence)).toBe(true);
    });

    it('화면이 보내는 ?q= 로 찾는다', async () => {
      const operator = await operatorHeaders();
      await failedDecision('reward');
      await failedDecision('vendor_claim');

      const hit = (await get('/v1/admin/audit-log?q=vendor_claim', operator.headers)).json() as {
        items: { targetType: string }[];
        total: number;
      };
      expect(hit.total).toBe(1);

      const miss = (await get('/v1/admin/audit-log?q=없는말', operator.headers)).json() as {
        total: number;
      };
      expect(miss.total).toBe(0);
    });
  });

  // ── 캠페인 · 광고 집행 ──────────────────────────────────────

  describe('캠페인 · 광고 집행', () => {
    it('캠페인 목록은 화면이 읽는 모양이고, 예산은 지어내지 않는다', async () => {
      const operator = await operatorHeaders();

      const body = (await get('/v1/admin/campaigns', operator.headers)).json() as {
        items: unknown[];
        budget?: unknown;
      };

      expect(Array.isArray(body.items)).toBe(true);
      // 예산을 담는 표가 없다. 0으로 적으면 「예산 0원」이 사실처럼 읽힌다.
      expect(body.budget).toBeUndefined();
    });

    it('지급·차단이 아닌 말은 거부한다', async () => {
      const operator = await operatorHeaders();
      const response = await post(
        '/v1/admin/campaigns/00000000-0000-0000-0000-000000000000/delete',
        operator.headers
      );
      expect(response.statusCode).toBe(400);
    });

    it('광고 상태는 화면이 보내는 PATCH로 바꾼다', async () => {
      const operator = await operatorHeaders();

      const { rows: vendor } = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('강남 A 스튜디오', 'studio', '서울', 'public_data') RETURNING id`
      );
      const { rows: placement } = await test.pool.query<{ id: string }>(
        `INSERT INTO ads.placements (vendor_id, surface, tier, starts_on, ends_on)
         VALUES ($1, 'vendor_detail', 'light', current_date - 1, current_date + 30) RETURNING id`,
        [vendor[0]!.id]
      );
      const id = placement[0]!.id;

      const listed = (await get('/v1/admin/ads', operator.headers)).json() as {
        items: { id: string; status: string }[];
      };
      expect(listed.items.find((i) => i.id === id)?.status).toBe('active');

      const paused = await patch(`/v1/admin/ads/${id}/status`, operator.headers, {
        status: 'paused',
      });
      expect(paused.statusCode).toBe(204);

      const after = (await get('/v1/admin/ads', operator.headers)).json() as {
        items: { id: string; status: string }[];
      };
      expect(after.items.find((i) => i.id === id)?.status).toBe('paused');

      /*
       * 멈춘 광고는 사용자에게 보이지 않아야 한다. 화면에는 «일시정지»인데
       * 사용자에게는 계속 나가는 것이 가장 나쁜 자리다.
       */
      const { rows: active } = await test.pool.query(
        'SELECT id FROM ads.active_placements WHERE id = $1',
        [id]
      );
      expect(active).toHaveLength(0);

      // 기간은 손대지 않는다. 돈이 오간 약속이다.
      const { rows: kept } = await test.pool.query<{ starts_on: Date; ends_on: Date }>(
        'SELECT starts_on, ends_on FROM ads.placements WHERE id = $1',
        [id]
      );
      expect(kept[0]?.starts_on).not.toBeNull();

      const resumed = await patch(`/v1/admin/ads/${id}/status`, operator.headers, {
        status: 'active',
      });
      expect(resumed.statusCode).toBe(204);

      const again = await patch(`/v1/admin/ads/${id}/status`, operator.headers, {
        status: 'active',
      });
      expect(again.statusCode).toBe(400);
    });

    /*
     * 2026-09-16까지 이 셋은 **성공만 돌려주고 아무것도 하지 않았다** — POST는 새
     * uuid를, PATCH · DELETE는 204를 냈다. 표에는 아무것도 남지 않았다.
     *
     * 그래서 상태 코드만 보지 않는다. **표를 다시 읽어 확인한다** — 204가 오는
     * 것과 줄이 바뀌는 것은 다른 말이고, 예전 판은 앞쪽만 하고 있었다.
     */
    async function aVendor(): Promise<string> {
      const { rows } = await test.pool.query<{ id: string }>(
        `INSERT INTO structured.vendors (name, category, region, source)
         VALUES ('강남 B 스튜디오 ' || gen_random_uuid(), 'studio', '서울', 'public_data')
         RETURNING id`
      );
      return rows[0]!.id;
    }

    const newAd = (vendorId: string) => ({
      vendorId,
      surface: 'vendor_detail',
      tier: 'light',
      category: 'studio',
      region: '서울',
      startsOn: '2026-10-01',
      endsOn: '2026-10-31',
    });

    it('등록하면 표에 남는다', async () => {
      const operator = await operatorHeaders();
      const vendorId = await aVendor();

      const created = await post('/v1/admin/ads', operator.headers, newAd(vendorId));
      expect(created.statusCode).toBe(201);

      const { id } = created.json() as { id: string };

      const { rows } = await test.pool.query<{
        vendor_id: string;
        tier: string;
        surface: string;
        region: string | null;
      }>('SELECT vendor_id, tier, surface, region FROM ads.placements WHERE id = $1', [id]);

      expect(rows[0]).toMatchObject({
        vendor_id: vendorId,
        tier: 'light',
        surface: 'vendor_detail',
        region: '서울',
      });

      /* 누가 넣었는지가 같이 남는다. 돈이 오간 자리라 그 질문이 반드시 나온다. */
      const { rows: decided } = await test.pool.query<{ actor_user_id: string }>(
        `SELECT actor_user_id FROM structured.decisions
         WHERE workflow = 'ad_placement' AND step = 'add' AND subject_id = $1`,
        [id]
      );
      expect(decided[0]?.actor_user_id).toBe(operator.userId);
    });

    it('고치면 넣은 칸만 바뀐다', async () => {
      const operator = await operatorHeaders();
      const vendorId = await aVendor();
      const { id } = (
        await post('/v1/admin/ads', operator.headers, newAd(vendorId))
      ).json() as { id: string };

      const changed = await patch(`/v1/admin/ads/${id}`, operator.headers, {
        tier: 'premium',
        endsOn: '2026-11-30',
      });
      expect(changed.statusCode).toBe(204);

      const { rows } = await test.pool.query<{
        tier: string;
        surface: string;
        region: string | null;
        ends_on: Date;
      }>('SELECT tier, surface, region, ends_on FROM ads.placements WHERE id = $1', [id]);

      expect(rows[0]?.tier).toBe('premium');
      expect(rows[0]?.ends_on.toISOString().slice(0, 10)).toBe('2026-11-30');
      /* 안 보낸 칸은 그대로다. NULL로 덮으면 조건 없는 광고가 된다. */
      expect(rows[0]?.surface).toBe('vendor_detail');
      expect(rows[0]?.region).toBe('서울');
    });

    it('빈 본문으로는 고치지 않는다', async () => {
      const operator = await operatorHeaders();
      const vendorId = await aVendor();
      const { id } = (
        await post('/v1/admin/ads', operator.headers, newAd(vendorId))
      ).json() as { id: string };

      expect((await patch(`/v1/admin/ads/${id}`, operator.headers, {})).statusCode).toBe(400);
    });

    it('내리면 표에서 사라지고, 없는 자리는 404다', async () => {
      const operator = await operatorHeaders();
      const vendorId = await aVendor();
      const { id } = (
        await post('/v1/admin/ads', operator.headers, newAd(vendorId))
      ).json() as { id: string };

      const removed = await test.app.inject({
        method: 'DELETE',
        url: `/v1/admin/ads/${id}`,
        headers: operator.headers,
      });
      expect(removed.statusCode).toBe(204);

      const { rowCount } = await test.pool.query('SELECT 1 FROM ads.placements WHERE id = $1', [
        id,
      ]);
      expect(rowCount).toBe(0);

      const again = await test.app.inject({
        method: 'DELETE',
        url: `/v1/admin/ads/${id}`,
        headers: operator.headers,
      });
      expect(again.statusCode).toBe(404);
    });

    /*
     * 표가 없어서 「나」로 간 셋. **성공을 돌려주지 않는다는 것 자체가 사양이다** —
     * 204로 되돌아가면 이 시험이 잡는다.
     */
    it.each([
      ['PATCH', '/v1/admin/ads-gate'],
      ['PATCH', '/v1/admin/automation'],
      ['POST', '/v1/admin/campaigns'],
    ])('%s %s는 성공을 지어내지 않는다', async (method, url) => {
      const operator = await operatorHeaders();

      const response = await test.app.inject({
        method: method as 'PATCH' | 'POST',
        url,
        headers: operator.headers,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
