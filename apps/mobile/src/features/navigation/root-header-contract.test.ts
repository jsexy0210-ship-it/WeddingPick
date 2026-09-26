declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('node:fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('node:path') as { join: (...parts: string[]) => string };

const APP = join(__dirname, '..', '..', 'app', '(tabs)');
const source = (path: string) => readFileSync(join(APP, path), 'utf8');

function styleBlock(text: string, name: string): string {
  const start = text.indexOf(`  ${name}: {`);
  const end = text.indexOf('\n  },', start);

  if (start < 0 || end < 0) throw new Error(`${name} 스타일을 찾지 못했다`);
  return text.slice(start, end);
}

describe('Root 1Depth 제목 헤더', () => {
  it.each([
    'index.tsx',
    'search/index.tsx',
    'pick/index.tsx',
    'wedding/index.tsx',
    'my/index.tsx',
  ])('%s Root에는 뒤로가기를 두지 않는다', (path) => {
    const text = source(path);

    expect(text).not.toContain('<BackBar');
    expect(text).not.toContain('<DepthHeader');
    expect(text).not.toContain('<BackButton');
    expect(text).not.toContain('name="arrowLeft"');
  });

  /*
   * 2026-09-26 대표 지시 「히어로 영역이 제각각이다. 홈 화면 기준으로 통일한다」 — 다섯 탭 제목 줄은
   * `components/root-tab-header.tsx` 한 벌이고, 값은 홈 브랜드 헤더(home.js `header` · `wordmark`)다.
   * 화면마다 제목 크기 · 줄 높이 · 여백을 따로 들면 다시 갈라진다(운영에서 26/35 · 26/39 · 22/28 ·
   * 28/36+위 4 · 아래 24로 넷이 갈려 있었다).
   */
  it('공통 제목 줄은 홈 기준 — 줄 66 · 좌우 20 · 위아래 0 · f26(26/39) · 700 · 자간 -0.52', () => {
    const text = readFileSync(join(__dirname, '..', '..', 'components', 'root-tab-header.tsx'), 'utf8');
    const header = styleBlock(text, 'header');

    expect(text).toContain('export const ROOT_TAB_HEADER_HEIGHT = 66;');
    expect(header).toContain('minHeight: ROOT_TAB_HEADER_HEIGHT');
    expect(header).toContain("alignItems: 'center'");
    expect(text).toContain('export const ROOT_TAB_GUTTER = 20;');
    expect(text).toContain('gutter = ROOT_TAB_GUTTER');
    expect(text).toContain('{ paddingHorizontal: gutter }');
    expect(header).not.toMatch(/padding(?:Top|Bottom|Vertical)?:/);
    expect(text).toContain('type="f26"');
    expect(text).toMatch(/title: \{[^}]*fontWeight: 700[^}]*letterSpacing: LetterSpacing\.n052/);
  });

  it.each([
    ['index.tsx', '<RootTabHeader\n      title="웨딩픽"'],
    ['search/index.tsx', '<RootTabHeader title={TITLE} />'],
    ['pick/index.tsx', '<RootTabHeader title={TERMS.pick} />'],
    ['wedding/index.tsx', '<RootTabHeader\n      title={TERMS.ourWedding}'],
    ['my/index.tsx', '<RootTabHeader title={S.title} />'],
  ])('%s 제목은 공통 RootTabHeader로 그린다', (path, usage) => {
    const text = source(path);

    expect(text).toContain(usage);
    // 화면별 제목 크기 · 줄 높이를 다시 들지 않는다.
    expect(text).not.toContain('type="f28" style={[styles.bold, styles.title]}');
    expect(text).not.toContain('FontSize.searchRootTitle');
    expect(text).not.toContain('rootTitle');
  });

  it('홈 첫 로딩 골격도 같은 제목 줄을 쓴다', () => {
    const text = readFileSync(join(__dirname, '..', 'home', 'home-skeleton.tsx'), 'utf8');
    expect(text).toContain('<RootTabHeader title="웨딩픽"');
  });

  it('웨딩노트 첫 방문(WP-EMPTY-NOTE)도 같은 제목 줄에 아래 선만 더한다', () => {
    const text = source('wedding/index.tsx');
    expect(text).toContain(
      '<RootTabHeader title={TERMS.ourWedding} style={[styles.emptyNav, { borderBottomColor: theme.border }]} />'
    );
    // 덧붙이는 스타일은 선뿐 — 높이 · 여백을 다시 들면 이 화면만 갈라진다.
    expect(text).toMatch(/emptyNav: \{ borderBottomWidth: Border\.hairline \}/);
  });

  it('다섯 탭 모두 제목 줄 좌우를 따로 넘기지 않는다 — 기본값 ROOT_TAB_GUTTER 하나', () => {
    for (const path of ['index.tsx', 'search/index.tsx', 'pick/index.tsx', 'wedding/index.tsx', 'my/index.tsx']) {
      expect(source(path)).not.toContain('gutter=');
    }
  });

  /*
   * 2026-09-26 대표 지시 「통일해」 — Root 5탭은 제목 줄과 본문 좌우가 20 한 값이다(정본 home.js ·
   * search.js · pick.js · my.js `padding:0 20px`). 전역 `Layout.gutter` · `Layout.pageX`(24)는 하위
   * 화면 몫이라 Root 본문 컨테이너의 좌우 여백으로 다시 들이지 않는다.
   */
  it.each([
    'index.tsx',
    'search/index.tsx',
    'pick/index.tsx',
    'wedding/index.tsx',
    'my/index.tsx',
  ])('%s 본문 좌우는 ROOT_TAB_GUTTER(20)이다', (path) => {
    const text = source(path);

    expect(text).not.toMatch(/(?:padding|margin)(?:Horizontal|Left|Right): Layout\.(?:gutter|pageX)/);
    expect(text).toMatch(/ROOT_TAB_GUTTER|HOME_PAGE_X/);
  });

  it('홈 전용 여백 HOME_PAGE_X는 ROOT_TAB_GUTTER를 다시 내보낼 뿐이다 — 20이 두 군데 적히지 않는다', () => {
    const text = readFileSync(join(__dirname, '..', 'home', 'home-layout.ts'), 'utf8');
    expect(text).toContain('export const HOME_PAGE_X = ROOT_TAB_GUTTER;');
    expect(text).not.toMatch(/HOME_PAGE_X = \d/);
  });

  it('검색 Root는 제목 줄 아래 검색창 줄도 좌우 20이다', () => {
    const text = source('search/index.tsx');
    expect(styleBlock(text, 'headerSearchRow')).toContain('paddingHorizontal: ROOT_TAB_GUTTER');
  });

  /* 2026-09-26 대표 지시 「고정으로 통일해」 — Pick 제목도 다른 네 탭처럼 스크롤 밖에 고정한다. */
  it('Pick 제목 줄은 스크롤 밖에 고정된다', () => {
    const text = source('pick/index.tsx');
    const render = text.slice(text.indexOf('return (\n    <ThemedView style={styles.root}>'));
    const header = render.indexOf('<Header />');

    expect(header).toBeGreaterThan(0);
    expect(render.indexOf('<ScrollView')).toBeGreaterThan(header);
    expect(render.match(/<Header \/>/g)).toHaveLength(1);
  });

  /*
   * v3.29 정본(`대메뉴_검색.dc.html` WP-SRCH-001) `stickyHead`: `headTop`은
   * `headTitleRoot`(«검색») 하나뿐이고 제목 옆에 결과 수를 적지 않는다 — 결과 수는
   * 검색창 아래 별도 `countRow`에 있다. 2026-09-23 재대조로 헤더의 중복 «N곳»
   * 표시를 뺐다(위 시험이 예전엔 그 중복을 정본으로 잘못 알고 있었다).
   */
  it('검색 Root 제목 옆에는 결과 수를 적지 않는다 — 결과 수는 countRow에 있다', () => {
    const text = source('search/index.tsx');
    const titleAt = text.indexOf('{TITLE}');
    const headerCloseAt = text.indexOf('</View>', titleAt);
    const titleBlock = text.slice(titleAt, headerCloseAt);

    expect(titleBlock).not.toContain('{formatCount(total)}곳');
    expect(text).toContain('{formatCount(total)}개 업체');
  });
});
