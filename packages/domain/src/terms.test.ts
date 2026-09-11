import { categoryReportLine, dataCaption, NOT_ENOUGH_DATA } from './terms';

/**
 * 검색 홈 업종 카드의 꼬리 한 줄 — WP-SRCH-001.
 *
 * 시안 `06-search.dc.html`이 «웨딩홀 · 실 제보 412건»을 그린다. 이 줄이 업체 수로
 * 채워지면 사용자는 그것을 「412명이 실제로 알려줬다」로 읽는다.
 */
describe('업종 카드의 실 제보 줄', () => {
  it('시안이 적은 그대로 «실 제보 N건»이다', () => {
    expect(categoryReportLine(412)).toBe('실 제보 412건');
  });

  it('0건을 «실 제보 0건»으로 적지 않는다', () => {
    // 시안에 없는 상태다. 0을 세어 보여주면 그 업종을 눌러볼 이유부터 지운다.
    expect(categoryReportLine(0)).toBe(NOT_ENOUGH_DATA);
    expect(categoryReportLine(0)).not.toContain('0건');
  });

  it('한 건이라도 있으면 수를 적는다', () => {
    expect(categoryReportLine(1)).toBe('실 제보 1건');
  });

  it('금액 옆 캡션과 같은 말을 쓴다 — 두 자리가 서로 다른 용어를 적지 않는다', () => {
    expect(categoryReportLine(12).startsWith('실 제보 12건')).toBe(true);
    expect(dataCaption({ count: 12 }).startsWith('실 제보 12건')).toBe(true);
  });
});
