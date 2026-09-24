declare const require: (id: string) => unknown;
declare const __dirname: string;

const { existsSync, readFileSync } = require('fs') as {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as {
  join: (...parts: string[]) => string;
};

const APP = join(__dirname, '..', '..', 'app');
const FEATURES = join(__dirname, '..');

const readApp = (path: string) => readFileSync(join(APP, path), 'utf8');
const readFeature = (path: string) => readFileSync(join(FEATURES, path), 'utf8');

describe('2026-09-19 사용자 화면 검수 회귀', () => {
  it('온보딩 완료 카피와 홈 스켈레톤 전환을 유지한다', () => {
    const flow = readFeature('onboarding/flow.ts');
    const setup = readApp('setup.tsx');

    /* v3.28(2026-09-22) WP-AUTH-007 «이대로 시작할까요?»가 9/19의 «선택한 정보로 준비할게요»를 덮는다. */
    expect(flow).toContain("DONE_TITLE_LINES = ['이대로', '시작할까요?']");
    expect(setup).toContain('if (sending) return <HomeSkeleton />');
    expect(setup).not.toContain('remainingLoadingMs = 3000 -');
  });

  it('홈의 웨딩피드 자세히는 라운지 웨딩피드 탭을 실제로 연다', () => {
    const home = readApp('(tabs)/index.tsx');
    const legacy = readApp('(tabs)/community/index.tsx');
    const feed = readApp('(tabs)/community/feed/index.tsx');

    /* 정본 my.jsx frame-010 — 웨딩정보는 독립 화면이다. 옛 `/community?tab=feed`는 리다이렉트로 보존한다. */
    expect(home).toContain("router.push('/community/feed'");
    expect(feed).toContain('<LoungeScreen kind="feed" />');
    expect(legacy).toContain("tab === 'feed' || tab === 'expo' ? tab : 'review'");
  });

  it('FAQ에서 문의하기 경로를 노출하지 않는다', () => {
    const guide = readApp('(tabs)/my/guide.tsx');
    const detail = readApp('(tabs)/my/faq/[faqKey].tsx');

    expect(guide).not.toContain('label="문의하기"');
    expect(detail).not.toContain("pathname: '/my/contact'");
    expect(detail).not.toContain('FAQ_UNRESOLVED_CATEGORY');
  });

  it('폐기한 목록 route 파일은 다시 생기지 않는다', () => {
    const removed = [
      '(tabs)/wedding/[id]/events/index.tsx',
      '(tabs)/wedding/[id]/consultations.tsx',
      '(tabs)/wedding/[id]/expenses/index.tsx',
      '(tabs)/my/policies.tsx',
    ];

    for (const path of removed) expect(existsSync(join(APP, path))).toBe(false);
  });

  it('등록 동작은 웨딩노트를 바닥에 둔 BottomSheet로 연다', () => {
    const event = readApp('(tabs)/wedding/[id]/events/new.tsx');
    const expense = readApp('(tabs)/wedding/[id]/expenses/add.tsx');
    const consultation = readApp('(tabs)/wedding/[id]/consultations/upload.tsx');

    for (const source of [event, expense, consultation]) {
      expect(source).toContain('<WeddingScreen');
      expect(source).toContain('<BottomSheet');
      expect(source).toContain('<ScrollView');
      expect(source).toContain('nestedScrollEnabled');
    }
  });
});
