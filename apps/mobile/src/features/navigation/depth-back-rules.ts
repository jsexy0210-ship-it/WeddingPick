/**
 * Depth Back — 화면 계층에서 **한 단계 위**로 가는 fallback 규칙. 앱 전체가 이 파일
 * 하나만 쓴다.
 *
 * ## 언제 이 표를 보는가 (SPEC §14.5)
 *
 * 좌상단 뒤로가기 버튼의 기본은 **Depth Back**이다(`depth-back.ts` `useDepthBack` ·
 * `goDepthBack`). 방문 기록이 있더라도 이 표가 정한 논리 부모로 간다. 그래야 MY 상세를
 * 검색이나 알림에서 열었어도 MY 홈으로 돌아가고, 우연히 앞에 있던 화면으로 튀지 않는다.
 *
 *   History Back  방문 순서를 되짚는다. 시트 닫기와 목록 상태 복원이 필요한 명시 화면만
 *                 쓴다. 안드로이드 하드웨어 버튼은 아래 `resolveBackAction`으로 같은 정책을
 *                 계산한다.
 *   Depth Back    기본값. 화면 계층에서 한 단계 위로 간다.
 *
 * History Back은 아래 `HISTORY_BACK_ROUTES`에 적힌 같은 계층의 목록/상세 또는 시트에만
 * 허용한다. 화면마다 `canGoBack()`을 임의로 쓰지 않는다.
 *
 * ## 계산 방법
 *
 *   1. 현재 경로가 예외표(`DEPTH_BACK_EXCEPTIONS`)에 있으면 거기 적힌 곳으로 간다.
 *   2. 아니면 마지막 조각을 하나씩 떼며 **실재하는 라우트**를 만날 때까지 올라간다.
 *      `/capture/result/[quoteId]` → 예외표의 웨딩노트로 간다.
 *   3. 끝까지 없으면 홈(`/`).
 *
 * 2번이 `ROUTES`를 필요로 한다 — 폴더가 있다고 화면이 있는 것은 아니기 때문이다.
 * 목록이 실제 파일과 어긋나면 `depth-back.test.ts`가 깨진다.
 */

/**
 * `apps/mobile/src/app` 아래 실재하는 화면의 경로 패턴. `(tabs)` · `(home)` 같은 그룹
 * 조각은 URL에 나오지 않으므로 빠져 있고, `index`는 부모 경로가 된다.
 *
 * **손으로 고치지 않는다** — 화면을 더하거나 지우면 `depth-back.test.ts`가 파일 목록과
 * 대조해 알려준다.
 */
