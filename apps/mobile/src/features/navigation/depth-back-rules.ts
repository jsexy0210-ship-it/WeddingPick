import { PREPARATION_GROUPS } from '@weddingpick/domain';

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
  '/community/expo',
  '/community/feed',
  '/community/feed/[id]',
  '/community/review',
  '/community/review/write',
  '/feed/[id]',
  /* 배우자 초대 안내 주소 — 화면 없이 /wedding/join으로 보낸다(2026-09-25). */
  '/invite',
  '/login',
  '/login/age-required',
  '/login/consent',
  '/my',
  '/my/contact',
  '/my/contact/[inquiryId]',
  '/my/guide',
  '/my/notifications',
  '/my/privacy-policy',
  '/my/profile',
  '/my/reports',
  '/my/reviews',
  '/my/taste',
  '/my/wedding-settings',
  '/my/withdrawal',
  '/pick',
  '/search',
  '/search/[vendorId]',
  '/search/[vendorId]/booking',
  '/search/[vendorId]/consult',
  '/search/[vendorId]/consult-done',
  '/search/[vendorId]/fix-report',
  '/search/[vendorId]/images',
  '/search/[vendorId]/write-review',
  '/search/compare',
  '/search/expo/[expoId]',
  '/search/expo/[expoId]/calendar',
  '/+not-found',
  '/setup',
  '/wedding',
  '/wedding/[id]/changelog',
  '/wedding/[id]/decided',
  '/wedding/[id]/events/new',
  '/wedding/[id]/expenses/add',
  '/wedding/[id]/expenses/list',
  '/wedding/[id]/map',
  '/wedding/[id]/consultations/[recordId]',
  '/wedding/[id]/consultations/upload',
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
 * - (옛 최종 결정 확인 시트 `/pick/confirm`은 2026-09-25 대표 결정으로 삭제했다.)
 *
 * 직접 진입처럼 history가 없으면 `depthBackTarget`의 논리 부모를 쓴다.
 */
