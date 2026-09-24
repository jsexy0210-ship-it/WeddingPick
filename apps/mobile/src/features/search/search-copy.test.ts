/**
 * 검색 화면의 문구는 `spec/strings.ko.json`이 정한다 — WP-SRCH-002 · 003.
 *
 * 화면 소스를 직접 읽는다. `sort-panel.tsx` · `filter-sheet.tsx`를 import 하면
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
     * RN 정본 `search.js` `sortRows[0]` · `sorts[0]`이 «추천순»이다(v3.29 「추천」 삭제와
     * 겹쳐 DESIGN_UNRESOLVED — 정본 값을 그대로 둔다). 금액 두 줄은 붙여 쓴다.
     */
    expect(strings.search['sort.recommended']).toBe('추천순');
    const panel = read('sort-panel.tsx');
    expect(panel).toContain(`data: '${strings.search['sort.recommended']}'`);
    expect(panel).toContain(`price_low: '${strings.search['sort.lowPrice']}'`);
    expect(panel).toContain(`price_high: '${strings.search['sort.highPrice']}'`);
  });

  it('필터 CTA는 «{n}개 업체 보기»다 — «필터 적용»이 아니다', () => {
    expect(strings.search['filter.apply']).toBe('{n}개 업체 보기');

    const sheet = read('filter-sheet.tsx');
    expect(sheet).toContain('`${count}개 업체 보기`');
    expect(sheet).not.toContain('필터 적용');
  });

  it('«실 제보가 있는 곳만» 토글을 두지 않는다', () => {
    /*
     * 2026-09-23 대표 지시 「정본과 다른 기능은 제거한다」. v3.28 WP-SRCH-002가 그리는
     * 묶음은 카테고리 · 지역 · 예산 · 스타일 넷뿐이고 이 토글은 6개 .dc.html 어디에도 없다.
     * 지웠다는 사실을 세는 자리 — 문구가 돌아오면 여기서 걸린다.
     */
    const sheet = read('filter-sheet.tsx');

    expect(sheet).not.toContain('실 제보가 있는 곳만');
    expect(strings.search['filter.onlyVerified']).toBeUndefined();
  });

  it('정렬은 바텀시트가 아니라 칩 아래 인라인 패널이다(WP-SRCH-003)', () => {
    const panel = read('sort-panel.tsx');

    expect(panel).not.toContain('BottomSheet');
    expect(panel).toContain('export function SortPanel');
  });

  it('예산은 구간 칩이다 — 만원 숫자 입력 칸을 두지 않는다', () => {
    const sheet = read('filter-sheet.tsx');

    expect(sheet).toContain('BUDGET_BANDS');
    expect(sheet).not.toContain('TextInput');
  });
});


describe('검색·업체상세는 폐기된 지연 로그인을 되살리지 않는다', () => {
  const routeSource = (relativePath: string) =>
    readFileSync(join(ROOT, 'apps', 'mobile', 'src', 'app', '(tabs)', 'search', relativePath), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('검색 결과는 로그인 시트를 겹쳐 띄우지 않는다', () => {
    const source = routeSource('index.tsx');

    expect(source).not.toContain('LoginSheet');
    expect(source).toContain('savePendingAction');
    expect(source).toContain("await savePendingAction({ kind: 'pick'");
    expect(source).toContain("router.replace('/login')");
  });

  it('업체 상세도 세션이 사라지면 로그인 화면으로 복귀한다', () => {
    const source = routeSource(join('[vendorId]', 'index.tsx'));

    expect(source).not.toContain('LoginSheet');
    expect(source).toContain('savePendingAction');
    expect(source).toContain("await savePendingAction({ kind: 'pick'");
    expect(source).not.toContain('loadToken');
    expect(source).toContain("router.replace('/login')");
  });

  it('비교 화면도 pending Pick만 남기고 로그인으로 복귀한다', () => {
    const source = routeSource('compare.tsx');

    expect(source).not.toContain('LoginSheet');
    expect(source).toContain('savePendingAction');
    expect(source).toContain("await savePendingAction({ kind: 'pick'");
    expect(source).toContain("router.replace('/login')");
  });
});

export {};
