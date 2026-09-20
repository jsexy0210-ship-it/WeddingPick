/**
 * 라운지에서 시작한 후기 작성은 업체 검색을 거쳐도 라운지 후기 탭을 바닥에 남긴다.
 * 실제 폼 렌더 테스트와 별개로, 두 route 사이의 출처 전달과 닫기 계약을 고정한다.
 */
declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const APP = join(__dirname, '..', '..', 'app', '(tabs)');

function screen(...parts: string[]): string {
  return readFileSync(join(APP, ...parts), 'utf8');
}

describe('라운지 후기 작성 복귀', () => {
  it('글쓰기는 숨은 하위 탭으로 이동하지 않고 라운지 후기 URL에서 직접 연다', () => {
    const lounge = screen('community', 'index.tsx');

    expect(lounge).toContain('const communityWriteHref = `${communityReviewHref}&write=review`');
    expect(lounge).toContain('router.push(communityWriteHref as never)');
    expect(lounge).toContain('<LoungeReviewVendorSheet');
    expect(lounge).toContain('<ReviewWriteSheet');
    expect(lounge).not.toContain("router.push('/community/review/write");
    expect(lounge).not.toContain('<VendorDetailScreen');
  });

  it('예전 글쓰기 주소도 HOME 배경을 그리지 않고 라운지 후기 URL로 보낸다', () => {
    const legacyWrite = screen('community', 'review', 'write.tsx');

    expect(legacyWrite).toContain("const href = `/community?tab=review&write=review${from === 'my' ? '&from=my' : ''}`");
    expect(legacyWrite).toContain('<Redirect href={href as never} />');
    expect(legacyWrite).not.toContain('<CommunityScreen');
    expect(legacyWrite).not.toContain('<VendorDetailScreen');
  });

  it('업체 선택과 폼 닫기 뒤에도 라운지 후기 URL을 복원한다', () => {
    const lounge = screen('community', 'index.tsx');

    expect(lounge).toContain("router.replace(communityReviewHref as never)");
    expect(lounge).toContain(
      'router.replace(`${communityWriteHref}&vendorId=${encodeURIComponent(vendorId)}` as never)'
    );
  });
});
