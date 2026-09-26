import type { WeddingEvent, WeddingTask } from '@weddingpick/api-contract';
import { TASK_PRESETS, tentativeDueDate } from '@weddingpick/domain';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { tentativePlanItems, tentativeScheduleRows } from '@/features/home/schedule-view';

import { notePlanEntries } from './note-plan';
import { buildUpcomingTimelineGroups } from './timeline-groups';
import { TimelinePlanRow } from './timeline-plan-row';

declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('node:fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

const WEDDING = '2027-05-16';
/* 2026-09-26(토) 09:00. */
const NOW = new Date(2026, 8, 26, 9, 0, 0);
const TENTATIVE = '예식일 기준 임시 날짜';

function task(label: string, overrides: Partial<WeddingTask> = {}): WeddingTask {
  return {
    id: `task-${label}`,
    label,
    dueDate: null,
    vendorId: null,
    vendorLabel: null,
    state: 'upcoming',
    stateLabel: '예정',
    manualState: false,
    ...overrides,
  };
}

function event(title: string, startsAt: string): WeddingEvent {
  return {
    id: `event-${title}`,
    title,
    startsAt,
    location: null,
    vendorId: null,
    vendorLabel: null,
    memo: null,
    notifyEnabled: true,
    source: 'manual',
    status: 'upcoming',
  };
}

/** 2026-09-26 대표 지시 — 웨딩노트 «웨딩일정»은 할 일을 예식일에서 역산한 임시 날짜로 보여 준다. */
describe('웨딩노트 웨딩일정 — 임시 날짜 줄', () => {
  it('할 일을 못 읽었으면 기본 열셋 중 아직 안 지난 것을 모두 임시 날짜로 세운다', () => {
    const plans = notePlanEntries(null, [], WEDDING, NOW);
    const expected = TASK_PRESETS.map((preset) => ({ label: preset.label, due: tentativeDueDate(WEDDING, preset.label)! }))
      .filter((row) => row.due >= '2026-09-26');

    expect(plans).toHaveLength(expected.length);
    expect(plans.length).toBeGreaterThan(5); // 홈처럼 다섯 줄에서 자르지 않는다
    for (const plan of plans) {
      expect(plan.tentative).toBe(true);
      expect(plan.meta).toBe(TENTATIVE);
      expect(plan.date).toBe(tentativeDueDate(WEDDING, plan.title));
      /* 서버에 행이 없는 대신 세운 줄이라 고치거나 지울 수 없다. */
      expect(plan.editable).toBe(false);
    }
    expect(plans.map((plan) => plan.date)).toEqual([...plans.map((plan) => plan.date)].sort());
  });

  it('서버 할 일이 있으면 그 이름으로 역산하고, 날짜를 넣은 할 일은 진짜 날짜가 이긴다', () => {
    const plans = notePlanEntries(
      [
        task('드레스 투어'),
        task('웨딩홀 잔금 납부', { dueDate: '2027-05-01', vendorLabel: '청담 E 웨딩홀' }),
        task('청첩장 시안', { state: 'done', stateLabel: '완료' }),
      ],
      [],
      WEDDING,
      NOW
    );

    expect(plans).toEqual([
      { id: 'task-웨딩홀 잔금 납부', date: '2027-05-01', title: '웨딩홀 잔금 납부', meta: '청담 E 웨딩홀', tentative: false, editable: true },
      { id: 'task-드레스 투어', date: tentativeDueDate(WEDDING, '드레스 투어'), title: '드레스 투어', meta: TENTATIVE, tentative: true, editable: true },
    ]);
  });

  it('같은 이름의 일정을 직접 넣었으면 그 할 일 줄은 세우지 않는다', () => {
    const plans = notePlanEntries(
      [task('드레스 투어'), task('예복 맞춤')],
      [event('드레스 투어', '2026-10-03T05:00:00.000Z')],
      WEDDING,
      NOW
    );
    expect(plans.map((plan) => plan.title)).toEqual(['예복 맞춤']);
  });

  it('할 일을 다 지웠으면(읽었는데 비었으면) 기본 열셋을 다시 세우지 않는다', () => {
    expect(notePlanEntries([], [], WEDDING, NOW)).toEqual([]);
  });

  it('예식일을 모르면 역산하지 않는다', () => {
    expect(notePlanEntries([task('드레스 투어')], [], null, NOW)).toEqual([]);
  });

  it('홈과 같은 함수를 쓴다 — 홈은 다섯 줄, 웨딩노트는 전부', () => {
    const all = tentativePlanItems([], WEDDING, NOW, { fallbackLabels: TASK_PRESETS.map((p) => p.label) });
    expect(all.length).toBe(notePlanEntries(null, [], WEDDING, NOW).length);
    expect(tentativeScheduleRows([], WEDDING, NOW).length).toBeLessThanOrEqual(5);
    /* 홈 기본 다섯 줄 이름은 그대로 쓴다. */
    expect(tentativeScheduleRows([], WEDDING, NOW).every((row) => row.kind === 'dated' && row.meta === TENTATIVE)).toBe(true);
  });

  it('타임라인은 일정과 임시 줄을 날짜순으로 섞어 묶고 예식일을 맨 끝에 둔다', () => {
    const plans = notePlanEntries([task('드레스 투어'), task('혼인신고 서류')], [], WEDDING, NOW);
    const groups = buildUpcomingTimelineGroups([event('스튜디오 상담', '2026-09-28T05:00:00.000Z')], WEDDING, NOW, plans);

    const flat = groups.flatMap((group) => group.items.map((item) => item.kind));
    expect(flat).toEqual(['event', 'plan', 'plan', 'wedding']);
    const planItems = groups.flatMap((group) => group.items).filter((item) => item.kind === 'plan');
    expect(planItems.map((item) => (item.kind === 'plan' ? item.title : ''))).toEqual(['드레스 투어', '혼인신고 서류']);
  });

  it('임시 줄은 정본 tlItem 모양 — 「11.17(화)」 · 제목 · 「예식일 기준 임시 날짜」', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(
        <TimelinePlanRow plan={{ id: 'p', date: '2026-11-17', title: '드레스 투어', meta: TENTATIVE, tentative: true, editable: false }} />
      );
    });
    const texts = view.root
      .findAll((node) => typeof node.props.children === 'string')
      .map((node) => node.props.children as string);
    expect(texts).toEqual(expect.arrayContaining(['11.17(화)', '드레스 투어', TENTATIVE]));
    expect(view.root.findAllByProps({ testID: 'timeline-plan-tentative' }).length).toBeGreaterThan(0);
    act(() => view.unmount());
  });

  it('웨딩노트는 할 일을 읽어 타임라인에 넘긴다 — 저장하지 않는다', () => {
    const screen = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'wedding', 'index.tsx'), 'utf8');
    expect(screen).toContain('listWeddingTasks(weddingId)');
    expect(screen).toContain('notePlanEntries(tasks, events, weddingDate, now)');
    expect(screen).toContain("item.kind === 'plan'");
    const plan = readFileSync(join(__dirname, 'note-plan.ts'), 'utf8');
    expect(plan).not.toMatch(/updateWeddingTask|patchWeddingTask|createWeddingTask/);
  });
});
