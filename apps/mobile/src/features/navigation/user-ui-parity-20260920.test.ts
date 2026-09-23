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
    expect(s).toContain('<DelayedLoader size={40} />');
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
      'app/(tabs)/pick/[category].tsx',
      'app/(tabs)/search/compare.tsx',
      'app/(tabs)/search/[vendorId]/index.tsx',
      'app/(tabs)/search/[vendorId]/review/[reviewId].tsx',
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
  it('setup 완료 뒤 Home 두 번째 로더를 생략한다', () => {
    expect(mobile('app/setup.tsx')).toContain('markNextHomeLoadingCoveredBySetup()');
    expect(mobile('app/(tabs)/index.tsx')).toContain('setupCoveredLoading ? null');
  });
  it('홈 추천 비교는 표시한 업체 id를 compare route에 넘긴다', () => {
    expect(mobile('app/(tabs)/index.tsx')).toContain("pathname: '/search/compare'");
    expect(mobile('features/home/pick-recommend.tsx')).toContain("group.vendors.slice(0, 3).map((vendor) => vendor.id)");
  });
  it('검색 제목/결과 머리 계약을 유지한다', () => {
    const s = mobile('app/(tabs)/search/index.tsx');
    // v3.28이 제목을 «검색»으로 되돌렸다(「탐색」 금지어 · 대조표 [bad]). 기준선을 옮긴 것이지 검사를 뺀 것이 아니다.
    expect(s).toContain("const TITLE = '검색'");
    expect(s).not.toContain("const SUBTITLE = '우리 조건에 맞는 선택만 모았어요'");
    expect(s).toContain('styles.filterRow');
    expect(s).toContain("budgetBand(filters.budget)?.label ?? '가격'");
    expect(s).not.toContain('sortSlot:');
  });
  it('Pick Root는 상단 탭 없이(v3.28) 홈의 추천 딥링크만 받고 compare로 이어진다', () => {
    /* v3.28(2026-09-22) 대조표 «탭 구성 · 준비 현황» — Pick 탭 안 추천 · 비교함 탭을 없앴다. */
    expect(() => mobile('features/pick/pick-section-tabs.tsx')).toThrow();

    const pick = mobile('app/(tabs)/pick/index.tsx');
    expect(pick).not.toContain('PickSectionTabs');
    expect(pick).not.toContain('<CompareBasket');
    expect(pick).toContain("const showRecommendations = requestedSection === 'recommendations'");
    expect(pick).toContain('<RecommendationsContent requestedCategory={requestedCategory} />');
    expect(pick).toContain('VENDOR_CATEGORIES.includes(rawCategory as VendorCategory)');
    expect(pick).toContain("pathname: '/search/compare'");
    expect(mobile('app/(tabs)/search/compare.tsx')).not.toContain('PickSectionTabs');

    const home = mobile('app/(tabs)/index.tsx');
    expect(home).toContain('item.pickCount > 0');
    expect(home).toContain(`/pick/\${item.category}`);
    expect(home).toContain(`/pick?section=recommendations&category=\${item.category}`);

    const recommendations = mobile('app/(tabs)/(home)/recommendations.tsx');
    expect(recommendations).toContain("pathname: '/pick'");
    expect(recommendations).toContain("section: 'recommendations'");
    expect(recommendations).toContain('requestedCategory');
    expect(recommendations).toContain('category: requestedCategory');
    expect(recommendations).not.toContain('useDepthBack');
    expect(mobile('app/(tabs)/pick/[category].tsx')).toContain("pathname: '/search/compare'");
    expect(mobile('app/(tabs)/pick/[category].tsx')).not.toContain('<PickSectionTabs');
  });
  it('홈 재진입과 핵심 검색 화면의 로딩은 기존 shell을 보존한다', () => {
    const home = mobile('app/(tabs)/index.tsx');
    expect(home).toContain('recommendationLoadedOnce.current');
    expect(home).toContain('contentLoadedOnce.current');
    expect(home).toContain('bootLoadedOnce.current');
    expect(home).toContain("if (!recommendationLoadedOnce.current) setRecommendationStatus('loading')");
    expect(home).toContain("if (!contentLoadedOnce.current) setContentStatus('loading')");

    const search = mobile('app/(tabs)/search/index.tsx');
    expect(search).toContain('<ListSkeleton variant="search" rows={3} />');

    const detail = mobile('app/(tabs)/search/[vendorId]/index.tsx');
    expect(detail).toContain('<DepthHeader title="업체 상세" onBack={depthBack} />');
    expect(detail).toContain('<Skeleton height={Layout.heroVendor} radius={0} />');
    expect(detail).not.toContain('<SkeletonView hero />');
  });

  it('추천 재조회는 기존 내용을 유지하되 최신 상태 전까지 변경 행동을 잠근다', () => {
    const recommendations = mobile('app/(tabs)/(home)/recommendations.tsx');
    expect(recommendations).toContain('const [refreshing, setRefreshing] = useState(false)');
    expect(recommendations).toContain('Promise.allSettled([load(), reloadCandidates()])');
    expect(recommendations).toContain('interactionDisabled={refreshing}');
    expect(recommendations).toContain('<DelayedLoader active={refreshing} size={20} />');

    const recommendUi = mobile('features/home/pick-recommend.tsx');
    expect(recommendUi).toContain("pointerEvents={interactionDisabled ? 'none' : 'auto'}");
  });

  it('최종 Pick 저장 뒤에만 상담 예약을 열고 직접 URL에서도 다시 검증한다', () => {
    const detail = mobile('app/(tabs)/search/[vendorId]/index.tsx');
    expect(detail).toContain("decided ? '상담 예약하기' : picked ? '최종 Pick하기'");
    expect(detail).toContain("group.decidedVendorId === currentVendor.id");
    expect(detail).toContain("pathname: '/pick/confirm'");

    const review = mobile('app/(tabs)/search/[vendorId]/review/[reviewId].tsx');
    expect(review).not.toContain("router.push(\`/search/\${vendorId}/consult\`)");
    expect(review).toContain("router.push(\`/search/\${vendorId}\`)");

    const done = mobile('app/(tabs)/pick/done.tsx');
    expect(done).toContain('상담 예약하기');
    expect(done).toContain('vendorId: string');

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
    expect(mobile('app/(tabs)/(home)/recommendations.tsx')).toContain('<EmptyView scope="section"');
    expect(mobile('app/(tabs)/search/[vendorId]/images.tsx')).toContain('<EmptyView scope="section"');
  });
  it('최초 예산은 만원 입력을 원으로 환산한다', () => {
    const s = mobile('app/(tabs)/wedding/index.tsx');
    expect(s).toContain('const budgetAmount = budgetManwon * 10_000');
    expect(s).toContain('placeholder="예: 5,000"');
  });
});
