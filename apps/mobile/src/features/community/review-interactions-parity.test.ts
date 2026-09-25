declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

function app(...parts: string[]): string {
  return readFileSync(join(__dirname, '..', '..', 'app', ...parts), 'utf8');
}

const lounge = readFileSync(join(__dirname, 'lounge-screen.tsx'), 'utf8');
const write = app('(tabs)', 'search', '[vendorId]', 'write-review.tsx');

describe('후기 07-lounge-my 이미지·상호작용 정본', () => {
  it('라운지 카드는 실사진·도움돼요를 계약 값으로 그린다', () => {
    expect(lounge).toContain('review.media[0].url');
    expect(lounge).toContain('review.helpful');
    // 후기 상세(댓글)는 2026-09-25 삭제 — 라운지 카드는 거기로 보내지 않는다.
    expect(lounge).not.toContain('/review/${');
    expect(lounge).toContain('setReviewHelpful(review.id');
    expect(lounge).not.toContain('author.displayName');
    expect(lounge).not.toContain('partnerName');
  });

  it('320·390·430에서도 카드 사진은 고정 화면 폭이 아니라 컨테이너 폭을 따른다', () => {
    expect(lounge).toContain("width: '100%'");
    expect(lounge).not.toContain('width: 390');
    expect(lounge).not.toContain('width: 430');
  });

  it('도움돼요 연타를 잠근다', () => {
    expect(lounge).toContain('helpfulPending[review.id]');
  });

  it('후기 작성의 사진은 로컬 미리보기로 끝나지 않고 업로드 결과를 createReview에 넣는다', () => {
    expect(write).toContain('pickFromLibrary');
    expect(write).toContain('uploadReviewMedia');
    expect(write).toContain('const media = photos.length > 0');
    expect(write).toContain('media,');
    expect(write).toContain('rightsConfirmed');
  });
});
