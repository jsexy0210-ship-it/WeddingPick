/**
 * #422 등록/추가/작성 Overlay 회귀 게이트.
 *
 * 새 CRUD 입력 route가 생기면 별도 전체 화면으로 조용히 돌아가지 못하게 한다.
 * capture/payment/register는 카메라/권한/증빙 업로드를 거치는 독립 one-shot 작업 단계라
 * 이 규칙의 명시적 예외다.
 */
declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync, readdirSync, statSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory: () => boolean };
};
const { basename, join, relative } = require('path') as {
  basename: (path: string) => string;
  join: (...parts: string[]) => string;
  relative: (from: string, to: string) => string;
};

const APP = join(__dirname, '..', '..', 'app');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function route(path: string): string {
  return relative(APP, path).replace(/\\/g, '/');
}

function source(path: string): string {
  return readFileSync(join(APP, path), 'utf8');
}

function expectCanonicalSheet(path: string): void {
  const content = source(path);

  expect(content).toContain('<BottomSheet');
  expect(content).toContain('<SheetPanel>');
  expect(content).not.toContain('<BackBar');
  expect(content).not.toContain('<NavBar');
}

describe('registration routes use canonical overlays', () => {
  it('새 등록/추가/작성 route는 BottomSheet + SheetPanel을 사용한다', () => {
    const candidates = filesUnder(APP)
      .filter((path) => path.endsWith('.tsx'))
      .map(route)
      .filter((path) => {
        const name = basename(path);
        return (
          /^(new|add|create|register)\.tsx$/i.test(name) ||
          /^write-[^/]+\.tsx$/i.test(name)
        );
      });

    expect(candidates).toContain('(tabs)/wedding/[id]/events/new.tsx');
    expect(candidates).toContain('(tabs)/wedding/[id]/expenses/add.tsx');
    expect(candidates).toContain('(tabs)/search/[vendorId]/write-review.tsx');

    for (const path of candidates) {
      expectCanonicalSheet(path);
    }
  });

  it('외부 캘린더처럼 이름 규칙 밖의 입력 흐름도 시트로 유지한다', () => {
    expectCanonicalSheet('(tabs)/search/expo/[expoId]/calendar.tsx');
  });

  it('상담 예약은 공통 풀팝업이다(2026-09-25 대표 지시) — 업체 상세 위 시트로 돌아가지 않는다', () => {
    const consult = source('(tabs)/search/[vendorId]/consult.tsx');
    expect(consult).toContain('<FullPopupHeader title={TITLE} onClose={requestClose}');
    expect(consult).not.toContain('<BottomSheet');
    expect(consult).not.toContain('<SheetPanel');
    expect(consult).not.toContain('<VendorDetailScreen');
    expect(consult).not.toContain('<BackBar');
    expect(consult).not.toContain('<NavBar');

    // 약관 상세(WP-AUTH-011)와 같은 머리를 쓴다.
    const terms = readFileSync(join(APP, '..', 'features', 'auth', 'terms-detail-modal.tsx'), 'utf8');
    expect(terms).toContain('<FullPopupHeader title="약관 상세" onClose={onClose} />');
  });

  it('데이터를 만드는 route는 이름이 등록이 아니어도 시트다', () => {
    const booking = source('(tabs)/search/[vendorId]/booking.tsx');
    expect(booking).toContain("export { default } from './consult'");

    const loungeWrite = source('(tabs)/community/review/write.tsx');
    expect(loungeWrite).toContain('<BottomSheet');
    expect(loungeWrite).toContain('<SheetPanel');
  });

  it('route형 시트는 부모 화면을 history 중복 없이 복원하고 dirty 입력은 DLG-B를 거친다', () => {
    const routes = [
      ['(tabs)/wedding/[id]/events/new.tsx', "dismissToOrReplace('/wedding?tab=calendar')"],
      ['(tabs)/wedding/[id]/expenses/add.tsx', "dismissToOrReplace('/wedding?tab=budget')"],
      ['(tabs)/search/[vendorId]/write-review.tsx', 'dismissToOrReplace(`/search/${vendorId}`)'],
      ['(tabs)/search/[vendorId]/consult.tsx', 'dismissToOrReplace(`/search/${vendorId}`)'],
    ] as const;

    for (const [path, parentClose] of routes) {
      const content = source(path);
      expect(content).toContain('requestDirtySheetClose(dirty, closeSheet)');
      expect(content).toContain(parentClose);
    }

    const calendar = source('(tabs)/search/expo/[expoId]/calendar.tsx');
    expect(calendar).toContain('dismissToOrReplace(`/search/expo/${expoId}`)');
  });
});
