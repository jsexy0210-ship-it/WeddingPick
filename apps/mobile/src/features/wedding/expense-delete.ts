import type { ExpenseSummaryResponse } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';

import { removeExpense } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';

import { ourWedding as copy } from '../../../../../spec/strings.ko.json';

type Expense = ExpenseSummaryResponse['expenses'][number];

/** 직접 입력한 줄만 고치고 지울 수 있다 — Pick 인증 · 상담 정리 줄은 금액이 자료에서 왔다. */
export function isUserExpense(expense: Pick<Expense, 'source'>): boolean {
  return expense.source === 'manual';
}

/**
 * 지출 한 줄 삭제 — 무엇이 지워지는지 보여준 뒤 OS 확인창으로 한 번 더 묻고 DELETE.
 * 지출 수정 시트(`expenses/add.tsx` 수정 모드)와 지출내역 줄의 휴지통 아이콘이 같이 쓴다.
 * 직접 입력한 줄이 아니면 아무것도 하지 않는다.
 */
export function confirmDeleteExpense({
  weddingId,
  expense,
  onStart,
  onDeleted,
  onError,
  onSettled,
}: {
  weddingId: string;
  expense: Pick<Expense, 'id' | 'label' | 'amount' | 'source'>;
  onStart?: () => void;
  onDeleted: () => void;
  onError: (message: string) => void;
  onSettled?: () => void;
}): void {
  if (!isUserExpense(expense)) return;
  confirmAlert(
    copy['expense.deleteTitle'],
    copy['expense.deleteBody'].replace('{label}', expense.label).replace('{amount}', manwon(expense.amount)),
    [
      { text: '취소', style: 'cancel' },
      {
        text: copy['expense.delete'],
        style: 'destructive',
        onPress: () => {
          onStart?.();
          removeExpense(weddingId, expense.id)
            .then(onDeleted)
            .catch((caught: Error) => onError(caught.message))
            .finally(() => onSettled?.());
        },
      },
    ]
  );
}