export const ROUTES: readonly string[] = [
  '/',
  '/admin',
  '/admin/admins',
  '/admin/ads',
  '/admin/ads-gate',
  '/admin/ai-usage',
  '/admin/audit-log',
  '/admin/automation',
  '/admin/biz-queue',
  '/admin/briefing',
  '/admin/campaigns',
  '/admin/data-pipeline',
  '/admin/decisions',
  '/admin/email-matching',
  '/admin/expos',
  '/admin/faq',
  '/admin/home',
  '/admin/images',
  '/admin/inquiries',
  '/admin/kill-switch',
  '/admin/marketing',
  '/admin/policy-engine',
  '/admin/price-stats',
  '/admin/queue',
  '/admin/login',
  '/admin/objections',
  '/admin/og-card',
  '/admin/pii-reviews',
  '/admin/rebuttal',
  '/admin/report',
  '/admin/revenue',
  '/admin/rollback',
  '/admin/stats',
  '/admin/terms',
  '/admin/user-detail',
  '/admin/users',
  '/admin/vendors',
  '/admin/wedding-feed',
  '/community',
  '/community/feed/[id]',
  '/community/review/write',
  '/capture',
  '/capture/analysis/[id]',
  '/capture/camera',
  '/capture/payment/consent',
  '/capture/payment/register',
  '/capture/quote/consent',
  '/capture/result/[quoteId]',
  '/capture/review',
  '/capture/sample',
  '/capture/verify-status/[requestId]',
  '/capture/verify/[quoteId]',
  '/feed',
  '/feed/[id]',
  '/login',
  '/login/age-required',
  '/my',
  '/my/biz',
  '/my/biz/benefit',
  '/my/biz/claim',
  '/my/biz/data',
  '/my/contact',
  '/my/faq/[faqKey]',
  '/my/guide',
  '/my/membership',
  '/my/notification-settings',
  '/my/notifications',
  '/my/privacy',
  '/my/profile',
  '/my/rebuttals',
  '/my/rebuttals/[reviewId]',
  '/my/referral',
  '/my/reports',
  '/my/reviews',
  '/my/scraps',
  '/my/rewards',
  '/my/rewards/fund',
  '/my/rewards/history',
  '/my/rewards/missions',
  '/my/rewards/npay',
  '/my/rewards/promotion',
  '/my/taste',
  '/my/vendor-claims',
  '/my/vendor-claims/[vendorId]',
  '/my/wedding-settings',
  '/my/withdrawal',
  '/pick',
  '/pick/[category]',
  '/pick/confirm',
  '/pick/done',
  '/progress',
  '/recommendations',
  '/search',
  '/search/[vendorId]',
  '/search/[vendorId]/booking',
  '/search/[vendorId]/consult',
  '/search/[vendorId]/edit-review',
  '/search/[vendorId]/fix-report',
  '/search/[vendorId]/images',
  '/search/[vendorId]/price-report',
  '/search/[vendorId]/review/[reviewId]',
  '/search/[vendorId]/reviews',
  '/search/[vendorId]/write-review',
  '/search/autocomplete',
  '/search/compare',
  '/search/expo',
  '/search/expo/[expoId]',
  '/search/expo/[expoId]/calendar',
  '/search/wedding-info',
  '/search/wedding-info/[infoId]',
  '/setup',
  '/top3',
  '/wedding',
  '/wedding/[id]',
  '/wedding/[id]/candidates',
  '/wedding/[id]/changelog',
  '/wedding/[id]/complete',
  '/wedding/[id]/conflict',
  '/wedding/[id]/decided',
  '/wedding/[id]/events/[eventId]',
  '/wedding/[id]/events/new',
  '/wedding/[id]/expenses/[expenseId]',
  '/wedding/[id]/expenses/add',
  '/wedding/[id]/expenses/list',
  '/wedding/[id]/map',
  '/wedding/[id]/notes',
  '/wedding/[id]/quotes',
  '/wedding/[id]/tasks',
  '/wedding/[id]/timeline',
  '/wedding/[id]/verify',
  '/wedding/[id]/consultations/[recordId]',
  '/wedding/[id]/consultations/upload',
  '/wedding/[id]/visit-notes',
  '/wedding/join',
  '/wedding/partner',
];

/** Root 5탭(SPEC §12.2 · 05-root). 여기에는 뒤로가기를 두지 않는다 — 위가 없다. */
/*
 * Root 5탭(2026-09-18 정본 · `features/navigation/root-tabs.ts`와 같은 다섯).
 * 홈 · 검색 · Pick · 웨딩노트 · MY만 루트다. 라운지(`/community`)는 홈/MY에서
 * 들어가는 하위 화면이라 Depth Back 대상이다.
 */
export const TAB_ROOTS: readonly string[] = ['/', '/search', '/pick', '/wedding', '/my'];

/**
 * SPEC §14.5가 허용한 History Back 예외.
 *
 * - 피드 상세 둘은 목록의 탭·스크롤 위치를 복원한다.
 * - 비교 후보 선택과 최종 결정 확인은 화면이 아니라 기존 화면 위에 열린 시트라 연 자리만 닫는다.
 * - 문서 확인은 촬영·선택 직후의 확인 단계라 직전 업로드 화면으로 돌아간다.
 *
 * 직접 진입처럼 history가 없으면 `depthBackTarget`의 논리 부모를 쓴다.
 */
export const HISTORY_BACK_ROUTES: readonly string[] = [
  '/feed/[id]',
  '/community/feed/[id]',
  '/pick/confirm',
  '/capture/review',
];

