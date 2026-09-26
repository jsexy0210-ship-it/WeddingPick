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
      /*
       * 출처 스택 별칭(`features/navigation/stack-alias.ts`) — 원래 화면을 한 줄로 다시 내보낼 뿐이라
       * 시트 여부는 원래 화면이 정한다. 대신 다시 내보내는 대상이 이 목록 안의 화면인지 본다.
       */
      .filter((path) => !/^\/\*\*[^\n]*\*\/\nexport \{ default \} from '[^']+';\n$/.test(source(path)))
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
      /* 출처가 없으면 업체 상세, MY 후기에서 왔으면 그 목록 — Depth Back 규칙이 정한다(depth-back.test.ts). */
      ['(tabs)/search/[vendorId]/write-review.tsx', 'const closeSheet = useDepthBack();'],
      /*
       * 출처가 없으면 업체 상세, Pick 카드에서 왔으면 그 Pick, 비교에서 왔으면 그 비교 — 같은 Depth Back
       * 규칙(origin-entry-points.test.ts). 스택 아래 목적지는 꺼내서(POP) 그 화면의 출처를 지우지 않는다.
       */
      ['(tabs)/search/[vendorId]/consult.tsx', 'backTo(depthBackTarget(closePath), closePath, readStackState(navigation));'],
    ] as const;

    for (const [path, parentClose] of routes) {
      const content = source(path);
      expect(content).toContain('requestDirtySheetClose(dirty, closeSheet)');
      expect(content).toContain(parentClose);
    }

    const calendar = source('(tabs)/search/expo/[expoId]/calendar.tsx');
    /* 라운지 스택 별칭(`/community/expo/<박람회>/calendar`)이면 그 스택의 박람회 상세로 접는다. */
    expect(calendar).toContain('dismissToOrReplace(inStack(pathname, `/search/expo/${expoId}`))');
  });
});
