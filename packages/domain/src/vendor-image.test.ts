import {
  MIN_IMAGE_MATCH_CONFIDENCE,
  displayableImageCondition,
  isDisplayableImage,
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
const 폐기 = { status: 'rejected', copyrightBasis: 'vendor_provided', matchConfidence: 1 };

describe('판정 전 사진은 운영자에게만 보인다', () => {
  it('기본값은 지금까지와 같다 — 판정 전은 안 나간다', () => {
    expect(isDisplayableImage(판정전)).toBe(false);
    expect(isDisplayableImage(판정끝)).toBe(true);
  });

  it('검수 모드에서는 판정 전도 나간다', () => {
    expect(isDisplayableImage(판정전, { preview: true })).toBe(true);
  });

  it('폐기로 넘긴 것은 검수 모드에서도 안 나간다 — 사람이 이미 내린 판정이다', () => {
    expect(isDisplayableImage(폐기, { preview: true })).toBe(false);
    expect(isDisplayableImage(폐기)).toBe(false);
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

    expect(sql).toContain("i.status <> 'rejected'");
    expect(sql).not.toContain('copyright_basis');
    expect(sql).not.toContain('match_confidence');
  });
});
