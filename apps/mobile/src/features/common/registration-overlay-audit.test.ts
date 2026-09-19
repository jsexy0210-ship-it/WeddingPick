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
const CAPTURE_EXCEPTION = '(tabs)/capture/payment/register.tsx';

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
    expect(candidates).toContain(CAPTURE_EXCEPTION);

    for (const path of candidates.filter((candidate) => candidate !== CAPTURE_EXCEPTION)) {
      expectCanonicalSheet(path);
    }
  });

  it('수정/외부 캘린더처럼 이름 규칙 밖의 입력 흐름도 시트로 유지한다', () => {
    const eventDetail = source('(tabs)/wedding/[id]/events/[eventId].tsx');
    expect(eventDetail).toContain('testID="event-edit-sheet"');
    expect(eventDetail).toContain('<BottomSheet');
    expect(eventDetail).toContain('<SheetPanel>');

    for (const path of [
      '(tabs)/search/[vendorId]/edit-review.tsx',
      '(tabs)/search/expo/[expoId]/calendar.tsx',
    ]) {
      expectCanonicalSheet(path);
    }
  });

  it('증빙 등록 one-shot 작업 단계만 명시적 전체 화면 예외다', () => {
    const content = source(CAPTURE_EXCEPTION);

    expect(content).toContain('registerPaymentProof');
    expect(content).toContain('pickFromLibrary');
    expect(content).toContain('uploadPaymentProof');
  });
});
