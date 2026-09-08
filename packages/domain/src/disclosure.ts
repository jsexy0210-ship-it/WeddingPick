/**
 * 가격 공개 4단계. 최종통합정책 v2.0 C장·D-1, 원문 14·15·16번.
 *
 * **이 사다리가 가격을 공개하는 유일한 기준이다.** 업체별·화면별로 별도 기준을
 * 만들지 않는다(원문 15번). 화면마다 "몇 건부터 보여줄까"를 다시 정하면, 어느
 * 화면은 2건에 숫자를 띄우고 어느 화면은 안 띄우게 된다.
 *
 * 이전 정책(결제인증 5건부터 공개, 제보한 사람만 열람)은 v2.0 K-6이 폐기했다.
 * **실제 결제 구간은 비회원에게도 열려 있다.** 결제인증이 여는 것은 접근이 아니라
 * **깊이다** — 조건이 비슷한 사례와 상세 분석.
 */

import { NOT_ENOUGH_DATA, TERMS } from './terms';

/**
 * 화면이 받는 상태 넷. **화면은 이 값만 받고 건수 기준을 알지 못한다.**
 *
 *   - `collecting` 수집 중 — 보여줄 금액이 없다
 *   - `limited`    정보 적음 — 구간은 보여주되 적다고 함께 말한다
 *   - `normal`     일반 공개 — 구간을 그대로 보여준다
 *   - `detailed`   상세 공개 — 기준금액·조건별·시기별까지
 *
 * 몇 건부터 어느 상태인지는 아래 임계값과 `decideDisclosure`가 정한다. 화면에
 * `count >= 5` 같은 조건이 들어가는 순간, 기준을 고칠 때 화면마다 찾아다녀야
 * 하고 어느 한 곳이 남는다.
 */
export const DISCLOSURE_STAGES = ['collecting', 'limited', 'normal', 'detailed'] as const;

export type DisclosureStage = (typeof DISCLOSURE_STAGES)[number];

/**
 * 각 단계가 시작되는 데이터 수.
 *
 * **이 수는 화면이 아니라 여기에만 있다.** 정책이 바꾸면 이 표 하나를 고친다.
 */
export const DISCLOSURE_THRESHOLDS = {
  /** 여기부터 구간을 보여주되, 데이터가 적다고 함께 말한다. */
  limited: 3,
  /** 여기부터는 데이터 부족 안내를 뗀다. */
  normal: 5,
  /** 여기부터 중앙값·조건별·시기별을 낼 수 있다. */
  detailed: 10,
} as const;

export function disclosureStage(count: number): DisclosureStage {
  if (count >= DISCLOSURE_THRESHOLDS.detailed) return 'detailed';
  if (count >= DISCLOSURE_THRESHOLDS.normal) return 'normal';
  if (count >= DISCLOSURE_THRESHOLDS.limited) return 'limited';

  return 'collecting';
}

/**
 * 금액을 공개하는 모든 화면이 함께 적어야 하는 말. 원문 16번.
 *
 * 데이터 수와 기준 기간을 숫자 옆에 붙인다. 숫자만 떼어놓으면 그것이 어디서 왔는지
 * 모르는 채로 읽히고, 그때부터 그 숫자는 우리가 정한 값처럼 보인다.
 */
export function disclosureCaption(input: {
  stage: DisclosureStage;
  count: number;
  period: string;
  /** 상세 단계에서만 붙는다. `168만원` 꼴. */
  baseAmount?: string;
}): string {
  /*
   * v3.3이 사용자 화면에서 `결제인증 N건`을 걷어냈고, v3.18부터는 `실 제보 N건`이다.
   * 안에서는 여전히 결제인증이고, 이 줄은 밖으로 나가는 말이다.
   */
  const head = `${TERMS.verifiedData} ${input.count}건`;

  if (input.stage === 'collecting') return `${head} · 수집 중`;
  if (input.stage === 'limited') return `${head} · ${NOT_ENOUGH_DATA}`;

  const tail = input.baseAmount ? ` · ${TERMS.baseAmount} ${input.baseAmount}` : '';

  return `${head} · ${input.period}${tail}`;
}

