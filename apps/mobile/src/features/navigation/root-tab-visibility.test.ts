import { isRootTabPath } from './root-tab-visibility';

describe('Root 1Depth 하단 내비게이션', () => {
  it.each([
    ['/', 'index'],
    ['/search', 'search'],
    ['/pick', 'pick'],
    ['/wedding', 'wedding'],
    ['/my', 'my'],
  ])('%s에서는 항상 보인다', (pathname, routeName) => {
    expect(isRootTabPath(pathname, routeName)).toBe(true);
    expect(isRootTabPath(`${pathname}/`, routeName)).toBe(true);
  });

  it.each([
    ['/search/vendor-1', 'search'],
    ['/pick/confirm', 'pick'],
    ['/wedding/wedding-1', 'wedding'],
    ['/my/settings', 'my'],
    ['/community', 'community'],
  ])('%s 하위 화면에서는 숨긴다', (pathname, routeName) => {
    expect(isRootTabPath(pathname, routeName)).toBe(false);
  });
});
