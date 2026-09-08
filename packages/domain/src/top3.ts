import { budgetOverlaps, type WeddingBudgetBracket } from './budget-bracket';
import { DISCLOSURE_THRESHOLDS } from './disclosure';
import { RECENT_PERIOD_LABEL } from './reidentification';

/**
 * TOP3 추천. 통합정책 v3.10 §2.
 *
 * v3.10이 `특정 업체 추천 금지`를 폐기하고 업체 TOP3를 핵심 기능으로 열었다.
 * 열렸다고 아무 업체나 세 곳 고르는 것은 아니다. 정책이 함께 못박은 것이 둘 있다.
 *
 *   1. **데이터가 부족하면 억지로 3곳을 채우지 않는다.** 한 곳만 추천할 만하면
 *      한 곳만 낸다. 빈자리를 채우려고 근거 없는 업체를 넣는 순간, 세 자리 전부의
 *      뜻이 사라진다 — 읽는 사람은 어느 것이 근거 있는 추천인지 알 수 없다.
 *   2. **광고비는 이 순위에 영향을 줄 수 없다.** 그래서 추천을 만드는 질의는
 *      `ads` 스키마를 아예 건드리지 않는다.
 */

/** 최대 몇 곳. 세 곳이 정책이 정한 수다. */
export const TOP3_LIMIT = 3;

/**
 * 추천할 자격. 실 제보가 이만큼은 있어야 한다.
 *
 * 공개 사다리의 `early`(3건)를 그대로 쓴다. 그 아래는 금액 구간조차 못 보여주는
 * 상태라, 추천해봐야 사용자가 볼 것이 이름뿐이다 — 보여줄 것이 없는 추천은
 * 추천이 아니다. 화면마다 기준을 새로 정하지 않는다(v2.0 원문 15번).
 *
 * 여기서 세는 `실 제보`는 **금액 옆 캡션이 세는 것과 같은 것**이다. 계약
 * 자료를 따로 세어 자격을 주면, 카드가 `실 제보가 많아요`라고 적어놓고 바로
 * 아래 캡션에 `실 제보 4건`이라고 적는 화면이 나온다 — 같은 이름의 두 숫자다.
 */
export const TOP3_MIN_CONFIRMED = DISCLOSURE_THRESHOLDS.limited;

/**
 * 추천 이유. **잴 수 있는 사실만 있다.**
 *
 * `분위기가 좋아요` 같은 말이 없는 이유: 우리는 분위기를 재지 않는다. 여기 있는
 * 넷은 모두 데이터 한 줄로 참·거짓을 가릴 수 있는 문장이다.
 */
/**
 * v3.22 — 스타일이 먼저다. 출시 초기 추천 근거는 지역 + 스타일 + 업체 안내 가격이고,
 * «실 제보 N건»은 자료가 생기면 등장한다(SPEC §2 «출시 초기 추천 근거»).
 */
export const TOP3_REASONS = ['style_all', 'style', 'region', 'budget', 'many_confirmed', 'recent_data'] as const;

export type Top3Reason = (typeof TOP3_REASONS)[number];

/** 사용자 화면에 그대로 나가는 문장. 표준 용어는 `이런 점이 잘 맞아요`다(v3.3). */
export const TOP3_REASON_LABEL: Record<Top3Reason, string> = {
  style_all: '고른 스타일 2개가 다 맞아요',
  style: '고른 스타일이랑 맞아요',
  region: '준비하는 지역이에요',
  budget: '제보 금액이 준비 예산과 맞아요',
  many_confirmed: '실 제보가 많아요',
  recent_data: `${RECENT_PERIOD_LABEL} 자료가 있어요`,
};

/** 추천 근거로 쓸 수 있는, 서버가 실제로 센 값들. */
export type Top3Facts = {
  /** 사용자가 고른 지역과 업체 지역이 맞는가. */
  regionMatched: boolean;
  /** 사용자가 고른 스타일 수(0~2)와 업체 태그와 겹치는 수. 안 골랐으면 둘 다 0. */
  chosenStyles: number;
  styleOverlap: number;
  /** 업체 안내 가격(정보 0층)이 있는가. 실 제보가 없어도 이것으로 추천이 선다. */
  hasGuidePrice: boolean;
  /**
   * 실 제보 건수. **캡션에 적히는 그 수와 같은 수여야 한다.**
   *
   * 기본 기간(최근 12개월) 안의 확인된 결제를 센다.
   */
  confirmedCount: number;
  /**
   * 그중 최근 3개월 것.
   *
   * 기본 기간보다 짧아야 `최근`이라는 말이 뜻을 갖는다. 같은 기간을 두 번 세면
   * `실 제보가 많아요`와 `최근 자료가 있어요`가 늘 함께 붙는 한 문장이 된다.
   */
  recentCount: number;
  /**
   * 제보 금액 구간(공개 사다리의 low~high). 아직 못 내면(collecting) null.
   *
   * 예산 매칭은 기준금액 하나가 아니라 이 구간이 준비 예산 구간과 **겹치는지**로
   * 본다(SPEC §13.6 «예산 매칭 기준»).
   */
  priceMin: number | null;
  priceMax: number | null;
  /** 준비 예산 구간. 아직 안 골랐으면 null. `unknown`은 범위 제한이 없다. */
  budgetBracket: WeddingBudgetBracket | null;
};