/**
 * 뒤로가기 버튼을 두지 않는 화면.
 *
 *   Root 5탭            위가 없다. 05-root.
 *   `/setup`            WP-APP-022 layout «nav 56 — Back 없음».
 *                          `_layout.tsx`가 `gestureEnabled: false`로 스와이프도 막아둔다 —
 *                          그 정책은 그대로 둔다.
 *   `/login`            WP-AUTH-001. 앞이 스플래시라 돌아갈 곳이 없다.
 *   `/login/age-required`  WP-AUTH-009. 계정을 만들지 않고 로그인으로만 되돌린다 —
 *                          화면이 직접 `replace('/login')`를 넘긴다.
 *   `/my/membership`    화면이 아니라 `Redirect` 한 줄이다(v3.22가 미션으로 옮겼다).
 *   `/admin/**`         관리자 콘솔은 좌측 사이드바가 이동을 맡는다.
 *   `/capture/camera`   전체 화면 카메라. 자체 닫기를 쓴다.
 */
export const NO_BACK_ROUTES: readonly string[] = [
  ...TAB_ROOTS,
  '/setup',
  '/login',
  '/login/age-required',
  '/my/membership',
  '/capture/camera',
  /*
   * Pick 확정은 화면이 아니라 **바텀시트**다. 나가는 길은 시트가 이미
   * 셋을 들고 있다(딤 탭 · 안드로이드 뒤로가기 · 시트 안 버튼) — 여기에 뒤로가기 줄을
   * 얹으면 시트 위에 화면 헤더가 떠서 무엇을 닫는 버튼인지 알 수 없게 된다.
   */
  '/pick/confirm',
];

/**
 * 예외표 — 계층을 올라가는 것만으로는 틀리는 자리. 근거를 함께 적는다.
 * 값에 `[param]`을 쓰면 현재 경로에서 같은 이름의 값을 그대로 옮겨 담는다.
 *
 * | 라우트                              | 간다              | 근거                                                                     |
 * | ---------------------------------- | ---------------- | ------------------------------------------------------------------------ |
 * | `/capture`                         | `/my/reports`    | 독립 제보 홈은 삭제되었고 예전 링크는 Pick 인증으로 전환된다.       |
 * | `/capture/payment/*`               | `/my/reports`    | 진입 출처가 없는 직접 링크에서는 내 제보내역이 논리 부모다.              |
 * | `/capture/analysis·result/*`     | `/wedding`       | 견적서 분석과 결과는 웨딩노트 문서 여정에서 열린다.                    |
 * | `/capture/sample`                  | `/my/guide`      | 샘플은 MY 사용법에서만 열린다.                                      |
 * | `/capture/verify/[quoteId]`        | `/capture/result/[quoteId]` | 자료 확인 신청은 WP-RPT-004 결과 확인에서만 들어간다. 폴더만 갈라져 있다.  |
 * | `/capture/verify-status/[requestId]` | `/my/reports`  | WP-RPT-008 처리 결과. entry «알림 · 내 제보 내역».                          |
 * | `/search/compare`                  | `/pick`          | WP-CMP-002 비교 결과. 후보를 고른 곳이 Pick이다(WP-PICK-003). 검색 폴더에    |
 * |                                    |                  | 있을 뿐이고, 홈·Pick 어디서 들어와도 Pick으로 나간다.                       |
 * | `/pick/done`                       | `/pick`          | WP-PICK-006 결정 완료. **히스토리로 돌려보내면 방금 끝낸 확인 시트로 돌아간다.** |
 * |                                    |                  | 계층 계산과 값이 같지만, 이 화면은 History Back을 쓰면 안 된다는 근거를 남긴다. |
 * | `/my/faq/[faqKey]`                 | `/my/guide`      | 질문 상세는 FAQ 목록에서 연다. 폴더상 `/my`로 바로 보내면 목록을 건너뛴다.   |
 * | `/my/referral`                     | `/my/rewards`    | 초대 현황은 혜택(WP-EVT) 아래다. 폴더가 `my/` 바로 아래라 계층 계산이 틀린다. |
 * | `/wedding/[id]/complete`           | `/wedding`       | WP-OUR-013 예식 완료 → 서버 웨딩일정 탭. `[id]` 문서 상세와 식별자가 다르다.        |
 */
