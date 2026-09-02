import { z } from 'zod';

import { paidPriceSchema } from './payment-proofs';
import { reportedPriceSchema } from './price-reports';
import { usageScoreSchema } from './reviews';

import { MAX_COMPARED_VENDORS, SPONSORED_LABEL } from '@weddingpick/domain';

import { documentTypeSchema, idSchema, vendorCategorySchema } from './common';
import { priceStatSchema } from './comparison';

/**
 * A-16 검색 결과 한 줄.
 *
 * 별점도 후기도 없다. 우리가 아는 것은 이 업체가 있다는 사실과, 확인된 계약이 몇 건
 * 모였는지뿐이다. 모르는 것을 아는 척하지 않는다.
 */
export const vendorSummarySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  category: vendorCategorySchema,
  region: z.string().min(1),
  /** 공공데이터에서 온 업체면 출처 문장. 서버가 만들어 내려준다. */
  sourceNote: z.string().nullable(),
  /**
   * 가격 비교에 쓸 수 있는 계약이 몇 건 모였는지.
   *
   * 0이어도 숨기지 않는다 — "아직 자료가 없다"는 것도 사용자가 알아야 할 사실이다.
   * L2 이상이고 사용자 확인을 마친 문서만 센다.
   */
  comparableQuoteCount: z.int().nonnegative(),
  /**
   * 최근 12개월 실제 결제. 목록에서도 보여준다 — 핸드오프 7번의 업체 카드.
   *
   * 상세와 같은 사다리를 쓴다. 목록만 기준을 낮추면 목록에서 본 숫자가 상세에서
   * 사라지는 일이 생긴다.
   */
  paidPrice: paidPriceSchema,
});

/**
 * 정렬. 핸드오프 7번.
 *
 * **`인기 순`은 없다.** 인기를 재는 것이 우리에게 없고, 없는 것을 만들어 이름만
 * 붙이면 그건 정렬이 아니라 꾸밈이다. 대신 `확인된 정보 많은 순`을 기본으로 둔다 —
 * Pick 인증이 많이 모인 업체가 먼저 나오는 것은 잴 수 있는 사실이다.
 */
export const VENDOR_SORTS = ['data', 'price_low', 'price_high', 'name'] as const;

export const vendorSortSchema = z.enum(VENDOR_SORTS);

export const VENDOR_SORT_LABEL: Record<(typeof VENDOR_SORTS)[number], string> = {
  data: '확인된 정보 많은 순',
  price_low: '금액 낮은 순',
  price_high: '금액 높은 순',
  name: '이름 순',
};

/**
 * 유료 노출 한 줄. 최종통합정책 v2.0 E-1.
 *
 * **자연 결과와 다른 배열에 담긴다.** 같은 배열에 넣고 배지만 붙이면 화면이
 * 섞어 그릴 수 있고, 배지를 못 본 사람에게 그건 그냥 검색 결과다. 타입이 섞을
 * 자리를 주지 않는다.
 *
 * 순위 근거(E-2)가 여기 없는 것도 같은 이유다 — 광고는 근거로 오른 것이 아니라
 * 값을 치르고 오른 것이고, 근거 자리를 만들어두면 언젠가 무언가 적힌다.
 */
export const sponsoredCardSchema = z.object({
  vendorId: idSchema,
  name: z.string().min(1),
  category: vendorCategorySchema,
  region: z.string().min(1),
  /** 유료 노출임을 밝히는 말. 애매한 말을 쓰지 않는다. */
  label: z.literal(SPONSORED_LABEL),
});

export const vendorSearchResponseSchema = z.object({
  vendors: z.array(vendorSummarySchema),
  /**
   * 광고 자리. **`vendors`와 섞이지 않는다**(E-1).
   *
   * 광고가 없으면 빈 배열이다. 화면은 이 배열을 자연 결과 위에 따로 그린다.
   */
  sponsored: z.array(sponsoredCardSchema),
  /** 다음 쪽. 없으면 null. */
  nextCursor: z.string().nullable(),
  /**
   * 이 조건에 몇 곳이 있는지. 핸드오프 7번이 정렬 옆에 개수를 뒀다.
   *
   * 쪽 수가 아니라 전체 수다 — "웨딩홀 128곳"이라고 말할 수 있어야 한다.
   */
  total: z.int().nonnegative(),
});

/** 지역 필터에 쓸 시도 목록. 자료에 실제로 있는 것만 내려간다. */
export const vendorRegionsResponseSchema = z.object({
  regions: z.array(z.object({ name: z.string().min(1), vendorCount: z.int().positive() })),
});

/**
 * 업체별 가격 분포 한 줄.
 *
 * 표본이 기준에 못 미치는 상품은 아예 들어오지 않는다 — 중앙값 없이 상품 이름만
 * 늘어놓으면 화면이 "가격 0원"으로 그릴 여지가 생긴다.
 */
export const vendorProductStatSchema = z.object({
  /** 사람이 읽는 상품 이름. 내부 키를 그대로 내보내지 않는다. */
  productLabel: z.string().min(1),
  docType: documentTypeSchema,
  stat: priceStatSchema,
});

