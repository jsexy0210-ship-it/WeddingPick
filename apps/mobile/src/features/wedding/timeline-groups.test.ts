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

/* 화요일 고정 — 정본 WP-NOTE-001의 오늘(9.22 · D-236)과 같은 날이다. */
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
    // 정본 `tlGroups` 범위 — 월~일 주, 이번 주는 오늘부터. 정본 표본의 다음 주 「D-229」는
    // 7일씩 뺀 값이라(9.22가 D-236이면 9.28은 D-230) 계산값을 쓴다.
    expect(groups[0]!.range).toBe('9.22~9.27 · D-236');
    expect(groups[1]!.range).toBe('9.28~10.4 · D-230');
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
      { title: '이번 주', range: '9.22~9.27', items: [{ event: expect.objectContaining({ id: 'this-week' }), kind: 'event' }] },
    ]);
  });

  it('주의 마지막 날(일요일) 낮 일정도 그 주에 든다', () => {
    const groups = buildUpcomingTimelineGroups(
      [event('sunday-noon', new Date(2026, 8, 27, 11, 0).toISOString()), event('next-sunday', new Date(2026, 9, 4, 18, 0).toISOString())],
      null,
      NOW
    );
    expect(groups.map((g) => [g.title, g.items.length])).toEqual([
      ['이번 주', 1],
      ['다음 주', 1],
    ]);
  });

  /* 2026-09-26 대표 감사(운영에서 재현) — 예식이 이번 주 일요일이면 다음 주 구간이 「D--1」이었다. */
  it('구간 시작이 예식 뒤면 D+N으로 적고 부호를 겹치지 않는다', () => {
    const groups = buildUpcomingTimelineGroups(
      [
        event('today', new Date(2026, 8, 22, 18, 0).toISOString()),
        event('after', new Date(2026, 8, 29, 11, 0).toISOString()),
        event('month-after', new Date(2026, 10, 3, 11, 0).toISOString()),
      ],
      '2026-09-27',
      NOW
    );

    expect(groups[0]!.range).toBe('9.22~9.27 · D-5');
    expect(groups[1]!.range).toBe('9.28~10.4 · D+1');
    expect(groups[2]).toMatchObject({ title: '11월', range: 'D+37 구간' });
    for (const group of groups) expect(group.range).not.toContain('D--');
  });

  it('예식 당일이 구간 시작이면 D-DAY다', () => {
    const groups = buildUpcomingTimelineGroups([event('today', new Date(2026, 8, 22, 18, 0).toISOString())], '2026-09-22', NOW);
    expect(groups[0]!.range).toBe('9.22~9.27 · D-DAY');
  });

  it('일정이 없으면 빈 배열이다', () => {
    expect(buildUpcomingTimelineGroups([], null, NOW)).toEqual([]);
  });
});