export const DEPTH_BACK_EXCEPTIONS: Readonly<Record<string, string>> = {
  '/community/feed/[id]': '/community?tab=feed',
  '/capture': '/my/reports',
  '/capture/analysis/[id]': '/wedding',
  '/capture/payment/consent': '/my/reports',
  '/capture/payment/register': '/my/reports',
  '/capture/quote/consent': '/wedding',
  '/capture/result/[quoteId]': '/wedding',
  '/capture/sample': '/my/guide',
  '/capture/verify/[quoteId]': '/capture/result/[quoteId]',
  '/capture/verify-status/[requestId]': '/my/reports',
  '/search/compare': '/pick',
  '/pick/done': '/pick',
  '/my/faq/[faqKey]': '/my/guide',
  '/my/referral': '/my/rewards',
  // 이 경로의 id는 서버 weddingId다. /wedding/[id]는 로컬 문서 상세이므로 그곳으로 보내지 않는다.
  '/wedding/[id]/candidates': '/wedding',
  '/wedding/[id]/changelog': '/wedding',
  '/wedding/[id]/complete': '/wedding',
  '/wedding/[id]/conflict': '/wedding',
  '/wedding/[id]/decided': '/wedding',
  '/wedding/[id]/events/[eventId]': '/wedding',
  '/wedding/[id]/events/new': '/wedding',
  '/wedding/[id]/expenses/[expenseId]': '/wedding',
  '/wedding/[id]/expenses/add': '/wedding',
  '/wedding/[id]/expenses/list': '/wedding',
  '/wedding/[id]/consultations/[recordId]': '/wedding',
  '/wedding/[id]/consultations/upload': '/wedding',
  '/wedding/[id]/map': '/wedding',
  '/wedding/[id]/notes': '/wedding',
  '/wedding/[id]/quotes': '/wedding',
  '/wedding/[id]/tasks': '/wedding',
  '/wedding/[id]/timeline': '/wedding',
  '/wedding/[id]/visit-notes': '/wedding',
};

/** SPEC §14.5에서 진입 출처를 `from`으로 넘기라고 정한 공유 화면. */
const ORIGIN_AWARE_ROUTES: readonly string[] = [
  '/community',
  '/search/[vendorId]',
  '/search/[vendorId]/write-review',
  '/search/[vendorId]/review/[reviewId]',
  '/capture/payment/consent',
  '/capture/payment/register',
];

/** `/a/b/?x=1#y` → `['a','b']`. 쿼리·해시·끝 슬래시를 떨군다. */
function segmentsOf(path: string): string[] {
  const bare = path.split('?')[0]!.split('#')[0]!;

  return bare.split('/').filter((segment) => segment.length > 0);
}

