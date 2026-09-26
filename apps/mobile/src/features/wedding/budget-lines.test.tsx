import type { ExpenseSummaryResponse, MyReport } from '@weddingpick/api-contract';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { removeWeddingEvent, removeWeddingTask } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';

import { BudgetCategoryList } from './budget-category-list';
import { budgetCategoryRows } from './budget-lines';
import { confirmDeleteTimelineItem, timelineEditHref } from './timeline-delete';
import { TimelinePlanRow } from './timeline-plan-row';

jest.mock('@/api/client', () => ({ removeWeddingEvent: jest.fn(), removeWeddingTask: jest.fn() }));

declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('node:fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };
jest.mock('@/components/confirm-alert', () => ({ confirmAlert: jest.fn() }));

type Expense = ExpenseSummaryResponse['expenses'][number];
type Button = { text: string; style?: string; onPress?: () => void };

let seq = 0;
function expense(category: Expense['category'], amount: number, overrides: Partial<Expense> = {}): Expense {
  seq += 1;
  return {
    id: `e-${seq}`,
    label: `지출 ${seq}`,
    amount,
    category,
    bucket: 'etc',
    status: 'paid',
    statusLabel: '지출완료',
    spentOn: '2026-09-20',
    source: 'manual',
    sourceLabel: '직접 입력',
    refundStatus: 'normal',
    refundStatusLabel: '정상',
    ...overrides,
  } as Expense;
}

const BUCKETS = [
  { bucket: 'hall', label: '웨딩홀', amount: 0, ratio: 0 },
  { bucket: 'sdm', label: '스드메', amount: 0, ratio: 0 },
  { bucket: 'etc', label: '기타', amount: 0, ratio: 0 },
] as ExpenseSummaryResponse['buckets'];

/**
 * 2026-09-26 대표 — 「예산 추가 시 입력한 카테고리별로 목록 화면에 예산 목록이 나오지 않는다」.
 * 원인: 카드가 서버 `buckets`(웨딩홀 · 스드메 · 기타 셋)를 그렸다 — 드레스는 스드메에, 본식스냅 · 부케 ·
 * 청첩장 …은 기타에 녹아 고른 이름이 안 보였다. 이제 고른 업종 그대로 줄을 세운다.
 */
describe('예산현황 업종 목록 — 입력한 업종이 그대로 줄이 된다', () => {
  it('고른 업종마다 한 줄 · 업종 순서 · 몫은 낸 돈 전체 대비', () => {
    const rows = budgetCategoryRows({
      buckets: BUCKETS,
      expenses: [
        expense('snap', 1_000_000),
        expense('dress', 3_000_000),
        expense('bouquet', 500_000),
        expense('dress', 1_000_000),
        expense('invitation', 500_000),
      ],
    });

    expect(rows.map((row) => [row.label, row.amount, row.expenses.length])).toEqual([
      ['드레스', 4_000_000, 2],
      ['본식스냅', 1_000_000, 1],
      ['부케', 500_000, 1],
      ['청첩장', 500_000, 1],
    ]);
    expect(rows[0]!.ratio).toBeCloseTo(4 / 6);
    expect(rows.reduce((sum, row) => sum + row.ratio, 0)).toBeCloseTo(1);
  });

  it('열한 업종을 하나씩 넣으면 열한 줄이 다 선다', () => {
    const categories = ['hall', 'studio', 'dress', 'makeup', 'hair', 'snap', 'bouquet', 'invitation', 'goods', 'dowry', 'honeymoon', 'etc'] as const;
    const rows = budgetCategoryRows({ buckets: BUCKETS, expenses: categories.map((category) => expense(category, 100_000)) });
    expect(rows.map((row) => row.key)).toEqual([...categories]);
  });

  it('업종 없는 줄 · 더는 고르지 않는 업종(결정사)은 «기타»로 · 잔금 예정은 빼고 센다', () => {
    const rows = budgetCategoryRows({
      buckets: BUCKETS,
      expenses: [
        expense(null, 200_000),
        expense('wedding_info_company', 300_000),
        expense('hall', 5_000_000, { status: 'scheduled', statusLabel: '지출예정' }),
      ],
    });
    expect(rows.map((row) => [row.label, row.amount, row.expenses.length])).toEqual([['기타', 500_000, 2]]);
  });

  it('지출이 하나도 없으면 서버 묶음 셋을 0원으로 세운다(빈 카드가 되지 않게)', () => {
    const rows = budgetCategoryRows({ buckets: BUCKETS, expenses: [] });
    expect(rows.map((row) => [row.label, row.amount, row.expenses.length])).toEqual([
      ['웨딩홀', 0, 0],
      ['스드메', 0, 0],
      ['기타', 0, 0],
    ]);
  });
});

describe('예산현황 업종 목록 — 지출내역 흡수 · 건마다 수정 · 삭제', () => {
  let view: ReactTestRenderer | null = null;
  afterEach(() => {
    if (view) act(() => view!.unmount());
    view = null;
  });

  const pending: MyReport = {
    id: 'p-1',
    kind: 'payment_proof',
    kindLabel: 'Pick 인증',
    use: '실 제보',
    subject: '확인 중인 자료',
    vendorId: null,
    amount: null,
    reportedAt: '2026-09-26T03:00:00.000Z',
    inUse: false,
    needsCheck: true,
    note: '사진에서 금액을 읽지 못했어요',
  } as MyReport;

  it('직접 넣은 건에만 아이콘 · Pick 인증 · 상담 정리 건은 잠금 · 0원 줄은 아이콘 없음 · «확인 중» 줄은 맨 위', () => {
    const manual = expense('dress', 1_500_000, { label: '드레스 예약금' });
    const proof = expense('hall', 10_000_000, { label: '청담 E 웨딩홀', source: 'payment_proof', sourceLabel: 'Pick 인증 자료' });
    const consult = expense('studio', 1_500_000, { label: '블루밍 스튜디오', source: 'consultation', sourceLabel: '상담 정리' });
    const rows = budgetCategoryRows({ buckets: BUCKETS, expenses: [manual, proof, consult] });
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onLocked = jest.fn();
    const onPending = jest.fn();

    act(() => {
      view = create(
        <BudgetCategoryList
          rows={rows}
          pending={[pending]}
          busy={false}
          onEdit={onEdit}
          onDelete={onDelete}
          onLocked={onLocked}
          onPending={onPending}
        />
      );
    });

    const edits = view!.root.findAll((node) => node.props.testID === 'expense-row-edit' && typeof node.props.onPress === 'function');
    const trashes = view!.root.findAll((node) => node.props.testID === 'expense-row-delete' && typeof node.props.onPress === 'function');
    expect(edits.map((node) => node.props.accessibilityLabel)).toEqual(['드레스 예약금 수정']);
    expect(trashes.map((node) => node.props.accessibilityLabel)).toEqual(['드레스 예약금 삭제']);

    act(() => edits[0]!.props.onPress());
    act(() => trashes[0]!.props.onPress());
    expect(onEdit).toHaveBeenCalledWith(manual);
    expect(onDelete).toHaveBeenCalledWith(manual);

    const locked = view!.root.find(
      (node) => node.props.accessibilityLabel === '청담 E 웨딩홀 1,000만원' && typeof node.props.onPress === 'function'
    );
    act(() => locked.props.onPress());
    expect(onLocked).toHaveBeenCalledWith(proof);

    /* 업종 줄 순서(웨딩홀 → 스튜디오 → 드레스)와 출처 배지. */
    const rowIds = view!.root
      .findAll((node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('budget-row-') && node.props.style)
      .map((node) => node.props.testID as string);
    expect([...new Set(rowIds)]).toEqual(['budget-row-hall', 'budget-row-studio', 'budget-row-dress']);
    const labels = view!.root.findAll((node) => typeof node.props.children === 'string').map((node) => node.props.children);
    expect(labels).toEqual(expect.arrayContaining(['Pick 인증', '상담 정리', '확인 중', '드레스', '스튜디오', '웨딩홀']));

    const pendingRow = view!.root.find((node) => node.props.testID === 'expense-pending-row' && typeof node.props.onPress === 'function');
    act(() => pendingRow.props.onPress());
    expect(onPending).toHaveBeenCalledWith(pending);
  });

  it('지출이 없는 0원 줄은 «아직 안 냈어요»만 · 아이콘 없음', () => {
    act(() => {
      view = create(
        <BudgetCategoryList
          rows={budgetCategoryRows({ buckets: BUCKETS, expenses: [] })}
          pending={[]}
          busy={false}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onLocked={jest.fn()}
          onPending={jest.fn()}
        />
      );
    });
    expect(view!.root.findAll((node) => node.props.testID === 'expense-row-edit')).toHaveLength(0);
    const labels = view!.root.findAll((node) => node.props.children === '아직 안 냈어요');
    expect(labels.length).toBeGreaterThanOrEqual(3);
  });
});

describe('웨딩일정 타임라인 — 줄마다 수정 · 삭제', () => {
  let view: ReactTestRenderer | null = null;
  afterEach(() => {
    if (view) act(() => view!.unmount());
    view = null;
    jest.clearAllMocks();
  });

  const plan = { id: 't-1', date: '2026-10-02', title: '예복 맞춤', meta: '예식일 기준 임시 날짜', tentative: true, editable: true };

  it('서버에 행이 있는 할 일 줄은 edit · trash 아이콘(44 칸)을 둔다 · 대신 세운 기본 줄은 없다', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    act(() => {
      view = create(<TimelinePlanRow plan={plan} onEdit={onEdit} onDelete={onDelete} />);
    });
    const edit = view!.root.find((node) => node.props.testID === 'timeline-row-edit' && typeof node.props.onPress === 'function');
    const trash = view!.root.find((node) => node.props.testID === 'timeline-row-delete' && typeof node.props.onPress === 'function');
    expect(edit.props.accessibilityLabel).toBe('예복 맞춤 수정');
    act(() => edit.props.onPress());
    act(() => trash.props.onPress());
    expect(onEdit).toHaveBeenCalledWith(plan);
    expect(onDelete).toHaveBeenCalledWith(plan);

    act(() => {
      view!.update(<TimelinePlanRow plan={{ ...plan, editable: false }} onEdit={onEdit} onDelete={onDelete} />);
    });
    expect(view!.root.findAll((node) => node.props.testID === 'timeline-row-edit')).toHaveLength(0);
  });

  it('수정 주소 — 일정은 eventId, 할 일은 taskId + 보이던 날짜', () => {
    expect(timelineEditHref('w-1', { kind: 'event', id: 'ev-1', title: 'x' })).toBe('/wedding/w-1/events/new?eventId=ev-1');
    expect(timelineEditHref('w-1', { kind: 'task', id: 't-1', title: 'x' }, '2026-10-02')).toBe(
      '/wedding/w-1/events/new?taskId=t-1&date=2026-10-02'
    );
  });

  it('삭제는 OS 확인창 뒤에 종류에 맞는 DELETE — 일정은 events, 할 일은 tasks', async () => {
    jest.mocked(removeWeddingEvent).mockResolvedValue(undefined);
    jest.mocked(removeWeddingTask).mockResolvedValue(undefined);
    const onDeleted = jest.fn();

    confirmDeleteTimelineItem({ weddingId: 'w-1', target: { kind: 'task', id: 't-1', title: '예복 맞춤' }, onDeleted, onError: jest.fn() });
    const [title, body, buttons] = jest.mocked(confirmAlert).mock.calls[0] as unknown as [string, string, Button[]];
    expect(title).toBe('일정을 삭제할까요?');
    expect(body).toBe('"예복 맞춤" 일정을 삭제합니다.');
    expect(removeWeddingTask).not.toHaveBeenCalled();
    await act(async () => buttons[1]!.onPress!());
    expect(removeWeddingTask).toHaveBeenCalledWith('w-1', 't-1');
    expect(removeWeddingEvent).not.toHaveBeenCalled();
    expect(onDeleted).toHaveBeenCalledTimes(1);

    confirmDeleteTimelineItem({ weddingId: 'w-1', target: { kind: 'event', id: 'ev-1', title: '상담' }, onDeleted, onError: jest.fn() });
    const second = jest.mocked(confirmAlert).mock.calls[1] as unknown as [string, string, Button[]];
    /* 취소는 아무것도 지우지 않는다. */
    expect(second[2][0]!.style).toBe('cancel');
    await act(async () => second[2][1]!.onPress!());
    expect(removeWeddingEvent).toHaveBeenCalledWith('w-1', 'ev-1');
  });
});

describe('웨딩노트 화면 연결', () => {
  const screen = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'wedding', 'index.tsx'), 'utf8');

  it('예산 카드는 업종 목록을 그리고 지출내역 풀팝업으로 가는 길이 없다', () => {
    expect(screen).toContain('const rows = budgetCategoryRows(expenses);');
    expect(screen).toContain('<BudgetCategoryList');
    expect(screen).not.toContain('/expenses/list` as never');
    expect(screen).not.toContain('expenses.buckets.map');
  });

  it('일정 줄(직접 넣은 일정 · 상담 일정)과 할 일 줄 모두 수정 · 삭제를 잇는다', () => {
    expect(screen).toMatch(/<ExpenseRowActions[\s\S]*?testIDPrefix="timeline-row"[\s\S]*?kind: 'event'/);
    expect(screen).toContain("onEdit={(plan) => onEdit({ kind: 'task', id: plan.id, title: plan.title }, plan.date)}");
    expect(screen).toContain('confirmDeleteTimelineItem({');
  });
});
