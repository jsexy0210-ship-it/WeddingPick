import type { ExpenseSummaryResponse, WeddingEvent, WeddingTask } from '@weddingpick/api-contract';
import React from 'react';
import { AccessibilityInfo, TextInput } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import {
  addExpense,
  getCurrentUser,
  getExpenses,
  listPublicHolidays,
  listWeddingEvents,
  listWeddingTasks,
  removeWeddingEvent,
  removeWeddingTask,
  updateExpense,
  updateWeddingEvent,
  updateWeddingTask,
} from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import AddExpenseRoute from '@/app/(tabs)/wedding/[id]/expenses/add';
import AddWeddingEventRoute from '@/app/(tabs)/wedding/[id]/events/new';

/**
 * 2026-09-26 대표 지시 — 웨딩노트 수정 시트 둘.
 *
 *   예산 추가 · 수정 시트   «낸 금액»을 만원 단위로 받는다(칸 오른쪽 «만원» · 저장 × 10,000)
 *   일정 추가 시트 수정 모드 타임라인 줄의 수정 아이콘이 값이 채워진 채 연다(일정 · 할 일) · 삭제는 OS 확인창
 */

let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/api/client', () => ({
  addExpense: jest.fn(),
  getCurrentUser: jest.fn(),
  getExpenses: jest.fn(),
  listPublicHolidays: jest.fn(),
  listWeddingEvents: jest.fn(),
  listWeddingTasks: jest.fn(),
  removeExpense: jest.fn(),
  removeWeddingEvent: jest.fn(),
  removeWeddingTask: jest.fn(),
  updateExpense: jest.fn(),
  updateWeddingEvent: jest.fn(),
  updateWeddingTask: jest.fn(),
  addWeddingEvent: jest.fn(),
}));
jest.mock('@/app/(tabs)/wedding/index', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/confirm-alert', () => ({ confirmAlert: jest.fn() }));
jest.mock('@/features/common/bottom-sheet', () => ({
  BottomSheet: 'BottomSheet',
  SheetPanel: 'SheetPanel',
  SheetHeader: 'SheetHeader',
}));
jest.mock('@/features/common/os-picker-field', () => ({ OsDateField: 'OsDateField', OsTimeField: 'OsTimeField' }));
jest.mock('@/features/wedding/expense-add-chooser', () => ({ ExpenseAddChooser: 'ExpenseAddChooser' }));
jest.mock('@/features/navigation/depth-back', () => ({ dismissToOrReplace: jest.fn() }));
jest.mock('@/features/navigation/result-toast', () => ({ showResultToast: jest.fn() }));
jest.mock('@/features/common/os-toast', () => ({ showOsToast: jest.fn() }));

type Button = { text: string; style?: string; onPress?: () => void };

function expense(overrides: Partial<ExpenseSummaryResponse['expenses'][number]> = {}) {
  return {
    id: 'e-1',
    label: '드레스',
    amount: 1_500_500,
    category: 'dress',
    bucket: 'sdm',
    status: 'paid',
    statusLabel: '지출완료',
    spentOn: '2026-09-10',
    source: 'manual',
    sourceLabel: '직접 입력',
    refundStatus: 'normal',
    refundStatusLabel: '정상',
    ...overrides,
  } as ExpenseSummaryResponse['expenses'][number];
}

function page(rows: ExpenseSummaryResponse['expenses']): ExpenseSummaryResponse {
  return {
    paidTotal: rows.reduce((sum, row) => sum + row.amount, 0),
    scheduledTotal: 0,
    scheduledNote: '',
    buckets: [],
    budget: { set: false, note: '예산을 정하지 않았어요' },
    budgetBracket: null,
    expenses: rows,
  } as unknown as ExpenseSummaryResponse;
}

let view: ReactTestRenderer | null = null;

async function mount(element: React.ReactElement) {
  await act(async () => {
    view = create(element);
  });
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

function amountInput(): ReactTestInstance {
  return view!.root.findAll((node) => node.type === TextInput && node.props.accessibilityLabel === '낸 금액')[0]!;
}

function texts(): string[] {
  return view!.root
    .findAll((node) => typeof node.props.children === 'string')
    .map((node) => node.props.children as string);
}

function button(label: string): ReactTestInstance {
  /* ActionButton · FilterChip 둘 다 `label` · `onPress`를 받는다 — 그 컴포넌트 자리를 찾는다. */
  return view!.root.find((node) => node.props.label === label && typeof node.props.onPress === 'function');
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
  jest.mocked(getCurrentUser).mockResolvedValue({} as never);
  jest.mocked(listPublicHolidays).mockResolvedValue({ holidays: [] } as never);
});

afterEach(async () => {
  if (view) await act(async () => view!.unmount());
  view = null;
});

describe('예산 추가 시트 — 낸 금액 만원 단위', () => {
  it('숫자 키패드 · 칸 오른쪽 «만원» · 저장할 때 × 10,000(원)으로 보낸다', async () => {
    mockParams = { id: 'w-1', mode: 'manual' };
    jest.mocked(getExpenses).mockResolvedValue(page([]));
    jest.mocked(addExpense).mockResolvedValue({ expenseId: 'e-new' });
    await mount(<AddExpenseRoute />);

    const input = amountInput();
    expect(input.props.keyboardType).toBe('number-pad');
    expect(texts()).toContain('만원');

    await act(async () => button('드레스').props.onPress());
    await act(async () => amountInput().props.onChangeText('150'));
    expect(amountInput().props.value).toBe('150');
    /* 칸 아래 한 줄 — 실제로 저장될 원 금액. */
    expect(texts()).toContain('1,500,000원');

    await act(async () => button('지출 넣기').props.onPress());
    expect(addExpense).toHaveBeenCalledWith('w-1', expect.objectContaining({ amount: 1_500_000, category: 'dress' }));
  });

  it('천 단위 쉼표 · 7자리 한도 · 숫자 아닌 글자는 버린다', async () => {
    mockParams = { id: 'w-1', mode: 'manual' };
    jest.mocked(getExpenses).mockResolvedValue(page([]));
    await mount(<AddExpenseRoute />);

    await act(async () => amountInput().props.onChangeText('12a3456789'));
    expect(amountInput().props.value).toBe('1,234,567');
  });

  it('수정 — 원래 금액 ÷ 10,000으로 채우고, 만원 아래 끝자리는 칸을 안 건드리면 그대로 둔다', async () => {
    mockParams = { id: 'w-1', expenseId: 'e-1' };
    jest.mocked(getExpenses).mockResolvedValue(page([expense({ amount: 1_500_500 })]));
    jest.mocked(updateExpense).mockResolvedValue(undefined);
    await mount(<AddExpenseRoute />);

    expect(amountInput().props.value).toBe('150');
    expect(texts()).toContain('1,500,500원');
    /* 아무것도 안 바꿨으면 저장 단추가 잠겨 있다 — 끝자리 500원이 조용히 사라지지 않는다. */
    expect(button('변경 내용 저장').props.disabled).toBe(true);

    await act(async () => amountInput().props.onChangeText('160'));
    expect(texts()).toContain('1,600,000원');
    await act(async () => button('변경 내용 저장').props.onPress());
    expect(updateExpense).toHaveBeenCalledWith('w-1', 'e-1', expect.objectContaining({ amount: 1_600_000 }));
  });

  it('수정 — 딱 떨어지는 금액은 만원 몫 그대로', async () => {
    mockParams = { id: 'w-1', expenseId: 'e-1' };
    jest.mocked(getExpenses).mockResolvedValue(page([expense({ amount: 5_000_000 })]));
    await mount(<AddExpenseRoute />);
    expect(amountInput().props.value).toBe('500');
  });
});

function event(overrides: Partial<WeddingEvent> = {}): WeddingEvent {
  return {
    id: 'ev-1',
    title: '리엔헤어메이크업 상담',
    startsAt: new Date(2026, 9, 3, 20, 50).toISOString(),
    location: null,
    vendorId: 'v-1',
    vendorLabel: '리엔헤어메이크업',
    memo: null,
    notifyEnabled: true,
    source: 'manual',
    status: 'upcoming',
    ...overrides,
  };
}

function task(overrides: Partial<WeddingTask> = {}): WeddingTask {
  return {
    id: 't-1',
    label: '예복 맞춤',
    dueDate: null,
    vendorId: null,
    vendorLabel: null,
    state: 'upcoming',
    stateLabel: '예정',
    manualState: false,
    ...overrides,
  };
}

describe('일정 수정 시트 — 타임라인 줄의 수정 아이콘', () => {
  it('상담 일정 — 날짜 · 제목 · 시간 · 알림을 채워 열고 PATCH /events로 저장한다', async () => {
    mockParams = { id: 'w-1', eventId: 'ev-1' };
    jest.mocked(listWeddingEvents).mockResolvedValue({ events: [event()] });
    jest.mocked(updateWeddingEvent).mockResolvedValue(undefined);
    await mount(<AddWeddingEventRoute />);

    const header = view!.root.findByType('SheetHeader' as never);
    expect(header.props.title).toBe('일정 수정');
    const date = view!.root.findByType('OsDateField' as never);
    const time = view!.root.findByType('OsTimeField' as never);
    expect(date.props.value).toBe('2026-10-03');
    expect(date.props.min).toBeUndefined();
    expect(time.props.value).toBe('20:50');
    const title = view!.root.findAll((node) => node.type === TextInput && node.props.accessibilityLabel === '제목')[0]!;
    expect(title.props.value).toBe('리엔헤어메이크업 상담');

    /* 안 바꿨으면 저장이 잠겨 있다. */
    expect(button('변경 내용 저장').props.disabled).toBe(true);
    await act(async () => time.props.onChange('21:00'));
    await act(async () => button('변경 내용 저장').props.onPress());
    expect(updateWeddingEvent).toHaveBeenCalledWith(
      'w-1',
      'ev-1',
      expect.objectContaining({ title: '리엔헤어메이크업 상담', notifyEnabled: true, startsAt: new Date(2026, 9, 3, 21, 0).toISOString() })
    );
  });

  it('임시 날짜 할 일 — 보이던 임시 날짜로 채우고 시간 · 알림 칸은 없다 · 저장하면 진짜 날짜가 된다', async () => {
    mockParams = { id: 'w-1', taskId: 't-1', date: '2026-10-02' };
    jest.mocked(listWeddingTasks).mockResolvedValue({ tasks: [task()], progress: { done: 0, total: 1 } });
    jest.mocked(updateWeddingTask).mockResolvedValue(undefined);
    await mount(<AddWeddingEventRoute />);

    expect(view!.root.findByType('OsDateField' as never).props.value).toBe('2026-10-02');
    expect(view!.root.findAllByType('OsTimeField' as never)).toHaveLength(0);
    expect(texts()).not.toContain('하루 전에 알려주기');
    /* 임시 날짜는 서버에 없는 값 — 그대로 눌러도 «이 날짜로 정하기»라 저장이 켜져 있다. */
    expect(button('변경 내용 저장').props.disabled).toBe(false);

    await act(async () => button('변경 내용 저장').props.onPress());
    expect(updateWeddingTask).toHaveBeenCalledWith('w-1', 't-1', { label: '예복 맞춤', dueDate: '2026-10-02' });
  });

  it('시트 안 «삭제»는 OS 확인창으로 묻고 그 종류의 DELETE를 부른다', async () => {
    mockParams = { id: 'w-1', eventId: 'ev-1' };
    jest.mocked(listWeddingEvents).mockResolvedValue({ events: [event()] });
    jest.mocked(removeWeddingEvent).mockResolvedValue(undefined);
    await mount(<AddWeddingEventRoute />);

    await act(async () => button('삭제').props.onPress());
    const [title, body, buttons] = jest.mocked(confirmAlert).mock.calls[0] as unknown as [string, string, Button[]];
    expect(title).toBe('일정을 삭제할까요?');
    expect(body).toContain('"리엔헤어메이크업 상담"');
    expect(buttons.map((item) => item.style)).toEqual(['cancel', 'destructive']);
    expect(removeWeddingEvent).not.toHaveBeenCalled();
    await act(async () => buttons[1]!.onPress!());
    expect(removeWeddingEvent).toHaveBeenCalledWith('w-1', 'ev-1');
    expect(removeWeddingTask).not.toHaveBeenCalled();
  });
});
