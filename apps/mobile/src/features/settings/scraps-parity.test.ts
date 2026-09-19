declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as {
  join: (...parts: string[]) => string;
};

const source = readFileSync(join(__dirname, '../../app/(tabs)/my/scraps.tsx'), 'utf8');

describe('MY 스크랩 07-lounge-my 4-6 정본', () => {
  it('88px 이미지 · 카테고리 · 제목 · 저장일 · bookmark를 한 행에 둔다', () => {
    expect(source).toContain('<CategoryImage uri={item.imageUrl} />');
    expect(source).toContain('{item.categoryLabel}');
    expect(source).toContain('{item.title}');
    expect(source).toContain('{savedAtLabel(item.savedAt)}');
    expect(source).toContain('<ProductSymbol name="bookmark" size={20} color={theme.tint} />');
    expect(source).not.toContain('<Row');
  });

  it('ISO 저장 시각을 사용자 문구로 바꾸는 fallback을 유지한다', () => {
    expect(source).toContain("if (!match) return '저장됨';");
    expect(source).toContain("return \`\${Number(match[2])}월 \${Number(match[3])}일 저장\`;");
  });
});
