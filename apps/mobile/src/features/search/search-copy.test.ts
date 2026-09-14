/**
 * 검색 화면의 문구는 `spec/strings.ko.json`이 정한다 — WP-SRCH-004 · 005.
 *
 * 화면 소스를 직접 읽는다. `sort-sheet.tsx` · `filter-sheet.tsx`를 import 하면
 * react-native와 시트 껍데기까지 끌고 오는데, 여기서 묻는 것은 **적힌 말**뿐이다.
 */

/** 테스트 러너(CommonJS)의 전역. 앱 번들에는 들어가지 않는다. */
declare const require: (id: string) => unknown;
declare const __dirname: string;

/*
 * `@types/node`를 tsconfig에 넣지 않는다 — 앱 코드가 노드 전역을 보게 되면 웹·네이티브에
 * 없는 API를 무심코 쓴다(depth-back.test.ts와 같은 이유). 쓰는 두 조각만 좁게 선언한다.
 */
const nodeRequire = require;
const { readFileSync } = nodeRequire('fs') as {
  readFileSync: (path: string, encoding: string) => string;
};
const { join } = nodeRequire('path') as { join: (...parts: string[]) => string };

const HERE = __dirname;
const ROOT = join(HERE, '..', '..', '..', '..', '..');

const strings = JSON.parse(
  readFileSync(join(ROOT, 'spec', 'strings.ko.json'), 'utf8')
) as { search: Record<string, string> };

/**
 * 주석을 걷어낸 소스. 설명에 적어 둔 옛 문구가 「아직 그렇게 적혀 있다」로 읽히면
 * 가드가 아무것도 잡지 못한다 — 실제로 화면에 나가는 줄만 본다.
 */
const read = (name: string) =>
  readFileSync(join(HERE, name), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('검색 문구는 spec과 같다', () => {
  it('기본 정렬 라벨은 «추천순»이다', () => {
    /*
     * 시안 06-search #16c의 결과 머리가 «추천순»이다. 재는 것은 그대로 실 제보
     * 수지만, 고르는 자리에서는 「무엇을 먼저 보여주는가」가 이름이다.
     */
    expect(strings.search['sort.recommended']).toBe('추천순');
    expect(read('sort-sheet.tsx')).toContain(`data: '${strings.search['sort.recommended']}'`);
  });

  it('필터 CTA는 «{n}곳 보기»다 — «필터 적용»이 아니다', () => {
    expect(strings.search['filter.apply']).toBe('{n}곳 보기');

    const sheet = read('filter-sheet.tsx');
    expect(sheet).toContain('`${count}곳 보기`');
    expect(sheet).not.toContain('필터 적용');
  });

  it('«실 제보가 있는 곳만» 토글의 두 줄이 다 있다', () => {
    const sheet = read('filter-sheet.tsx');

    expect(sheet).toContain(strings.search['filter.onlyVerified']);
    expect(sheet).toContain(strings.search['filter.onlyVerifiedDesc']);
  });

  it('예산은 구간 칩이다 — 만원 숫자 입력 칸을 두지 않는다', () => {
    const sheet = read('filter-sheet.tsx');

    expect(sheet).toContain('BUDGET_BANDS');
    expect(sheet).not.toContain('TextInput');
  });
});

export {};
