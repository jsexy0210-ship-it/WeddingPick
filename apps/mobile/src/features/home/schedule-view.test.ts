import type { WeddingTask } from '@weddingpick/api-contract';

import { scheduleRows } from './schedule-view';

const task = (id: string, label: string): WeddingTask => ({
  id, label, dueDate: null, vendorId: null, vendorLabel: null, state: 'upcoming', stateLabel: '예정', manualState: false,
});

describe('홈 웨딩일정 — 예식일 역산 임시 날짜(2026-09-25 대표 지시)', () => {
  const now = new Date('2026-09-25T00:00:00Z');

  it('예식일을 알면 지난 임시 날짜도 남겨 가까운 기한부터 보여 준다', () => {
    // 2027-05-15 기준: 웨딩홀 계약 2026-07-19(지난 기한) · 드레스 투어 2026-11-16 · 청첩장 시안 2027-03-01
    const rows = scheduleRows([task('a', '웨딩홀 계약'), task('b', '청첩장 시안'), task('c', '드레스 투어')], now, '2027-05-15');
    expect(rows.map((row) => row.kind)).toEqual(['dated', 'dated', 'dated']);
    expect(rows.map((row) => row.title)).toEqual(['드레스 투어', '웨딩홀 계약', '청첩장 시안']);
    expect(rows[0]!.meta).toBe('예식일 기준 임시 날짜');
  });

  it('할 일이 아직 없으면 홈 기본 다섯 줄로 역산한다', () => {
    const rows = scheduleRows([], now, '2027-09-25');
    expect(rows.every((row) => row.kind === 'dated')).toBe(true);
    expect(rows[0]!.title).toBe('상견례 날짜 정하기');
  });

  it('예식일을 모르면 번호 줄 그대로', () => {
    const rows = scheduleRows([task('a', '웨딩홀 계약')], now, null);
    expect(rows[0]!.kind).toBe('preset');
  });

  it('예식일이 가까워 임시 날짜가 모두 지나도 D+N으로 보인다', () => {
    const rows = scheduleRows([task('a', '웨딩홀 계약')], now, '2026-10-01');
    expect(rows[0]).toMatchObject({ kind: 'dated', title: '웨딩홀 계약' });
    expect(rows[0]!.kind === 'dated' && rows[0].dday).toMatch(/^D\+\d+$/);
  });

  it('실제 날짜와 임시 날짜를 합쳐 미완료 다섯 줄까지 보인다', () => {
    const tasks = [
      { ...task('actual', '청첩장 인쇄'), dueDate: '2026-09-28' },
      task('tentative', '웨딩홀 잔금 납부'),
    ];
    const rows = scheduleRows(tasks, now, '2026-09-30');
    expect(rows.map((row) => row.title)).toEqual(['웨딩홀 잔금 납부', '청첩장 인쇄']);
    expect(rows[0]!.kind === 'dated' && rows[0].dday).toBe('D+2');
    expect(rows[1]!.kind === 'dated' && rows[1].dday).toBe('D-3');
  });
});
