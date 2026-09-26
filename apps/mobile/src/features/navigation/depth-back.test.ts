import {
  DEPTH_BACK_EXCEPTIONS,
  HISTORY_BACK_ROUTES,
  NO_BACK_ROUTES,
  ROUTES,
  chainOrigin,
  crossesStackOnBack,
  depthBackTarget,
  hasDepthBack,
  hasHistoryBack,
  matchRoute,
  resolveBackAction,
} from './depth-back-rules';

/** 테스트 러너(CommonJS)의 전역. 앱 번들에는 들어가지 않는다. */
declare const require: (id: string) => unknown;
declare const __dirname: string;

const nodeRequire = require;
const dirName = __dirname;

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
    ['/search/expo/e-9/calendar', '/search/expo/e-9', '달력 등록 → 박람회 상세'],
    ['/search/expo/e-9', '/community/expo', '박람회 상세 → 라운지 박람회(목록 화면 삭제 2026-09-25)'],
    ['/my/taste', '/my', '스타일 다시 고르기 → MY'],
    ['/wedding/w-1/expenses/add', '/wedding', '지출 추가 → 웨딩노트 예산현황'],
    ['/wedding/w-1/events/new', '/wedding', '일정 추가 → 웨딩노트 캘린더'],
    ['/wedding/w-1/consultations/c-1', '/wedding', '상담기록 상세 → 웨딩노트 상담기록'],
    ['/wedding/w-1/consultations/upload', '/wedding', '상담 녹음 추가 → 웨딩노트 상담기록'],
    ['/community/feed/f-1', '/community/feed', '라운지 웨딩정보 상세 → 웨딩정보 화면(my.jsx frame-010)'],
    ['/community/review', '/', '리얼후기 직접 진입 → 홈(옛 `/community`로 올라가면 리다이렉트로 되돌아온다)'],
    ['/community/feed', '/', '웨딩정보 직접 진입 → 홈'],
    ['/community/expo', '/', '박람회 직접 진입 → 홈'],

    // ── 폴더만 있고 화면이 없는 칸은 건너뛴다 ───────────────────────

    // ── 예외표 ────────────────────────────────────────────────────
    ['/search/compare', '/pick', 'WP-CMP-002 비교 결과 → Pick'],

    ...['candidates', 'changelog', 'conflict', 'decided', 'map', 'notes', 'quotes', 'tasks', 'timeline', 'visit-notes'].map((part): [string, string, string] => [
      `/wedding/w-1/${part}`, '/wedding', '서버 weddingId를 로컬 문서 식별자로 취급하지 않는다',
    ]),

    // ── 모르는 경로도 홈까지는 간다 ─────────────────────────────────
    ['/nope/deeper/still', '/', '없는 경로 → 홈'],
  ];

  it.each(cases)('%s → %s (%s)', (from, to) => {
    expect(depthBackTarget(from)).toBe(to);
  });

  it('쿼리와 끝 슬래시를 무시한다', () => {
    expect(depthBackTarget('/search/v-101/images?index=2')).toBe('/search/v-101');
  });

  it('공유 화면은 허용된 진입 출처로 돌아가고 모르는 출처는 추측하지 않는다', () => {
    expect(depthBackTarget('/community?from=my')).toBe('/my');
    expect(depthBackTarget('/community/review?from=my')).toBe('/my');
    expect(depthBackTarget('/community/expo?from=my')).toBe('/my');
    expect(depthBackTarget('/search/v-101?from=pick')).toBe('/pick');
    expect(depthBackTarget('/search/v-101/write-review?from=vendor/v-101')).toBe('/search/v-101');
    expect(depthBackTarget('/community?from=https%3A%2F%2Fevil.example')).toBe('/');
    expect(depthBackTarget('/community?from=%2Fadmin')).toBe('/');
    expect(depthBackTarget('/community?from=%E0%A4%A')).toBe('/');
  });

  /*
   * 2026-09-26 대표 감사(운영에서 재현) — MY → 연결관리 → Back이 웨딩노트로, MY → 리얼후기 → 후기 카드
   * → 업체 상세 → Back이 검색 홈으로 갔다. 두 화면은 다른 탭의 스택에 있어 계층대로 올라가면 틀린다.
   */
  it('연결관리(배우자 초대)는 들어온 자리로 돌아간다', () => {
    expect(depthBackTarget('/wedding/partner')).toBe('/wedding');
    expect(depthBackTarget('/wedding/partner?from=my')).toBe('/my');
    expect(depthBackTarget('/wedding/partner?from=notifications')).toBe('/my/notifications');
    expect(depthBackTarget('/wedding/partner?from=home')).toBe('/');
    /* 초대 수락은 연결관리로, 그 연결관리는 다시 자기 출처(MY)로 — 두 겹을 한 값으로 잇는다. */
    expect(depthBackTarget('/wedding/join?from=partner.my')).toBe('/wedding/partner?from=my');
    expect(depthBackTarget('/wedding/join?from=partner')).toBe('/wedding/partner');
    /* /invite 딥링크처럼 출처가 없으면 계층 부모 그대로다. */
    expect(depthBackTarget('/wedding/join')).toBe('/wedding');
  });

  it('업체 상세 · 후기 작성은 MY 후기 · 리얼후기로 돌아간다', () => {
    expect(depthBackTarget('/search/v-101?from=reviews')).toBe('/my/reviews');
    expect(depthBackTarget('/search/v-101/write-review?from=reviews')).toBe('/my/reviews');
    expect(depthBackTarget('/search/v-101?from=community')).toBe('/community/review');
    expect(depthBackTarget('/search/v-101?from=community.my')).toBe('/community/review?from=my');
    /* 검색에서 들어온 업체 상세는 그대로 검색으로(운영 확인 — 회귀 방지). */
    expect(depthBackTarget('/search/v-101')).toBe('/search');
    expect(depthBackTarget('/search/v-101/write-review')).toBe('/search/v-101');
  });

  it('이어진 출처도 허용된 값만 받는다', () => {
    /* 안쪽 값을 모르면 바깥 화면까지만 간다 — 추측해서 주소를 짓지 않는다. */
    expect(depthBackTarget('/search/v-101?from=community.%2Fadmin')).toBe('/community/review');
    expect(depthBackTarget('/search/v-101?from=community.https%3A%2F%2Fevil.example')).toBe('/community/review');
    /* 바깥 화면이 출처를 받지 않는 화면이면 안쪽 값을 버린다. */
    expect(depthBackTarget('/search/v-101?from=reviews.my')).toBe('/my/reviews');
    /* 한 겹까지만 잇는다. */
    expect(depthBackTarget('/wedding/join?from=partner.partner.my')).toBe('/wedding/partner');
    /* 자기 자신으로 돌아오는 고리는 잇지 않는다. */
    expect(depthBackTarget('/wedding/join?from=partner.partner')).toBe('/wedding/partner');
    /* 바깥 값을 모르면 계층 규칙으로 떨어진다. */
    expect(depthBackTarget('/search/v-101?from=nowhere.my')).toBe('/search');
  });

  it('chainOrigin은 안쪽 출처가 있을 때만 잇는다', () => {
    expect(chainOrigin('community', 'my')).toBe('community.my');
    expect(chainOrigin('community', null)).toBe('community');
    expect(chainOrigin('partner', ['notifications', 'x'])).toBe('partner.notifications');
    expect(chainOrigin('partner', undefined)).toBe('partner');
  });

  it('다른 탭 스택으로 건너가는 Back만 제스처를 끌 대상이다', () => {
    expect(crossesStackOnBack('/wedding/partner?from=my')).toBe(true);
    expect(crossesStackOnBack('/search/v-101?from=reviews')).toBe(true);
    expect(crossesStackOnBack('/search/v-101?from=community.my')).toBe(true);
    expect(crossesStackOnBack('/wedding/partner?from=home')).toBe(true);
    /* 같은 스택 안의 부모 — 스와이프가 그대로 맞다. */
    expect(crossesStackOnBack('/wedding/join?from=partner.my')).toBe(false);
    expect(crossesStackOnBack('/search/v-101/write-review?from=vendor/v-101')).toBe(false);
    expect(crossesStackOnBack('/search/v-101')).toBe(false);
    expect(crossesStackOnBack('/wedding/partner')).toBe(false);
  });

  it('Root 5탭에서는 더 올라가지 않는다', () => {
    for (const tab of ['/', '/search', '/pick', '/wedding', '/my']) {
      expect(depthBackTarget(tab)).toBe('/');
    }
  });
});

