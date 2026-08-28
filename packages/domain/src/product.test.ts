import { normalizeProductName, productKey } from './product';

describe('상품 키', () => {
  const vendorId = 'vendor-1';

  it('표기가 달라도 같은 상품으로 본다', () => {
    expect(productKey({ vendorId, productName: '기본 패키지' })).toBe(
      productKey({ vendorId, productName: '기본패키지' })
    );
    expect(productKey({ vendorId, productName: '올인원 (평일)' })).toBe(
      productKey({ vendorId, productName: '올인원 평일' })
    );
  });

  it('업체가 다르면 다른 상품이다', () => {
    expect(productKey({ vendorId: 'a', productName: '기본 패키지' })).not.toBe(
      productKey({ vendorId: 'b', productName: '기본 패키지' })
    );
  });

  it('웨딩홀처럼 상품명이 없으면 홀 이름을 쓴다', () => {
    expect(productKey({ vendorId, productName: null, hallName: '그랜드볼룸' })).toBe(
      productKey({ vendorId, productName: null, hallName: '그랜드 볼룸' })
    );
  });

  it('상품명이 있으면 홀 이름보다 상품명을 쓴다', () => {
    expect(productKey({ vendorId, productName: '올인원', hallName: '그랜드볼룸' })).not.toBe(
      productKey({ vendorId, productName: null, hallName: '그랜드볼룸' })
    );
  });

  it('상품명도 홀 이름도 없으면 키를 만들지 않는다', () => {
    // 키가 없으면 비교에 들어가지 않는다 — 무엇과 견줄지 모르는 채로 묶지 않는다.
    expect(productKey({ vendorId, productName: null })).toBeNull();
    expect(productKey({ vendorId, productName: '   ', hallName: null })).toBeNull();
  });

  it('기호만 있는 이름은 이름이 아니다', () => {
    expect(normalizeProductName('---')).toBeNull();
  });
});
