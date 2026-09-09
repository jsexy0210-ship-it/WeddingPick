/**
 * Depth Back — 화면 계층에서 **한 단계 위**로 가는 규칙. 앱 전체가 이 파일 하나만 쓴다.
 *
 * ## History Back과 무엇이 다른가
 *
 *   History Back  방문 순서를 되짚는다. 안드로이드 하드웨어 버튼 · 웹 브라우저 뒤로 ·
 *                 iOS 가장자리 스와이프가 그것이고, **그대로 둔다**(막지 않는다).
 *   Depth Back    화면 계층에서 한 단계 위로 간다. 링크로 곧장 들어와 방문 기록이
 *                 없어도 언제나 부모로 간다. **좌상단 뒤로가기 버튼이 이것이다.**
 *
 * 예전에는 버튼이 `canGoBack() ? back() : replace(fallback)`이었다. 기록이 있으면
 * 방문 순서를 따라가므로, MY에서 검색 결과로 들어갔다가 뒤로 누르면 MY가 아니라
 * 직전에 있던 다른 탭으로 튀었다. 화면마다 `fallback`을 따로 적어둔 것도 서로 어긋났다
 * (`BackButton` `/search` · `SubScreen` `/my` · `NavBar` `/wedding`). 셋을 없애고
 * **현재 경로에서 부모를 계산**한다.
 *
 * ## 계산 방법
 *
 *   1. 현재 경로가 예외표(`DEPTH_BACK_EXCEPTIONS`)에 있으면 거기 적힌 곳으로 간다.
 *   2. 아니면 마지막 조각을 하나씩 떼며 **실재하는 라우트**를 만날 때까지 올라간다.
 *      `/capture/result/[quoteId]` → `/capture/result`(라우트 아님) → `/capture`(라우트).
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
  '/admin/faq',
  '/admin/home',
  '/admin/images',
  '/admin/kill-switch',
  '/admin/marketing',
  '/admin/policy-engine',
  '/admin/price-stats',
  '/admin/queue',
  '/admin/objections',
  '/admin/pii-reviews',
  '/admin/rebuttal',
  '/admin/report',
  '/admin/revenue',
  '/admin/rollback',
  '/admin/stats',
  '/admin/terms',
  '/admin/users',
  '/admin/vendors',
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
  '/home-edit',
  '/login',
  '/login/age-required',
  '/my',
  '/my/account',
  '/my/biz',
  '/my/biz/benefit',
  '/my/biz/claim',
  '/my/biz/data',
  '/my/contact',
  '/my/display',
  '/my/faq/[faqKey]',
  '/my/guide',
  '/my/membership',
  '/my/notification-settings',
  '/my/notifications',
  '/my/policies',
  '/my/privacy',
  '/my/profile',
  '/my/rebuttals',
  '/my/rebuttals/[reviewId]',
  '/my/referral',
  '/my/reports',
  '/my/reviews',
  '/my/rewards',
  '/my/rewards/fund',
  '/my/rewards/history',
  '/my/rewards/missions',
  '/my/rewards/npay',
  '/my/rewards/promotion',
  '/my/settings',
  '/my/support',
  '/my/taste',
  '/my/vendor-claims',
  '/my/vendor-claims/[vendorId]',
  '/my/wedding-settings',
  '/my/withdrawal',
  '/onboarding',
  '/pick',
  '/pick/[category]',
  '/pick/category',
  '/pick/compare',
  '/pick/confirm',
  '/pick/done',
  '/pick/history',
  '/pick/removed',
  '/progress',
  '/search',
  '/search/[vendorId]',
  '/search/[vendorId]/edit-review',
  '/search/[vendorId]/fix-report',
  '/search/[vendorId]/images',
  '/search/[vendorId]/price-report',
  '/search/[vendorId]/reviews',
  '/search/[vendorId]/write-review',
  '/search/autocomplete',
  '/search/compare',
  '/search/expo',
  '/search/expo/[expoId]',
  '/search/expo/[expoId]/calendar',
  '/search/filter',
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
  '/wedding/[id]/events',
  '/wedding/[id]/events/[eventId]',
  '/wedding/[id]/events/new',
  '/wedding/[id]/expenses',
  '/wedding/[id]/expenses/[expenseId]',
  '/wedding/[id]/expenses/add',
  '/wedding/[id]/expenses/list',
  '/wedding/[id]/map',
  '/wedding/[id]/notes',
  '/wedding/[id]/quotes',
  '/wedding/[id]/tasks',
  '/wedding/[id]/timeline',
  '/wedding/[id]/verify',
  '/wedding/[id]/visit-notes',
  '/wedding/join',
  '/wedding/partner',
];

/** Root 5탭(SPEC §12.2 · 05-root). 여기에는 뒤로가기를 두지 않는다 — 위가 없다. */
export const TAB_ROOTS: readonly string[] = ['/', '/search', '/pick', '/wedding', '/my'];

