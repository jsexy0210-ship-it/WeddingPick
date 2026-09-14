import {
  HOTLINK_BLOCKED_IMAGE_HOSTS,
  displayableImageUrlSql,
  isDisplayableImageUrl,
  isHotlinkBlockedImageUrl,
} from '../image-hotlink';

describe('핫링킹 차단 호스트', () => {
  it('차단 호스트에는 왜 막혔는지가 따라온다', () => {
    // 근거 없는 줄이 하나라도 섞이면, 다음 사람이 «이건 왜 여기 있지»에서 멈춘다.
    for (const host of HOTLINK_BLOCKED_IMAGE_HOSTS) {
      expect(host.suffix).not.toHaveLength(0);
      expect(host.reason).not.toHaveLength(0);
    }
  });

  it('네이버 이미지 CDN은 서브도메인까지 막는다', () => {
    // 대표님 화면 콘솔에 403으로 쌓이던 주소가 이 모양이다.
    expect(isHotlinkBlockedImageUrl('https://postfiles.pstatic.net/MjAy/abc.jpg')).toBe(true);
    expect(isHotlinkBlockedImageUrl('http://blogfiles.pstatic.net/a.jpg')).toBe(true);
    expect(isHotlinkBlockedImageUrl('https://pstatic.net/a.jpg')).toBe(true);
    expect(isHotlinkBlockedImageUrl('https://PSTATIC.NET/a.jpg')).toBe(true);
  });

  it('이름만 비슷한 호스트는 막지 않는다', () => {
    // `.`을 경계로 삼는다 — 아니면 멀쩡한 이미지가 조용히 사라진다.
    expect(isHotlinkBlockedImageUrl('https://evilpstatic.net/a.jpg')).toBe(false);
    expect(isHotlinkBlockedImageUrl('https://example.com/pstatic.net/a.jpg')).toBe(false);
    expect(isHotlinkBlockedImageUrl('https://cdn.example.com/a.jpg')).toBe(false);
  });

  it('빈 값과 깨진 주소는 차단 호스트가 아니지만 내려보내지도 않는다', () => {
    for (const broken of [null, undefined, '', 'garbage', 'ftp://x/a.jpg']) {
      expect(isHotlinkBlockedImageUrl(broken)).toBe(false);
      expect(isDisplayableImageUrl(broken)).toBe(false);
    }
  });

  it('뜰 수 있는 주소만 통과시킨다', () => {
    expect(isDisplayableImageUrl('https://cdn.example.com/a.jpg')).toBe(true);
    expect(isDisplayableImageUrl('http://cdn.example.com/a.jpg')).toBe(true);
    expect(isDisplayableImageUrl('https://postfiles.pstatic.net/a.jpg')).toBe(false);
  });

  it('SQL 조건은 컬럼 이름을 받아 조건식을 만든다', () => {
    const sql = displayableImageUrlSql('i.source_url');

    expect(sql).toContain('i.source_url');
    // 목록에 있는 호스트가 빠지면 조건이 아무것도 안 막는다.
    for (const host of HOTLINK_BLOCKED_IMAGE_HOSTS) {
      expect(sql).toContain(host.suffix.replace(/\./g, '\\.'));
    }
  });
});
