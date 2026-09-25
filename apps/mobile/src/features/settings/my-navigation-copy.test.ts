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
const strings = require('../../../../../spec/strings.ko.json') as {
  my: Record<string, string>;
};

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

    /*
     * 문구는 화면에 직접 적지 않고 `spec/strings.ko.json`에서 읽는다. 그래서 두 가지를
     * 따로 센다 — 화면이 그 칸을 읽는지, 그 칸에 든 말이 영문 약어가 아닌지.
     *
     * 이 자리는 정본대로 「FAQ」다 — docs/design/React_Native/my.jsx:679(frame-015 navTitle) ·
     * my.js `mySections`. 2026-09-25 MASTER 후속 지시(대표님 「업데이트된 앱 화면에 다
     * 맞추라는뜻」)로 RN 정본이 2026-09-15 영문 금지 규칙보다 앞선다.
     */
    expect(index).toContain("label: S['item.faq']");
    expect(strings.my['item.faq']).toBe('FAQ');
    expect(guide).toContain('질문을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  });
});