/**
 * 뒤로가기 버튼을 두지 않는 화면.
 *
 *   Root 5탭            위가 없다. 05-root.
 *   `/onboarding` `/setup`  WP-APP-020 · WP-APP-022 layout «nav 56 — Back 없음».
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
  '/onboarding',
  '/setup',
  '/login',
  '/login/age-required',
  '/my/membership',
  '/capture/camera',
  // 홈 편집은 닫기(X)로 나간다 — 뒤로가기 화살표를 두지 않는다(시안 close: true).
  '/home-edit',
];

/**
 * 예외표 — 계층을 올라가는 것만으로는 틀리는 자리. 근거를 함께 적는다.
 * 값에 `[param]`을 쓰면 현재 경로에서 같은 이름의 값을 그대로 옮겨 담는다.
 *
 * | 라우트                              | 간다              | 근거                                                                     |
 * | ---------------------------------- | ---------------- | ------------------------------------------------------------------------ |
 * | `/capture`                         | `/my`            | 제보는 Root 탭이 아니다(WP-NAV-006). WP-RPT-001 entry «MY · 맥락형 4곳» —   |
 * |                                    |                  | 대표 진입점이 MY 제보 메뉴다. 폴더상 부모는 홈이라 계층 계산이 틀린다.       |
 * | `/capture/verify/[quoteId]`        | `/capture/result/[quoteId]` | 자료 확인 신청은 WP-RPT-004 결과 확인에서만 들어간다. 폴더만 갈라져 있다.  |
 * | `/capture/verify-status/[requestId]` | `/my/reports`  | WP-RPT-008 처리 결과. entry «알림 · 내 제보 내역».                          |
 * | `/search/compare`                  | `/pick`          | WP-CMP-002 비교 결과. 후보를 고른 곳이 Pick이다(WP-PICK-003). 검색 폴더에    |
 * |                                    |                  | 있을 뿐이고, 홈·Pick 어디서 들어와도 Pick으로 나간다.                       |
 * | `/pick/done`                       | `/pick`          | WP-PICK-006 결정 완료. **히스토리로 돌려보내면 방금 끝낸 확인 시트로 돌아간다.** |
 * |                                    |                  | 계층 계산과 값이 같지만, 이 화면은 History Back을 쓰면 안 된다는 근거를 남긴다. |
 * | `/pick/removed`                    | `/pick/history`  | 제거된 후보는 WP-PICK-007 결정 내역의 «제거된 후보 보기»에서만 들어간다.      |
 * | `/my/referral`                     | `/my/rewards`    | 초대 현황은 혜택(WP-EVT) 아래다. 폴더가 `my/` 바로 아래라 계층 계산이 틀린다. |
 * | `/wedding/[id]/complete`           | `/wedding/[id]`  | (예외 아님 · 계층 계산이 맞다) WP-OUR-013 예식 완료 → 그 웨딩일정 홈.        |
 */
export const DEPTH_BACK_EXCEPTIONS: Readonly<Record<string, string>> = {
  '/capture': '/my',
  '/capture/verify/[quoteId]': '/capture/result/[quoteId]',
  '/capture/verify-status/[requestId]': '/my/reports',
  '/search/compare': '/pick',
  '/pick/done': '/pick',
  '/pick/removed': '/pick/history',
  '/my/referral': '/my/rewards',
};

/** `/a/b/?x=1#y` → `['a','b']`. 쿼리·해시·끝 슬래시를 떨군다. */
function segmentsOf(path: string): string[] {
  const bare = path.split('?')[0]!.split('#')[0]!;

  return bare.split('/').filter((segment) => segment.length > 0);
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
 * **글자 그대로 적힌 쪽**이 이긴다 — `/pick/category`는 `/pick/[category]`가 아니다.
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

  const filled = segmentsOf(target).map((slot) => (isDynamic(slot) ? (values[paramName(slot)] ?? slot) : slot));

  return filled.length > 0 ? `/${filled.join('/')}` : '/';
}

/**
 * 지금 이 경로에서 뒤로가기가 갈 곳. **부모가 있으면 부모, 없으면 그 위**로 올라간다.
 *
 * 방문 기록을 보지 않는다 — 링크로 곧장 들어왔든 세 화면을 거쳐 왔든 답이 같다.
 */
export function depthBackTarget(pathname: string): string {
  const route = matchRoute(pathname);

  if (route) {
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
