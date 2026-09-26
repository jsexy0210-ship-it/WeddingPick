import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { removeExpense } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';

import { confirmDeleteExpense, isUserExpense } from './expense-delete';
import { ExpenseRowActions } from './expense-row-actions';

jest.mock('@/api/client', () => ({ removeExpense: jest.fn() }));
jest.mock('@/components/confirm-alert', () => ({ confirmAlert: jest.fn() }));

declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('node:fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

const confirm = confirmAlert as unknown as jest.Mock;
const remove = removeExpense as unknown as jest.Mock;

type Button = { text: string; style?: string; onPress?: () => void };

/** 2026-09-26 대표 지시 — 지출내역의 직접 넣은 줄마다 수정 · 삭제 아이콘. */
describe('지출내역 줄 수정 · 삭제 아이콘', () => {
  let view: ReactTestRenderer | null = null;
  afterEach(() => {
    if (view) act(() => view!.unmount());
    view = null;
  });

  it('정본 edit · trash 아이콘을 44 × 44 누르는 칸에 둔다', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    act(() => {
      view = create(<ExpenseRowActions label="드레스" onEdit={onEdit} onDelete={onDelete} />);
    });

    const edit = view!.root.find((node) => node.props.testID === 'expense-row-edit' && typeof node.props.onPress === 'function');
    const trash = view!.root.find((node) => node.props.testID === 'expense-row-delete' && typeof node.props.onPress === 'function');
    expect(edit.props.accessibilityLabel).toBe('드레스 수정');
    expect(trash.props.accessibilityLabel).toBe('드레스 삭제');

    for (const target of [edit, trash]) {
      const style = StyleSheet.flatten(
        typeof target.props.style === 'function' ? target.props.style({ pressed: false }) : target.props.style
      );
      expect(style.width).toBeGreaterThanOrEqual(44);
      expect(style.height).toBeGreaterThanOrEqual(44);
    }

    const icons = view!.root.findAll((node) => typeof node.props.name === 'string' && node.props.size === 14);
    expect(icons.map((node) => node.props.name)).toEqual(expect.arrayContaining(['edit', 'trash']));

    act(() => edit.props.onPress());
    act(() => trash.props.onPress());
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('삭제는 OS 확인창으로 무엇이 지워지는지 보여준 뒤 DELETE한다', async () => {
    remove.mockResolvedValue({ ok: true });
    const onDeleted = jest.fn();
    const onError = jest.fn();

    confirmDeleteExpense({
      weddingId: 'w-1',
      expense: { id: 'e-1', label: '드레스', amount: 1_500_000, source: 'manual' },
      onDeleted,
      onError,
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    const [title, body, buttons] = confirm.mock.calls[0] as [string, string, Button[]];
    expect(title).toBe('지출을 삭제할까요?');
    expect(body).toContain('"드레스"');
    expect(body).toContain('150만원');
    expect(buttons.map((button) => button.style)).toEqual(['cancel', 'destructive']);
    expect(remove).not.toHaveBeenCalled();

    await act(async () => {
      buttons[1]!.onPress!();
    });
    expect(remove).toHaveBeenCalledWith('w-1', 'e-1');
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('Pick 인증 · 상담 정리 줄은 잠금 그대로 — 확인창도 DELETE도 없다', () => {
    for (const source of ['payment_proof', 'consultation'] as const) {
      expect(isUserExpense({ source })).toBe(false);
      confirmDeleteExpense({
        weddingId: 'w-1',
        expense: { id: 'e-2', label: '스튜디오', amount: 1_000_000, source },
        onDeleted: jest.fn(),
        onError: jest.fn(),
      });
    }
    expect(isUserExpense({ source: 'manual' })).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('예산 목록은 직접 넣은 건에만 아이콘을 그리고, 수정은 같은 수정 시트를 연다', () => {
    const list = readFileSync(join(__dirname, 'budget-category-list.tsx'), 'utf8');
    expect(list).toContain('const editable = isUserExpense(expense);');
    expect(list).toMatch(/\{editable \? \(\s*<ExpenseRowActions/);
    const screen = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'wedding', 'index.tsx'), 'utf8');
    expect(screen).toContain('/expenses/add?expenseId=${expenseId}');
    expect(screen).toContain('confirmDeleteExpense({');
    const sheet = readFileSync(
      join(__dirname, '..', '..', 'app', '(tabs)', 'wedding', '[id]', 'expenses', 'add.tsx'),
      'utf8'
    );
    expect(sheet).toContain('confirmDeleteExpense({');
  });
});