describe('matchRoute — 글자 그대로 적힌 라우트가 이긴다', () => {
  it('`/pick/studio`는 동적 `/pick/[category]`로 간다', () => {
  });

  it('`/search/compare`는 업체 상세가 아니다', () => {
    expect(matchRoute('/search/compare')).toBe('/search/compare');
    expect(matchRoute('/search/v-101')).toBe('/search/[vendorId]');
  });

  it('`/wedding/join`은 웨딩일정 홈이 아니다', () => {
    expect(matchRoute('/wedding/join')).toBe('/wedding/join');
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
    expect(hasDepthBack('/community')).toBe(true);
  });
});

describe('규칙의 앞뒤가 맞는가', () => {
  it('예외표의 열쇠와 목적지가 모두 실재하는 라우트다', () => {
    for (const [from, to] of Object.entries(DEPTH_BACK_EXCEPTIONS)) {
      expect(ROUTES).toContain(from);
      expect(matchRoute(to)).not.toBeNull();
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

  it('모든 사용자 라우트의 Depth 목적지가 실재하는 라우트다', () => {
    for (const route of ROUTES.filter((r) => r !== '/' && !r.startsWith('/admin'))) {
      const concrete = route.replace(/\[[^\]]+\]/g, 'x');

      expect(matchRoute(depthBackTarget(concrete))).not.toBeNull();
    }
  });

  it('모든 MY 상세는 MY 계층 안의 명시된 부모로 돌아간다', () => {
    for (const route of ROUTES.filter((r) => r.startsWith('/my/'))) {
      const concrete = route.replace(/\[[^\]]+\]/g, 'x');
      const target = depthBackTarget(concrete).split('?')[0];

      expect(target === '/my' || target?.startsWith('/my/')).toBe(true);
    }
  });

  it('History 예외는 실재하는 Back 화면만 중복 없이 가리킨다', () => {
    expect(new Set(HISTORY_BACK_ROUTES).size).toBe(HISTORY_BACK_ROUTES.length);

    for (const route of HISTORY_BACK_ROUTES) {
      const concrete = route.replace(/\[[^\]]+\]/g, 'x');

      expect(ROUTES).toContain(route);
      expect(hasHistoryBack(concrete)).toBe(true);
      expect(hasDepthBack(concrete)).toBe(!NO_BACK_ROUTES.includes(route));
    }
  });
});