function decodeQueryPart(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

function queryValue(pathname: string, key: string): string | null {
  const query = pathname.split('?')[1]?.split('#')[0];
  if (!query) return null;

  for (const pair of query.split('&')) {
    const [encodedKey, encodedValue = ''] = pair.split('=');
    if (decodeQueryPart(encodedKey ?? '') === key) return decodeQueryPart(encodedValue);
  }

  return null;
}

function isDynamic(segment: string): boolean {
  return segment.startsWith('[') && segment.endsWith(']');
}

/** `[id]` · `[...rest]` → `id` · `rest`. */
function paramName(segment: string): string {
  return segment.slice(1, -1).replace(/^\.\.\./, '');
}

/**
 * 실제 경로에 맞는 라우트 패턴 하나. 같은 칸을 두 패턴이 노릴 때는
 * **글자 그대로 적힌 쪽**이 이긴다 — `/search/compare`는 `/search/[vendorId]`가 아니다.
 */
export function matchRoute(pathname: string): string | null {
  const segments = segmentsOf(pathname);
  let best: string | null = null;
  let bestScore = -1;

  for (const route of ROUTES) {
    const pattern = segmentsOf(route);

    if (pattern.length !== segments.length) continue;

    let score = 0;
    let ok = true;

    for (let i = 0; i < pattern.length; i += 1) {
      const slot = pattern[i]!;

      if (isDynamic(slot)) continue;
      if (slot !== segments[i]) {
        ok = false;
        break;
      }
      score += 1;
    }

    if (ok && score > bestScore) {
      best = route;
      bestScore = score;
    }
  }

  return best;
}

/** 패턴의 `[param]` 자리에 실제 경로의 값을 채운다. 값을 못 찾으면 그 자리는 비운 채 둔다. */
function fill(target: string, route: string, pathname: string): string {
  const pattern = segmentsOf(route);
  const actual = segmentsOf(pathname);
  const values: Record<string, string> = {};

  pattern.forEach((slot, i) => {
    if (isDynamic(slot) && actual[i]) values[paramName(slot)] = actual[i]!;
  });

  const [targetPath, query] = target.split('?');
  const filled = segmentsOf(targetPath ?? target).map((slot) =>
    isDynamic(slot) ? (values[paramName(slot)] ?? slot) : slot
  );
  const path = filled.length > 0 ? `/${filled.join('/')}` : '/';

  return query ? `${path}?${query}` : path;
}

/** 공유 화면의 `from` 값을 실재하는 논리 부모로 바꾼다. 모르는 값은 추측하지 않는다. */
function originTarget(route: string, pathname: string): string | null {
  if (!ORIGIN_AWARE_ROUTES.includes(route)) return null;

  const from = queryValue(pathname, 'from');
  if (!from) return null;

  const aliases: Readonly<Record<string, string>> = {
    home: '/',
    my: '/my',
    search: '/search',
    pick: '/pick',
    wedding: '/wedding',
    budget: '/wedding?tab=budget',
    community: '/community',
    reports: '/my/reports',
    recommendations: '/recommendations',
  };
  const vendor = from.match(/^vendor\/([^/?#]+)$/);
  const target = aliases[from] ?? (vendor ? `/search/${vendor[1]}` : null);

  return target && matchRoute(target) ? target : null;
}

/**
 * 지금 이 경로에서 뒤로가기가 갈 곳. **부모가 있으면 부모, 없으면 그 위**로 올라간다.
 *
 * 방문 기록을 보지 않는다 — 링크로 곧장 들어왔든 세 화면을 거쳐 왔든 답이 같다.
 */
export function depthBackTarget(pathname: string): string {
  const route = matchRoute(pathname);

  if (route) {
    const origin = originTarget(route, pathname);
    if (origin) return origin;

    const exception = DEPTH_BACK_EXCEPTIONS[route];

    if (exception) return fill(exception, route, pathname);
  }

  const segments = segmentsOf(pathname);

  for (let i = segments.length - 1; i > 0; i -= 1) {
    const candidate = `/${segments.slice(0, i).join('/')}`;

    if (matchRoute(candidate)) return candidate;
  }

  return '/';
}

/** 좌상단에 뒤로가기를 둘 자리인가. Root 5탭 · 온보딩 · 로그인은 두지 않는다. */
export function hasDepthBack(pathname: string): boolean {
  const route = matchRoute(pathname) ?? `/${segmentsOf(pathname).join('/')}`;

  return !NO_BACK_ROUTES.includes(route) && !route.startsWith('/admin');
}

/** SPEC §14.5의 명시된 History Back 화면인가. */
export function hasHistoryBack(pathname: string): boolean {
  const route = matchRoute(pathname);

  return route !== null && HISTORY_BACK_ROUTES.includes(route);
}

export type BackAction =
  | { kind: 'exit' }
  | { kind: 'history' }
  | { kind: 'depth'; target: string };

/**
 * SPEC §14.5의 화면/안드로이드 Back 결정을 부작용 없이 계산한다.
 * 홈만 종료 대상이고, 다른 Root 탭은 홈, 하위 화면은 Depth 부모로 간다.
 */
export function resolveBackAction(pathname: string, canGoBack: boolean): BackAction {
  const route = matchRoute(pathname);

  if (route === '/') return { kind: 'exit' };
  if (route && TAB_ROOTS.includes(route)) return { kind: 'depth', target: '/' };
  if (hasHistoryBack(pathname) && canGoBack) return { kind: 'history' };

  return { kind: 'depth', target: depthBackTarget(pathname) };
}
