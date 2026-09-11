import { showsUnverifiedImages } from '../routes/vendors';

/**
 * 판정 전 사진을 내보내는 스위치.
 *
 * 2026-09-11 대표 지시 「이미지 720장만 우선 삽입한다」로 **기본이 열림**이 됐다.
 * 이 시험이 붙들고 있는 것은 기본값 그 자체다 — 누가 「안전하게」 기본을 닫힘으로
 * 되돌려 놓으면 720장이 다시 한 장도 안 나가는데, 화면은 똑같이 멀쩡해 보여서
 * 아무도 알아채지 못한다. 오늘 그 상태를 하루 넘게 못 봤다.
 */
describe('VENDOR_IMAGES_SHOW_UNVERIFIED', () => {
  const before = process.env.VENDOR_IMAGES_SHOW_UNVERIFIED;

  afterEach(() => {
    if (before === undefined) delete process.env.VENDOR_IMAGES_SHOW_UNVERIFIED;
    else process.env.VENDOR_IMAGES_SHOW_UNVERIFIED = before;
  });

  it('설정이 없으면 열려 있다 — 대표 지시가 기본값이다', () => {
    delete process.env.VENDOR_IMAGES_SHOW_UNVERIFIED;
    expect(showsUnverifiedImages()).toBe(true);
  });

  it("'0'이면 닫힌다 — 되돌릴 것은 이 값 하나다", () => {
    process.env.VENDOR_IMAGES_SHOW_UNVERIFIED = '0';
    expect(showsUnverifiedImages()).toBe(false);
  });

  it("'0' 말고는 무엇을 넣어도 열려 있다 — 오타로 조용히 닫히지 않는다", () => {
    for (const value of ['1', 'true', 'false', 'no', '']) {
      process.env.VENDOR_IMAGES_SHOW_UNVERIFIED = value;
      expect(showsUnverifiedImages()).toBe(true);
    }
  });
});
