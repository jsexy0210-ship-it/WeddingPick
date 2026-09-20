declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('path') as { join: (...parts: string[]) => string };
const MOBILE = join(__dirname, '..', '..');
const ROOT = join(MOBILE, '..', '..', '..');
const mobile = (path: string) => readFileSync(join(MOBILE, path), 'utf8');
const root = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('2026-09-20 사용자 공통 UI 회귀', () => {
  it('Kakao 복귀는 기본 로더와 진행 문구를 같이 둔다', () => {
    const s = mobile('features/auth/signing-in-view.tsx');
    expect(s).toContain('<DelayedLoader size={40} />');
    expect(s).toContain('{SIGNING_IN_MESSAGE}');
  });
  it('Android Root/no-history Back은 2회 앱 종료를 쓴다', () => {
    const s = mobile('app/(tabs)/_layout.tsx');
    expect(s).toContain("BackHandler.addEventListener('hardwareBackPress'");
    expect(s).toContain("setExitToast('뒤로가기를 한 번 더 누르면 앱이 종료돼요')");
    expect(s).toContain('BackHandler.exitApp()');
    expect(s).toContain('TAB_ROOTS.includes(pathname)');
  });
  it('2Depth 헤더는 DepthHeader 하나를 쓴다', () => {
    expect(mobile('components/back-bar.tsx')).toContain('<DepthHeader');
    expect(mobile('features/wedding/screen-kit.tsx')).toContain('<DepthHeader');
    expect(mobile('features/settings/my-kit.tsx')).toContain('<DepthHeader');
    const depth = mobile('components/depth-header.tsx');
    expect(depth).not.toContain('sub?:');
    expect(depth).toContain('depthHeaderTitle(pathname)');
  });
  it('온보딩 지역 전체값을 만들지 않고 스타일 4종을 허용한다', () => {
    const region = mobile('features/onboarding/region-picker-sheet.tsx');
    expect(region).not.toContain("const WHOLE = '전체'");
    expect(root('packages/domain/src/style.ts')).toContain('STYLE_PICK_MAX = WEDDING_STYLES.length');
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
    expect(s).toContain("const TITLE = '검색'");
    expect(s).not.toContain("const SUBTITLE = '우리 조건에 맞는 선택만 모았어요'");
    expect(s).toContain("sortSlot: { position: 'absolute', right: Layout.pageX }");
  });
  it('Pick 3탭과 compare 연결을 유지한다', () => {
    const s = mobile('features/pick/pick-section-tabs.tsx');
    expect(s).toContain("label: '나의 Pick'");
    expect(s).toContain("label: '웨딩픽 추천'");
    expect(s).toContain("label: '비교함'");
    expect(s).toContain("pathname: '/search/compare'");
  });
  it('최초 예산은 만원 입력을 원으로 환산한다', () => {
    const s = mobile('app/(tabs)/wedding/index.tsx');
    expect(s).toContain('const budgetAmount = budgetManwon * 10_000');
    expect(s).toContain('placeholder="예: 5,000"');
  });
});
