import { compareOrigin, crossesStackOnBack, depthBackTarget, pickOrigin, resolveBackAction } from './depth-back-rules';

/**
 * 다른 탭의 스택에 있는 화면으로 들어가는 자리는 **출처를 `from`으로 넘긴다** — 넘기지 않으면
 * Back이 그 화면의 계층 부모(웨딩노트 · 검색 홈)로 떨어진다(2026-09-26 대표 감사, 운영에서 재현:
 * MY → 연결관리 → Back = 웨딩노트 · MY → 리얼후기 → 후기 카드 → 업체 상세 → Back = 검색).
 *
 * 들어가는 자리의 주소 문자열을 읽고, 그 주소의 Back 목적지를 규칙으로 계산해 본다.
 */

/** 테스트 러너(CommonJS)의 전역. 앱 번들에는 들어가지 않는다. */
declare const require: (id: string) => any;
declare const __dirname: string;

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const src = join(__dirname, '..', '..');
const read = (path: string): string => readFileSync(join(src, path), 'utf8');

describe('다른 탭 스택으로 들어가는 자리는 출처를 넘긴다', () => {
  it.each([
    ['app/(tabs)/my/index.tsx', "guestPush('/wedding/partner?from=my')", '/wedding/partner?from=my', '/my'],
    ['app/(tabs)/my/notifications.tsx', "router.push('/wedding/partner?from=notifications')", '/wedding/partner?from=notifications', '/my/notifications'],
    ['app/(tabs)/index.tsx', "router.push('/wedding/partner?from=home')", '/wedding/partner?from=home', '/'],
    ['app/(tabs)/my/reviews.tsx', 'router.push(`/search/${report.vendorId}?from=reviews`)', '/search/v-1?from=reviews', '/my/reviews'],
    ['app/(tabs)/my/reviews.tsx', 'router.push(`/search/${report.vendorId}/write-review?from=reviews`)', '/search/v-1/write-review?from=reviews', '/my/reviews'],
  ])('%s — %s', (file, call, sample, origin) => {
    expect(read(file)).toContain(call);
    expect(depthBackTarget(sample)).toBe(origin);
  });

  it('리얼후기 카드 → 업체 상세는 리얼후기(와 그 앞의 MY)를 넘긴다', () => {
    const lounge = read('features/community/lounge-screen.tsx');
    expect(lounge).toContain("vendorOrigin={chainOrigin('community', from === 'my' ? 'my' : null)}");
    expect(lounge).toContain('router.push(`/search/${encodeURIComponent(review.vendor.id)}?from=${vendorOrigin}` as never)');
    expect(depthBackTarget('/search/v-1?from=community.my')).toBe('/community/review?from=my');
    expect(depthBackTarget('/community/review?from=my')).toBe('/my');
    expect(depthBackTarget('/search/v-1?from=community')).toBe('/community/review');
  });

  it('연결관리 → 초대 수락은 연결관리의 출처를 잇는다', () => {
    const partner = read('app/(tabs)/wedding/partner.tsx');
    expect(partner).toContain("router.push(`/wedding/join?from=${chainOrigin('partner', from)}` as never)");
    expect(depthBackTarget('/wedding/join?from=partner.my')).toBe('/wedding/partner?from=my');
  });

  it('후기 작성 시트를 닫으면 Depth Back — 출처가 있으면 MY 후기로', () => {
    expect(read('app/(tabs)/search/[vendorId]/write-review.tsx')).toContain('const closeSheet = useDepthBack();');
  });

  it('안드로이드 Back은 지금 화면 주소의 출처를 읽는다(레이아웃 local params에는 없다)', () => {
    const layout = read('app/(tabs)/_layout.tsx');
    expect(layout).toContain('useGlobalSearchParams');
    expect(layout).toContain('withBackOrigin(pathname, from)');
  });

  it('Pick → «내 조건에 맞는 곳» → 업체 상세는 Pick(과 켜진 칩)을 넘긴다(2026-09-26 대표 감사)', () => {
    const pick = read('app/(tabs)/pick/index.tsx');
    expect(pick).toContain("const origin = pickOrigin(filter === 'all' ? null : filter);");
    expect(pick).toContain("router.push({ pathname: '/search/[vendorId]', params: { vendorId: vendor.id, from: origin } })");
    expect(pickOrigin(null)).toBe('pick');
    expect(pickOrigin('sdm')).toBe('pick/sdm');
    expect(pickOrigin('bogus')).toBe('pick');
    // 헤더 Back · 안드로이드 Back이 같은 계산을 쓴다.
    expect(depthBackTarget('/search/v-1?from=pick')).toBe('/pick');
    expect(depthBackTarget(`/search/v-1?from=${encodeURIComponent('pick/sdm')}`)).toBe('/pick?group=sdm');
    expect(resolveBackAction('/search/v-1?from=pick%2Fstart', true)).toEqual({ kind: 'depth', target: '/pick?group=start' });
    // 검색 스택에서 Pick 탭으로 건너간다 — iOS 스와이프를 끄고 navigate로 옮긴다.
    expect(crossesStackOnBack('/search/v-1?from=pick')).toBe(true);
    // 모르는 묶음은 추측하지 않고 Pick까지만(`pick/xx`는 별칭이 아니라 계층 규칙 → 검색).
    expect(depthBackTarget('/search/v-1?from=pick%2Fxx')).toBe('/search');
    expect(depthBackTarget('/search/v-1')).toBe('/search');
  });

  it('Pick 카드 → 상담 예약은 Pick을 넘기고, 닫으면 Pick으로', () => {
    const pick = read('app/(tabs)/pick/index.tsx');
    expect(pick).toContain("params: { vendorId: candidate.vendorId, from: origin }");
    const consult = read('app/(tabs)/search/[vendorId]/consult.tsx');
    expect(consult).toContain('backTo(depthBackTarget(closePath), closePath, readStackState(navigation));');
    expect(consult).toContain('requestDirtySheetClose(dirty, closeSheet);');
    expect(depthBackTarget('/search/v-1/consult?from=pick')).toBe('/pick');
    expect(depthBackTarget('/search/v-1/consult?from=pick%2Fgoods')).toBe('/pick?group=goods');
    expect(crossesStackOnBack('/search/v-1/consult?from=pick%2Fgoods')).toBe(true);
    // 출처가 없으면 전처럼 업체 상세로 닫는다.
    expect(depthBackTarget('/search/v-1/consult')).toBe('/search/v-1');
  });

  it('비교 → 상담 예약은 같은 업체를 견주던 그 비교로 돌아온다(비교 목록째 출처로)', () => {
    const compare = read('app/(tabs)/search/compare.tsx');
    expect(compare).toContain("const origin = compareOrigin((ids ?? '').split(',').filter(Boolean));");
    expect(compare).toContain("params: origin ? { vendorId, from: origin } : { vendorId }");
    expect(compareOrigin(['v-1', 'v-2'])).toBe('compare/v-1,v-2');
    expect(compareOrigin(['v-1', 'v-2', 'v-3'])).toBe('compare/v-1,v-2,v-3');
    // 한 곳 · 넷 이상 · id 모양이 아닌 값은 출처를 만들지 않는다.
    expect(compareOrigin(['v-1'])).toBeNull();
    expect(compareOrigin(['a', 'b', 'c', 'd'])).toBeNull();
    expect(compareOrigin(['v-1', '../admin'])).toBeNull();
    const from = encodeURIComponent('compare/v-1,v-2');
    expect(depthBackTarget(`/search/v-1/consult?from=${from}`)).toBe('/search/compare?ids=v-1,v-2');
    // 같은 검색 스택 — 스와이프를 끄지 않는다(아래 화면이 그 비교다).
    expect(crossesStackOnBack(`/search/v-1/consult?from=${from}`)).toBe(false);
    // 모양이 틀린 값은 추측하지 않고 업체 상세로.
    expect(depthBackTarget('/search/v-1/consult?from=compare')).toBe('/search/v-1');
    expect(depthBackTarget(`/search/v-1/consult?from=${encodeURIComponent('compare/v-1')}`)).toBe('/search/v-1');
    expect(depthBackTarget(`/search/v-1/consult?from=${encodeURIComponent('compare/a,b,c,d')}`)).toBe('/search/v-1');
    // 상담 예약은 History Back을 쓰지 않는다.
    expect(read('app/(tabs)/search/[vendorId]/consult.tsx')).not.toContain('router.back()');
  });
});
