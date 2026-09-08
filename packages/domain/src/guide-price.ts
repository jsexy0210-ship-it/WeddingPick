import { manwon, rangeLabel, type PriceDisclosure } from './disclosure';
import { COLLECTING_LABEL, NOT_ENOUGH_DATA, TERMS } from './terms';

/**
 * 업체 안내 가격 — 정보 0층(핸드오프 v3.22 SPEC §2).
 *
 * 출시 첫날 실 제보는 0건이다. 실 제보로만 금액을 내면 전 업체가 «수집 중»인 빈 앱이
 * 된다. 그래서 실 제보가 3건이 되기 전에는 업체가 안내한 시작 금액을 **대신** 보여준다.
 *
 * 실 제보와 섞지 않는다 — 라벨이 «업체 안내»로 다르고 색이 회색이다. 실 제보가 3건이
 * 되는 순간(stage가 collecting을 벗어나는 순간) 자동으로 실 제보 표기로 바뀐다.
 */
export type GuidePrice = {
  /** 안내 시작 금액(원). */
  fromKrw: number;
  /** 출처 표기. «출처 · 업체 홈페이지». */
  sourceLabel: string;
};

/** «업체 안내 150만원~». */
export function guidePriceLabel(fromKrw: number): string {
  return `${TERMS.vendorNotice} ${manwon(fromKrw)}~`;
}

/**
 * 금액 한 줄 — 검색 · 홈 추천 · 업체 상세 · 비교가 **같은 규칙**으로 쓴다.
 *
 *   0층  실 제보 3건 미만 · 업체 안내 있음   «업체 안내 150만원~» 회색 · 캡션 «출처 · …»
 *   1층  실 제보 3건 미만 · 업체 안내 없음   «수집 중» 회색 · 캡션 «아직 정보가 적어요 · N건»
 *   2~4  실 제보 3건 이상                  «152~184만원» · 캡션은 공개 사다리 그대로
 */
export type PriceLine = {
  text: string;
  /** 회색으로 낮춘다(#868B94). 0층 · 1층. */
  dim: boolean;
  caption: string;
  /** 0층인가 — 화면이 «업체 안내» 배지나 출처 줄을 더 그릴 때 본다. */
  guide: boolean;
};

export function priceLine(paidPrice: PriceDisclosure, guidePrice: GuidePrice | null): PriceLine {
  if (paidPrice.stage !== 'collecting') {
    return {
      text: rangeLabel(paidPrice.low, paidPrice.high),
      dim: false,
      caption: paidPrice.caption,
      guide: false,
    };
  }

  if (guidePrice) {
    return {
      text: guidePriceLabel(guidePrice.fromKrw),
      dim: true,
      caption: `출처 · ${guidePrice.sourceLabel}`,
      guide: true,
    };
  }

  return {
    text: COLLECTING_LABEL,
    dim: true,
    caption: `${NOT_ENOUGH_DATA} · ${paidPrice.count}건`,
    guide: false,
  };
}

/** 실 제보도 업체 안내도 없다 — «수집 중» + Pick 인증 CTA로 채운다(빈 섹션 처리). */
export function needsPickProof(paidPrice: PriceDisclosure, guidePrice: GuidePrice | null): boolean {
  return paidPrice.stage === 'collecting' && guidePrice === null;
}
