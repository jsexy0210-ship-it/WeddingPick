import { z } from 'zod';

import { paidPriceSchema } from './payment-proofs';
import { reportedPriceSchema } from './price-reports';
import { usageScoreSchema } from './reviews';

import { BUDGET_BAND_KEYS, MAX_COMPARED_VENDORS, SPONSORED_LABEL, WEDDING_STYLES } from '@weddingpick/domain';

import { coordinateSchema, documentTypeSchema, idSchema, vendorCategorySchema } from './common';
import { priceStatSchema } from './comparison';

/**
 * A-16 검색 결과 한 줄.
 *
 * 별점도 후기도 없다. 우리가 아는 것은 이 업체가 있다는 사실과, 확인된 계약이 몇 건
 * 모였는지뿐이다. 모르는 것을 아는 척하지 않는다.
 */
export const weddingStyleSchema = z.enum(WEDDING_STYLES);

/** 업체 안내 가격(정보 0층). packages/domain guide-price.ts와 같은 꼴이다. */
export const guidePriceSchema = z.object({
  fromKrw: z.int().positive(),
  sourceLabel: z.string().min(1),
});

export type GuidePriceDto = z.infer<typeof guidePriceSchema>;

export const vendorSummarySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  category: vendorCategorySchema,
  region: z.string().min(1),
  /** 지도 핀 위치. 아직 지오코딩하지 않은 업체는 null — 지도에는 안 뜨고 목록에는 그대로 뜬다. */
  coordinates: coordinateSchema.nullable(),
  /** 공공데이터에서 온 업체면 출처 문장. 서버가 만들어 내려준다. */
  sourceNote: z.string().nullable(),
  /**
   * 대표 이미지. 승인된(status=approved) 이미지 중 대표 한 장의 주소. 없으면
   * null — 화면은 카테고리 기본 이미지로 대체한다(CLAUDE.md §8). «사진 준비 중»
   * 상자를 그리지 않는다.
   */
  imageUrl: z.string().nullable(),
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
  /**
   * 업체 스타일 태그(v3.22). 개수 제한 없음. 사용자가 고른 것과 겹치는 개수를 정렬에만
   * 반영한다 — 태그가 다르다고 목록에서 빼지 않는다.
   */
  styleTags: z.array(weddingStyleSchema),
  /**
   * 업체 안내 가격(정보 0층). 실 제보 3건 미만일 때 «업체 안내 150만원~»를 회색으로
   * 대신 보여준다. 없으면 null — 그때는 «수집 중» + Pick 인증 CTA.
   */
  guidePrice: guidePriceSchema.nullable(),
  /**
   * 추천 이유(홈 웨딩픽 추천). 서버가 문장으로 내려준다 — 스타일 일치가 먼저고
   * «실 제보 N건»은 자료가 생기면 등장한다. 추천 자리가 아니면 없다.
   */
  reasons: z.array(z.string().min(1)).optional(),
});


/**
 * 정렬. 핸드오프 7번.
 *
 * **`인기 순`은 없다.** 인기를 재는 것이 우리에게 없고, 없는 것을 만들어 이름만
 * 붙이면 그건 정렬이 아니라 꾸밈이다. 대신 `데이터 많은 순`을 기본으로 둔다 —
 * 결제인증이 많이 모인 업체가 먼저 나오는 것은 잴 수 있는 사실이다.
 */
export const VENDOR_SORTS = ['data', 'price_low', 'price_high', 'name'] as const;

export const vendorSortSchema = z.enum(VENDOR_SORTS);

export const VENDOR_SORT_LABEL: Record<(typeof VENDOR_SORTS)[number], string> = {
  data: '실 제보 많은 순',
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
  /** 대표 이미지. 없으면 null — 카드가 카테고리 기본으로 대체한다. */
  imageUrl: z.string().nullable(),
  /** 유료 노출임을 밝히는 말. 애매한 말을 쓰지 않는다. */
  label: z.literal(SPONSORED_LABEL),
});

/**
 * A-16 검색 질의.
 *
 * **화면이 거는 조건 그대로다.** 필터 시트(WP-SRCH-005)가 그리는 것은 지역 · 예산 ·
 * «실 제보가 있는 곳만» 셋이고, 세 칸이 여기 그대로 있다. 서버가 먼저 정해둔 칸에
 * 화면을 맞추지 않는다.
 *
 * 시안의 「촬영일」 · 「조건」 두 묶음은 여기 없다 — 업체의 촬영 가능일도, 상품
 * 구성(원본 전체 · 야외 포함 …)도 아직 어디에도 모아둔 것이 없다. 고를 수는 있는데
 * 아무것도 걸리지 않는 칩을 두지 않는다.
 */