/**
 * 업체의 가격.
 *
 * **잠기지 않는다.** 최종통합정책 v2.0 K-6이 "결제인증 회원만 실제 결제 데이터
 * 접근"을 폐기했다 — 실제 결제 구간은 비회원도 본다. 무엇을 보여줄지는 이제
 * 사람이 아니라 **데이터 수**가 정한다(`paidPrice`의 4단계).
 *
 * 결제인증이 여는 것은 접근이 아니라 **깊이**다 — 조건이 비슷한 사례와 상세 분석
 * (`deepData`).
 *
 * 세 가격이 한 자리에 있지만 **셋은 서로 다른 숫자다.** 근거가 다르다:
 * 사람이 심사한 계약(products), 기계가 읽은 결제내역(paidPrice), 그냥 적어준
 * 숫자(reportedPrice). 배열 하나로 합치지 않는 이유다.
 */
export const vendorPricesSchema = z.object({
  /** 계약 중앙값. 사람이 심사한 L2 이상 문서에서만 나온다. */
  products: z.array(vendorProductStatSchema),
  /** 이용자가 올린 결제내역에서 읽은 금액. 심사가 아니라 등록이다. */
  paidPrice: paidPriceSchema,
  /** 문서 없이 적어준 금액. */
  reportedPrice: reportedPriceSchema,
  /**
   * 조건이 비슷한 사례를 볼 수 있는가. 결제내역을 한 건이라도 등록했으면 열린다.
   *
   * 구간을 가리지 않는다 — 여기서 갈리는 것은 상세 분석뿐이다.
   */
  deepData: z.boolean(),
  /** 아직 열리지 않았으면 어떻게 열리는지. 열려 있으면 null. */
  deepDataNote: z.string().nullable(),
});

/**
 * 업체 상세.
 *
 * 목록 카드의 `paidPrice`를 **덜어낸다.** 상세에는 더 자세한 `prices`가 있고,
 * 같은 숫자를 두 자리에 두면 언젠가 둘이 어긋난다 — 그때 어느 쪽이 맞는지
 * 아무도 모른다. 하나만 둔다.
 */
export const vendorDetailSchema = vendorSummarySchema
  .omit({ paidPrice: true })
  .extend({
    lastVerifiedAt: z.string().min(1),
    prices: vendorPricesSchema,
    /** 이용점수. 확인된 후기만 들어간다. */
    usageScore: usageScoreSchema,
  });

/**
 * A-17 업체 비교. 최대 세 곳.
 *
 * 단서(caveats)는 결과와 한 객체로 나간다. 떼어놓을 수 있게 두면 화면이 표만 그리고
 * "금액만으로는 비교할 수 없다"는 말을 빠뜨릴 수 있다 — 사업계획서 2번이 꼽은
 * "비교의 어려움"을 우리가 만든 표가 되레 가리게 된다.
 */
export const vendorComparisonResponseSchema = z.object({
  vendors: z.array(vendorDetailSchema).min(2).max(MAX_COMPARED_VENDORS),
  caveats: z.array(z.string().min(1)).min(1),
});

export type VendorSort = z.infer<typeof vendorSortSchema>;
export type VendorSummary = z.infer<typeof vendorSummarySchema>;
export type VendorComparisonResponse = z.infer<typeof vendorComparisonResponseSchema>;
export type SponsoredCard = z.infer<typeof sponsoredCardSchema>;
export type VendorSearchResponse = z.infer<typeof vendorSearchResponseSchema>;
export type VendorRegionsResponse = z.infer<typeof vendorRegionsResponseSchema>;
export type VendorProductStat = z.infer<typeof vendorProductStatSchema>;
export type VendorPrices = z.infer<typeof vendorPricesSchema>;
export type VendorDetail = z.infer<typeof vendorDetailSchema>;

/**
 * 조건이 비슷한 결제 사례. 최종통합정책 v2.0 D-1 · C-3 · C-4.
 *
 * **판별 유니온이다.** 낼 수 없을 때는 `price`가 아예 없다 — 비워 보내면 화면이
 * 0원이나 빈 구간을 그릴 여지가 남는다.
 *
 * 낼 수 있을 때는 `condition`이 함께 온다. 어느 조건의 숫자인지 모르면 읽는
 * 사람이 자기 조건의 값이라고 넘겨짚고, 그게 가장 흔한 오해다.
 */
export const conditionStatsSchema = z.discriminatedUnion('available', [
  z.object({
    available: z.literal(false),
    /** 왜 못 내는지. "개인정보 때문"이라고 말하지 않는다 — 자료가 덜 모인 것이 맞다. */
    note: z.string().min(1),
  }),
  z.object({
    available: z.literal(true),
    /** 무엇을 좁힌 숫자인지. `웨딩홀 · 서울 · 최근 3개월`. */
    condition: z.string().min(1),
    /** 몇 개의 축으로 좁혔는지. 0이면 업종 전국이다. */
    axes: z.int().min(0),
    price: paidPriceSchema,
  }),
]);

export type ConditionStats = z.infer<typeof conditionStatsSchema>;
