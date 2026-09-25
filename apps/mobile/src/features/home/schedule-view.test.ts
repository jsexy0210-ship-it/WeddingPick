import type { WeddingTask } from '@weddingpick/api-contract';

import { scheduleRows } from './schedule-view';

const task = (id: string, label: string): WeddingTask => ({
  id, label, dueDate: null, vendorId: null, vendorLabel: null, state: 'upcoming', stateLabel: '예정', manualState: false,
});

describe('홈 웨딩일정 — 예식일 역산 임시 날짜(2026-09-25 대표 지시)', () => {
  const now = new Date('2026-09-25T00:00:00Z');

  it('날짜 넣은 일정이 없고 예식일을 알면 기본 줄에 임시 날짜를 붙여 가까운 순으로 보인다(지난 줄은 뺀다)', () => {
    // 2027-05-15 기준: 웨딩홀 계약 D-300 = 2026-07-19(지남) · 드레스 투어 D-180 = 2026-11-16 · 청첩장 시안 D-75 = 2027-03-01
    const rows = scheduleRows([task('a', '웨딩홀 계약'), task('b', '청첩장 시안'), task('c', '드레스 투어')], now, '2027-05-15');
    expect(rows.map((row) => row.kind)).toEqual(['dated', 'dated']);
    expect(rows.map((row) => row.title)).toEqual(['드레스 투어', '청첩장 시안']);
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

  it('임시 날짜가 이미 지난 줄은 빼고, 남는 게 없으면 번호 줄', () => {
    const rows = scheduleRows([task('a', '웨딩홀 계약')], now, '2026-10-01');
    expect(rows[0]!.kind).toBe('preset');
  });
});
