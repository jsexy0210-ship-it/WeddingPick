import {
  HOTLINK_BLOCKED_IMAGE_HOSTS,
  MIN_IMAGE_MATCH_CONFIDENCE,
  displayableImageCondition,
  displayableImageUrlCondition,
  isDisplayableImage,
  isDisplayableImageUrl,
  isHotlinkBlockedImageUrl,
} from './vendor-image';

/**
 * 검수 모드가 무엇을 열고 무엇을 안 여는지 시험한다.
 *
 * 2026-09-11 대표 지시 「일단 이미지 넣어 보고 판단한다」로 만든 자리다. **여는
 * 범위를 잘못 잡으면 눈에 보이지 않는다** — 판정 전 사진이 비로그인 화면까지
 * 나가도 화면은 똑같이 예쁘게 그려지고, 다른 업체 사진이 걸린 것을 알아볼
 * 방법이 없다. 그래서 조건 자체를 여기서 붙잡아 둔다.
 */
const 판정전 = { status: 'approved', copyrightBasis: 'unknown', matchConfidence: 0 };
const 판정끝 = { status: 'approved', copyrightBasis: 'vendor_provided', matchConfidence: 1 };
/** 폐기 상태는 넷이다(0050). 하나만 시험하면 나머지 셋이 새는 것을 못 본다. */
const 폐기들 = ['rights_rejected', 'match_rejected', 'quality_rejected', 'crop_failed'].map(
  (status) => ({ status, copyrightBasis: 'vendor_provided', matchConfidence: 1 })
);

describe('판정 전 사진은 운영자에게만 보인다', () => {
  it('기본값은 지금까지와 같다 — 판정 전은 안 나간다', () => {
    expect(isDisplayableImage(판정전)).toBe(false);
    expect(isDisplayableImage(판정끝)).toBe(true);
  });

  it('검수 모드에서는 판정 전도 나간다', () => {
    expect(isDisplayableImage(판정전, { preview: true })).toBe(true);
  });

  it('폐기로 넘긴 것은 검수 모드에서도 안 나간다 — 넷 전부', () => {
    for (const 폐기 of 폐기들) {
      expect(isDisplayableImage(폐기, { preview: true })).toBe(false);
      expect(isDisplayableImage(폐기)).toBe(false);
    }
  });

  it('검증 전(pending)은 검수 모드에서만 나간다', () => {
    const 검증전 = { status: 'pending', copyrightBasis: 'vendor_provided', matchConfidence: 1 };

    expect(isDisplayableImage(검증전, { preview: true })).toBe(true);
    expect(isDisplayableImage(검증전)).toBe(false);
  });

  it('매칭 신뢰도만 낮아도 기본값에서는 막힌다', () => {
    expect(
      isDisplayableImage({
        status: 'approved',
        copyrightBasis: 'vendor_provided',
        matchConfidence: MIN_IMAGE_MATCH_CONFIDENCE - 0.01,
      })
    ).toBe(false);
  });
});

describe('SQL 조건도 같은 것을 말한다', () => {
  it('기본값은 저작권과 매칭을 둘 다 본다', () => {
    const sql = displayableImageCondition('i');

    expect(sql).toContain("i.status = 'approved'");
    expect(sql).toContain("i.copyright_basis <> 'unknown'");
    expect(sql).toContain(`i.match_confidence >= ${MIN_IMAGE_MATCH_CONFIDENCE}`);
  });

  it('검수 모드는 폐기만 거른다', () => {
    const sql = displayableImageCondition('i', { preview: true });

    expect(sql).toContain("i.status IN ('pending', 'approved')");
    expect(sql).not.toContain('copyright_basis');
    expect(sql).not.toContain('match_confidence');
  });
});

describe('핫링킹 차단 호스트는 주소가 뜨는지를 묻는다', () => {
  it('차단 호스트에는 왜 막혔는지가 따라온다', () => {
    // 근거 없는 줄이 하나라도 섞이면, 다음 사람이 「이건 왜 여기 있지」에서 멈춘다.
    for (const host of HOTLINK_BLOCKED_IMAGE_HOSTS) {
      expect(host.suffix).not.toHaveLength(0);
      expect(host.reason).not.toHaveLength(0);
    }
  });

  it('네이버 이미지 CDN은 서브도메인까지 막는다', () => {
    // 운영 화면 콘솔에 403으로 쌓이던 주소가 이 모양이다(2026-09-14).
    expect(isHotlinkBlockedImageUrl('https://postfiles.pstatic.net/MjAy/abc.jpg')).toBe(true);
    expect(isHotlinkBlockedImageUrl('http://blogfiles.pstatic.net/a.jpg')).toBe(true);
    expect(isHotlinkBlockedImageUrl('https://pstatic.net/a.jpg')).toBe(true);
    expect(isHotlinkBlockedImageUrl('https://PSTATIC.NET/a.jpg')).toBe(true);
  });

  it('이름만 비슷한 호스트는 막지 않는다', () => {
    // `.`을 경계로 삼는다 — 아니면 멀쩡한 사진이 조용히 사라진다.
    expect(isHotlinkBlockedImageUrl('https://evilpstatic.net/a.jpg')).toBe(false);
    expect(isHotlinkBlockedImageUrl('https://example.com/pstatic.net/a.jpg')).toBe(false);
    expect(isHotlinkBlockedImageUrl('https://cdn.example.com/a.jpg')).toBe(false);
  });

  it('빈 값과 깨진 주소는 차단 호스트가 아니지만 내려보내지도 않는다', () => {
    for (const broken of [null, undefined, '', 'garbage', 'ftp://x/a.jpg', 'https:///a.jpg']) {
      expect(isHotlinkBlockedImageUrl(broken)).toBe(false);
      expect(isDisplayableImageUrl(broken)).toBe(false);
    }
  });

  it('뜰 수 있는 주소만 통과시킨다', () => {
    expect(isDisplayableImageUrl('https://cdn.example.com/a.jpg')).toBe(true);
    expect(isDisplayableImageUrl('http://cdn.example.com/a.jpg')).toBe(true);
    expect(isDisplayableImageUrl('https://postfiles.pstatic.net/a.jpg')).toBe(false);
  });

  it('저작권·매칭 조건과 합치지 않는다 — 묻는 것이 다르다', () => {
    /*
     * 저장소에 원본을 받아둔 사진은 원본 주소가 차단 호스트여도 우리 주소로 뜬다.
     * 두 조건이 한 덩어리가 되면 그런 사진까지 같이 막힌다.
     */
    expect(displayableImageCondition('i')).not.toContain('source_url');
    expect(displayableImageUrlCondition('i.source_url')).not.toContain('copyright_basis');
    expect(displayableImageUrlCondition('i.source_url')).not.toContain('status');
  });

  it('SQL 조건은 컬럼 이름을 받아 조건식을 만든다', () => {
    const sql = displayableImageUrlCondition('i.source_url');

    expect(sql).toContain('i.source_url');
    // 목록에 있는 호스트가 빠지면 조건이 아무것도 안 막는다.
    for (const host of HOTLINK_BLOCKED_IMAGE_HOSTS) {
      expect(sql).toContain(host.suffix.replace(/\./g, '\\.'));
    }
  });
});
