declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('path') as { join: (...parts: string[]) => string };
const MOBILE = join(__dirname, '..', '..');
const ROOT = join(MOBILE, '..', '..', '..');
const mobile = (path: string) => readFileSync(join(MOBILE, path), 'utf8');
const root = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('2026-09-20 사용자 공통 UI 회귀', () => {
  it('로그인은 정본 카피·Pick 마크·연령 동의 상태를 유지한다', () => {
    const s = mobile('app/login/index.tsx');
    expect(s).toContain("const HERO_TITLE = '웨딩 준비,\\n진짜 견적부터\\n확인해 보세요'");
    expect(s).toContain("'실제 견적 금액을 비교해요'");
    expect(s).toContain("'마음에 드는 곳을 함께 Pick해요'");
    expect(s).toContain("'일정과 지출도 한곳에서 관리해요'");
    expect(s).toContain('<WeddingMark size={64} color={theme.tint} />');
    expect(s).toContain('visible={!showRemembered}');
    expect(s).toContain('const ageBlocked = !showRemembered && !ageChecked;');
    expect(s).not.toContain('다른 계정으로 시작하기');
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
    expect(s).toContain("const TITLE = '업체 탐색'");
    expect(s).not.toContain("const SUBTITLE = '우리 조건에 맞는 선택만 모았어요'");
    expect(s).toContain('styles.filterRow');
    expect(s).toContain("budgetBand(filters.budget)?.label ?? '가격'");
    expect(s).not.toContain('sortSlot:');
  });
  it('Pick 3보기는 같은 Root 안에서 전환하고 compare로 이어진다', () => {
    const s = mobile('features/pick/pick-section-tabs.tsx');
    expect(s).toContain("label: '나의 Pick'");
    expect(s).toContain("label: '웨딩픽 추천'");
    expect(s).toContain("label: '비교함'");
    expect(s).toContain("pathname: '/pick'");
    expect(s).not.toContain("router.replace('/recommendations'");
    expect(s).not.toContain("router.replace('/pick/wedding_info_company'");

    const pick = mobile('app/(tabs)/pick/index.tsx');
    expect(pick).toContain("requestedSection === 'recommendations' || requestedSection === 'compare'");
    expect(pick).toContain("section === 'recommendations'");
    expect(pick).toContain("section === 'compare'");
    expect(pick).toContain('<RecommendationsContent requestedCategory={requestedCategory} />');
    expect(pick).toContain('VENDOR_CATEGORIES.includes(rawCategory as VendorCategory)');
    expect(pick).toContain('<CompareBasket');

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
    expect(consult).not.toContain('addWeddingEvent(me.weddingId');
    expect(consult).toContain('submitLock.current = true');
    expect(consult).toContain('group.decidedVendorId === vendorId');
    expect(consult).toContain('최종 Pick 확인이 필요해요');
    expect(consult).toContain('일정 등록하기');
  });

  it('빈 상태는 페이지 전체와 섹션 범위를 구분한다', () => {
    const status = root('packages/ui/src/status-view.tsx');
    expect(status).toContain("scope?: 'page' | 'section'");
    expect(status).toContain("scope === 'section'");
    expect(mobile('app/(tabs)/(home)/recommendations.tsx')).toContain('<EmptyView scope="section"');
    expect(mobile('app/(tabs)/search/[vendorId]/images.tsx')).toContain('<EmptyView scope="section"');
    expect(mobile('app/(tabs)/pick/history.tsx')).toContain('<EmptyView scope="section"');
  });
  it('최초 예산은 만원 입력을 원으로 환산한다', () => {
    const s = mobile('app/(tabs)/wedding/index.tsx');
    expect(s).toContain('const budgetAmount = budgetManwon * 10_000');
    expect(s).toContain('placeholder="예: 5,000"');
  });
});