/** 예산으로 말할 수 있는 상태인가 — 구간을 골랐고(모르겠어요 제외) 제보 금액이 있다. */
function budgetComparable(facts: Top3Facts): facts is Top3Facts & {
  priceMin: number;
  priceMax: number;
  budgetBracket: Exclude<WeddingBudgetBracket, 'unknown'>;
} {
  return (
    facts.budgetBracket !== null &&
    facts.budgetBracket !== 'unknown' &&
    facts.priceMin !== null &&
    facts.priceMax !== null
  );
}

/**
 * 예산 밖인가. 고른 구간과 제보 금액 구간이 안 겹치면 추천 대상에서 뺀다
 * (SPEC §13.6 «제보 3,200~4,000만원 → 제외»). 견줄 수 없는 상태면 빼지 않는다 —
 * 모르는 것으로 거르지 않는다.
 */
export function budgetExcludes(facts: Top3Facts): boolean {
  return budgetComparable(facts) && !budgetOverlaps(facts.budgetBracket, facts.priceMin, facts.priceMax);
}

/** 실 제보가 이만큼 넘으면 `많다`고 말한다. 공개 사다리의 `general`이다. */
export const MANY_CONFIRMED_AT = DISCLOSURE_THRESHOLDS.normal;

/**
 * 이 업체를 추천할 이유들. 참인 것만 담는다.
 *
 * 하나도 없을 수 있다 — 그때는 추천하지 않는다. `reasonsFor`가 빈 배열을 주면
 * 부르는 쪽이 그 업체를 뺀다. "이유는 없지만 추천합니다"라고 적을 자리는 없다.
 */
export function reasonsFor(facts: Top3Facts): Top3Reason[] {
  const reasons: Top3Reason[] = [];

  /* 스타일이 먼저다(v3.22). 고른 것이 다 맞으면 개수를, 일부면 «맞아요»를 적는다. */
  if (facts.chosenStyles >= 2 && facts.styleOverlap === facts.chosenStyles) {
    reasons.push('style_all');
  } else if (facts.styleOverlap > 0) {
    reasons.push('style');
  }

  if (facts.regionMatched) reasons.push('region');

  /*
   * 예산은 둘 다 있어야 말할 수 있다. 제보 금액이 없는데 "예산과 맞아요"라고
   * 적으면 무엇과 견줬는지 없는 말이 된다. «아직 모르겠어요»도 이유가 못 된다 —
   * 전부 보여주되, 맞는다고 말하지는 않는다.
   */
  if (budgetComparable(facts) && budgetOverlaps(facts.budgetBracket, facts.priceMin, facts.priceMax)) {
    reasons.push('budget');
  }

  if (facts.confirmedCount >= MANY_CONFIRMED_AT) reasons.push('many_confirmed');
  if (facts.recentCount > 0) reasons.push('recent_data');

  return reasons;
}

/** 추천할 수 있는 상태인가. 자격 · 예산 · 이유를 다 본다. */
export function isRecommendable(facts: Top3Facts): boolean {
  /*
   * 자격은 셋 중 하나다 — 실 제보 3건 이상, 업체 안내 가격(0층), 또는 스타일이 맞는
   * 곳(출시 초기). 출시 첫날 실 제보는 0건이라 실 제보만 자격으로 두면 빈 앱이 된다.
   */
  const qualified =
    facts.confirmedCount >= TOP3_MIN_CONFIRMED || facts.hasGuidePrice || facts.styleOverlap > 0;

  return qualified && !budgetExcludes(facts) && reasonsFor(facts).length > 0;
}

/**
 * 순위 점수. 큰 것이 앞이다. 스타일 교집합이 가장 무겁고, 실 제보가 붙는 대로
 * 가중치가 오른다(«이후 실 제보가 붙는 대로 가중치 상승»). 태그가 다르다고 빼지는
 * 않는다 — 순서에만 반영한다.
 */
export function recommendScore(facts: Top3Facts): number {
  return (
    facts.styleOverlap * 100 +
    (facts.confirmedCount >= TOP3_MIN_CONFIRMED ? 50 : 0) +
    (facts.hasGuidePrice ? 20 : 0) +
    (facts.regionMatched ? 10 : 0) +
    Math.min(facts.confirmedCount, 30)
  );
}

/** 세 곳을 못 채웠을 때 함께 적는 말. 빈자리를 설명하지 않으면 빠진 것처럼 보인다. */
export const TOP3_PARTIAL_NOTE = '추천할 만한 곳이 아직 이만큼이에요';

/** 한 곳도 못 찾았을 때. */
export const TOP3_EMPTY = '이 지역은 아직 추천할 만큼 자료가 모이지 않았어요';
