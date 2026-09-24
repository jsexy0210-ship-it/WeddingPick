import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { MyWeddingPrep } from './home-summary';
import { homePrepCards } from './prep-groups';
import { scheduleRows } from './schedule-view';
import { UpcomingSchedule } from './wedding-schedule';
import type { CategoryStatus } from './state';

jest.mock('./category-image', () => ({ CategoryImage: () => null }));

declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('node:fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('node:path') as { join: (...parts: string[]) => string };

const status = (
  category: CategoryStatus['category'],
  label: string,
  state: CategoryStatus['state'],
  pickCount = 0
): CategoryStatus => ({ category, label, state, pickCount, decidedName: null });

/**
 * WP-HOME-001~003 구조 — `docs/design/html/대메뉴_홈(로그인, 온보딩).dc.html`이 정본이다
 * (2026-09-23 v3.29 재구축). 「웨딩픽 추천」 섹션은 정본에 없어 뺐다 — 남기지 않는지를
 * 이 파일이 계속 지킨다.
 */
describe('WP-HOME-001 정본 구조(v3.29)', () => {
  const views: ReactTestRenderer[] = [];
  afterEach(() => act(() => views.splice(0).forEach((view) => view.unmount())));

  it('홈은 코랄 Hero 다음 내 웨딩 준비 · 웨딩일정 · 예산현황 · 웨딩 준비 팁 순서다', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'index.tsx'), 'utf8');
    const order = [
      source.indexOf('<Hero'),
      source.indexOf('<MyWeddingPrep'),
      source.indexOf('<UpcomingSchedule'),
      source.indexOf('<HomeBudget'),
      source.indexOf('웨딩 준비 팁</ThemedText>'),
    ];

    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(source).not.toContain('homeView({');
    expect(source).not.toContain('<Board');
    expect(source).not.toContain('<HomeRecommendations');
    expect(source).not.toContain('<PendingPreparation');
    /* 헤더는 벨 하나뿐이다 — 검색 아이콘을 다시 넣지 않는다. */
    expect(source).not.toContain('accessibilityLabel="검색"');
    expect(source).not.toContain("router.push('/search')");
  });

  it('내 웨딩 준비 4칸은 완료해도 사라지지 않는다', () => {
    const statuses = ['hall', 'studio', 'dress', 'makeup', 'hair', 'snap', 'bouquet', 'invitation', 'goods', 'dowry', 'honeymoon']
      .map((category) => status(category as never, category, category === 'hall' ? 'decided' : 'before', category === 'studio' ? 2 : 0));
    const cards = homePrepCards({ statuses, venueName: null });

    let view!: ReactTestRenderer;
    act(() => {
      view = create(
        <MyWeddingPrep cards={cards} sub="지금은 스튜디오 차례예요" onOpen={jest.fn()} onMore={jest.fn()} />
      );
    });
    views.push(view);

    for (const label of ['웨딩홀', '스드메', '본식', '예물 · 신혼']) {
      expect(view.root.findAllByProps({ accessibilityLabel: label }).length).toBeGreaterThan(0);
    }
  });

  it('웨딩일정은 날짜 있는 일정을 가까운 순으로 최대 3건 보여준다', () => {
    const tasks = [
      { id: 'a', label: '본식 리허설', dueDate: '2099-10-04', vendorId: null, vendorLabel: '더채플 청담', state: 'upcoming' as const, stateLabel: '예정', manualState: false },
      { id: 'b', label: '드레스 피팅', dueDate: '2099-09-12', vendorId: null, vendorLabel: '그레이스 드레스', state: 'upcoming' as const, stateLabel: '예정', manualState: false },
    ];
    const rows = scheduleRows(tasks, new Date('2099-09-01'));
    expect(rows.map((row) => row.title)).toEqual(['드레스 피팅', '본식 리허설']);

    let view!: ReactTestRenderer;
    act(() => {
      view = create(<UpcomingSchedule rows={rows} hasDate onMore={jest.fn()} />);
    });
    views.push(view);

    expect(view.root.findAllByProps({ accessibilityLabel: '드레스 피팅' })).toHaveLength(0);
    expect(JSON.stringify(view.toJSON())).toContain('드레스 피팅');
  });
});
