/** 테스트 러너(CommonJS)의 전역. 앱 번들에는 들어가지 않는다. */
declare const require: (id: string) => unknown;
declare const __dirname: string;

const nodeRequire = require;
const dirName = __dirname;

import {
  DEPTH_BACK_EXCEPTIONS,
  NO_BACK_ROUTES,
  ROUTES,
  depthBackTarget,
  hasDepthBack,
  matchRoute,
} from './depth-back-rules';

/**
 * Depth Back — 「부모로 간다」가 경로마다 실제로 무엇을 뜻하는지 표로 못박는다.
 *
 * 이 표가 사양이다. 화면 좌상단 뒤로가기는 방문 기록을 보지 않으므로, 링크로 곧장
 * 들어와도 여기 적힌 곳으로 간다.
 */
describe('depthBackTarget — 대표 경로', () => {
  const cases: [현재: string, 간다: string, 근거: string][] = [
    // ── 계층을 그대로 한 칸 올라간다 ────────────────────────────────
    ['/search/v-101', '/search', '업체 상세 → 검색'],
    ['/search/v-101/images', '/search/v-101', '전체보기 → 업체 상세'],
    ['/search/v-101/write-review', '/search/v-101', '후기 쓰기 → 업체 상세'],
    ['/search/expo/e-9', '/search/expo', '박람회 상세 → 박람회 목록'],
    ['/search/expo/e-9/calendar', '/search/expo/e-9', '달력 등록 → 박람회 상세'],
    ['/search/wedding-info/i-3', '/search/wedding-info', '웨딩 정보 상세 → 목록'],
    ['/search/expo', '/search', '박람회 목록 → 검색'],
    ['/my/rewards/npay', '/my/rewards', 'Npay 수령 → 혜택'],
    ['/my/rewards', '/my', '혜택 → MY'],
    ['/my/settings', '/my', '설정 → MY'],
    ['/my/rebuttals/r-2', '/my/rebuttals', '반론 상세 → 반론 목록'],
    ['/my/vendor-claims/v-7', '/my/vendor-claims', '관계자 인증 상세 → 목록'],
    ['/wedding/w-1', '/wedding', '웨딩일정 홈 → 웨딩일정 탭'],
    ['/wedding/w-1/expenses', '/wedding/w-1', '지출 → 웨딩일정 홈'],
    ['/wedding/w-1/expenses/add', '/wedding/w-1/expenses', '지출 추가 → 지출'],
    ['/wedding/w-1/events/ev-3', '/wedding/w-1/events', '일정 상세 → 일정 목록'],
    ['/wedding/w-1/complete', '/wedding/w-1', 'WP-OUR-013 예식 완료 → 웨딩일정 홈'],
    ['/pick/history', '/pick', 'WP-PICK-007 결정 내역 → Pick 탭'],
    ['/pick/studio', '/pick', '업종별 Pick → Pick 탭'],
    ['/feed', '/', '홈 하위 스택(피드) → 홈'],
    ['/top3', '/', '웨딩픽 TOP3 → 홈'],
    ['/progress', '/', '준비 현황 → 홈'],

    // ── 폴더만 있고 화면이 없는 칸은 건너뛴다 ───────────────────────
    ['/capture/result/q-1', '/capture', '`/capture/result`는 화면이 아니다'],
    ['/capture/analysis/a-1', '/capture', '`/capture/analysis`는 화면이 아니다'],
    ['/capture/payment/consent', '/capture', '`/capture/payment`는 화면이 아니다'],
    ['/capture/sample', '/capture', '샘플 → 제보 홈'],

    // ── 예외표 ────────────────────────────────────────────────────
    ['/capture', '/my', '제보는 Root 탭이 아니다 — WP-RPT-001 entry'],
    ['/capture/verify/q-1', '/capture/result/q-1', '자료 확인 신청 → 그 자료의 결과 확인'],
    ['/capture/verify-status/rq-1', '/my/reports', 'WP-RPT-008 처리 결과 → 내 제보 내역'],
    ['/search/compare', '/pick', 'WP-CMP-002 비교 결과 → Pick'],
    ['/pick/done', '/pick', 'WP-PICK-006 결정 완료 → Pick(끝난 확인 시트로 돌아가지 않는다)'],
    ['/pick/removed', '/pick/history', '제거된 후보 → 결정 내역'],
    ['/my/referral', '/my/rewards', '초대 현황 → 혜택'],

    // ── 모르는 경로도 홈까지는 간다 ─────────────────────────────────
    ['/nope/deeper/still', '/', '없는 경로 → 홈'],
  ];

  it.each(cases)('%s → %s (%s)', (from, to) => {
    expect(depthBackTarget(from)).toBe(to);
  });

  it('쿼리와 끝 슬래시를 무시한다', () => {
    expect(depthBackTarget('/search/v-101/images?index=2')).toBe('/search/v-101');
    expect(depthBackTarget('/my/rewards/npay/')).toBe('/my/rewards');
  });

  it('Root 5탭에서는 더 올라가지 않는다', () => {
    for (const tab of ['/', '/search', '/pick', '/wedding', '/my']) {
      expect(depthBackTarget(tab)).toBe('/');
    }
  });
});

