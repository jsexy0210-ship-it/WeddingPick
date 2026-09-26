import { crossesStack, crossesStackOnBack, depthBackTarget, matchRoute, resolveBackAction, ROUTES } from './depth-back-rules';
import { stackTransitionFor } from './stack-motion';
import { HOME_STACK_SEGMENTS, STACK_ALIASES, canonicalOf, inStack, stackOf } from './stack-alias';

/**
 * 출처 스택 별칭 — 상세로 들어가는 이동이 다른 탭으로 건너가지 않고 들어온 탭의 스택 안에서 밀리는가
 * (2026-09-26 대표 지시 「RN타입으로 화면 이동이 안되는 경우다 싹다 검수하라」).
 */

/** 테스트 러너(CommonJS)의 전역. 앱 번들에는 들어가지 않는다. */
declare const require: (id: string) => any;
declare const __dirname: string;

const { readFileSync, readdirSync, statSync, existsSync } = require('node:fs');
const { join, relative, dirname, resolve } = require('node:path');

const SRC = join(__dirname, '..', '..');
const APP = join(SRC, 'app');
const TABS = join(APP, '(tabs)');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name: string) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** `app/(tabs)/pick/vendor/[vendorId]/images.tsx` → `/pick/vendor/[vendorId]/images`. */
function urlOf(file: string): string {
  const parts = relative(APP, file).replace(/\\/g, '/').replace(/\.tsx$/, '').split('/')
    .filter((part: string) => !(part.startsWith('(') && part.endsWith(')')));
  if (parts[parts.length - 1] === 'index') parts.pop();
  return `/${parts.join('/')}`;
}

const ALIAS_LINE = /^\/\*\*[^\n]*\*\/\nexport \{ default \} from '([^']+)';\n$/;
const aliasFiles = walk(TABS).filter((file: string) => file.endsWith('.tsx') && ALIAS_LINE.test(readFileSync(file, 'utf8')));

describe('stackOf', () => {
  it.each([
    ['/', 'home'],
    ['/feed/f-1', 'home'],
    ['/notifications', 'home'],
    ['/wedding-settings', 'home'],
    ['/contact/q-1', 'home'],
    ['/search/v-1', 'search'],
    ['/pick/vendor/v-1?from=pick', 'pick'],
    ['/community/review', 'community'],
    ['/login', null],
    ['/setup', null],
  ])('%s → %s', (path, stack) => {
    expect(stackOf(path)).toBe(stack);
  });

  it('홈 하위 스택 조각은 (home) 폴더와 같다', () => {
    const home = readdirSync(join(TABS, '(home)'))
      .filter((name: string) => !name.startsWith('_'))
      .map((name: string) => name.replace(/\.tsx$/, ''));
    expect([...new Set(home)].sort()).toEqual([...HOME_STACK_SEGMENTS].sort());
  });
});

