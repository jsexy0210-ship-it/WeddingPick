declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

function app(...parts: string[]): string {
  return readFileSync(join(__dirname, '..', '..', 'app', ...parts), 'utf8');
}

const lounge = app('(tabs)', 'community', 'index.tsx');
const detail = app('(tabs)', 'search', '[vendorId]', 'review', '[reviewId].tsx');
const write = app('(tabs)', 'search', '[vendorId]', 'write-review.tsx');

describe('후기 07-lounge-my 이미지·상호작용 정본', () => {
  it('라운지 카드는 실사진·도움돼요·댓글 수를 계약 값으로 그린다', () => {
    expect(lounge).toContain('review.media[0].url');
    expect(lounge).toContain('review.helpful');
    expect(lounge).toContain('review.comments.count');
    expect(lounge).toContain('setReviewHelpful(review.id');
    expect(lounge).not.toContain('author.displayName');
    expect(lounge).not.toContain('partnerName');
  });

  it('320·390·430에서도 카드 사진과 상세 사진은 고정 화면 폭이 아니라 컨테이너 폭을 따른다', () => {
    expect(lounge).toContain("width: '100%'");
    expect(detail).toContain("width: '100%'");
    expect(lounge).not.toContain('width: 390');
    expect(lounge).not.toContain('width: 430');
    expect(detail).not.toContain('width: 390');
    expect(detail).not.toContain('width: 430');
  });

  it('도움돼요 연타와 댓글 중복 등록을 잠그고 late comment 응답은 화면 이탈 뒤 버린다', () => {
    expect(lounge).toContain('helpfulPending[review.id]');
    expect(detail).toContain('commentSending');
    expect(detail).toContain('let active = true');
    expect(detail).toContain('if (active) setComments(page.comments)');
    expect(detail).toContain('active = false');
  });

  it('후기 작성의 사진은 로컬 미리보기로 끝나지 않고 업로드 결과를 createReview에 넣는다', () => {
    expect(write).toContain('pickFromLibrary');
    expect(write).toContain('uploadReviewMedia');
    expect(write).toContain('const media = photos.length > 0');
    expect(write).toContain('media,');
    expect(write).toContain('rightsConfirmed');
  });

  it('상세 댓글은 익명 회원/내 댓글만 표시하고 삭제·신고 경로를 제공한다', () => {
    expect(detail).toContain("comment.mine ? '내 댓글' : '회원'");
    expect(detail).toContain('deleteReviewComment');
    expect(detail).toContain('reportReviewComment');
    expect(detail).not.toContain('comment.authorName');
    expect(detail).not.toContain('comment.displayName');
  });
});
