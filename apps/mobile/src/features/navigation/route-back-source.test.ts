/** 테스트 러너(CommonJS)의 전역. 앱 번들에는 들어가지 않는다. */
declare const require: (id: string) => any;
declare const __dirname: string;

const { readdirSync, readFileSync } = require('node:fs');
const { join, relative } = require('node:path');

const tabsDir = join(__dirname, '..', '..', 'app', '(tabs)');

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry: {
    isDirectory: () => boolean;
    name: string;
  }) => {
    if (entry.name === 'my') return [];

    const path = join(dir, entry.name);

    if (entry.isDirectory()) return routeFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

/**
 * SPEC §14.5 — 직접 `router.back()`은 History가 제품 동작인 자리만 남긴다.
 * 나머지 화면 헤더·오류·하단 출구는 `useDepthBack()`으로 논리 부모를 찾는다.
 */
describe('비-MY 사용자 라우트의 직접 History Back', () => {
  it('시트·카메라 닫기와 저장·삭제 후 목록 복귀에만 남는다', () => {
    const actual = Object.fromEntries(
      routeFiles(tabsDir)
        .map((path) => {
          const source = readFileSync(path, 'utf8');
          const count = source.match(/router\.back\(\)/g)?.length ?? 0;
          const route = relative(tabsDir, path).replaceAll('\\', '/');

          return [route, count] as const;
        })
        .filter(([, count]) => count > 0)
    );

    // 카메라 · 문서 확인 · 충돌 · 일정/지출 상세 · 문서 상세가 2026-09-25에 삭제돼 남은 곳이 없다.
    // 비교 → 상담 예약 닫기도 History가 아니라 출처(`compare/<업체>,<업체>`)로 그 비교에 돌아간다.
    expect(actual).toEqual({});
  });
});