describe('resolveBackAction — Android/공용 Back 정책', () => {
  it('홈만 종료하고 다른 Root 탭은 홈으로 보낸다', () => {
    expect(resolveBackAction('/', true)).toEqual({ kind: 'exit' });

    for (const route of ['/search', '/pick', '/wedding', '/my']) {
      expect(resolveBackAction(route, true)).toEqual({ kind: 'depth', target: '/' });
    }
  });

  it('하위 화면은 history가 있어도 논리 부모로 보낸다', () => {
    expect(resolveBackAction('/my/profile', true)).toEqual({ kind: 'depth', target: '/my' });
    expect(resolveBackAction('/community?from=my', true)).toEqual({ kind: 'depth', target: '/my' });
    expect(resolveBackAction('/wedding/partner?from=my', true)).toEqual({ kind: 'depth', target: '/my' });
    expect(resolveBackAction('/search/v-101?from=community.my', true)).toEqual({
      kind: 'depth',
      target: '/community/review?from=my',
    });
  });

  it('명시된 History 화면만 기록을 쓴다', () => {
    expect(resolveBackAction('/community/feed/f-1', true)).toEqual({ kind: 'history' });
    expect(resolveBackAction('/community/feed/f-1', false)).toEqual({
      kind: 'depth',
      target: '/community/feed',
    });
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

      /*
       * `_`로 시작하는 파일은 expo-router가 라우트로 잡지 않는다 — `_layout.tsx`뿐 아니라
       * 화면들이 나눠 쓰는 부품(`_ui.tsx`)도 마찬가지다. 라우터와 같은 규칙으로 거른다.
       */
      if (!entry.name.endsWith('.tsx') || entry.name.startsWith('_')) continue;

      /*
       * `+html.tsx`는 화면이 아니라 **웹으로 내보낸 HTML의 껍데기**다. expo-router가 따로
       * 읽어 문서 전체를 감싸고, 주소로 들어갈 수 있는 자리가 아니다. `+`로 시작하는 파일이
       * 전부 그런 것은 아니라(`+not-found.tsx`는 진짜 라우트다) 이름을 콕 집어 거른다.
       */
      if (entry.name === '+html.tsx') continue;

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


describe('완료 흐름은 이전 Stack을 다시 열지 않는다', () => {
  const { readFileSync } = nodeRequire('fs') as {
    readFileSync: (path: string, encoding: 'utf8') => string;
  };
  const { join } = nodeRequire('path') as { join: (...parts: string[]) => string };

  it('숨은 탭은 blur 시 하위 Stack을 접지 않는다', () => {
    const layout = readFileSync(join(dirName, '..', '..', 'app', '(tabs)', '_layout.tsx'), 'utf8');
    const common = readFileSync(join(dirName, 'screen-options.ts'), 'utf8');

    expect(layout).not.toContain("'capture'");
    expect(layout).toContain('popToTopOnBlur: false');
    expect(common).not.toContain('popToTopOnBlur: true');
  });
});
