import { VENDOR_CATEGORY_LABEL, type VendorCategory } from './vendor';

/**
 * 여러 업체를 나란히 놓고 볼 때 함께 알려야 하는 것.
 *
 * 사업계획서 2번이 꼽은 문제 중 하나가 "비교의 어려움"이다 — 웨딩홀은 식사·주차·교통·
 * 시설이, 스드메는 업체별 품질과 추가비용이 함께 걸려 있어 금액만으로는 비교가 되지
 * 않는다. 표를 만들어놓고 그 사실을 적지 않으면, 우리가 만든 표가 바로 그 오해를
 * 부추기게 된다.
 */

/** 한 번에 견줄 수 있는 업체 수. 넘으면 표가 읽히지 않는다. */
export const MAX_COMPARED_VENDORS = 3;

export type ComparisonInput = {
  category: VendorCategory;
  /** "서울 마포구" 형태. 시도까지만 견준다. */
  region: string;
  /** 가격을 보여줄 수 있는 상품이 하나라도 있는지 */
  hasPriceData: boolean;
};

/** 시도. "서울 마포구" → "서울" */
function province(region: string): string {
  return region.trim().split(/\s+/)[0] ?? region;
}

/**
 * 비교 결과와 함께 보여줄 단서들.
 *
 * 마지막 문장은 조건과 무관하게 늘 붙는다. 나머지는 실제로 그런 경우에만 붙는다 —
 * 늘 같은 경고를 늘어놓으면 아무도 읽지 않는다.
 */
export function comparisonCaveats(vendors: readonly ComparisonInput[]): string[] {
  const caveats: string[] = [];

  const categories = new Set(vendors.map((vendor) => vendor.category));

  if (categories.size > 1) {
    const labels = [...categories].map((category) => VENDOR_CATEGORY_LABEL[category]);

    caveats.push(
      `분류가 다른 업체를 함께 놓았습니다 (${labels.join(', ')}). 같은 분류끼리 견주는 편이 낫습니다.`
    );
  }

  const provinces = new Set(vendors.map((vendor) => province(vendor.region)));

  if (provinces.size > 1) {
    caveats.push(
      `지역이 다릅니다 (${[...provinces].join(', ')}). 지역에 따라 가격대가 다릅니다.`
    );
  }

  const withoutData = vendors.filter((vendor) => !vendor.hasPriceData).length;

  if (withoutData > 0) {
    caveats.push(
      withoutData === vendors.length
        ? '아직 어느 곳도 가격을 보여줄 만큼 자료가 모이지 않았습니다.'
        : `${withoutData}곳은 확인된 계약 자료가 모자라 가격을 견줄 수 없습니다. 자료가 없다는 뜻이지 싸거나 비싸다는 뜻이 아닙니다.`
    );
  }

  // 사업계획서 2번 "비교의 어려움". 늘 붙인다.
  caveats.push(
    '금액만으로는 비교하기 어렵습니다. 웨딩홀은 식사·주차·교통·시설이, 스드메는 업체별 품질과 추가비용이 함께 걸려 있습니다.'
  );

  return caveats;
}
