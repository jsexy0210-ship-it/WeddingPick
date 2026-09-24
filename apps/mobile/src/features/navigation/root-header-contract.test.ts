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

  it.each([
    ['pick/index.tsx', 'titleRow'],
    ['wedding/index.tsx', 'header'],
    ['my/index.tsx', 'header'],
  ])('%s 제목행은 nav 56 · 좌우 gutter 24를 쓴다', (path, styleName) => {
    const header = styleBlock(source(path), styleName);

    expect(header).toMatch(/(?:height|minHeight): Layout\.navBar/);
    expect(header).toContain('paddingHorizontal: Layout.gutter');
  });

  it('홈 브랜드 헤더는 화면 원본 높이 66과 공통 거터 24를 쓴다', () => {
    const header = styleBlock(source('index.tsx'), 'header');
    expect(header).toContain('minHeight: 66');
    expect(header).toContain('paddingHorizontal: Layout.gutter');
  });

  it.each([
    ['index.tsx', '웨딩픽', 'styles.brand'],
    ['wedding/index.tsx', '{TERMS.ourWedding}', 'styles.bold'],
    ['my/index.tsx', '{S.title}', 'styles.bold'],
  ])('%s 제목은 f26/700을 쓴다', (path, title, weightStyle) => {
    const text = source(path);
    const titleAt = text.indexOf(title);
    const opening = text.lastIndexOf('<ThemedText', titleAt);
    const tag = text.slice(opening, titleAt);

    expect(titleAt).toBeGreaterThanOrEqual(0);
    expect(opening).toBeGreaterThanOrEqual(0);
    expect(tag).toContain('type="f26"');
    expect(tag).toContain(weightStyle);
  });

  it('Pick Root 제목은 화면 원본의 28px을 쓴다', () => {
    const text = source('pick/index.tsx');
    const titleAt = text.indexOf('{TERMS.pick}');
    const opening = text.lastIndexOf('<ThemedText', titleAt);
    expect(text.slice(opening, titleAt)).toContain('type="f28"');
  });

  it('검색 Root는 Back 없이 22px 제목·24px 여백을 쓴다', () => {
    const text = source('search/index.tsx');
    const header = styleBlock(text, 'header');
    const titleAt = text.indexOf('{TITLE}');
    const opening = text.lastIndexOf('<ThemedText', titleAt);
    const tag = text.slice(opening, titleAt);

    expect(header).toContain('paddingHorizontal: Layout.pageX');
    expect(tag).toContain('type="f20"');
    expect(styleBlock(text, 'title')).toContain('fontSize: 22');
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
