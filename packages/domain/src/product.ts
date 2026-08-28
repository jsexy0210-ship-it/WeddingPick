/**
 * "같은 상품"을 무엇으로 볼 것인가.
 *
 * **아직 확정되지 않은 규칙이다** (docs/05 7번). 중앙값의 신뢰도가 여기서 갈린다 —
 * 느슨하면 다른 상품이 한 분포에 섞이고, 빡빡하면 표본이 모이지 않는다.
 *
 * 지금은 업체 + 정규화한 상품명(웨딩홀은 홀 이름)으로 잠정 정의한다.
 *
 * 아직 반영하지 않은 것: 요일·시간대·시즌, 보증인원, 식대 단가. 사업계획서 14번은
 * 요일·시간·시즌별 가격 차이를 데이터가 충분해지면 분리하라고 한다. 보증인원과 식대
 * 단가는 컬럼으로는 들어와 있으니, 표본이 모이면 여기에 더한다.
 *
 * 규칙이 바뀌면 이 함수만 고치고 기존 product_key를 다시 계산한다.
 */
export function productKey(input: {
  vendorId: string;
  productName: string | null;
  /** 웨딩홀 견적에는 상품명이 없고 홀 이름이 있다. 상품명이 없으면 이걸 쓴다. */
  hallName?: string | null;
}): string | null {
  const normalized =
    normalizeProductName(input.productName) ?? normalizeProductName(input.hallName ?? null);

  if (!normalized) {
    return null;
  }

  return `${input.vendorId}:${normalized}`;
}

/** 공백·기호를 지우고 소문자로. 업체 이름 정규화와 같은 방식이다. */
export function normalizeProductName(name: string | null): string | null {
  if (!name) {
    return null;
  }

  const normalized = name.toLowerCase().replace(/[\s()[\]{}·・,._/-]/g, '');

  return normalized.length > 0 ? normalized : null;
}
