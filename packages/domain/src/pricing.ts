import { PRICING_POLICY } from './policy';
import type { DocumentType } from './document';
import { VERIFICATION_LEVEL_RULES, affectsMarketPrice, isAtLeast } from './verification';
import type { VerificationLevel } from './verification';

/** 가격 판단 4단계. 사업계획서 9번. */
export const PRICE_JUDGEMENTS = ['low', 'similar', 'somewhat_high', 'high'] as const;

export type PriceJudgement = (typeof PRICE_JUDGEMENTS)[number];

export const PRICE_JUDGEMENT_LABEL: Record<PriceJudgement, string> = {
  low: '낮은 편',
  similar: '비슷한 수준',
  somewhat_high: '다소 높은 편',
  high: '높은 편',
};

export type PriceSample = {
  amount: number;
  verificationLevel: VerificationLevel;
  /** ISO 8601 날짜 */
  contractDate: string;
};

/**
 * 한 업체·상품의 가격 분포. 명세 3.3의 PriceStat.
 *
 * 표본 수와 기준 기간은 화면에 항상 함께 표시한다(사업계획서 9번). 숫자만 떼어놓으면
 * 근거 없는 시장가격이 되므로 이 타입에서 분리하지 않는다.
 */
export type PriceStat = {
  sampleCount: number;
  median: number;
  p25: number;
  p75: number;
  p90: number;
  periodStart: string;
  periodEnd: string;
  minVerificationLevel: VerificationLevel;
};

/** 오름차순으로 정렬된 값에서 분위수를 선형 보간으로 구한다. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) {
    throw new Error('빈 표본에서는 분위수를 구할 수 없다.');
  }

  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] as number;

  if (lower === upper) {
    return low;
  }

  return low + ((sorted[upper] as number) - low) * (position - lower);
}

/** 평균이 아니라 중앙값을 쓴다. 사업계획서 9번. */
export function median(values: number[]): number {
  return quantile([...values].sort((a, b) => a - b), 0.5);
}

/**
 * 시장 가격 통계를 낸다. 표본이 기준에 못 미치면 `null`을 준다.
 *
 * `null`은 "가격 정보 없음"이며, 화면은 이때 시장가격을 만들어내지 않는다 —
 * 제품 원칙 2, 사업계획서 9번.
 */
export function computePriceStat(samples: PriceSample[]): PriceStat | null {
  const eligible = samples.filter(
    (sample) =>
      affectsMarketPrice(sample.verificationLevel) &&
      isAtLeast(sample.verificationLevel, PRICING_POLICY.minimumVerificationLevel)
  );

  if (eligible.length < PRICING_POLICY.minimumSampleCount) {
    return null;
  }

  const amounts = eligible.map((sample) => sample.amount).sort((a, b) => a - b);
  const dates = eligible.map((sample) => sample.contractDate).sort();

  return {
    sampleCount: eligible.length,
    median: quantile(amounts, 0.5),
    p25: quantile(amounts, PRICING_POLICY.judgementQuantiles.low),
    p75: quantile(amounts, PRICING_POLICY.judgementQuantiles.similar),
    p90: quantile(amounts, PRICING_POLICY.judgementQuantiles.somewhatHigh),
    periodStart: dates[0] as string,
    periodEnd: dates[dates.length - 1] as string,
    minVerificationLevel: PRICING_POLICY.minimumVerificationLevel,
  };
}

/** 내 견적이 표본 분포의 어디에 있는지. */
export function judgePrice(amount: number, stat: PriceStat): PriceJudgement {
  if (amount < stat.p25) return 'low';
  if (amount <= stat.p75) return 'similar';
  if (amount <= stat.p90) return 'somewhat_high';
  return 'high';
}

/**
 * 표본의 등급 구성. 화면에서 "무엇을 근거로 이렇게 판단했는지" 보여줄 때 쓴다 — 제품 원칙 4.
 */
export function levelBreakdown(samples: PriceSample[]): Record<VerificationLevel, number> {
  const counts = { L0: 0, L1: 0, L2: 0, L3: 0, L4: 0 };

  for (const sample of samples) {
    counts[sample.verificationLevel] += 1;
  }

  return counts;
}

/** 통계에 들어간 표본들의 가중치 합. 상위 등급일수록 크다. 서비스정책서 2번. */
export function totalWeight(samples: PriceSample[]): number {
  return samples.reduce(
    (sum, sample) => sum + VERIFICATION_LEVEL_RULES[sample.verificationLevel].weight,
    0
  );
}

/** 시장 가격 비교의 단위. 어떤 문서 종류끼리 견줄지는 호출하는 쪽이 정한다. */
export type PriceComparison = {
  docType: DocumentType;
  myAmount: number;
  stat: PriceStat;
  judgement: PriceJudgement;
};