export const HISTORY_BACK_ROUTES: readonly string[] = [
  '/feed/[id]',
  '/community/feed/[id]',
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
 *   `/admin/**`         관리자 콘솔은 좌측 사이드바가 이동을 맡는다.
 */
export const NO_BACK_ROUTES: readonly string[] = [
  ...TAB_ROOTS,
  '/setup',
  '/login',
  '/login/age-required',
];

/**
 * 예외표 — 계층을 올라가는 것만으로는 틀리는 자리. 근거를 함께 적는다.
 * 값에 `[param]`을 쓰면 현재 경로에서 같은 이름의 값을 그대로 옮겨 담는다.
 *
 * | 라우트                              | 간다              | 근거                                                                     |
 * | ---------------------------------- | ---------------- | ------------------------------------------------------------------------ |
 * | `/search/compare`                  | `/pick`          | WP-CMP-002 비교 결과. 후보를 고른 곳이 Pick이다(WP-PICK-003). 검색 폴더에    |
 * |                                    |                  | 있을 뿐이고, 홈·Pick 어디서 들어와도 Pick으로 나간다.                       |
 * |                                    |                  | 계층 계산과 값이 같지만, 이 화면은 History Back을 쓰면 안 된다는 근거를 남긴다. |
 */
export const DEPTH_BACK_EXCEPTIONS: Readonly<Record<string, string>> = {
  '/community/expo': '/',
  '/community/feed': '/',
  '/community/feed/[id]': '/community/feed',
  '/community/review': '/',
  '/search/compare': '/pick',
  // 박람회 목록(`/search/expo`)은 2026-09-25 삭제 — 상세는 라운지 박람회 탭에서 연다.
  // 계층대로 올라가면 `/search/expo`가 업체 상세(`/search/[vendorId]`)로 잘못 잡힌다.
  '/search/expo/[expoId]': '/community/expo',
  // 이 경로의 id는 서버 weddingId다. /wedding/[id]는 로컬 문서 상세이므로 그곳으로 보내지 않는다.
  '/wedding/[id]/changelog': '/wedding',
  '/wedding/[id]/decided': '/wedding',
  '/wedding/[id]/events/new': '/wedding',
  '/wedding/[id]/expenses/add': '/wedding',
  '/wedding/[id]/expenses/list': '/wedding',
  '/wedding/[id]/consultations/[recordId]': '/wedding',
  '/wedding/[id]/consultations/upload': '/wedding',
  '/wedding/[id]/map': '/wedding',
};

/**
 * SPEC §14.5에서 진입 출처를 `from`으로 넘기라고 정한 공유 화면.
 *
 * `/wedding/partner` · `/wedding/join` — 연결관리(WP-CPL-001 · 002)는 파일이 웨딩노트 스택에
 * 있지만 정본(`React_Native/my.jsx` 14 «배우자 초대» — 「연결관리에서 들어옵니다」)은 MY 아래다.
 * 계층대로 올라가면 `/wedding`으로 떨어진다(2026-09-26 대표 감사 — MY → 연결관리 → Back이
 * 웨딩노트로 갔다). 들어온 자리를 `from`으로 받아 그리로 돌아간다.
 */
const ORIGIN_AWARE_ROUTES: readonly string[] = [
  '/community',
  '/community/expo',
  '/community/feed',
  '/community/review',
  '/search/[vendorId]',
  /*
   * 상담 예약(WP-PICK-009) — Pick 카드(`pick/index.tsx` «카드를 누르면 상담 예약으로 바로»)에서
   * 곧장 열린다. 출처 없이 닫으면 업체 상세(검색 스택)로 떨어진다(2026-09-26 대표 감사 — Pick에서
   * 들어간 화면의 Back이 검색으로 갔다). `/booking`은 같은 화면의 옛 주소다.
   */
  '/search/[vendorId]/booking',
  '/search/[vendorId]/consult',
  '/search/[vendorId]/write-review',
  '/wedding/join',
  '/wedding/partner',
];

/**
 * `from` 값 → 돌아갈 화면. **여기 적힌 것만** 받는다 — 주소를 그대로 받으면 바깥 주소나
 * 관리자 경로로 튀게 만들 수 있다. 모르는 값은 추측하지 않고 계층 규칙으로 떨어진다.
 */
const ORIGIN_ALIASES: Readonly<Record<string, string>> = {
  home: '/',
  my: '/my',
  search: '/search',
  /* `pick/<묶음>`(`pick/sdm`)은 아래 `aliasTarget`이 `/pick?group=<묶음>`으로 푼다. */
  pick: '/pick',
  wedding: '/wedding',
  budget: '/wedding?tab=budget',
  community: '/community/review',
  reports: '/my/reports',
  /* MY → 내가 쓴 후기(WP-MY-006) → 업체 상세 · 후기 작성. */
  reviews: '/my/reviews',
  /* MY → 알림 → 배우자 알림 → 연결관리. */
  notifications: '/my/notifications',
  /* 연결관리 → 초대 수락(WP-CPL-002). */
  partner: '/wedding/partner',
};

/** `from` 연결 깊이 한도 — `community.my`처럼 한 번 이어진 것까지만 받는다. */
const MAX_ORIGIN_CHAIN = 1;

/**
 * 출처가 자기 출처를 가진 화면일 때 두 겹을 한 값으로 잇는다 — `community` + `my` →
 * `community.my`. MY → 리얼후기 → 업체 상세 → Back이 리얼후기로, 거기서 다시 Back이
 * MY로 가야 한다(2026-09-26 대표 감사 — 업체 상세 Back이 검색으로 갔다).
 */
export function chainOrigin(alias: string, from?: string | string[] | null): string {
  const inner = Array.isArray(from) ? from[0] : from;

  return inner ? `${alias}.${inner}` : alias;
}

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

/**
 * Pick 화면의 출처 값 — 칩이 «전체»면 `pick`, 준비 묶음이 켜져 있으면 `pick/<묶음>`.
 * Pick → «내 조건에 맞는 곳» → 업체 상세 → Back이 **그 칩이 켜진 Pick**으로 돌아간다
 * (2026-09-26 대표 감사 — 업체 상세 Back이 검색으로 갔다). 모르는 묶음은 `pick`으로 떨군다.
 */
export function pickOrigin(group?: string | null): string {
  return group && PREPARATION_GROUPS.some((item) => item.key === group) ? `pick/${group}` : 'pick';
}

/** `pick/<묶음>` → `/pick?group=<묶음>`. 준비 묶음 넷(`PREPARATION_GROUPS`)만 받는다. */
function pickGroupTarget(alias: string): string | null {
  const match = alias.match(/^pick\/([a-z]+)$/);
  const group = match?.[1];

  return group && PREPARATION_GROUPS.some((item) => item.key === group) ? `/pick?group=${group}` : null;
}

/** 비교(WP-CMP-002)가 한 번에 견주는 업체 수의 상한 — `features/pick/canonical-rules` `PICK_COMPARE_MAX`와 같다. */
const COMPARE_ORIGIN_MAX = 3;

/**
 * 비교 화면의 출처 값 — `compare/<업체>,<업체>`. 비교 → 상담 예약 → 닫기가 **같은 업체를 견주던 그
 * 비교**로 돌아간다(2026-09-26 대표 감사 — Pick에서 들어간 화면의 Back 출처 보존). 비교 목록은 주소
 * 말고는 다시 만들 길이 없어 목록째 넘긴다. 업체 id 모양(영문·숫자·`-`)이 아니면 값을 만들지 않는다.
 */
export function compareOrigin(ids: readonly string[]): string | null {
  const valid = ids.length >= 2 && ids.length <= COMPARE_ORIGIN_MAX && ids.every((id) => /^[A-Za-z0-9-]+$/.test(id));

  return valid ? `compare/${ids.join(',')}` : null;
}

/** `compare/<업체>,<업체>` → `/search/compare?ids=<업체>,<업체>`. 두 곳 이상 · 상한 이하만 받는다. */
function compareTarget(alias: string): string | null {
  const match = alias.match(/^compare\/([A-Za-z0-9-]+(?:,[A-Za-z0-9-]+)+)$/);
  const ids = match?.[1]?.split(',') ?? [];

  return ids.length >= 2 && ids.length <= COMPARE_ORIGIN_MAX ? `/search/compare?ids=${ids.join(',')}` : null;
}

/** 출처 한 조각(`my` · `vendor/v-1` · `pick/sdm` · `compare/a,b`) → 실재하는 화면 주소. 모르면 null. */
function aliasTarget(alias: string): string | null {
  const vendor = alias.match(/^vendor\/([^/?#.]+)$/);
  const target = ORIGIN_ALIASES[alias] ?? (vendor ? `/search/${vendor[1]}` : pickGroupTarget(alias) ?? compareTarget(alias));

  return target && matchRoute(target) ? target : null;
}

/**
 * `from` 값 → 돌아갈 주소. `a.b`는 «`a` 화면에 `from=b`를 붙인 것»이다(`chainOrigin`).
 * 안쪽 값은 바깥 화면이 출처를 받는 화면이고, 한 겹이고, 허용된 값이고, 자기 자신이 아닐 때만
 * 잇는다 — 그 밖에는 바깥 화면까지만 간다.
 */
function resolveOrigin(from: string): string | null {
  const [head = '', ...rest] = from.split('.');
  const base = aliasTarget(head);

  if (!base) return null;
  if (rest.length === 0) return base;

  const inner = rest.join('.');
  const innerTarget = rest.length > MAX_ORIGIN_CHAIN ? null : aliasTarget(inner);
  const baseRoute = matchRoute(base);

  if (!innerTarget || innerTarget === base || base.includes('?') || !baseRoute || !ORIGIN_AWARE_ROUTES.includes(baseRoute)) {
    return base;
  }

  return `${base}?from=${encodeURIComponent(inner)}`;
}

/** 공유 화면의 `from` 값을 실재하는 논리 부모로 바꾼다. 모르는 값은 추측하지 않는다. */
function originTarget(route: string, pathname: string): string | null {
  if (!ORIGIN_AWARE_ROUTES.includes(route)) return null;

  const from = queryValue(pathname, 'from');
  if (!from) return null;

  return resolveOrigin(from);
}

/** `/wedding/partner?x` → `wedding`, `/` → ``. 탭 한 칸(=스택 하나)을 가르는 첫 조각. */
function rootSegment(path: string): string {
  return segmentsOf(path)[0] ?? '';
}

/**
 * 두 주소가 서로 다른 탭(= 다른 스택)에 있는가. 첫 조각으로 가른다 — `/my/reviews`와 `/my`는
 * 같은 스택, `/wedding/partner`와 `/my`는 다른 스택이다.
 */
export function crossesStack(fromPath: string, toPath: string): boolean {
  return rootSegment(fromPath) !== rootSegment(toPath);
}

/**
 * 뒤로가 **다른 탭의 스택**으로 건너가는가 — 출처가 있어 논리 부모가 현재 스택 밖에 있을 때다.
 * 이때 네이티브 스택의 되돌리기 제스처(iOS 가장자리 스와이프)는 **현재 스택의 아래 화면**을
 * 드러낼 뿐 출처로 가지 못한다. 화면은 이 값으로 제스처를 끄고 헤더 Back만 남긴다.
 */
export function crossesStackOnBack(pathname: string): boolean {
  const route = matchRoute(pathname);
  if (!route) return false;

  const origin = originTarget(route, pathname);

  return origin !== null && crossesStack(pathname, origin);
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

/** 스택 내비게이터 상태에서 이 계산이 읽는 부분 — React Navigation `StackNavigationState`의 일부. */
export type StackStateLike = {
  index: number;
  routes: readonly { name: string; params?: object }[];
};

function decodeSegment(segment: string): string {
  return decodeQueryPart(segment) ?? segment;
}

/**
 * 스택 한 장의 주소를 **그 스택 안에서의 조각**으로 되살린다 — 라우트 이름(`[vendorId]/images`)의
 * `[param]` 자리를 그 화면의 params로 채우고, `index` · `(group)` 조각은 주소에 안 나오니 뺀다.
 * 값이 비어 되살릴 수 없으면 null.
 */
function stackRouteSegments(route: { name: string; params?: object }): string[] | null {
  const params = (route.params ?? {}) as Record<string, unknown>;
  const segments: string[] = [];

  for (const slot of route.name.split('/')) {
    if (slot === '' || slot === 'index' || (slot.startsWith('(') && slot.endsWith(')'))) continue;
    if (!isDynamic(slot)) {
      segments.push(slot);
      continue;
    }

    const value = params[paramName(slot)];
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      segments.push(...(value as string[]));
    } else if (typeof value === 'string' && value.length > 0) {
      segments.push(value);
    } else {
      return null;
    }
  }

  return segments;
}

/**
 * Depth Back의 목적지가 **지금 스택 아래에 이미 있으면** 몇 장을 내려야 그 화면인가. 없으면 null.
 *
 * `dismissTo`(POP_TO)는 목적지 화면을 찾아도 그 화면의 params를 **목적지 주소의 값으로 갈아끼운다**
 * (React Navigation StackRouter — merge 없음). 업체 상세에 붙어 있던 출처(`from=pick` ·
 * `from=reviews` · `from=community.my`)가 사진 보기 · 후기 작성 · 정보 수정 제안에서 돌아오는 순간
 * 지워져, 그다음 Back이 검색으로 떨어졌다(2026-09-26 대표 감사 — Pick → 내 조건에 맞는 곳 → 업체
 * 상세). 이미 있는 화면으로는 **꺼내기(POP)**로 내려가 그 화면이 들고 있던 출처와 상태를 그대로 둔다.
 *
 * 목적지 주소에 쿼리가 있으면(`/wedding?tab=budget`) 그 값이 그 화면의 params와 같을 때만 센다 —
 * 다르면 null이라 `dismissTo`가 값을 새로 넣는다. `currentPathname`은 지금 화면의 주소(쿼리 무관)다.
 */
export function stackPopCount(state: StackStateLike | null | undefined, currentPathname: string, target: string): number | null {
  if (!state || !Array.isArray(state.routes) || state.index <= 0 || state.index >= state.routes.length) return null;

  const currentRoute = state.routes[state.index];
  const currentRelative = currentRoute ? stackRouteSegments(currentRoute) : null;
  if (!currentRelative) return null;

  const currentSegments = segmentsOf(currentPathname).map(decodeSegment);
  const baseLength = currentSegments.length - currentRelative.length;
  if (baseLength < 0 || currentSegments.slice(baseLength).join('/') !== currentRelative.join('/')) return null;

  const base = currentSegments.slice(0, baseLength);
  const targetPath = segmentsOf(target).map(decodeSegment).join('/');
  const targetQuery = (target.split('?')[1]?.split('#')[0] ?? '')
    .split('&')
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const [key = '', value = ''] = pair.split('=');
      return [decodeQueryPart(key) ?? key, decodeQueryPart(value) ?? value] as const;
    });

  for (let i = state.index - 1; i >= 0; i -= 1) {
    const route = state.routes[i]!;
    const relative = stackRouteSegments(route);
    if (!relative || [...base, ...relative].join('/') !== targetPath) continue;

    const params = (route.params ?? {}) as Record<string, unknown>;
    const sameQuery = targetQuery.every(([key, value]) => {
      const actual = params[key];
      return (Array.isArray(actual) ? actual[0] : actual) === value;
    });

    return sameQuery ? state.index - i : null;
  }

  return null;
}
