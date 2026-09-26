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
  it('글쓰기는 같은 라운지 후기 화면 위의 오버레이로 연다 — 화면을 새로 push하지 않는다', () => {
    const lounge = readFileSync(join(__dirname, 'lounge-screen.tsx'), 'utf8');

    /* 2026-09-26 대표 제보 「바닥페이지가 두 번 로드된다」 — 같은 화면을 ?write=review로 push했었다. */
    expect(lounge).toContain('onPress: () => setWriteSheet({})');
    expect(lounge).not.toContain('communityWriteHref');
    expect(lounge).toContain('<LoungeReviewVendorSheet');
    expect(lounge).toContain('<ReviewWriteSheet');
    expect(lounge).not.toContain("router.push('/community/review/write");
    expect(lounge).not.toContain('<VendorDetailScreen');
  });

  it('예전 글쓰기 주소도 HOME 배경을 그리지 않고 라운지 후기 URL로 보낸다', () => {
    const legacyWrite = screen('community', 'review', 'write.tsx');

    expect(legacyWrite).toContain("const href = `/community/review?write=review${from === 'my' ? '&from=my' : ''}`");
    expect(legacyWrite).toContain('<Redirect href={href as never} />');
    expect(legacyWrite).not.toContain('<CommunityScreen');
    expect(legacyWrite).not.toContain('<VendorDetailScreen');
  });

  it('업체 선택 · 닫기는 화면을 갈아끼우지 않고 상태만 바꾼다 · 딥링크 인자는 기록 없이 지운다', () => {
    const lounge = readFileSync(join(__dirname, 'lounge-screen.tsx'), 'utf8');

    expect(lounge).toContain('onChoose={(vendorId) => setWriteSheet({ vendorId })}');
    expect(lounge).toContain('onClose={() => setWriteSheet(null)}');
    expect(lounge).not.toContain('router.replace(communityReviewHref');
    expect(lounge).toContain('navigation.setParams({ write: undefined, vendorId: undefined } as never)');
  });
});
