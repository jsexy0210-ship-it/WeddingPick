import { OFF_TAB_ROUTES, ROOT_TABS, isRootTab, rootTab } from './root-tabs';

/**
 * 탭 정의는 라우터(`app/(tabs)/_layout.tsx`)와 탭 바가 둘 다 읽는 한 자리다 —
 * 여기가 틀어지면 없는 탭이 서거나 있는 탭이 안 선다. 화면을 띄우지 않고 목록만
 * 확인한다.
 */
describe('ROOT_TABS', () => {
  it('2026-09-17 지시 — 홈 · 검색 · Pick · 웨딩노트 · MY 다섯이다', () => {
    expect(ROOT_TABS.map((tab) => tab.label)).toEqual(['홈', '검색', 'Pick', '웨딩노트', 'MY']);
  });

  it('이름이 바뀌어도 라우트는 그대로다 — 저장된 링크가 깨지지 않아야 한다', () => {
    expect(ROOT_TABS.map((tab) => tab.name)).toEqual([
      'index',
      'search',
      'pick',
      'wedding',
      'my',
    ]);
  });

  it('원형 강조는 Pick 하나뿐이고 가운데에 선다', () => {
    const emphasized = ROOT_TABS.filter((tab) => tab.emphasized);

    expect(emphasized).toHaveLength(1);
    expect(emphasized[0]!.name).toBe('pick');
    expect(ROOT_TABS.findIndex((tab) => tab.emphasized)).toBe(2);
  });

  /*
   * 2026-09-17에 이 둘이 자리를 맞바꿨다. **바꾼 쪽만 고치고 반대쪽을 안 고치면**
   * 탭이 넷이 되거나 여섯이 되므로 둘을 같은 시험에서 본다.
   *
   * 검색은 2026-09-14에 「초기 이미지 데이터가 없어서」 임시로 내렸던 것이고
   * 라운지는 「후기와 박람회가 몇 건뿐이라 탭 한 칸이 빈 화면을 띄운다」가 이유다
   * (`docs/design/figma-export/README.md`).
   */
  it('검색이 탭으로 돌아오고 라운지가 내려갔다', () => {
    expect(isRootTab('search')).toBe(true);
    expect(OFF_TAB_ROUTES).not.toContain('search');

    expect(isRootTab('community')).toBe(false);
    expect(OFF_TAB_ROUTES).toContain('community');
  });

  /**
   * **라운지는 없앤 것이 아니다.** 탭에서만 내렸고 화면과 주소는 그대로다 —
   * 저장된 링크 · 딥링크 · 공유 주소가 `/community`를 가리킨다.
   */
  it('라운지 라우트는 살아 있다', () => {
    expect(OFF_TAB_ROUTES).toContain('community');
    expect(rootTab('community')).toBeUndefined();
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
