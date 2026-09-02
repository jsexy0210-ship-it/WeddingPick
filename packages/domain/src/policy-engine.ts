import {
  DISCLOSURE_THRESHOLDS,
  disclosureStage,
  type DisclosureStage,
} from './disclosure';
import { RECENT_PERIOD_MONTHS, canDiscloseNarrowed } from './reidentification';
import { VERIFICATION_LEVELS, type VerificationLevel } from './verification';

/**
 * 가격 공개 Policy Engine.
 *
 * 화면은 상태 넷(`collecting` / `limited` / `normal` / `detailed`)만 받는다.
 * **몇 건부터 무엇을 여는지는 여기서만 정한다** — 화면에 `count >= 5` 같은 조건이
 * 들어가면 기준을 고칠 때 화면마다 찾아다니게 되고, 어느 한 곳은 반드시 남는다.
 *
 * 건수만 보지 않는다. 건수가 넉넉해도 아래 중 하나에 걸리면 **내려 잡는다.**
 * 내려 잡기만 하고 올리지 않는 이유: 신호 하나가 좋다고 부족한 자료를 자세히
 * 보여주면, 그 화면은 우리가 아는 것보다 많이 아는 척하게 된다.
 */

/** 공개 판단에 쓰는 신호. 부르는 쪽이 실제로 센 값만 넘긴다. */
export type DisclosureSignals = {
  /** 전체 데이터 수. */
  count: number;
  /**
   * 지금 화면이 좁혀둔 조건의 데이터 수. 안 좁혔으면 넘기지 않는다.
   *
   * 전체가 12건이어도 그 조건이 1건이면, 그 1건은 조건별 가격이 아니라
   * 한 사람의 결제다.
   */
  conditionCount?: number;
  /** 조건을 몇 축으로 좁혔는가. 지역·시기로 좁혔으면 2다. */
  narrowedAxes?: number;
  /** 최근 3개월 안에 들어온 건수. */
  recentCount?: number;
  /** 가장 낮은 확인 등급. 이것이 낮으면 자료 전체의 신뢰도가 그만큼이다. */
  minVerificationLevel?: VerificationLevel;
  /** 사람이 봐도 이상한 값의 수. 자릿수 실수나 다른 상품이 섞인 것들. */
  outlierCount?: number;
};

/** 왜 더 못 보여주는지. 화면이 그대로 적을 수 있게 문장으로 둔다. */
export const DISCLOSURE_LIMIT_REASONS = [
  'not_enough',
  'condition_thin',
  'reidentifiable',
  'stale',
  'low_trust',
  'outliers',
] as const;

export type DisclosureLimitReason = (typeof DISCLOSURE_LIMIT_REASONS)[number];

export const DISCLOSURE_LIMIT_LABEL: Record<DisclosureLimitReason, string> = {
  not_enough: '아직 정보가 적어요',
  condition_thin: '이 조건은 아직 정보가 모이는 중이에요',
  reidentifiable: '조건을 더 좁히면 특정 계약이 드러날 수 있어 넓게 보여드려요',
  stale: '최근 자료가 적어 넓게 보여드려요',
  low_trust: '확인 단계가 낮은 자료가 섞여 있어 넓게 보여드려요',
  outliers: '값이 크게 튀는 자료가 있어 넓게 보여드려요',
};

/**
 * 상세까지 열려면 최근 자료가 이만큼은 있어야 한다.
 *
 * 열 건이 다 2년 전 것이면 그 중앙값은 지금 값이 아니다. 기준금액은 "지금 얼마쯤
 * 하는가"에 답하는 숫자라, 오래된 자료만으로 그 답을 내지 않는다.
 */
export const DETAILED_MIN_RECENT = 2;

/** 이상값이 이 비율을 넘으면 상세를 열지 않는다. */
export const OUTLIER_RATIO_LIMIT = 0.2;

/** 낮은 쪽부터. `L1`이 가장 낮다. */
function levelRank(level: VerificationLevel): number {
  return VERIFICATION_LEVELS.indexOf(level);
}

/** 상세를 열려면 이 등급 이상이어야 한다. */
export const DETAILED_MIN_LEVEL: VerificationLevel = 'L2';