export const vendorSearchQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  /** 업종 목록은 `vendorCategorySchema`가 들고 있다. */
  category: vendorCategorySchema.optional(),
  /** "서울"처럼 시도까지만. region은 "서울 마포구" 형태라 앞부분으로 맞춘다. */
  region: z.string().trim().max(20).optional(),
  /** 예산 구간 한 칸. 키는 `BUDGET_BANDS`(packages/domain)가 정한다. */
  budget: z.enum(BUDGET_BAND_KEYS).optional(),
  /**
   * 금액을 볼 수 있는 곳만 — 실 제보가 공개 기준(`DISCLOSURE_THRESHOLDS.limited`)에
   * 닿은 업체만 남긴다. 쿼리스트링이라 «true»/«false» 글자로 온다.
   */
  onlyVerified: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  cursor: z.string().max(200).optional(),
  /** 기본은 데이터 많은 순. `인기 순`은 잴 것이 없어 만들지 않았다. */
  sort: vendorSortSchema.default('data'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type VendorSearchQuery = z.infer<typeof vendorSearchQuerySchema>;

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
 * 검색 홈 업종 카드가 적는 수 — WP-SRCH-001 «업종 2×2 + 건수».
 *
 * **업체 수가 아니라 실 제보 수다.** `vendorSearchResponseSchema.total`은 「웨딩홀
 * 340곳」이고 여기 `reportCount`는 「웨딩홀 · 실 제보 412건」이다. 두 숫자를 한 칸에
 * 섞으면 사용자는 업체 수를 「412명이 실제로 알려줬다」로 읽는다.
 *
 * **세는 기준은 화면이 금액을 만들 때 쓰는 것과 같다** — 목록의 금액 한 줄
 * (`priceLine`)이 보는 실 제보와 같은 자격·같은 기간(최근 12개월)이다. 다른 수를
 * 세면 「412건이라는데 금액은 수집 중」이 된다.
 *
 * 업종은 하나도 빠짐없이 내려간다. 0건인 업종을 빼면 화면이 「없으니 0이겠지」를
 * 스스로 정해야 하고, 그건 서버가 말해주지 않은 값이다.
 */
export const vendorCategoryReportsResponseSchema = z.object({
  categories: z.array(
    z.object({
      category: vendorCategorySchema,
      /** 그 업종 업체들의 실 제보를 합친 수. 0일 수 있다. */
      reportCount: z.int().nonnegative(),
    })
  ),
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
export type VendorCategoryReportsResponse = z.infer<typeof vendorCategoryReportsResponseSchema>;
export type VendorProductStat = z.infer<typeof vendorProductStatSchema>;
export type VendorPrices = z.infer<typeof vendorPricesSchema>;
export type VendorDetail = z.infer<typeof vendorDetailSchema>;

/**
 * WP-VEND-002 업체 이미지 한 장.
 *
 * `VendorImage`(@weddingpick/ui의 카테고리 기본 이미지 컴포넌트)와 이름이 겹치지
 * 않게 `VendorPhoto`로 부른다 — 이건 실제 업체 사진이고, 그건 사진이 없을 때의
 * 대체 그림이다.
 *
 * 핸드오프(WP-VEND-002)는 "업체 제공" · "제보 사진" 2탭을 그렸지만, 지금 DB에는
 * 그 둘을 가를 축이 없다 — `vendor_images.copyright_basis`는 저작권 근거일 뿐
 * 제공 주체를 말하지 않는다. 없는 축으로 탭을 나누느니 단일 목록으로 보여준다.
 */
export const vendorPhotoSchema = z.object({
  id: idSchema,
  /** 승인된 이미지의 조회 URL. 저장소 서명 URL이거나 원본 출처 URL. */
  url: z.string().min(1),
  /** 업체를 대표하는 한 장. 업체당 최대 하나. */
  isRepresentative: z.boolean(),
  /** true면 로고·CI처럼 잘리면 안 되는 이미지 — contain으로 표시한다. */
  useContain: z.boolean(),
  /** 화면에 표시할 출처 문구. 없으면 안 보여준다 — 지어내지 않는다. */
  sourceNote: z.string().nullable(),
  /** 검증 통과 시각. 확인일로 보여준다. */
  verifiedAt: z.string().nullable(),
});

export const vendorPhotosResponseSchema = z.object({
  photos: z.array(vendorPhotoSchema),
});

export type VendorPhoto = z.infer<typeof vendorPhotoSchema>;
export type VendorPhotosResponse = z.infer<typeof vendorPhotosResponseSchema>;

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
