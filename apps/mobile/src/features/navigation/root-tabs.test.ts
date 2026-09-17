import { OFF_TAB_ROUTES, ROOT_TABS, isRootTab, rootTab } from './root-tabs';

/**
 * 탭 정의는 라우터(`app/(tabs)/_layout.tsx`)와 탭 바가 둘 다 읽는 한 자리다 —
 * 여기가 틀어지면 없는 탭이 서거나 있는 탭이 안 선다. 화면을 띄우지 않고 목록만
 * 확인한다.
 */
describe('ROOT_TABS', () => {
  it('2026-09-14 확정 — 홈 · 웨딩노트 · Pick · 라운지 · MY 다섯이다', () => {
    expect(ROOT_TABS.map((tab) => tab.label)).toEqual(['홈', '웨딩노트', 'Pick', '라운지', 'MY']);
  });

  it('이름이 바뀌어도 라우트는 그대로다 — 저장된 링크가 깨지지 않아야 한다', () => {
    expect(ROOT_TABS.map((tab) => tab.name)).toEqual([
      'index',
      'wedding',
      'pick',
      'community',
      'my',
    ]);
  });

  it('원형 강조는 Pick 하나뿐이고 가운데에 선다', () => {
    const emphasized = ROOT_TABS.filter((tab) => tab.emphasized);

    expect(emphasized).toHaveLength(1);
    expect(emphasized[0]!.name).toBe('pick');
    expect(ROOT_TABS.findIndex((tab) => tab.emphasized)).toBe(2);
  });

  it('검색은 탭이 아니다 — 임시로 내렸고 라우트는 살아 있다', () => {
    expect(isRootTab('search')).toBe(false);
    expect(OFF_TAB_ROUTES).toContain('search');
  });

  it('한 라우트가 탭과 숨김 목록에 같이 들어가지 않는다', () => {
    const both = OFF_TAB_ROUTES.filter((name) => isRootTab(name));

    expect(both).toEqual([]);
  });

  it('없는 라우트는 탭이 아니다', () => {
    expect(isRootTab('explore')).toBe(false);
    expect(isRootTab(undefined)).toBe(false);
    expect(rootTab('explore')).toBeUndefined();
  });
});
