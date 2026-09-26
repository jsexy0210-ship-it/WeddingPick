declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const source = readFileSync(join(__dirname, '../../app/admin/wedding-feed.tsx'), 'utf8');

describe('관리자 웨딩피드 비동기 폼 회귀', () => {
  it('카테고리 변경 뒤 늦게 온 Gemini 초안을 버린다', () => {
    expect(source).toContain('const requestedCategory = form.categoryLabel');
    expect(source).toContain('current.categoryLabel === requestedCategory');
    expect(source).toContain('disabled={draftGenerating}');
  });

  it('닫은 폼의 이미지 업로드 완료가 새 폼을 바꾸지 않는다', () => {
    expect(source).toContain('const formRevision = useRef(0)');
    expect(source).toContain('if (formRevision.current !== revision) return');
    expect(source).toContain('onClose={closePostEditor}');
  });
});

/**
 * 관리자와 앱이 같은 목록을 본다(2026-09-26 대표 지적 — 「관리자 웨딩피드 카테고리와
 * 앱웹 카테고리와 정보가 전혀 다르다」). 관리자가 따로 들던 탭·카테고리 표를 다시
 * 부르거나, 고르는 목록을 화면 안에 다시 적으면 둘이 또 갈라진다.
 */
describe('관리자 웨딩피드 — 앱과 같은 카테고리 목록', () => {
  it('고르는 목록과 앱 칩 칸이 domain 상수에서 온다', () => {
    expect(source).toContain('WEDDING_FEED_CATEGORIES.map((category) => (');
    expect(source).toContain('weddingFeedChipOf(categoryLabel)');
    expect(source).toContain('isWeddingFeedCategoryLabel(form.categoryLabel)');
  });

  it('걷어낸 탭·카테고리 편집 API를 부르지 않는다', () => {
    expect(source).not.toContain('/v1/admin/wedding-feed/taxonomy');
    expect(source).not.toContain('/v1/admin/wedding-feed/groups');
    expect(source).not.toContain('/v1/admin/wedding-feed/categories');
  });

  it('앱 글 상세가 찍는 공개일을 관리자 표도 같은 꼴로 보여준다', () => {
    expect(source).toContain('formatDateDot(post.publishedAt)');
  });
});