const ORDER: DisclosureStage[] = ['collecting', 'limited', 'normal', 'detailed'];

/** 둘 중 낮은 단계. 내려 잡기만 하고 올리지 않는다. */
function lower(a: DisclosureStage, b: DisclosureStage): DisclosureStage {
  return ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b;
}

export type DisclosureDecision = {
  stage: DisclosureStage;
  /** 건수만 봤다면 어디까지 열렸을지. 무엇 때문에 내려갔는지 견줄 수 있다. */
  stageByCount: DisclosureStage;
  /** 내려 잡은 이유들. 안 내려갔으면 빈 배열. */
  limitedBy: DisclosureLimitReason[];
  /** 화면이 그대로 적을 한 줄. 안 내려갔으면 null. */
  note: string | null;
};

/**
 * 이 자료를 어디까지 보여줄 것인가.
 *
 * 순서가 있다. 건수로 한 번 잡고, 신호마다 더 낮은 쪽으로 끌어내린다.
 */
export function decideDisclosure(signals: DisclosureSignals): DisclosureDecision {
  const stageByCount = disclosureStage(signals.count);
  let stage = stageByCount;
  const limitedBy: DisclosureLimitReason[] = [];

  const limit = (to: DisclosureStage, reason: DisclosureLimitReason) => {
    if (ORDER.indexOf(to) < ORDER.indexOf(stage)) {
      stage = lower(stage, to);
      limitedBy.push(reason);
    }
  };

  /*
   * 조건별 자료가 얇으면 상세를 열지 않는다. 전체 수가 아무리 커도, 화면이
   * 좁혀둔 그 조건의 자료가 곧 그 화면이 보여줄 값이다.
   */
  if (signals.conditionCount !== undefined) {
    if (signals.conditionCount < DISCLOSURE_THRESHOLDS.limited) {
      limit('collecting', 'condition_thin');
    } else if (signals.conditionCount < DISCLOSURE_THRESHOLDS.detailed) {
      limit('normal', 'condition_thin');
    }
  }

  /*
   * 재식별. 좁힐수록 더 많은 자료를 요구한다 — 지역·시기·상품까지 좁힌 한 건은
   * 통계가 아니라 한 사람의 계약이다.
   */
  if (signals.narrowedAxes !== undefined && signals.narrowedAxes > 0) {
    const count = signals.conditionCount ?? signals.count;

    if (!canDiscloseNarrowed({ count, axes: signals.narrowedAxes })) {
      limit('collecting', 'reidentifiable');
    }
  }

  /* 최근성. 오래된 자료만으로 "지금 얼마쯤"에 답하지 않는다. */
  if (signals.recentCount !== undefined && signals.recentCount < DETAILED_MIN_RECENT) {
    limit('normal', 'stale');
  }

  /* 신뢰도. 확인 등급이 낮은 자료만 있으면 상세를 열지 않는다. */
  if (
    signals.minVerificationLevel !== undefined &&
    levelRank(signals.minVerificationLevel) < levelRank(DETAILED_MIN_LEVEL)
  ) {
    limit('normal', 'low_trust');
  }

  /* 이상 데이터. 튀는 값이 섞인 중앙값은 중앙값이 아니다. */
  if (signals.outlierCount !== undefined && signals.count > 0) {
    if (signals.outlierCount / signals.count > OUTLIER_RATIO_LIMIT) {
      limit('normal', 'outliers');
    }
  }

  /*
   * 건수 자체가 모자라 `limited`인 것은 "내려 잡은" 것이 아니다. 그건 이 자료의
   * 지금 상태고, 캡션이 이미 `아직 데이터가 적어요`라고 말한다.
   */
  return {
    stage,
    stageByCount,
    limitedBy,
    note: limitedBy.length === 0 ? null : DISCLOSURE_LIMIT_LABEL[limitedBy[0]!],
  };
}

/** 최근으로 치는 기간. 판단에 쓰는 기간을 화면이 다시 정하지 않게 여기서 내보낸다. */
export const DISCLOSURE_RECENT_MONTHS = RECENT_PERIOD_MONTHS;