describe('matchRoute — 글자 그대로 적힌 라우트가 이긴다', () => {
  it('`/pick/category`는 `/pick/[category]`가 아니다', () => {
    expect(matchRoute('/pick/category')).toBe('/pick/category');
    expect(matchRoute('/pick/studio')).toBe('/pick/[category]');
  });

  it('`/search/compare`는 업체 상세가 아니다', () => {
    expect(matchRoute('/search/compare')).toBe('/search/compare');
    expect(matchRoute('/search/v-101')).toBe('/search/[vendorId]');
  });

  it('`/wedding/join`은 웨딩일정 홈이 아니다', () => {
    expect(matchRoute('/wedding/join')).toBe('/wedding/join');
    expect(matchRoute('/wedding/w-1')).toBe('/wedding/[id]');
  });
});

describe('hasDepthBack — 뒤로가기를 둘 자리', () => {
  it.each(NO_BACK_ROUTES)('%s에는 두지 않는다', (route) => {
    expect(hasDepthBack(route)).toBe(false);
  });

  it('관리자 콘솔은 사이드바가 이동을 맡는다', () => {
    expect(hasDepthBack('/admin/queue')).toBe(false);
  });

  it('하위 화면에는 둔다', () => {
    expect(hasDepthBack('/search/v-101')).toBe(true);
    expect(hasDepthBack('/my/rewards/npay')).toBe(true);
  });
});

describe('규칙의 앞뒤가 맞는가', () => {
  it('예외표의 열쇠와 목적지가 모두 실재하는 라우트다', () => {
    for (const [from, to] of Object.entries(DEPTH_BACK_EXCEPTIONS)) {
      expect(ROUTES).toContain(from);
      expect(ROUTES).toContain(to);
    }
  });

  it('예외가 자기 자신을 가리키지 않는다', () => {
    for (const [from, to] of Object.entries(DEPTH_BACK_EXCEPTIONS)) {
      expect(to).not.toBe(from);
    }
  });

  it('모든 라우트가 자기 자신이 아닌 곳으로 나간다', () => {
    // 홈은 바닥이라 제자리다 — 애초에 뒤로가기를 두지 않는다.
    for (const route of ROUTES.filter((r) => r !== '/')) {
      const concrete = route.replace(/\[[^\]]+\]/g, 'x');

      expect(depthBackTarget(concrete)).not.toBe(concrete);
    }
  });
});

/**
 * `ROUTES`가 실제 파일과 어긋나면 계층 계산이 조용히 틀린다 — 없는 부모로 보내거나,
 * 있는 부모를 건너뛴다. 그래서 목록을 파일 트리와 직접 맞춰본다.
 */
describe('ROUTES가 src/app과 같은가', () => {
  /*
   * `@types/node`를 tsconfig에 넣지 않는다 — 앱 코드가 노드 전역을 보게 되면 웹·네이티브에
   * 없는 API를 무심코 쓴다. 이 테스트가 쓰는 두 조각만 여기서 좁게 선언한다.
   */
  type Dirent = { name: string; isDirectory: () => boolean };
  const { readdirSync } = nodeRequire('fs') as {
    readdirSync: (path: string, options: { withFileTypes: true }) => Dirent[];
  };
  const { join } = nodeRequire('path') as { join: (...parts: string[]) => string };
  const APP_DIR = join(dirName, '..', '..', 'app');

  function collect(dir: string, prefix: string[], out: Set<string>): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // `(tabs)` · `(home)` 같은 그룹은 URL에 나오지 않는다.
        const group = entry.name.startsWith('(') && entry.name.endsWith(')');

        collect(join(dir, entry.name), group ? prefix : [...prefix, entry.name], out);
        continue;
      }

      if (!entry.name.endsWith('.tsx') || entry.name === '_layout.tsx') continue;

      // `map.web.tsx`는 `map.tsx`와 같은 라우트다.
      const base = entry.name.replace(/\.web\.tsx$/, '').replace(/\.tsx$/, '');
      const segments = base === 'index' ? prefix : [...prefix, base];

      out.add(segments.length > 0 ? `/${segments.join('/')}` : '/');
    }
  }

  it('빠지거나 남는 라우트가 없다', () => {
    const found = new Set<string>();

    collect(APP_DIR, [], found);

    expect([...found].sort()).toEqual([...ROUTES].sort());
  });
});
