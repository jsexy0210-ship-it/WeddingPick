import { TERMS } from './terms';
import {
  VENDOR_DETAIL_SECTIONS,
  pendingVendorDetailSections,
  readyVendorDetailSections,
} from './vendor-detail';

describe('업체 상세 순서', () => {
  it('정책이 정한 열세 자리를 그 순서로 담는다', () => {
    // v3.10 §8. 앱·웹·IA가 이 목록 하나를 본다.
    expect(VENDOR_DETAIL_SECTIONS.map((section) => section.key)).toEqual([
      'hero_image',
      'name',
      'key_conditions',
      'verified_data',
      'recommend_reason',
      'vendor_notice',
      'benefits',
      'experience',
      'reviews',
      'rebuttals',
      'official_source',
      'pick',
      'report_error',
    ]);
  });

  it('공식정보가 후기 다음, Pick 앞이다', () => {
    /*
     * 예전에는 업체명 바로 아래에 있었다. 이름을 꾸며주는 배지처럼 보였는데,
     * 읽는 사람이 출처를 궁금해하는 때는 고르기 직전이다.
     */
    const keys = VENDOR_DETAIL_SECTIONS.map((section) => section.key);

    expect(keys.indexOf('official_source')).toBeGreaterThan(keys.indexOf('reviews'));
    expect(keys.indexOf('official_source')).toBeLessThan(keys.indexOf('pick'));
  });

  it('아직 못 그리는 자리도 목록에 남는다', () => {
    /*
     * 지우면 자료가 생기는 날 어디에 넣을지 다시 정해야 한다. 자리는 남기고
     * 아직 없다고 적어둔다.
     */
    expect(pendingVendorDetailSections()).toEqual([
      'hero_image',
      'recommend_reason',
      'vendor_notice',
      'benefits',
    ]);
  });

  it('못 그리는 자리에는 왜인지가 적혀 있다', () => {
    // 이유 없이 비어 있는 자리는 빠뜨린 것과 구별되지 않는다.
    for (const section of VENDOR_DETAIL_SECTIONS) {
      if (!section.ready) expect(section).toHaveProperty('note');
    }
  });

  it('그릴 수 있는 자리는 정책 순서를 지킨다', () => {
    expect(readyVendorDetailSections()).toEqual([
      'name',
      'key_conditions',
      'verified_data',
      'experience',
      'reviews',
      'rebuttals',
      'official_source',
      'pick',
      'report_error',
    ]);
  });

  it('제목이 표준 용어를 쓴다', () => {
    const labels = VENDOR_DETAIL_SECTIONS.map((section) => section.label);

    expect(labels).toContain(TERMS.verifiedData);
    expect(labels).toContain(TERMS.experience);
    expect(labels).toContain(TERMS.recommendReason);
    expect(labels).toContain(TERMS.benefits);
  });
});
