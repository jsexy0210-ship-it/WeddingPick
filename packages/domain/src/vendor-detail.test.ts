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
      'recommend_reason',
      'verified_data',
      'vendor_notice',
      'benefits',
      'experience',
      'reviews',
      'rebuttals',
      'official_source',
      'report_error',
      'pick',
    ]);
  });

  it('공식정보가 후기 다음이고, Pick은 어느 자리에도 속하지 않는다', () => {
    /*
     * 공식정보는 예전에 업체명 바로 아래에 있었다. 이름을 꾸며주는 배지처럼 보였는데,
     * 읽는 사람이 출처를 궁금해하는 때는 후기까지 읽은 뒤다. 그 규칙은 그대로다.
     *
     * **Pick은 2026-09-14에 자리가 바뀌었다.** 핸드오프 WP-VEND-001은 «근거를 다 읽은
     * 자리(제보 금액 다음)»라고 정했고, 화면이 위에서 아래로 한 번에 흐르던 때는 그
     * 자리가 곧 그 뜻이었다. 대표 지시로 상세가 탭 넷이 되면서 그 자리가 사라졌다 —
     * 한 탭 안에 넣으면 나머지 세 탭에서는 Pick을 못 누른다.
     *
     * 그래서 탭 바깥 하단 고정으로 옮겼다. 목록에서 마지막인 것은 «제일 덜 중요하다»가
     * 아니라 **어느 자리에도 속하지 않는다**는 뜻이고, 그것을 여기서 지킨다.
     */
    const keys = VENDOR_DETAIL_SECTIONS.map((section) => section.key);

    expect(keys.indexOf('official_source')).toBeGreaterThan(keys.indexOf('reviews'));
    expect(keys.indexOf('pick')).toBe(keys.length - 1);
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
      'report_error',
      'pick',
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