describe('inStack — 지금 스택 안의 주소', () => {
  it.each([
    // Pick → 업체 상세 · 상담 예약 · 비교(WP-PICK-006 · 009는 pick.jsx 보드)
    ['/pick', '/search/v-1?from=pick', '/pick/vendor/v-1?from=pick'],
    ['/pick', '/search/v-1/consult?from=pick%2Fsdm', '/pick/vendor/v-1/consult?from=pick%2Fsdm'],
    ['/pick', '/search/compare?ids=a,b', '/pick/compare?ids=a,b'],
    // 별칭 안에서는 그 아래 화면도 같은 별칭
    ['/pick/vendor/v-1', '/search/v-1/images?index=2', '/pick/vendor/v-1/images?index=2'],
    ['/pick/compare', '/search/v-2/consult?from=compare%2Fv-1%2Cv-2', '/pick/vendor/v-2/consult?from=compare%2Fv-1%2Cv-2'],
    ['/pick/vendor/v-1/consult', '/search/v-1/consult-done?when=x', '/pick/vendor/v-1/consult-done?when=x'],
    // 라운지 → 업체 상세 · 박람회 상세(WP-LNG-006은 my.jsx 라운지와 함께)
    ['/community', '/search/v-1?from=community.my', '/community/vendor/v-1?from=community.my'],
    ['/community', '/search/expo/e-1', '/community/expo/e-1'],
    ['/community/expo/e-1', '/search/expo/e-1/calendar', '/community/expo/e-1/calendar'],
    // MY 내가 쓴 후기 · 웨딩노트 지도 → 업체 상세
    ['/my', '/search/v-1/write-review?from=reviews', '/my/vendor/v-1/write-review?from=reviews'],
    ['/wedding', '/search/v-1', '/wedding/vendor/v-1'],
    // 홈 알림 종 · D-day → MY 화면을 홈 스택에서
    ['/', '/my/notifications', '/notifications'],
    ['/', '/my/wedding-settings', '/wedding-settings'],
    ['/notifications', '/my/contact/q-1', '/contact/q-1'],
    ['/wedding', '/my/wedding-settings', '/wedding/wedding-settings'],
    ['/search', '/my/contact?category=data_correction', '/search/contact?category=data_correction'],
    ['/search/contact', '/my/contact/q-1', '/search/contact/q-1'],
    // 원래 스택 안이면 그대로
    ['/search', '/search/v-1', '/search/v-1'],
    ['/search/v-1', '/search/v-1/images', '/search/v-1/images'],
    ['/my/contact', '/my/contact/q-1', '/my/contact/q-1'],
    // 별칭이 없는 자리는 원래 주소(의도된 탭 전환이거나 별칭 대상이 아님)
    ['/', '/search?category=hall', '/search?category=hall'],
    ['/', '/pick?group=sdm', '/pick?group=sdm'],
    ['/login', '/search/v-1', '/search/v-1'],
  ])('%s 에서 %s → %s', (from, href, expected) => {
    expect(inStack(from, href)).toBe(expected);
  });
});

describe('별칭 화면 파일', () => {
  it('표의 모든 별칭 주소에 화면 파일이 있다', () => {
    const samples = [
      '/pick/compare', '/pick/vendor/x', '/pick/vendor/x/images', '/pick/vendor/x/write-review', '/pick/vendor/x/fix-report',
      '/pick/vendor/x/consult', '/pick/vendor/x/consult-done',
      '/community/vendor/x', '/community/expo/x', '/community/expo/x/calendar',
      '/my/vendor/x', '/my/vendor/x/write-review', '/wedding/vendor/x', '/wedding/wedding-settings',
      '/notifications', '/wedding-settings', '/contact', '/contact/x', '/search/contact', '/search/contact/x',
    ];
    for (const path of samples) {
      const route = matchRoute(path);
      expect({ path, route: route && ROUTES.includes(route) ? 'ok' : route }).toEqual({ path, route: 'ok' });
    }
    expect(STACK_ALIASES.length).toBeGreaterThan(0);
  });

  it('별칭 파일은 원래 화면 하나를 그대로 다시 내보낸다(주소도 짝이 맞다)', () => {
    expect(aliasFiles.length).toBe(28);
    for (const file of aliasFiles) {
      const spec = readFileSync(file, 'utf8').match(ALIAS_LINE)![1] as string;
      let target = resolve(dirname(file), spec);
      if (!existsSync(`${target}.tsx`)) target = join(target, 'index');
      expect({ file: relative(APP, file), exists: existsSync(`${target}.tsx`) }).toEqual({ file: relative(APP, file), exists: true });
      /* 원래 화면은 별칭이 아니다 — 별칭의 별칭을 만들지 않는다. */
      expect(ALIAS_LINE.test(readFileSync(`${target}.tsx`, 'utf8'))).toBe(false);
      expect(canonicalOf(urlOf(file))).toBe(urlOf(`${target}.tsx`));
    }
  });

  it('별칭은 원래 화면과 같은 전환으로 움직인다(풀팝업 · 시트 · 밀기)', () => {
    expect(stackTransitionFor('vendor/[vendorId]/consult')).toBe(stackTransitionFor('[vendorId]/consult'));
    expect(stackTransitionFor('vendor/[vendorId]/images')).toBe('modal');
    expect(stackTransitionFor('vendor/[vendorId]/write-review')).toBe('sheet');
    expect(stackTransitionFor('vendor/[vendorId]')).toBe('push');
    expect(stackTransitionFor('compare')).toBe('modal');
    expect(stackTransitionFor('expo/[expoId]/calendar')).toBe('sheet');
  });
});

