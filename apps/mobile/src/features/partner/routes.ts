/**
 * 연결관리(WP-CPL-001 · WP-MY-005) · 초대 수락(WP-CPL-002) 주소 — 한 곳에서만 정한다.
 *
 * **왜 주소가 셋인가**(2026-09-26 대표 지시 「배우자 초대 메뉴만 왜 슬라이드 RN타입으로 화면
 * 이동이 안되지?」). 화면 파일이 웨딩노트 스택(`app/(tabs)/wedding/partner.tsx`)에만 있어서
 * MY · 알림 · 홈에서 누르면 **같은 스택에 쌓이지 않고 탭이 바뀌었다** — 스택 push의 밀어넣기
 * (`stack-motion.ts`)가 타지 않았다. 그래서 들어오는 스택마다 같은 화면을 별칭으로 둔다.
 *
 *   MY 스택      `/my/partner`   · `/my/partner/join`     MY · 알림에서 연다. Back은 계층대로 `/my`.
 *   홈 하위 스택 `/partner`      · `/partner/join`        홈에서 연다. 탭에서 내린 `(home)` 스택이라
 *                                                         밀려 들어온다(`screen-options.ts` forOffTabPush).
 *   웨딩노트 스택 `/wedding/partner` · `/wedding/join`     저장된 링크 보존(CLAUDE.md «보이는 이름과
 *                                                         라우트를 함께 바꾸지 않는다»). `from`으로 출처를 받는다.
 *
 * 화면 컴포넌트는 하나다 — 별칭 파일은 `wedding/partner.tsx` · `wedding/join.tsx`를 다시 내보낼 뿐이다.
 */

/** MY · 알림에서 여는 연결관리. */
export const MY_PARTNER_ROUTE = '/my/partner';
/** 홈(히어로 배우자 현황 등)에서 여는 연결관리 — 홈 하위 `(home)` 스택. */
export const HOME_PARTNER_ROUTE = '/partner';
/** 웨딩노트 스택의 원래 주소 — 저장된 링크용으로 살려 둔다. */
export const WEDDING_PARTNER_ROUTE = '/wedding/partner';

/**
 * 지금 주소가 선 스택의 연결관리 주소 — MY 스택이면 `/my/partner`, 그 밖(홈과 홈 하위 스택 ·
 * 알림이 홈 스택 `/notifications`에 설 때)은 `/partner`. 알림처럼 여러 스택에 서는 화면이 쓴다.
 */
export function partnerRouteFor(pathname: string): string {
  return /^\/my(\/|$|\?)/.test(pathname) ? MY_PARTNER_ROUTE : HOME_PARTNER_ROUTE;
}

/** `from` 값 — 초대 수락의 Back이 «출처를 가진 MY 연결관리»로 돌아갈 때 쓴다(`depth-back-rules.ts` ORIGIN_ALIASES). */
export const MY_PARTNER_ORIGIN = 'mypartner';

/**
 * 연결관리 화면이 «코드 받았어요»로 여는 초대 수락 주소 — **지금 연결관리가 있는 스택 안**이다.
 * 스택이 바뀌면 또 탭이 바뀌어 밀어넣기가 안 탄다. 모르는 주소면 원래 자리(`/wedding/join`)다.
 */
export function partnerJoinRoute(pathname: string): string {
  const bare = pathname.split('?')[0]!.split('#')[0]!.replace(/\/+$/, '');

  if (bare === MY_PARTNER_ROUTE) return `${MY_PARTNER_ROUTE}/join`;
  if (bare === HOME_PARTNER_ROUTE) return `${HOME_PARTNER_ROUTE}/join`;

  return '/wedding/join';
}

/**
 * 초대 수락으로 가는 주소 전체 — 연결관리의 출처(`from`)를 이어 준다.
 *
 *   `/my/partner`               → `/my/partner/join`(계층대로 Back이 `/my/partner`)
 *   `/my/partner?from=notifications` → `/my/partner/join?from=mypartner.notifications`
 *                                   (Back이 `/my/partner?from=notifications` — 그다음 Back이 알림 목록)
 *   `/partner`                  → `/partner/join`
 *   `/wedding/partner?from=my`  → `/wedding/join?from=partner.my`(원래 규칙 그대로)
 */
export function partnerJoinHref(pathname: string, from: string | null): string {
  const route = partnerJoinRoute(pathname);

  if (route === '/wedding/join') return `/wedding/join?from=${from ? `partner.${from}` : 'partner'}`;
  if (route === `${MY_PARTNER_ROUTE}/join` && from) return `${route}?from=${MY_PARTNER_ORIGIN}.${from}`;

  return route;
}
