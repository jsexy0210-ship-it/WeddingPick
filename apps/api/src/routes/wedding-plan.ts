import {
  createExpenseRequestSchema,
  createVisitNoteRequestSchema,
  createWeddingNoteRequestSchema,
  createWeddingTaskRequestSchema,
  setBudgetRequestSchema,
  updateExpenseRequestSchema,
  updateWeddingNoteRequestSchema,
  updateWeddingTaskRequestSchema,
} from '@weddingpick/api-contract';
import {
  EXPENSE_BUCKET_LABEL,
  EXPENSE_REFUND_STATUS_LABEL,
  EXPENSE_SOURCE_LABEL,
  EXPENSE_STATUS_LABEL,
  SCHEDULED_NOTE,
  TASK_PRESETS,
  TASK_STATE_LABEL,
  bucketFor,
  budgetView,
  resolveTaskState,
  summarizeExpenses,
  taskProgress,
  type ExpenseRefundStatus,
  type ExpenseSource,
  type ExpenseStatus,
  type TaskState,
  type VendorCategory,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

import { assertWeddingAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError, notFound } from '../errors';

type TaskRow = {
  id: string;
  label: string;
  due_date: Date | null;
  vendor_id: string | null;
  vendor_label: string | null;
  state_override: TaskState | null;
};

const day = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

/**
 * 기본 열넷을 깔아준다.
 *
 * **처음 목록을 볼 때 한 번만.** 사용자가 지운 항목을 다시 깔면, 지우는 일이
 * 아무 뜻이 없어진다. 그래서 "비어 있으면"이 조건이지 "빠진 것이 있으면"이 아니다.
 */
async function seedPresets(pool: Pool, weddingId: string): Promise<void> {
  const existing = await pool.query('SELECT 1 FROM structured.wedding_tasks WHERE wedding_id = $1', [
    weddingId,
  ]);

  if (existing.rows.length > 0) return;

  for (const preset of TASK_PRESETS) {
    await pool.query(
      `INSERT INTO structured.wedding_tasks (wedding_id, label, preset_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (wedding_id, preset_key) DO NOTHING`,
      [weddingId, preset.label, preset.key]
    );
  }
}

export function registerWeddingPlanRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  /* ------------------------------------------------------------------ */
  /* 웨딩 스케줄                                                          */
  /* ------------------------------------------------------------------ */

  app.get<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/tasks',
    auth,
    async (request) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);
      await seedPresets(context.pool, request.params.weddingId);

      const { rows } = await context.pool.query<TaskRow>(
        `SELECT id, label, due_date, vendor_id, vendor_label, state_override
         FROM structured.wedding_tasks
         WHERE wedding_id = $1
         ORDER BY due_date NULLS LAST, created_at`,
        [request.params.weddingId]
      );

      const shaped = rows.map((row) => ({
        dueDate: day(row.due_date),
        override: row.state_override,
        row,
      }));

      return {
        tasks: shaped.map(({ row, dueDate, override }) => {
          const resolved = resolveTaskState({ dueDate, override });

          return {
            id: row.id,
            label: row.label,
            dueDate,
            vendorId: row.vendor_id,
            vendorLabel: row.vendor_label,
            state: resolved.state,
            stateLabel: TASK_STATE_LABEL[resolved.state],
            manualState: resolved.manual,
          };
        }),
        // 화면이 세지 않는다. 두 곳에서 세면 언젠가 다른 수가 나온다.
        progress: taskProgress(shaped),
      };
    }
  );

  app.post<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/tasks',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = createWeddingTaskRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rows } = await context.pool.query<{ id: string }>(
        `INSERT INTO structured.wedding_tasks
           (wedding_id, label, due_date, vendor_id, vendor_label)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          request.params.weddingId,
          body.label,
          body.dueDate ?? null,
          body.vendorId ?? null,
          body.vendorLabel ?? null,
        ]
      );

      return reply.status(201).send({ taskId: rows[0]!.id });
    }
  );

  app.patch<{ Params: { weddingId: string; taskId: string } }>(
    '/v1/weddings/:weddingId/tasks/:taskId',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const body = updateWeddingTaskRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      /*
       * 보낸 칸만 고친다. 안 보낸 칸을 null로 지우면, 날짜만 바꾸려던 사람이
       * 업체까지 잃는다. `state`에 null을 보내면 자동 판정으로 되돌린다 — 그건
       * 지우는 것이 아니라 "직접 지정을 그만둔다"는 뜻이다.
       */
      const { rowCount } = await context.pool.query(
        `UPDATE structured.wedding_tasks SET
           due_date = CASE WHEN $3 THEN $4::date ELSE due_date END,
           vendor_id = CASE WHEN $5 THEN $6::uuid ELSE vendor_id END,
           vendor_label = CASE WHEN $7 THEN $8::text ELSE vendor_label END,
           state_override = CASE WHEN $9 THEN $10::task_state ELSE state_override END
         WHERE id = $1 AND wedding_id = $2`,
        [
          request.params.taskId,
          request.params.weddingId,
          body.dueDate !== undefined,
          body.dueDate ?? null,
          body.vendorId !== undefined,
          body.vendorId ?? null,
          body.vendorLabel !== undefined,
          body.vendorLabel ?? null,
          body.state !== undefined,
          body.state ?? null,
        ]
      );

      if (rowCount === 0) {
        throw notFound('일정');
      }

      return { ok: true };
    }
  );

  app.delete<{ Params: { weddingId: string; taskId: string } }>(
    '/v1/weddings/:weddingId/tasks/:taskId',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rowCount } = await context.pool.query(
        'DELETE FROM structured.wedding_tasks WHERE id = $1 AND wedding_id = $2',
        [request.params.taskId, request.params.weddingId]
      );

      if (rowCount === 0) {
        throw notFound('일정');
      }

      return reply.status(204).send();
    }
  );

  /* ------------------------------------------------------------------ */
  /* 지출내역                                                            */
  /* ------------------------------------------------------------------ */

  app.get<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/expenses',
    auth,
    async (request) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rows } = await context.pool.query<{
        id: string;
        label: string;
        amount: string;
        category: VendorCategory | null;
        status: ExpenseStatus;
        spent_on: Date | null;
        source: ExpenseSource;
        refund_status: ExpenseRefundStatus;
      }>(
        `SELECT id, label, amount, category, status, spent_on, source, refund_status
         FROM structured.wedding_expenses
         WHERE wedding_id = $1
         ORDER BY spent_on DESC NULLS LAST`,
        [request.params.weddingId]
      );

      const expenses = rows.map((row) => ({
        id: row.id,
        label: row.label,
        amount: Number(row.amount),
        category: row.category,
        bucket: bucketFor(row.category),
        status: row.status,
        statusLabel: EXPENSE_STATUS_LABEL[row.status],
        spentOn: day(row.spent_on),
        source: row.source,
        sourceLabel: EXPENSE_SOURCE_LABEL[row.source],
        refundStatus: row.refund_status,
        refundStatusLabel: EXPENSE_REFUND_STATUS_LABEL[row.refund_status],
      }));

      const summary = summarizeExpenses(expenses);

      const wedding = await context.pool.query<{ budget_amount: string | null }>(
        'SELECT budget_amount FROM structured.weddings WHERE id = $1',
        [request.params.weddingId]
      );

      const budget = wedding.rows[0]?.budget_amount;

      return {
        paidTotal: summary.paidTotal,
        // 낸 돈과 낼 돈이 다른 필드다. 합쳐 보내면 화면이 더할 여지가 남는다.
        scheduledTotal: summary.scheduledTotal,
        scheduledNote: SCHEDULED_NOTE,
        buckets: summary.buckets,
        budget: budgetView({
          budget: budget === null || budget === undefined ? null : Number(budget),
          spent: summary.paidTotal,
        }),
        expenses,
      };
    }
  );

  app.post<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/expenses',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = createExpenseRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rows } = await context.pool.query<{ id: string }>(
        `INSERT INTO structured.expenses
           (wedding_id, label, amount, category, status, spent_on, added_by)
         VALUES ($1, $2, $3, $4::vendor_category, $5::expense_status, $6, $7)
         RETURNING id`,
        [
          request.params.weddingId,
          body.label,
          body.amount,
          body.category ?? null,
          body.status,
          body.spentOn ?? null,
          userId,
        ]
      );

      return reply.status(201).send({ expenseId: rows[0]!.id });
    }
  );

  /**
   * 직접 입력한 항목만 지울 수 있다.
   *
   * 결제인증에서 온 줄은 여기서 지우지 않는다 — 그건 지출 기록이 아니라 제보이고,
   * 지우면 남의 분포에서도 빠진다. 제보를 무르는 것은 다른 문이어야 한다.
   */
  app.delete<{ Params: { weddingId: string; expenseId: string } }>(
    '/v1/weddings/:weddingId/expenses/:expenseId',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rowCount } = await context.pool.query(
        'DELETE FROM structured.expenses WHERE id = $1 AND wedding_id = $2',
        [request.params.expenseId, request.params.weddingId]
      );

      if (rowCount === 0) {
        throw notFound('지출 항목');
      }

      return reply.status(204).send();
    }
  );

  /**
   * 지출 상세. WP-OUR-010.
   *
   * 결제인증(payment_proofs)과 직접 입력(expenses)은 다른 표라, wedding_expenses
   * 뷰를 거치지 않고 두 표를 차례로 본다 — 환불 상태·분할 결제·등록자는 직접
   * 입력에만 있어서, 뷰 하나로는 결이 다른 두 값을 깔끔히 못 담는다.
   */
  app.get<{ Params: { weddingId: string; expenseId: string } }>(
    '/v1/weddings/:weddingId/expenses/:expenseId',
    auth,
    async (request) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const manual = await context.pool.query<{
        id: string;
        label: string;
        amount: string;
        category: VendorCategory | null;
        status: ExpenseStatus;
        spent_on: Date | null;
        refund_status: ExpenseRefundStatus;
        added_by: string | null;
        created_at: Date;
      }>(
        `SELECT id, label, amount, category, status, spent_on, refund_status, added_by, created_at
         FROM structured.expenses
         WHERE id = $1 AND wedding_id = $2`,
        [request.params.expenseId, request.params.weddingId]
      );

      if (manual.rows.length > 0) {
        const row = manual.rows[0]!;
        const bucket = bucketFor(row.category);

        const splits = await context.pool.query<{
          id: string;
          seq: number;
          label: string;
          amount: string;
          paid_on: Date | null;
        }>(
          `SELECT id, seq, label, amount, paid_on
           FROM structured.expense_split_payments
           WHERE expense_id = $1
           ORDER BY seq`,
          [row.id]
        );

        return {
          id: row.id,
          label: row.label,
          amount: Number(row.amount),
          category: row.category,
          bucket,
          bucketLabel: EXPENSE_BUCKET_LABEL[bucket],
          status: row.status,
          statusLabel: EXPENSE_STATUS_LABEL[row.status],
          spentOn: day(row.spent_on),
          source: 'manual' as const,
          sourceLabel: EXPENSE_SOURCE_LABEL.manual,
          refundStatus: row.refund_status,
          refundStatusLabel: EXPENSE_REFUND_STATUS_LABEL[row.refund_status],
          registeredByPartner: row.added_by !== null && row.added_by !== userId,
          registeredAt: row.created_at.toISOString(),
          splitPayments: splits.rows.map((split) => ({
            id: split.id,
            seq: split.seq,
            label: split.label,
            amount: Number(split.amount),
            paidOn: day(split.paid_on),
          })),
        };
      }

      // 직접 입력이 아니면 결제인증에서 온 줄인지 본다.
      const proof = await context.pool.query<{
        id: string;
        label: string;
        amount: string;
        category: VendorCategory | null;
        paid_on: Date;
        reporter_user_id: string;
        created_at: Date;
      }>(
        `SELECT p.id, coalesce(v.name, p.merchant_name) AS label, p.paid_amount AS amount,
                v.category, p.paid_at::date AS paid_on, p.reporter_user_id, p.created_at
         FROM structured.payment_proofs p
         JOIN structured.weddings w
           ON w.owner_user_id = p.reporter_user_id OR w.partner_user_id = p.reporter_user_id
         LEFT JOIN structured.vendors v ON v.id = p.vendor_id
         WHERE p.id = $1 AND w.id = $2`,
        [request.params.expenseId, request.params.weddingId]
      );

      if (proof.rows.length === 0) {
        throw notFound('지출 항목');
      }

      const row = proof.rows[0]!;
      const bucket = bucketFor(row.category);

      return {
        id: row.id,
        label: row.label,
        amount: Number(row.amount),
        category: row.category,
        bucket,
        bucketLabel: EXPENSE_BUCKET_LABEL[bucket],
        status: 'paid' as const,
        statusLabel: EXPENSE_STATUS_LABEL.paid,
        spentOn: day(row.paid_on),
        source: 'payment_proof' as const,
        sourceLabel: EXPENSE_SOURCE_LABEL.payment_proof,
        // 결제인증 표는 아직 환불을 추적하지 않는다 — 늘 정상으로 고정한다.
        refundStatus: 'normal' as const,
        refundStatusLabel: EXPENSE_REFUND_STATUS_LABEL.normal,
        registeredByPartner: row.reporter_user_id !== userId,
        registeredAt: row.created_at.toISOString(),
        // 결제인증 표에는 분할 결제 개념이 없다.
        splitPayments: [],
      };
    }
  );

  /**
   * 환불 상태만 고친다. 직접 입력한 항목만 — 결제인증에서 온 줄은 이 문으로
   * 고치지 않는다(삭제와 같은 이유). v1 범위: 분할 결제 줄 편집은 아직 없다.
   */
  app.patch<{ Params: { weddingId: string; expenseId: string } }>(
    '/v1/weddings/:weddingId/expenses/:expenseId',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const body = updateExpenseRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rowCount } = await context.pool.query(
        `UPDATE structured.expenses SET refund_status = $3
         WHERE id = $1 AND wedding_id = $2`,
        [request.params.expenseId, request.params.weddingId, body.refundStatus]
      );

      if (rowCount === 0) {
        throw notFound('지출 항목');
      }

      return { ok: true };
    }
  );

  app.put<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/budget',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const body = setBudgetRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      await context.pool.query('UPDATE structured.weddings SET budget_amount = $2 WHERE id = $1', [
        request.params.weddingId,
        body.budget,
      ]);

      return { budget: body.budget };
    }
  );

  /* ------------------------------------------------------------------ */
  /* 방문노트                                                            */
  /* ------------------------------------------------------------------ */

  app.get<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/visit-notes',
    auth,
    async (request) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rows } = await context.pool.query<{
        id: string;
        vendor_id: string | null;
        vendor_label: string;
        visited_on: Date;
        quoted_amount: string | null;
        memo: string | null;
      }>(
        `SELECT id, vendor_id, vendor_label, visited_on, quoted_amount, memo
         FROM structured.visit_notes
         WHERE wedding_id = $1
         ORDER BY visited_on DESC`,
        [request.params.weddingId]
      );

      return {
        notes: rows.map((row) => ({
          id: row.id,
          vendorId: row.vendor_id,
          vendorLabel: row.vendor_label,
          visitedOn: day(row.visited_on)!,
          quotedAmount: row.quoted_amount === null ? null : Number(row.quoted_amount),
          memo: row.memo,
        })),
        caveat:
          '제안금액은 방문했을 때 들으신 값입니다. 계약 금액이 아니고, 다른 분들이 보는 가격에도 들어가지 않습니다.',
      };
    }
  );

  app.post<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/visit-notes',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = createVisitNoteRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rows } = await context.pool.query<{ id: string }>(
        `INSERT INTO structured.visit_notes
           (wedding_id, vendor_id, vendor_label, visited_on, quoted_amount, memo, added_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          request.params.weddingId,
          body.vendorId ?? null,
          body.vendorLabel,
          body.visitedOn,
          body.quotedAmount ?? null,
          body.memo ?? null,
          userId,
        ]
      );

      return reply.status(201).send({ noteId: rows[0]!.id });
    }
  );

  app.delete<{ Params: { weddingId: string; noteId: string } }>(
    '/v1/weddings/:weddingId/visit-notes/:noteId',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rowCount } = await context.pool.query(
        'DELETE FROM structured.visit_notes WHERE id = $1 AND wedding_id = $2',
        [request.params.noteId, request.params.weddingId]
      );

      if (rowCount === 0) {
        throw notFound('방문노트');
      }

      return reply.status(204).send();
    }
  );

  /* ------------------------------------------------------------------ */
  /* 메모                                                                 */
  /* ------------------------------------------------------------------ */

  app.get<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/notes',
    auth,
    async (request) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rows } = await context.pool.query<{
        id: string;
        vendor_id: string | null;
        vendor_label: string | null;
        body: string;
        author_user_id: string;
        edited_by_user_id: string | null;
        version: number;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT id, vendor_id, vendor_label, body, author_user_id, edited_by_user_id,
                version, created_at, updated_at
         FROM structured.wedding_notes
         WHERE wedding_id = $1
         ORDER BY created_at DESC`,
        [request.params.weddingId]
      );

      return {
        notes: rows.map((row) => {
          const edited = row.updated_at.getTime() !== row.created_at.getTime();

          return {
            id: row.id,
            vendorId: row.vendor_id,
            vendorLabel: row.vendor_label,
            body: row.body,
            authoredByPartner: row.author_user_id !== userId,
            edited,
            editedByPartner: edited
              ? row.edited_by_user_id !== null && row.edited_by_user_id !== userId
              : null,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString(),
            version: row.version,
          };
        }),
      };
    }
  );

  app.post<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/notes',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);
      const body = createWeddingNoteRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rows } = await context.pool.query<{ id: string }>(
        `INSERT INTO structured.wedding_notes
           (wedding_id, vendor_id, vendor_label, body, author_user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          request.params.weddingId,
          body.vendorId ?? null,
          body.vendorLabel ?? null,
          body.body,
          userId,
        ]
      );

      return reply.status(201).send({ noteId: rows[0]!.id });
    }
  );

  /**
   * 고치기. **동시 수정 충돌**을 여기서 판정한다.
   *
   * 클라이언트가 마지막으로 본 version을 함께 보낸다. 그 값이 지금 저장된
   * version과 다르면 배우자가 그 사이에 먼저 고친 것이다 — 그대로 덮어쓰면
   * 배우자의 수정이 조용히 사라지므로, conflict를 돌려주고 화면이 결론을
   * 내리게 한다(WP-CPL-005 conflict 화면).
   */
  app.patch<{ Params: { weddingId: string; noteId: string } }>(
    '/v1/weddings/:weddingId/notes/:noteId',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const body = updateWeddingNoteRequestSchema.parse(request.body);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      /*
       * version을 WHERE 절에 같이 걸어 한 문장으로 판정한다. SELECT로 먼저
       * 읽고 나중에 UPDATE하면 그 사이에 배우자가 끼어드는 경우를 못 잡는다
       * — 두 요청이 같은 version을 보고 둘 다 통과해버릴 수 있다.
       */
      const { rowCount } = await context.pool.query(
        `UPDATE structured.wedding_notes SET
           body = $4,
           edited_by_user_id = $5,
           version = version + 1,
           updated_at = now()
         WHERE id = $1 AND wedding_id = $2 AND version = $3`,
        [request.params.noteId, request.params.weddingId, body.version, body.body, userId]
      );

      if (rowCount === 0) {
        const { rows } = await context.pool.query<{ version: number }>(
          'SELECT version FROM structured.wedding_notes WHERE id = $1 AND wedding_id = $2',
          [request.params.noteId, request.params.weddingId]
        );

        if (!rows[0]) {
          throw notFound('메모');
        }

        throw new ApiError('conflict', '배우자가 먼저 이 메모를 고쳤어요.');
      }

      return { ok: true };
    }
  );

  app.delete<{ Params: { weddingId: string; noteId: string } }>(
    '/v1/weddings/:weddingId/notes/:noteId',
    auth,
    async (request, reply) => {
      const userId = currentUserId(request);

      await assertWeddingAccess(context.pool, request.params.weddingId, userId);

      const { rowCount } = await context.pool.query(
        'DELETE FROM structured.wedding_notes WHERE id = $1 AND wedding_id = $2',
        [request.params.noteId, request.params.weddingId]
      );

      if (rowCount === 0) {
        throw notFound('메모');
      }

      return reply.status(204).send();
    }
  );
}
