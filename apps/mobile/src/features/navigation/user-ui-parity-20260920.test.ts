declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('path') as { join: (...parts: string[]) => string };
const MOBILE = join(__dirname, '..', '..');
const ROOT = join(MOBILE, '..', '..', '..');
const mobile = (path: string) => readFileSync(join(MOBILE, path), 'utf8');
const root = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('2026-09-20 사용자 공통 UI 회귀', () => {
  it('로그인은 정본 카피·Pick 마크를 유지하고 만 14세 확인은 약관 동의 화면으로 옮겼다', () => {
    const s = mobile('app/login/index.tsx');
    /* v3.29(2026-09-23) WP-AUTH-001 — 타이틀·혜택 4줄 교체(CHANGELOG v3.29). 9/20·v3.28 카피를 덮는다. */
    expect(s).toContain("const HERO_TITLE = '플래너 없이,\\n직접 고르는\\n웨딩 준비'");
    expect(s).toContain("'업체별 가격과 조건을 한눈에 확인해요'");
    expect(s).toContain("'광고보다 내 기준으로 직접 골라요'");
    expect(s).toContain("'플래너를 거치지 않고 직접 연결돼요'");
    expect(s).toContain("'계약부터 결혼식까지 한곳에서 챙겨요'");
    /* v3.28(2026-09-22) WP-AUTH-001 markBox — 64 코랄 면 상자 안에 40 마크. 9/20의 «64 마크»를 덮는다. */
    expect(s).toContain('<WeddingMark size={MARK} color={theme.tint} />');
    expect(s).toContain('const MARK = 40;');
    /* v3.28(2026-09-22)에 «기억된 계정» 변형이 없다 — 2026-09-23 「정본에 없는 기능은 제거」로 걷어냈다. */
    expect(s).not.toContain('showRemembered');
    expect(s).not.toContain('다른 계정으로 시작하기');
    /*
     * v3.29(2026-09-23) — 만 14세 체크 · 약관 문구를 약관 동의 화면(WP-AUTH-010)으로
     * 일원화했다(CHANGELOG v3.29). 로그인 화면에는 더 이상 연령 체크박스가 없다.
     */
    expect(s).not.toContain('AgeConfirmRow');
    expect(s).not.toContain('const ageBlocked');
    const consent = mobile('app/login/consent.tsx');
    expect(consent).toContain("동의하고 시작하기");
  });

  it('Kakao 복귀는 기본 로더와 진행 문구를 같이 둔다', () => {
    const s = mobile('features/auth/signing-in-view.tsx');
    expect(s).toContain('<DelayedLoader size={40} shape="mark" />');
    expect(s).toContain('{SIGNING_IN_MESSAGE}');
  });
  it('Android Back도 화면 계층을 따르고 홈에서만 2회 앱 종료를 쓴다', () => {
    const s = mobile('app/(tabs)/_layout.tsx');
    expect(s).toContain("BackHandler.addEventListener('hardwareBackPress'");
    expect(s).toContain("setExitToast('뒤로가기를 한 번 더 누르면 앱이 종료돼요')");
    expect(s).toContain('BackHandler.exitApp()');
    expect(s).toContain('resolveBackAction(backPathname, router.canGoBack())');
    expect(s).toContain("action.kind === 'depth'");
  });
  it('2Depth 헤더는 DepthHeader 하나를 쓴다', () => {
    expect(mobile('components/back-bar.tsx')).toContain('<DepthHeader');
    expect(mobile('features/wedding/screen-kit.tsx')).toContain('<DepthHeader');
    expect(mobile('features/settings/my-kit.tsx')).toContain('<DepthHeader');
    const depth = mobile('components/depth-header.tsx');
    expect(depth).not.toContain('sub?:');
    expect(depth).toContain('depthHeaderTitle(pathname)');
    for (const path of [
      'app/(tabs)/search/compare.tsx',
      'app/(tabs)/search/[vendorId]/index.tsx',
    ]) {
      expect(mobile(path)).toContain('<DepthHeader');
      expect(mobile(path)).not.toContain('<BackButton');
    }
  });
  it('온보딩 지역 전체값을 만들지 않고 스타일은 최대 2개로 제한한다', () => {
    const region = mobile('features/onboarding/region-picker-sheet.tsx');
    const style = root('packages/domain/src/style.ts');
    const setup = mobile('app/setup.tsx');
    const taste = mobile('app/(tabs)/my/taste.tsx');
    expect(region).not.toContain("const WHOLE = '전체'");
    expect(style).toContain('STYLE_PICK_MAX = 2');
    expect(style).toContain('STYLE_PICK_LIMIT_TOAST');
    expect(setup).toContain('STYLE_PICK_LIMIT_TOAST');
    expect(taste).toContain('STYLE_PICK_LIMIT_TOAST');
  });
  it('setup 저장 중과 홈 첫 진입에 같은 홈 스켈레톤을 쓴다', () => {
    expect(mobile('app/setup.tsx')).toContain('if (sending) return <HomeSkeleton />');
    expect(mobile('app/(tabs)/index.tsx')).toContain('return <HomeSkeleton />');
    expect(mobile('app/setup.tsx')).not.toContain('remainingLoadingMs = 3000 -');
  });
  /*
   * 「홈 추천 비교는 표시한 업체 id를 compare route에 넘긴다」는 2026-09-23 v3.29 홈
   * 재구축에서 뺐다 — 검사 대상이던 홈의 「웨딩픽 추천」 카드·비교 CTA
   * (`HomeRecommendations`, 표시한 vendorId 배열을 `/search/compare`로 넘기던 그
   * 컴포넌트)를 정본에 없어 지웠다. 「웨딩픽 추천」 전체 화면은 같은 파일의
   * `PickRecommend`를 그대로 쓰는데, 그쪽 비교는 vendorId 배열이 아니라 업종 하나를
   * `/pick/{category}`로 보낸다 — 다른 메커니즘이라 이 시험을 옮겨 쓰지 않는다.
   */
  it('검색 제목/결과 머리 계약을 유지한다', () => {
    const s = mobile('app/(tabs)/search/index.tsx');
    // v3.28이 제목을 «검색»으로 되돌렸다(「탐색」 금지어 · 대조표 [bad]). 기준선을 옮긴 것이지 검사를 뺀 것이 아니다.
    expect(s).toContain("const TITLE = '검색'");
    expect(s).not.toContain("const SUBTITLE = '우리 조건에 맞는 선택만 모았어요'");
    /*
     * v3.29(2026-09-23) WP-SRCH-001 재대조 — 정본 `countRow`에는 결과 수와 정렬 칩
     * 하나뿐이고, 카테고리 ▾ · 지역 ▾ · 가격 ▾ 세 칩(`styles.filterRow`)은 없다.
     * 그 세 조건은 헤더의 필터 단추(`headerFilterBtn`) 하나로 필터 시트를 연다 —
     * 같은 시트를 여는 진입점을 둘 두지 않는다. 2026-09-20 기준선이 그 칩 줄을
     * 있어야 한다고 적었던 것을 여기서 v3.29로 덮는다.
     */
    expect(s).not.toContain('styles.filterRow');
    expect(s).not.toContain("budgetBand(filters.budget)?.label ?? '가격'");
    expect(s).toContain('headerFilterBtn');
    expect(s).not.toContain('sortSlot:');
  });
  it('Pick Root는 상단 탭 없이(v3.28) 홈의 묶음 딥링크만 받고 compare로 이어진다', () => {
    /* v3.28(2026-09-22) 대조표 «탭 구성 · 준비 현황» — Pick 탭 안 추천 · 비교함 탭을 없앴다. */
    expect(() => mobile('features/pick/pick-section-tabs.tsx')).toThrow();

    const pick = mobile('app/(tabs)/pick/index.tsx');
    expect(pick).not.toContain('PickSectionTabs');
    expect(pick).not.toContain('<CompareBasket');
    /* 2026-09-25 대표 지시 — `/pick?section=recommendations` 분기를 없앴다. 홈 카드는 `?group=`으로 묶음 칩만 켠다. */
    expect(pick).not.toContain('RecommendationsContent');
    expect(pick).not.toContain("section: 'recommendations'");
    expect(pick).toContain('PREPARATION_GROUPS.find((group) => group.key === rawGroup)');
    /* 최종 결정 확인 시트는 정본(pick.js «최종 결정: 확인 시트 → 완료 화면»)이라 남긴다. */
    expect(pick).toContain("'/pick/confirm'");
    expect(pick).toContain("pathname: '/search/compare'");
    expect(mobile('app/(tabs)/search/compare.tsx')).not.toContain('PickSectionTabs');

    const home = mobile('app/(tabs)/index.tsx');
    expect(home).toContain('`/pick?group=${card.key}`');
    expect(home).not.toContain('section=recommendations');
  });
  it('홈 재진입과 핵심 검색 화면의 로딩은 기존 shell을 보존한다', () => {
    /*
     * 2026-09-23 v3.29 홈 재구축 — 추천(`recommendationLoadedOnce`)은 홈에서 지운
     * 섹션이라 없다. 대신 신설한 웨딩일정(`tasksLoadedOnce`)이 같은 «한 번이라도
     * 받아왔는가» 중복 방지 규칙을 지킨다.
     */
    const home = mobile('app/(tabs)/index.tsx');
    expect(home).toContain('tasksLoadedOnce.current');
    expect(home).toContain('contentLoadedOnce.current');
    expect(home).toContain('bootLoadedOnce.current');
    expect(home).toContain("if (!tasksLoadedOnce.current) setTaskStatus('loading')");
    expect(home).toContain("if (!contentLoadedOnce.current) setContentStatus('loading')");

    const search = mobile('app/(tabs)/search/index.tsx');
    expect(search).toContain('<ListSkeleton variant="search" rows={3} />');

    const detail = mobile('app/(tabs)/search/[vendorId]/index.tsx');
    expect(detail).toContain('<DepthHeader title="업체 상세" onBack={depthBack} />');
    expect(detail).toContain('<Skeleton height={Layout.heroVendor} radius={0} />');
    expect(detail).not.toContain('<SkeletonView hero />');
  });


  it('최종 Pick 저장 뒤에만 상담 예약을 열고 직접 URL에서도 다시 검증한다', () => {
    /*
     * v3.29(2026-09-23) 대메뉴_검색.dc.html WP-VEND-001~004 vdiffs(#13) — 업체 상세의
     * 하단 CTA는 하트+«Pick하기» 1개뿐이고, «최종 Pick하기 / 상담 예약하기» 2단계 라벨과
     * «업체 상세에서 바로» 상담 진입은 Figma 원본이지 정본이 아니다. 정본은 «Pick →
     * 최종 결정 → 상담 잡기»고 그 흐름은 Pick 탭(`pick/index.tsx`·`pick/[category].tsx`)이
     * 이미 따로 갖고 있다 — 업체 상세에서 지운 것은 그 흐름의 중복 진입점이지 흐름
     * 자체가 아니다. 아래는 Pick 탭 쪽에서 같은 게이트가 여전히 도는지를 본다.
     */
    const consult = mobile('app/(tabs)/search/[vendorId]/consult.tsx');
    expect(consult).toContain("listCandidates(me.weddingId, { force: true })");
    expect(consult).toContain('addConsultationEvent(me.weddingId');
    expect(consult).toContain('idempotencyKey: `consult:${vendor.id}:${startsAt.toISOString()}`');
    expect(consult).not.toContain('addWeddingEvent(me.weddingId');
    expect(consult).toContain('submitLock.current = true');
    expect(consult).toContain('group.decidedVendorId === vendorId');
    expect(consult).toContain('최종 Pick 확인이 필요해요');
    // v3.28 WP-PICK-009 — CTA가 고른 값을 그대로 말한다(「9월 20일 오후 2시로 잡기」).
    expect(consult).toContain('로 잡기');
  });

  it('빈 상태는 페이지 전체와 섹션 범위를 구분한다', () => {
    const status = root('packages/ui/src/status-view.tsx');
    expect(status).toContain("scope?: 'page' | 'section'");
    expect(status).toContain("scope === 'section'");
    expect(mobile('app/(tabs)/search/[vendorId]/images.tsx')).toContain('<EmptyView scope="section"');
  });
  it('최초 예산은 만원 입력을 원으로 환산한다', () => {
    const s = mobile('app/(tabs)/wedding/index.tsx');
    expect(s).toContain('const budgetAmount = budgetManwon * 10_000');
    expect(s).toContain('placeholder="예: 5,000"');
  });
});
