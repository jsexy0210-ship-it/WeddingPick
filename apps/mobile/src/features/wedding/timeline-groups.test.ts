import type { WeddingEvent } from '@weddingpick/api-contract';

import { buildUpcomingTimelineGroups } from './timeline-groups';

function event(id: string, startsAt: string): WeddingEvent {
  return {
    id,
    title: id,
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

/* 화요일 고정 — 일요일 시작 주 계산을 매번 같은 결과로 만든다. */
const NOW = new Date(2026, 8, 22, 9, 0, 0);

describe('buildUpcomingTimelineGroups', () => {
  it('오늘 이후 일정만 이번 주 · 다음 주 · 달 단위로 묶는다', () => {
    const groups = buildUpcomingTimelineGroups(
      [
        event('past', '2026-09-10T05:00:00.000Z'),
        event('this-week', '2026-09-23T05:00:00.000Z'),
        event('next-week', '2026-09-29T05:00:00.000Z'),
        event('far', '2026-11-14T05:00:00.000Z'),
      ],
      '2027-05-16',
      NOW
    );

    expect(groups.map((g) => g.title)).toEqual(['이번 주', '다음 주', '11월', '예식']);
    expect(groups[0]!.items).toHaveLength(1);
    expect(groups[0]!.items[0]).toMatchObject({ kind: 'event' });
    expect(groups.at(-1)).toMatchObject({ title: '예식', items: [{ kind: 'wedding', date: '2027-05-16' }] });
  });

  it('지난 일정은 어느 그룹에도 넣지 않는다', () => {
    const groups = buildUpcomingTimelineGroups([event('past', '2026-09-10T05:00:00.000Z')], '2027-05-16', NOW);
    expect(groups).toEqual([{ title: '예식', range: '', items: [{ event: null, kind: 'wedding', date: '2027-05-16' }] }]);
  });

  it('예식일에 이미 일정이 있으면 예식 줄을 따로 만들지 않는다', () => {
    const groups = buildUpcomingTimelineGroups([event('wedding-day', '2027-05-16T05:00:00.000Z')], '2027-05-16', NOW);
    expect(groups.filter((g) => g.title === '예식')).toHaveLength(0);
    expect(groups.some((g) => g.items.some((item) => item.kind === 'event' && item.event.id === 'wedding-day'))).toBe(
      true
    );
  });

  it('예식일이 없으면 예식 줄도, D-day 표시도 만들지 않는다', () => {
    const groups = buildUpcomingTimelineGroups([event('this-week', '2026-09-23T05:00:00.000Z')], null, NOW);
    expect(groups).toEqual([
      { title: '이번 주', range: '9.20~9.26', items: [{ event: expect.objectContaining({ id: 'this-week' }), kind: 'event' }] },
    ]);
  });

  it('일정이 없으면 빈 배열이다', () => {
    expect(buildUpcomingTimelineGroups([], null, NOW)).toEqual([]);
  });
});