/**
 * 공개할 수 있는 가격.
 *
 * **판별 유니온이다.** `median`은 `detailed`에만 있고 `range`는 `collecting`에
 * 없다 — 필드를 비워 보내면 화면이 0원이나 빈칸을 그릴 여지가 남고, 언젠가 어느
 * 화면이 그렇게 그린다. 타입이 없으면 그릴 수 없다.
 */
export type PriceDisclosure =
  | { stage: 'collecting'; count: number; caption: string }
  | { stage: 'limited'; count: number; caption: string; low: number; high: number }
  | { stage: 'normal'; count: number; caption: string; low: number; high: number }
  | {
      stage: 'detailed';
      count: number;
      caption: string;
      low: number;
      high: number;
      median: number;
    };

/** 구간의 양끝. 최저·최고가 아니라 분포의 허리를 쓴다 — 한 건의 특이값이 구간을 늘리지 않게. */
const RANGE_QUANTILES = { low: 0.25, high: 0.75 } as const;

/**
 * 밖으로 내보내는 금액의 단위. **만원.**
 *
 * 분위수는 표본 수에 따라 **표본 하나를 그대로 돌려준다.** `(n-1)*q`가 정수면
 * 보간할 이웃이 없어 그 자리의 값이 그대로 나온다 — 5건이면 25%·50%·75% 셋 다
 * 그렇다. 그러면 화면에 뜨는 `기준금액`이 어느 한 사람이 실제로 낸 금액이고,
 * 그 사람은 자기 영수증과 숫자를 맞춰볼 수 있다. 중앙값도 홀수 표본에서는
 * 가운데 한 건 그대로다.
 *
 * 그래서 내보내기 전에 만원으로 반올림한다. 화면은 어차피 만원 단위로 그리므로
 * (`manwon`·`rangeLabel`) 보이는 것은 달라지지 않고, 원 단위로 일치하는 숫자가
 * 나가지 않는다.
 *
 * **이것이 재식별을 막아주지는 않는다.** 만원으로 반올림해도 표본이 적으면
 * 누구인지 좁혀질 수 있다. 그건 공개 건수 기준과 C-4가 맡는 일이고, 여기서
 * 막는 것은 `숫자가 그대로 나가는 것` 하나다.
 */
export const PUBLISHED_AMOUNT_UNIT = 10_000;

/**
 * 밖으로 나가는 금액은 전부 이걸 거친다.
 *
 * 만원이 안 되는 값은 그대로 둔다. 반올림하면 0원이 되고, **0원은 "공짜였다"로
 * 읽힌다** — 있는 그대로보다 나쁜 거짓말이다. 1만원으로 올려 적는 것도 없는
 * 값을 지어내는 것이라 하지 않는다.
 *
 * `manwon`이 만원 아래를 `원`으로 그대로 적는 것과 같은 규칙이다. 이 구간에서는
 * 숫자가 그대로 나갈 수 있지만, 웨딩 계약 금액이 만원 미만인 경우는 없다 —
 * 그런 값이 보인다면 반올림이 아니라 그 데이터를 의심할 자리다.
 */
export function roundForDisclosure(amount: number): number {
  if (amount < PUBLISHED_AMOUNT_UNIT) return amount;

  return Math.round(amount / PUBLISHED_AMOUNT_UNIT) * PUBLISHED_AMOUNT_UNIT;
}

function quantile(sorted: readonly number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const below = Math.floor(position);
  const above = Math.ceil(position);

  if (below === above) return sorted[below]!;

  return Math.round(sorted[below]! + (sorted[above]! - sorted[below]!) * (position - below));
}

