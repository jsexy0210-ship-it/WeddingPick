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
    const bizClaim = readFileSync(join(MY_ROOT, 'biz', 'claim.tsx'), 'utf8');

    /*
     * 문구는 화면에 직접 적지 않고 `spec/strings.ko.json`에서 읽는다. 그래서 두 가지를
     * 따로 센다 — 화면이 그 칸을 읽는지, 그 칸에 든 말이 영문 약어가 아닌지.
     *
     * **v3.28 대조표는 이 자리를 「FAQ」로 적는다**(시안 12 WP-MY-013). 2026-09-15 대표
     * 지시 「사용자 화면에 영문을 쓰지 않는다」와 부딪혀 판단 대기 중이라 아직 한국어다.
     * 대표님이 「FAQ」로 정하시면 이 줄의 기대값을 그때 같이 바꾼다.
     */
    expect(index).toContain("label: S['item.faq']");
    expect(strings.my['item.faq']).toBe('자주 묻는 질문');
    expect(guide).toContain('질문을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    expect(bizClaim).not.toContain('이 빌드는 서버에 붙어 있지 않아');
  });
});
