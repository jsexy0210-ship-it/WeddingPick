import { DISCLOSURE_THRESHOLDS } from './disclosure';
import { decideDisclosure, type DisclosureDecision, type DisclosureSignals } from './policy-engine';
import type { VendorCategory } from './vendor';

/**
 * 결혼정보회사 가격 공개.
 *
 * 웨딩홀·스튜디오와 같은 사다리를 그대로 쓰지 않는다. 이유는 상품의 모양이 다르기
 * 때문이다.
 *
 *   - 웨딩홀 계약은 "그 홀, 그 날짜, 그 상품"이라 금액 하나가 뜻을 가진다.
 *   - 결혼정보회사 계약은 **이용기간·소개횟수·소개방식·성혼비**가 다 다르다.
 *     조건을 모르는 채 금액만 보면 3개월 3회와 1년 무제한이 같은 줄에 선다.
 *
 * 그래서 조건이 확인되지 않으면 세부 금액을 열지 않는다. 금액만 맞히는 것보다
 * 무엇에 대한 금액인지가 먼저다.
 */

/** 이 업종인가. 화면·서버가 같은 판정을 쓰게 한 곳에 둔다. */
export function isAgency(category: VendorCategory): boolean {
  return category === 'wedding_info_company';
}

/**
 * 함께 확인해야 하는 조건.
 *
 * 정책이 정한 목록이다. 여기 없는 것을 비교 조건으로 만들지 않는다 — 조건이
 * 늘수록 조합이 잘게 쪼개지고, 잘게 쪼갠 조합은 곧 한 사람을 가리킨다.
 */
export const AGENCY_CONDITIONS = [
  'period',
  'intro_count',
  'intro_method',
  'success_fee',
  'extra_cost',
  'product_grade',
] as const;

export type AgencyCondition = (typeof AGENCY_CONDITIONS)[number];

export const AGENCY_CONDITION_LABEL: Record<AgencyCondition, string> = {
  period: '이용기간',
  intro_count: '소개횟수',
  intro_method: '소개방식',
  success_fee: '성혼비 여부',
  extra_cost: '추가비용',
  product_grade: '상품·등급',
};

/**
 * 세부 금액을 열려면 이만큼은 확인돼야 한다.
 *
 * 여섯 중 넷이다. 여섯을 다 요구하면 실전에서 열리는 일이 거의 없고, 둘만
 * 요구하면 기간도 모르는 채 금액을 보여주게 된다. 넷은 **기간·횟수·방식·성혼비**가
 * 모이는 선이다 — 금액을 읽는 데 필요한 최소한이 그 넷이다.
 */
export const AGENCY_MIN_CONDITIONS = 4;

/** 사용자에게 하는 말. 무엇이 모자란지 적는다. */
export const AGENCY_CONDITIONS_MISSING =
  '이용기간과 소개 조건이 확인되면 금액을 함께 보여드려요';

/**
 * 한 건은 결코 금액이 되지 않는다.
 *
 * 정책이 "개인 1건의 실제 결제금액 단독 공개 금지"라고 못박았다. 다른 업종은
 * 공개 사다리가 이미 막지만(3건부터), 여기서 한 번 더 적어두는 이유는 이 금지가
 * 사다리의 부수 효과가 아니라 **그 자체로 규칙**이기 때문이다. 사다리를 낮추는
 * 날이 와도 이 줄은 남는다.
 */
export const AGENCY_NEVER_SINGLE = 2;

export type AgencyDisclosureInput = DisclosureSignals & {
  /** 값이 확인된 조건들. 확인 안 된 것은 넣지 않는다. */
  knownConditions: readonly AgencyCondition[];
};

/**
 * 결혼정보회사 금액을 어디까지 보여줄 것인가.
 *
 * 공통 Policy Engine을 먼저 돌리고, 이 업종의 규칙으로 더 내려 잡는다. 올려
 * 잡는 일은 없다.
 */
export function decideAgencyDisclosure(input: AgencyDisclosureInput): DisclosureDecision {
  const base = decideDisclosure(input);

  /* 한 건은 금액이 아니다. 사다리와 무관하게 막는다. */
  if (input.count < AGENCY_NEVER_SINGLE) {
    return {
      ...base,
      stage: 'collecting',
      limitedBy: [...base.limitedBy, 'not_enough'],
      note: AGENCY_CONDITIONS_MISSING,
    };
  }

  const known = new Set(input.knownConditions).size;

  if (known < AGENCY_MIN_CONDITIONS) {
    /*
     * 조건을 모르면 구간까지만. 기준금액·조건별은 "무엇에 대한 값인지"를 아는
     * 사람만 읽을 수 있는 숫자다.
     */
    const capped = base.stage === 'detailed' ? 'normal' : base.stage;

    return {
      ...base,
      stage: capped,
      limitedBy:
        capped === base.stage ? base.limitedBy : [...base.limitedBy, 'condition_thin'],
      note: AGENCY_CONDITIONS_MISSING,
    };
  }

  return base;
}

/**
 * 공식가격과 확인된 정보를 한 줄에 섞지 않는다.
 *
 * 업체가 안내한 가격은 업체의 말이고, 확인된 정보는 우리가 센 것이다. 둘을 한
 * 숫자로 합치면 어느 쪽이 근거인지 물을 수 없게 된다. 화면은 늘 두 줄로 적는다.
 */
export const AGENCY_PRICE_SOURCES = ['official', 'confirmed'] as const;

export type AgencyPriceSource = (typeof AGENCY_PRICE_SOURCES)[number];

export const AGENCY_PRICE_SOURCE_LABEL: Record<AgencyPriceSource, string> = {
  official: '업체 안내',
  confirmed: '확인된 정보',
};

/** 세부 금액을 열어도 되는 최소 건수. 공개 사다리의 첫 칸과 같다. */
export const AGENCY_MIN_COUNT = DISCLOSURE_THRESHOLDS.limited;
