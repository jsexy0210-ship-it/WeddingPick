import {
  EXPENSE_BUCKETS,
  EXPENSE_SOURCES,
  EXPENSE_STATUSES,
  TASK_STATES,
} from '@weddingpick/domain';
import { z } from 'zod';

import { amountSchema, dateSchema, idSchema, vendorCategorySchema } from './common';

export const taskStateSchema = z.enum(TASK_STATES);
export const expenseSourceSchema = z.enum(EXPENSE_SOURCES);
export const expenseStatusSchema = z.enum(EXPENSE_STATUSES);
export const expenseBucketSchema = z.enum(EXPENSE_BUCKETS);

/* -------------------------------------------------------------------------- */
/* 웨딩 스케줄                                                                 */
/* -------------------------------------------------------------------------- */

export const weddingTaskSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  dueDate: dateSchema.nullable(),
  vendorId: idSchema.nullable(),
  vendorLabel: z.string().nullable(),
  /** 자동 판정이든 직접 지정이든 지금 상태. */
  state: taskStateSchema,
  stateLabel: z.string().min(1),
  /**
   * 사용자가 직접 정한 값인가.
   *
   * 화면이 "직접 지정"이라고 적는다 — 이 값은 날짜가 바뀌어도 안 따라간다는 것을
   * 보이게 하려는 것이다.
   */
  manualState: z.boolean(),
});

export const weddingTaskListResponseSchema = z.object({
  tasks: z.array(weddingTaskSchema),
  /** "준비 6 / 14 완료". 화면이 세지 않는다. */
  progress: z.object({ done: z.int().nonnegative(), total: z.int().nonnegative() }),
});

export const createWeddingTaskRequestSchema = z.object({
  label: z.string().trim().min(1).max(40),
  dueDate: dateSchema.optional(),
  vendorId: idSchema.optional(),
  vendorLabel: z.string().trim().max(60).optional(),
});

export const updateWeddingTaskRequestSchema = z.object({
  dueDate: dateSchema.nullable().optional(),
  vendorId: idSchema.nullable().optional(),
  vendorLabel: z.string().trim().max(60).nullable().optional(),
  /** null로 보내면 자동 판정으로 되돌린다. */
  state: taskStateSchema.nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* 지출내역                                                                    */
/* -------------------------------------------------------------------------- */

export const expenseSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  amount: amountSchema,
  category: vendorCategorySchema.nullable(),
  bucket: expenseBucketSchema,
  status: expenseStatusSchema,
  statusLabel: z.string().min(1),
  spentOn: dateSchema.nullable(),
  /** 어디서 온 값인지. 결제인증인지 직접 입력인지 줄마다 적는다. */
  source: expenseSourceSchema,
  sourceLabel: z.string().min(1),
});

/**
 * 지출 요약.
 *
 * `paidTotal`과 `scheduledTotal`이 **다른 필드다.** 합쳐 보내면 화면이 더할 여지가
 * 남고, 더하면 "지금까지 결제한 금액"이 거짓말이 된다.
 */
export const expenseSummaryResponseSchema = z.object({
  paidTotal: amountSchema,
  scheduledTotal: amountSchema,
  /** 아직 안 낸 돈이 있을 때 화면이 그대로 보여줄 말. */
  scheduledNote: z.string().min(1),
  buckets: z.array(
    z.object({
      bucket: expenseBucketSchema,
      label: z.string().min(1),
      amount: amountSchema,
      /** 0~1. 막대 길이. */
      ratio: z.number().min(0).max(1),
    })
  ),
  budget: z.discriminatedUnion('set', [
    z.object({ set: z.literal(false), note: z.string().min(1) }),
    z.object({
      set: z.literal(true),
      budget: amountSchema,
      spent: amountSchema,
      remaining: z.number(),
      over: z.boolean(),
    }),
  ]),
  expenses: z.array(expenseSchema),
});

export const createExpenseRequestSchema = z.object({
  label: z.string().trim().min(1).max(60),
  amount: amountSchema.refine((value) => value > 0, '금액을 적어주세요'),
  category: vendorCategorySchema.optional(),
  status: expenseStatusSchema.default('paid'),
  spentOn: dateSchema.optional(),
});

export const setBudgetRequestSchema = z.object({
  /** null로 보내면 예산을 지운다. */
  budget: amountSchema.nullable(),
});

/* -------------------------------------------------------------------------- */
/* 방문노트                                                                    */
/* -------------------------------------------------------------------------- */

export const visitNoteSchema = z.object({
  id: idSchema,
  vendorId: idSchema.nullable(),
  vendorLabel: z.string().min(1),
  visitedOn: dateSchema,
  /** 그 자리에서 들은 금액. **계약가가 아니라 제안가다.** */
  quotedAmount: amountSchema.nullable(),
  memo: z.string().nullable(),
});

export const visitNoteListResponseSchema = z.object({
  notes: z.array(visitNoteSchema),
  /** 제안가가 무엇인지 화면이 그대로 보여줄 문구. */
  caveat: z.string().min(1),
});

export const createVisitNoteRequestSchema = z.object({
  vendorId: idSchema.optional(),
  vendorLabel: z.string().trim().min(1).max(60),
  visitedOn: dateSchema,
  quotedAmount: amountSchema.optional(),
  memo: z.string().trim().max(1000).optional(),
});

export type WeddingTask = z.infer<typeof weddingTaskSchema>;
export type WeddingTaskListResponse = z.infer<typeof weddingTaskListResponseSchema>;
export type CreateWeddingTaskRequest = z.infer<typeof createWeddingTaskRequestSchema>;
export type UpdateWeddingTaskRequest = z.infer<typeof updateWeddingTaskRequestSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type ExpenseSummaryResponse = z.infer<typeof expenseSummaryResponseSchema>;
export type CreateExpenseRequest = z.infer<typeof createExpenseRequestSchema>;
export type SetBudgetRequest = z.infer<typeof setBudgetRequestSchema>;
export type VisitNote = z.infer<typeof visitNoteSchema>;
export type VisitNoteListResponse = z.infer<typeof visitNoteListResponseSchema>;
export type CreateVisitNoteRequest = z.infer<typeof createVisitNoteRequestSchema>;
