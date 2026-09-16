import {
  OFFICIAL_VENDOR_RULES,
  VENDOR_OFFICIAL_SOURCE,
  officialVendorCondition,
  officialVendorSignals,
} from './vendor-official';

/**
 * 셋을 각각 내놓기만 한다. 「공식인증인가」 하나로 접는 것은 부르는 쪽이 정한다 —
 * 대표님이 정의를 아직 확정하지 않으셨다.
 */
describe('공식인증 판정', () => {
  const none = { source: 'public_data', approvedClaimCount: 0, vendorProvidedImageCount: 0 };

  it('가 — 출처 표시만으로 참이 된다. 승인 기록이 없어도 본다', () => {
    expect(officialVendorSignals({ ...none, source: VENDOR_OFFICIAL_SOURCE })).toEqual({
      source: true,
      approvedClaim: false,
      vendorProvidedImage: false,
    });
  });

  it('나 — 승인된 인증이 있으면 참이다. 출처가 안 올라가 있어도 본다', () => {
    expect(officialVendorSignals({ ...none, approvedClaimCount: 1 })).toEqual({
      source: false,
      approvedClaim: true,
      vendorProvidedImage: false,
    });
  });

  it('다 — 승인과 사진이 둘 다 있어야 참이다', () => {
    expect(
      officialVendorSignals({ ...none, approvedClaimCount: 1, vendorProvidedImageCount: 3 })
    ).toMatchObject({ approvedClaim: true, vendorProvidedImage: true });
  });

  /*
   * 사진만 있고 승인이 없으면 다가 아니다. 그런 사진은 업체가 준 것이 아니라
   * 그렇게 «적힌» 것뿐이다 — 수집이 값을 그렇게 넣었을 수 있다.
   */
  it('다 — 승인 없이 사진만 있으면 참이 아니다', () => {
    expect(
      officialVendorSignals({ ...none, approvedClaimCount: 0, vendorProvidedImageCount: 5 })
    ).toMatchObject({ approvedClaim: false, vendorProvidedImage: false });
  });

  it('셋 다 거짓인 것이 지금 DB의 업체 전부다', () => {
    expect(officialVendorSignals(none)).toEqual({
      source: false,
      approvedClaim: false,
      vendorProvidedImage: false,
    });
  });
});

describe('공식인증 SQL 조건', () => {
  it('별칭을 그대로 쓴다 — 질의마다 다시 적지 않게', () => {
    for (const rule of OFFICIAL_VENDOR_RULES) {
      expect(officialVendorCondition('v', rule)).toContain('v.');
    }
  });

  /*
   * 승인된 인증은 표가 아니라 뷰를 본다. 그 뷰에는 연락처 · 증빙 열이 아예 없어서
   * 이 조건을 붙인 질의가 실수로 증빙을 꺼낼 수 없다(0038 · 원문 27번).
   */
  it('승인된 인증은 approved_vendor_claims 뷰를 본다', () => {
    expect(officialVendorCondition('v', 'approvedClaim')).toContain(
      'structured.approved_vendor_claims'
    );
    expect(officialVendorCondition('v', 'approvedClaim')).not.toContain('structured.vendor_claims');
  });

  it('다는 나를 포함한다 — 승인 조건을 함께 건다', () => {
    const image = officialVendorCondition('v', 'vendorProvidedImage');

    expect(image).toContain('structured.approved_vendor_claims');
    expect(image).toContain("i.copyright_basis = 'vendor_provided'");
  });
});