describe('별칭의 Back — 같은 스택이라 건너지 않는다', () => {
  it.each([
    ['/pick/vendor/v-1?from=pick', '/pick'],
    ['/pick/vendor/v-1?from=pick%2Fsdm', '/pick?group=sdm'],
    ['/pick/vendor/v-1/images', '/pick/vendor/v-1'],
    ['/pick/vendor/v-1/consult?from=pick', '/pick'],
    ['/pick/compare?ids=v-1,v-2', '/pick'],
    ['/community/vendor/v-1?from=community.my', '/community/review?from=my'],
    ['/community/expo/e-1', '/community/expo'],
    ['/community/expo/e-1/calendar', '/community/expo/e-1'],
    ['/my/vendor/v-1?from=reviews', '/my/reviews'],
    ['/my/vendor/v-1/write-review?from=reviews', '/my/reviews'],
    ['/wedding/vendor/v-1', '/wedding'],
    ['/wedding/wedding-settings', '/wedding'],
    ['/search/contact', '/search'],
    ['/search/contact/q-1', '/search/contact'],
    ['/contact/q-1', '/contact'],
  ])('%s → %s', (path, target) => {
    expect(depthBackTarget(path)).toBe(target);
    expect(crossesStack(path, target)).toBe(false);
    expect(crossesStackOnBack(path)).toBe(false);
  });

  it('홈 스택 별칭은 홈(Root 탭)으로 — 홈 하위 스택 → 홈 탭은 피드 상세와 같은 길이다', () => {
    expect(depthBackTarget('/notifications')).toBe('/');
    expect(depthBackTarget('/wedding-settings')).toBe('/');
    expect(depthBackTarget('/contact')).toBe('/');
    expect(resolveBackAction('/notifications', true)).toEqual({ kind: 'depth', target: '/' });
  });

  it('웨딩노트 지도 → 업체 상세는 스택 아래의 지도로(History) · 직접 진입은 웨딩노트로', () => {
    expect(resolveBackAction('/wedding/vendor/v-1', true)).toEqual({ kind: 'history' });
    expect(resolveBackAction('/wedding/vendor/v-1', false)).toEqual({ kind: 'depth', target: '/wedding' });
  });

  it('원래 주소(딥링크 · 저장된 링크)는 그대로 산다', () => {
    expect(depthBackTarget('/search/v-1?from=pick')).toBe('/pick');
    expect(depthBackTarget('/search/v-1?from=reviews')).toBe('/my/reviews');
    expect(depthBackTarget('/search/expo/e-1')).toBe('/community/expo');
    expect(depthBackTarget('/my/notifications')).toBe('/my');
  });
});

/**
 * 가드 — 탭 화면에서 **다른 Root 탭 스택의 하위 화면**을 글자 그대로 밀지 않는다. 밀려면 `inStack`을
 * 거친다. Root 탭 뿌리(`/pick` · `/search?category=…` · `/wedding?tab=…`)로 가는 것은 의도된 탭 전환이라
 * 괜찮고, 라운지 · 홈 하위 스택(탭에서 내린 칸)은 탭 전환이어도 밀려 들어온다(`screen-options.ts`).
 */
describe('다른 탭 스택의 하위 화면으로 글자 그대로 밀지 않는다', () => {
  /** 남은 예외 없음 — 연결관리는 MY · 홈 스택 별칭으로 옮겼다(2026-09-26 9차 통합). */
  const PENDING: readonly string[] = [];

  it('탭 화면의 글자 그대로 이동은 같은 스택이거나 Root 탭 뿌리다', () => {
    const offenders: string[] = [];
    const files = walk(TABS).filter((file: string) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'));

    for (const file of files) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      const own = stackOf(urlOf(file));
      const source = readFileSync(file, 'utf8');
      const pattern = /(router\.(?:push|replace|navigate)|guestPush)\((['`])(\/[^'`]*)\2/g;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(source))) {
        const href = match[3]!;
        const path = href.split('?')[0]!;
        const target = stackOf(href);
        const isRoot = ['/', '/search', '/pick', '/wedding', '/my'].includes(path) || path === '/(tabs)';
        if (target === null || target === own || isRoot || target === 'community' || (target === 'home' && path !== '/')) continue;
        const key = `${rel}:${match[1]}(${match[2]}${href}${match[2]})`;
        if (!PENDING.includes(key)) offenders.push(key);
      }
    }

    expect(offenders).toEqual([]);
  });
});
