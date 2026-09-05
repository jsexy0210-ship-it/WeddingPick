import {
  EXPENSE_BUCKETS,
  EXPENSE_REFUND_STATUSES,
  EXPENSE_SOURCES,
  EXPENSE_STATUSES,
  TASK_STATES,
} from '@weddingpick/domain';
import { z } from 'zod';

import { amountSchema, dateSchema, idSchema, timestampSchema, vendorCategorySchema } from './common';

export const taskStateSchema = z.enum(TASK_STATES);
export const expenseSourceSchema = z.enum(EXPENSE_SOURCES);
export const expenseStatusSchema = z.enum(EXPENSE_STATUSES);
export const expenseBucketSchema = z.enum(EXPENSE_BUCKETS);
export const expenseRefundStatusSchema = z.enum(EXPENSE_REFUND_STATUSES);

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
  /** 정상/부분환불/전액취소. 결제인증에서 온 줄은 늘 normal이다. */
  refundStatus: expenseRefundStatusSchema,
  refundStatusLabel: z.string().min(1),
});

/** 분할 결제 한 줄. 직접 입력한 지출에만 있다 — 결제인증 줄은 늘 빈 배열이다. */
export const expenseSplitPaymentSchema = z.object({
  id: idSchema,
  seq: z.int().positive(),
  label: z.string().min(1),
  amount: amountSchema,
  paidOn: dateSchema.nullable(),
});

/**
 * 지출 상세. WP-OUR-010.
 *
 * 목록(expenseSchema)에 없는 것만 더한다 — 업종 이름표(bucketLabel), 누가
 * 등록했는지(registeredByPartner), 분할 결제 줄, 등록 시각.
 */
export const expenseDetailSchema = expenseSchema.extend({
  bucketLabel: z.string().min(1),
  /** 배우자가 등록했는지. 방문노트·후보의 addedByPartner와 같은 뜻이다. */
  registeredByPartner: z.boolean(),
  registeredAt: timestampSchema,
  splitPayments: z.array(expenseSplitPaymentSchema),
});

export const updateExpenseRequestSchema = z.object({
  refundStatus: expenseRefundStatusSchema,
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

/* -------------------------------------------------------------------------- */
/* 메모                                                                        */
/* -------------------------------------------------------------------------- */

export const weddingNoteSchema = z.object({
  id: idSchema,
  /** 업체에 매달린 메모면 값이 있다. 자유 메모면 둘 다 null. */
  vendorId: idSchema.nullable(),
  vendorLabel: z.string().nullable(),
  body: z.string().min(1),
  /** 배우자가 썼는지. */
  authoredByPartner: z.boolean(),
  /** 고친 적이 있는지. 규칙 — 작성자와 수정 여부를 항상 남긴다. */
  edited: z.boolean(),
  /** 고친 사람이 글쓴이와 다른 사람인지. 안 고쳤으면 null. */
  editedByPartner: z.boolean().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  /** 동시 수정 충돌 판정용. 고칠 때 그대로 되돌려 보낸다. */
  version: z.int().positive(),
});

export const weddingNoteListResponseSchema = z.object({
  notes: z.array(weddingNoteSchema),
});

export const createWeddingNoteRequestSchema = z.object({
  vendorId: idSchema.optional(),
  vendorLabel: z.string().trim().max(60).optional(),
  body: z.string().trim().min(1).max(1000),
});

/** 마지막으로 본 version을 함께 보낸다 — 배우자가 먼저 고쳤으면 conflict를 받는다. */
export const updateWeddingNoteRequestSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  version: z.int().positive(),
});

export type WeddingTask = z.infer<typeof weddingTaskSchema>;
export type WeddingTaskListResponse = z.infer<typeof weddingTaskListResponseSchema>;
export type CreateWeddingTaskRequest = z.infer<typeof createWeddingTaskRequestSchema>;
export type UpdateWeddingTaskRequest = z.infer<typeof updateWeddingTaskRequestSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type ExpenseSummaryResponse = z.infer<typeof expenseSummaryResponseSchema>;
export type CreateExpenseRequest = z.infer<typeof createExpenseRequestSchema>;
export type SetBudgetRequest = z.infer<typeof setBudgetRequestSchema>;
export type ExpenseSplitPayment = z.infer<typeof expenseSplitPaymentSchema>;
export type ExpenseDetail = z.infer<typeof expenseDetailSchema>;
export type UpdateExpenseRequest = z.infer<typeof updateExpenseRequestSchema>;
export type VisitNote = z.infer<typeof visitNoteSchema>;
export type VisitNoteListResponse = z.infer<typeof visitNoteListResponseSchema>;
export type CreateVisitNoteRequest = z.infer<typeof createVisitNoteRequestSchema>;
export type WeddingNote = z.infer<typeof weddingNoteSchema>;
export type WeddingNoteListResponse = z.infer<typeof weddingNoteListResponseSchema>;
export type CreateWeddingNoteRequest = z.infer<typeof createWeddingNoteRequestSchema>;
export type UpdateWeddingNoteRequest = z.infer<typeof updateWeddingNoteRequestSchema>;
