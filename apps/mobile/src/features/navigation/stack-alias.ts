/**
 * 출처 스택 별칭 — **상세로 들어가는 이동은 들어온 탭의 스택 안에서 밀린다.**
 *
 * 2026-09-26 대표 지시 「RN타입으로 화면 이동이 안되는 경우다 싹다 검수하라」. 화면 파일이 다른 탭의
 * 스택에 있으면 `router.push`는 그 탭으로 **건너가는** 탭 전환이 된다 — 오른쪽에서 밀려 들어오지
 * 않고 제자리에서 겹쳐 바뀌고(`screen-options.ts` `forTabFade`), iOS 가장자리 스와이프로도 돌아갈 수
 * 없다(`crossesStackOnBack`). Pick → 업체 상세 · 리얼후기 → 업체 상세 · 홈 → 알림이 그랬다.
 *
 * 그래서 같은 화면을 **출처 탭의 폴더에도 한 번 더 세운다**(`app/(tabs)/<탭>/…`가 원래 화면을 그대로
 * 다시 내보내는 한 줄). 원래 주소(`/search/<업체>` 등)는 그대로 살아 있어 저장된 링크 · 공유 주소 ·
 * 딥링크가 깨지지 않는다. 이 파일은 «지금 있는 스택에서 그 화면의 주소»를 고르는 표 하나다 —
 * 화면은 원래 주소를 적고 `inStack(지금 주소, 원래 주소)`로 바꿔 민다.
 *
 * 정본 근거(docs/design/React_Native): `home.js:808` 「Back 처리 — 진입 컨텍스트 유지」 ·
 * `home.js:810` 「상세 Back — 진입한 목록 · 탭과 스크롤 유지」. 비교(WP-PICK-006) · 상담 예약
 * (WP-PICK-009) · 상담 예약 완료(WP-PICK-010)는 `pick.jsx` 보드, 박람회 상세(WP-LNG-006)는 라운지와
 * 함께 `my.jsx` 보드에 있다.
 */

/** 탭 스택 이름. `home`은 홈 탭(`index`)과 그 아래 하위 스택 `(home)`을 함께 이른다. */
export type StackKey = 'home' | 'search' | 'pick' | 'wedding' | 'my' | 'community';

/**
 * 홈 하위 스택(`app/(tabs)/(home)`)의 첫 조각 — 그룹 폴더라 주소에 `(home)`이 나오지 않는다.
 * 폴더에 화면을 더하면 여기에도 적는다(`stack-alias.test.ts`가 파일과 대조한다).
 */
export const HOME_STACK_SEGMENTS: readonly string[] = ['feed', 'notifications', 'wedding-settings', 'contact', 'partner'];

const TAB_STACKS: readonly StackKey[] = ['search', 'pick', 'wedding', 'my', 'community'];

function pathOnly(path: string): string {
  return path.split('?')[0]!.split('#')[0]!;
}

/** 주소가 사는 탭 스택. 로그인 · 온보딩 · 관리자처럼 탭 밖이면 null. */
export function stackOf(path: string): StackKey | null {
  const first = pathOnly(path).split('/').filter(Boolean)[0] ?? '';

  if (first === '' || HOME_STACK_SEGMENTS.includes(first)) return 'home';

  return (TAB_STACKS as readonly string[]).includes(first) ? (first as StackKey) : null;
}

/**
 * 별칭 한 줄 — 원래 주소 앞부분(`canonical`)을 스택별 앞부분으로 바꾼다. 나머지 꼬리(`/images` ·
 * `?from=…`)는 그대로 붙는다. `reserved`는 `canonical` 바로 뒤 조각이 이 값이면 이 줄이 아니다 —
 * `/search/compare`는 업체 상세가 아니다.
 */
type AliasRule = {
  canonical: string;
  aliases: Partial<Record<StackKey, string>>;
  reserved?: readonly string[];
};

