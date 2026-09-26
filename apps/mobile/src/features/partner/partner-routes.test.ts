import {
  crossesStack,
  crossesStackOnBack,
  depthBackTarget,
  matchRoute,
  resolveBackAction,
  stackPopCount,
} from '@/features/navigation/depth-back-rules';

import { HOME_PARTNER_ROUTE, MY_PARTNER_ROUTE, partnerJoinHref, partnerJoinRoute, partnerRouteFor } from './routes';

/** 테스트 러너(CommonJS)의 전역. 앱 번들에는 들어가지 않는다. */
declare const require: (id: string) => any;
declare const __dirname: string;

const fs = require('node:fs');
const path = require('node:path');

const app = path.join(__dirname, '..', '..', 'app');
const read = (file: string): string => fs.readFileSync(path.join(app, file), 'utf8');

/**
 * 연결관리(배우자 초대)를 들어오는 스택 안에 둔다 — 2026-09-26 대표 지시 「배우자 초대 메뉴만 왜
 * 슬라이드 RN타입으로 화면 이동이 안되지?」. 화면이 웨딩노트 스택에만 있어 MY · 알림 · 홈에서
 * 누르면 탭이 바뀌었고, 스택 push의 밀어넣기가 타지 않았다.
 */
describe('연결관리 별칭 라우트', () => {
  it('MY 스택 · 홈 하위 스택에 같은 화면을 다시 내보낸다(화면은 하나)', () => {
    expect(read('(tabs)/my/partner.tsx')).toContain("export { default } from '../wedding/partner';");
    expect(read('(tabs)/(home)/partner.tsx')).toContain("export { default } from '../wedding/partner';");
    expect(read('(tabs)/my/partner/join.tsx')).toContain("export { default } from '../../wedding/join';");
    expect(read('(tabs)/(home)/partner/join.tsx')).toContain("export { default } from '../../wedding/join';");
    /* 저장된 링크 보존 — 원래 주소는 그대로 살아 있다. */
    expect(matchRoute('/wedding/partner')).toBe('/wedding/partner');
    expect(matchRoute('/wedding/join')).toBe('/wedding/join');
  });

  it('MY · 알림 · 홈은 자기 스택의 별칭으로 연다 — 탭을 건너지 않는다', () => {
    expect(read('(tabs)/my/index.tsx')).toContain('guestPush(MY_PARTNER_ROUTE)');
    expect(read('(tabs)/my/notifications.tsx')).toContain('router.push(`${partnerRouteFor(pathname)}?from=notifications` as never)');
    /* 알림은 선 스택 기준 — MY 스택이면 MY 별칭, 홈 스택(`/notifications`)이면 홈 별칭. */
    expect(partnerRouteFor('/my/notifications')).toBe('/my/partner');
    expect(partnerRouteFor('/notifications')).toBe('/partner');
    expect(partnerRouteFor('/my')).toBe('/my/partner');
    expect(partnerRouteFor('/mypage')).toBe('/partner');
    expect(read('(tabs)/index.tsx')).toContain('router.push(HOME_PARTNER_ROUTE as never)');
    for (const file of ['(tabs)/my/index.tsx', '(tabs)/my/notifications.tsx', '(tabs)/index.tsx']) {
      expect(read(file)).not.toContain('/wedding/partner');
    }

    expect(crossesStack('/my', MY_PARTNER_ROUTE)).toBe(false);
    expect(crossesStack('/my/notifications', MY_PARTNER_ROUTE)).toBe(false);
  });

  it('MY → 연결관리 → Back = /my · 홈 → 연결관리 → Back = /', () => {
    expect(matchRoute(MY_PARTNER_ROUTE)).toBe('/my/partner');
    expect(matchRoute(HOME_PARTNER_ROUTE)).toBe('/partner');

    expect(depthBackTarget('/my/partner')).toBe('/my');
    expect(resolveBackAction('/my/partner', true)).toEqual({ kind: 'depth', target: '/my' });
    expect(crossesStackOnBack('/my/partner')).toBe(false);

    expect(depthBackTarget('/partner')).toBe('/');
    expect(resolveBackAction('/partner', true)).toEqual({ kind: 'depth', target: '/' });

    /* 알림에서 들어온 것만 알림 목록으로 — 같은 MY 스택이라 건너지 않는다. */
    expect(depthBackTarget('/my/partner?from=notifications')).toBe('/my/notifications');
    expect(crossesStackOnBack('/my/partner?from=notifications')).toBe(false);
    /* 홈 스택 알림에서 들어온 홈 별칭도 출처를 읽는다. */
    expect(depthBackTarget('/partner?from=notifications')).toBe('/notifications');
  });

  it('MY 스택 Back은 아래 화면을 꺼낸다(POP) — 밀려 나가는 전환', () => {
    const stack = { index: 1, routes: [{ name: 'index' }, { name: 'partner' }] };
    expect(stackPopCount(stack, '/my/partner', depthBackTarget('/my/partner'))).toBe(1);

    const fromNoti = {
      index: 2,
      routes: [{ name: 'index' }, { name: 'notifications' }, { name: 'partner', params: { from: 'notifications' } }],
    };
    expect(stackPopCount(fromNoti, '/my/partner', depthBackTarget('/my/partner?from=notifications'))).toBe(1);

    const join = {
      index: 2,
      routes: [{ name: 'index' }, { name: 'partner' }, { name: 'partner/join' }],
    };
    expect(stackPopCount(join, '/my/partner/join', depthBackTarget('/my/partner/join'))).toBe(1);
  });

  it('초대 수락도 지금 스택 안으로 — 출처를 잇는다', () => {
    expect(partnerJoinRoute('/my/partner')).toBe('/my/partner/join');
    expect(partnerJoinRoute('/partner')).toBe('/partner/join');
    expect(partnerJoinRoute('/wedding/partner')).toBe('/wedding/join');

    expect(partnerJoinHref('/my/partner', null)).toBe('/my/partner/join');
    expect(partnerJoinHref('/my/partner', 'notifications')).toBe('/my/partner/join?from=mypartner.notifications');
    expect(partnerJoinHref('/partner', null)).toBe('/partner/join');
    expect(partnerJoinHref('/wedding/partner', 'my')).toBe('/wedding/join?from=partner.my');
    expect(partnerJoinHref('/wedding/partner', null)).toBe('/wedding/join?from=partner');

    expect(depthBackTarget('/my/partner/join')).toBe('/my/partner');
    expect(depthBackTarget('/my/partner/join?from=mypartner.notifications')).toBe('/my/partner?from=notifications');
    expect(depthBackTarget('/partner/join')).toBe('/partner');
  });
});
