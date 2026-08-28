/**
 * "같은 상품"을 무엇으로 볼 것인가.
 *
 * **아직 확정되지 않은 규칙이다** (docs/05 7번). 중앙값의 신뢰도가 여기서 갈린다 —
 * 느슨하면 다른 상품이 한 분포에 섞이고, 빡빡하면 표본이 모이지 않는다.
 *
 * 지금은 업체 + 정규화한 상품명으로 잠정 정의한다. 실제 견적서를 모아보고
 * 옵션 조합까지 봐야 하는지 정해야 한다. 규칙이 바뀌면 이 함수만 고치고
 * 기존 product_key를 다시 계산한다.
 */
export function productKey(input: { vendorId: string; productName: string | null }): string | null {
  const normalized = normalizeProductName(input.productName);

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