function median(sorted: readonly number[]): number {
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

/**
 * 금액들을 공개 단계에 맞춰 정리한다.
 *
 * 개별 금액은 나가지 않는다 — 결제 한 건은 한 사람의 결제고, 금액과 시각이 함께
 * 나가면 그 사람이 누구인지 좁혀진다(C-4 재식별 방지).
 *
 * 구간과 기준금액도 만원으로 반올림해서 내보낸다. 분위수가 표본 하나를 그대로
 * 돌려주는 자리가 있어서다 — `PUBLISHED_AMOUNT_UNIT`에 왜인지 적어뒀다.
 */
export function discloseAmounts(input: {
  amounts: readonly number[];
  period: string;
}): PriceDisclosure {
  const count = input.amounts.length;
  const stage = disclosureStage(count);

  if (stage === 'collecting') {
    return { stage, count, caption: disclosureCaption({ stage, count, period: input.period }) };
  }

  const sorted = [...input.amounts].sort((a, b) => a - b);
  const low = roundForDisclosure(quantile(sorted, RANGE_QUANTILES.low));
  const high = roundForDisclosure(quantile(sorted, RANGE_QUANTILES.high));

  /*
   * 기준금액은 상세 단계에서만 캡션에 붙는다(v3.1 §11). 그래서 중앙값을 먼저
   * 구하고 캡션을 만든다 — 캡션이 값보다 앞서면 붙일 것이 없다.
   */
  if (stage === 'detailed') {
    const middle = roundForDisclosure(median(sorted));

    return {
      stage,
      count,
      caption: disclosureCaption({
        stage,
        count,
        period: input.period,
        baseAmount: manwon(middle),
      }),
      low,
      high,
      median: middle,
    };
  }

  return {
    stage,
    count,
    caption: disclosureCaption({ stage, count, period: input.period }),
    low,
    high,
  };
}

/**
 * 조건별·시기별을 낼 수 있는가. C-3 · K-8.
 *
 * **전체가 10건을 넘겨도 그 조건의 데이터가 모자라면 내지 않는다.** 전체 공개
 * 단계와 조건별 공개 단계는 따로 판단한다 — 전체 12건 중 그 조건이 1건이면,
 * 그 1건은 조건별 가격이 아니라 한 사람의 결제다.
 */
export function canDiscloseCondition(input: {
  totalCount: number;
  conditionCount: number;
}): boolean {
  return (
    disclosureStage(input.totalCount) === 'detailed' &&
    disclosureStage(input.conditionCount) !== 'collecting'
  );
}

export const CONDITION_NOT_ENOUGH = '이 조건은 아직 데이터가 모이는 중이에요';

/**
 * 결제인증이 여는 것.
 *
 * 실제 결제 구간이 아니다 — 그건 누구나 본다(v2.0 K-6). 여기서 열리는 것은
 * **조건이 비슷한 사례와 상세 분석**이다(D-1).
 */
export function hasDeepData(input: { usablePaymentProofCount: number }): boolean {
  return input.usablePaymentProofCount >= 1;
}

export const DEEP_DATA_NOTE =
  'Pick 인증을 마치시면 조건이 비슷한 사례를 함께 보실 수 있어요';

/**
 * 만원 단위로 줄여 적는다. 정책 문서가 쓰는 표기다 — `265~305만원`.
 *
 * 구간을 원 단위로 다 적으면 `2,650,000원~3,050,000원`이 되어 한 줄에 들어가지
 * 않는다. 화면에서 가장 큰 글씨가 두 줄로 접히면 읽는 순간이 늘어지고, 무엇보다
 * 구간이 한 덩어리로 보이지 않는다.
 *
 * **반올림한 값이라는 것을 잊지 않는다.** 그래서 정확한 금액이 필요한 자리
 * (내 지출내역, 결제 등록 확인)에는 쓰지 않는다 — 거기서는 원 단위 그대로 적는다.
 */
export function manwon(amount: number): string {
  if (amount < 10_000) return `${amount.toLocaleString('ko-KR')}원`;

  return `${Math.round(amount / 10_000).toLocaleString('ko-KR')}만원`;
}

/** `265~305만원`. 단위는 뒤에 한 번만 붙인다. */
export function rangeLabel(low: number, high: number): string {
  if (low < 10_000 || high < 10_000) return `${manwon(low)}~${manwon(high)}`;

  return `${Math.round(low / 10_000).toLocaleString('ko-KR')}~${manwon(high)}`;
}

/** 기준 기간. C-1이 최근 12개월을 기본으로 정했다. */
export const DEFAULT_PERIOD_MONTHS = 12;
export const DEFAULT_PERIOD_LABEL = '최근 12개월';
