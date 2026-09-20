declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync, readdirSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
  readdirSync: (path: string, options: { withFileTypes: true }) => {
    isDirectory: () => boolean;
    name: string;
  }[];
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const MY_ROOT = join(__dirname, '..', '..', 'app', '(tabs)', 'my');

function myScreens(dir = MY_ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) return myScreens(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

describe('MY 화면 이동과 UX 문구', () => {
  it('화면 안의 Back 동작은 공용 Depth Back만 쓴다', () => {
    for (const path of myScreens()) {
      expect(readFileSync(path, 'utf8')).not.toContain('router.back()');
    }
  });

  it('영문 약어와 개발 상태 대신 사용자가 이해할 안내를 보여준다', () => {
    const index = readFileSync(join(MY_ROOT, 'index.tsx'), 'utf8');
    const guide = readFileSync(join(MY_ROOT, 'guide.tsx'), 'utf8');
    const bizClaim = readFileSync(join(MY_ROOT, 'biz', 'claim.tsx'), 'utf8');

    expect(index).toContain("label: '자주 묻는 질문'");
    expect(guide).toContain('질문을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    expect(bizClaim).not.toContain('이 빌드는 서버에 붙어 있지 않아');
  });
});