/**
 * 표. 위에서부터 먼저 맞는 줄 하나만 쓴다. 이 표의 모든 별칭 주소에 화면 파일이 있어야 한다
 * (`stack-alias.test.ts`).
 *
 *   /search/compare          Pick → 비교(WP-PICK-006)
 *   /search/expo/<박람회>     라운지 박람회 → 박람회 상세(WP-LNG-006) · 캘린더 시트
 *   /search/<업체>/…          Pick · 리얼후기 · MY 내가 쓴 후기 · 웨딩노트 지도 → 업체 상세와 그 아래
 *                             (사진 · 후기 쓰기 · 정보 오류 제보 · 상담 예약 · 상담 예약 완료)
 *   /my/wedding-settings     홈 D-day · 웨딩노트 «예식일 확정» → 내 웨딩설정(WP-MY-003)
 *   /my/notifications        홈 알림 종 → 알림(정본에 화면 없음 · 홈 머리에서만 들어온다)
 *   /my/contact/…            검색 «결과 없음» 정보 수정 요청 · 홈 알림의 문의 답변 → 문의하기 · 지난 문의
 */
export const STACK_ALIASES: readonly AliasRule[] = [
  { canonical: '/search/compare', aliases: { pick: '/pick/compare' } },
  { canonical: '/search/expo', aliases: { community: '/community/expo' } },
  {
    canonical: '/search',
    reserved: ['compare', 'expo', 'contact'],
    aliases: { pick: '/pick/vendor', community: '/community/vendor', my: '/my/vendor', wedding: '/wedding/vendor' },
  },
  { canonical: '/my/wedding-settings', aliases: { home: '/wedding-settings', wedding: '/wedding/wedding-settings' } },
  { canonical: '/my/notifications', aliases: { home: '/notifications' } },
  { canonical: '/my/contact', aliases: { home: '/contact', search: '/search/contact' } },
  /* 연결관리(WP-CPL-001 · 002) — MY · 홈 · 알림에서 들어온 스택 안에서 민다(my-tweaks 별칭). `join`이 먼저다. */
  { canonical: '/wedding/join', aliases: { my: '/my/partner/join', home: '/partner/join' } },
  { canonical: '/wedding/partner', aliases: { my: '/my/partner', home: '/partner' } },
];

/** `canonical` 앞부분이 맞으면 그 뒤 꼬리(`''` · `/…`), 아니면 null. */
function tailAfter(path: string, rule: AliasRule): string | null {
  if (rule.canonical === '/search') {
    const match = path.match(/^\/search\/([^/]+)(\/.*)?$/);
    if (!match || rule.reserved?.includes(match[1]!)) return null;
    return `/${match[1]}${match[2] ?? ''}`;
  }

  if (path === rule.canonical) return '';
  if (path.startsWith(`${rule.canonical}/`)) return path.slice(rule.canonical.length);

  return null;
}

/**
 * 원래 주소 `href`를 **지금 주소 `currentPathname`의 스택 안** 주소로 바꾼다. 그 스택에 별칭이 없으면
 * `href` 그대로 — 원래 스택으로 건너간다(의도된 탭 전환이거나 아직 별칭이 없는 자리).
 *
 * 지금 주소가 이미 별칭 안이면(`/pick/vendor/v-1`) 그 아래 화면도 같은 별칭으로 간다 —
 * `/search/v-1/images` → `/pick/vendor/v-1/images`.
 */
export function inStack(currentPathname: string, href: string): string {
  const stack = stackOf(currentPathname);
  if (!stack) return href;

  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  const rest = cut === -1 ? '' : href.slice(cut);

  for (const rule of STACK_ALIASES) {
    const tail = tailAfter(path, rule);
    if (tail === null) continue;

    const alias = rule.aliases[stack];
    return alias ? `${alias}${tail}${rest}` : href;
  }

  return href;
}

/** 별칭 주소 → 원래 주소. 별칭이 아니면 그대로. 시험과 대조용이다. */
export function canonicalOf(href: string): string {
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  const rest = cut === -1 ? '' : href.slice(cut);

  for (const rule of STACK_ALIASES) {
    for (const alias of Object.values(rule.aliases)) {
      if (!alias) continue;
      /* `/community/expo`(라운지 박람회 목록)는 별칭이 아니다 — 박람회 · 업체 별칭은 꼬리가 있어야 한다. */
      const needsTail = rule.canonical === '/search' || rule.canonical === '/search/expo';
      if ((!needsTail && path === alias) || path.startsWith(`${alias}/`)) {
        return `${rule.canonical}${path.slice(alias.length)}${rest}`;
      }
    }
  }

  return href;
}
