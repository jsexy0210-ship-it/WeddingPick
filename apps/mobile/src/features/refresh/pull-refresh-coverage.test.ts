declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync, readdirSync, statSync } = require('node:fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory: () => boolean };
};
const { join, relative } = require('node:path') as {
  join: (...parts: string[]) => string;
  relative: (from: string, to: string) => string;
};

const SRC = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(SRC, path), 'utf8');

/**
 * 당겨서 새로 고침이 붙은 자리를 센다(2026-09-26 대표 지시 「화면 자체를 밑으로 내리면
 * 새로고침 진행한다」). 목록 · 상세 화면이 새로 생기거나 고쳐지다 빠지면 여기서 걸린다.
 *
 * 붙이지 않은 자리(의도): 입력 · 작성 화면(후기 쓰기 · 지출 등록 · 일정 추가 · 상담 예약 · 수정 제보 ·
 * 녹음 올리기 · 초대 코드 입력 · 프로필 · 취향 · 웨딩 설정 · 탈퇴 · 문의하기) — 당기다 입력을 잃는
 * 자리라서. 시트형 라우트(상담 기록 상세 · 라운지 후기 쓰기) — 시트 끌어 닫기와 겹쳐서. 사진 전체보기
 * (가로 넘김 뷰어) · 관리자 콘솔.
 */
const WIRED = [
  // Root 5탭
  'app/(tabs)/index.tsx',
  'app/(tabs)/search/index.tsx',
  'app/(tabs)/pick/index.tsx',
  'app/(tabs)/wedding/index.tsx',
  'app/(tabs)/my/index.tsx',
  // 홈 · 라운지
  'app/(tabs)/(home)/feed/[id].tsx',
  'features/community/lounge-screen.tsx',
  // 검색
  'app/(tabs)/search/[vendorId]/index.tsx',
  'app/(tabs)/search/expo/[expoId]/index.tsx',
  'app/(tabs)/search/compare.tsx',
  // 웨딩노트 — 지출내역 풀팝업(`expenses/list`)은 2026-09-26 예산현황 목록으로 통합돼 예산 탭(위 `wedding/index`)이 맡는다.
  'app/(tabs)/wedding/[id]/changelog.tsx',
  'app/(tabs)/wedding/[id]/decided.tsx',
  'app/(tabs)/wedding/[id]/map.tsx',
  'app/(tabs)/wedding/partner.tsx',
  // MY
  'app/(tabs)/my/notifications.tsx',
  'app/(tabs)/my/reports.tsx',
  'app/(tabs)/my/reviews.tsx',
  'app/(tabs)/my/contact/[inquiryId].tsx',
  'app/(tabs)/my/guide.tsx',
];

describe('당겨서 새로 고침 — 붙은 자리', () => {
  it.each(WIRED)('%s', (path) => {
    const text = read(path);

    expect(text).toContain('usePullRefresh(');
    expect(text).toMatch(/refreshControl=\{(?:pull\.refreshControl|refreshControl)\}/);
  });

  it('라운지 세 화면(리얼후기 · 웨딩정보 · 박람회)은 모두 같은 LoungeScreen이다', () => {
    for (const path of ['app/(tabs)/community/review/index.tsx', 'app/(tabs)/community/feed/index.tsx', 'app/(tabs)/community/expo.tsx']) {
      expect(read(path)).toContain('LoungeScreen');
    }
    expect(read('app/(tabs)/community/feed/[id].tsx')).toContain("from '../../(home)/feed/[id]'");
  });

  /*
   * 한 벌만 둔다 — 화면이 RN `RefreshControl`을 직접 쓰면 웹에서는 당겨지지 않는다(react-native-web의
   * RefreshControl은 빈 View다). 공용 `PullRefreshControl`만 그것을 부른다.
   */
  it('RefreshControl을 직접 쓰는 화면이 없다 — 공용 컨트롤 한 벌뿐', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
        const path = relative(SRC, full);
        if (path.startsWith('features/refresh/') || path.startsWith('app/admin/')) continue;
        if (/<RefreshControl\b|\bonRefresh=\{/.test(readFileSync(full, 'utf8'))) offenders.push(path);
      }
    };
    walk(SRC);

    expect(offenders).toEqual([]);
  });
});
