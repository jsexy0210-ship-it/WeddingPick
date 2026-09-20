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
    ['index.tsx', 'header'],
    ['search/index.tsx', 'headerTitleRow'],
    ['pick/index.tsx', 'titleRow'],
    ['wedding/index.tsx', 'header'],
    ['my/index.tsx', 'header'],
  ])('%s 제목행은 nav 56 · 좌우 gutter 24를 쓴다', (path, styleName) => {
    const header = styleBlock(source(path), styleName);

    expect(header).toMatch(/(?:height|minHeight): Layout\.navBar/);
    expect(header).toContain('paddingHorizontal: Layout.gutter');
  });

  it.each([
    ['index.tsx', '웨딩픽', 'styles.brand'],
    ['search/index.tsx', '{TITLE}', 'styles.bold'],
    ['pick/index.tsx', '{TERMS.pick}', 'styles.bold'],
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
});
