import { withSubject } from './korean';
import { PRICING_POLICY } from './policy';

/**
 * 가격 제보.
 *
 * 문서 없이 "나는 이만큼 냈다"를 받는다. 콜드 스타트를 넘기 위한 것이다 —
 * 계약서를 찍어 올리는 것은 문턱이 높고, 그 문턱 때문에 표본이 모이지 않으면
 * 비교가 서지 않고, 비교가 없으면 계약서를 올릴 이유도 없다.
 *
 * **검증된 계약 중앙값과 섞지 않는다.** 이것이 이 파일 전체를 지배하는 규칙이다.
 * 서비스정책서 2번은 시장 대표가격이 L2(계약인증) 이상만 반영한다고 정한다.
 * 제보는 아무 증빙이 없으므로 그 자리에 들어갈 수 없다.
 *
 * 그렇다고 버리지도 않는다. 나란히 보여준다 — "실제 계약 3,104만원(확인 8건)"과
 * "제보 2,900만원(제보 12건)"은 서로 다른 것을 말하고, 둘 다 알아야 판단이 는다.
 * 표를 아예 나눠 둔 이유는 나중에 누군가 한 번에 합치는 쿼리를 쓰지 못하게
 * 하기 위해서다.
 */

/** 제보에 반드시 있어야 하는 것. 없으면 비교에 쓸 수 없다. */
export type PriceReportDraft = {
  vendorId: string;
  /** 어떤 상품인지. 같은 업체라도 홀·패키지마다 다르다. */
  productName: string;
  totalAmount: number;
  /** 언제 계약했는지. 가격은 시점에 따라 달라진다 (YYYY-MM). */
  contractedOn: string;
};

export const MIN_REPORT_AMOUNT = 10_000;
/** 웨딩 비용에서 현실적으로 넘기 어려운 선. 자릿수 실수를 걸러낸다. */
export const MAX_REPORT_AMOUNT = 500_000_000;

export type ReportCheck = { ok: true } | { ok: false; reason: string };

export function canSubmitPriceReport(draft: PriceReportDraft): ReportCheck {
  if (draft.productName.trim().length === 0) {
    return { ok: false, reason: '어떤 상품인지 적어주세요. 같은 업체라도 상품마다 가격이 다릅니다.' };
  }

  if (!Number.isInteger(draft.totalAmount) || draft.totalAmount < MIN_REPORT_AMOUNT) {
    return { ok: false, reason: '금액을 원 단위로 적어주세요.' };
  }

  /*
   * 상한을 두는 것은 자릿수 실수를 잡기 위해서다. "3200"을 만원 단위로 적었는데
   * 원으로 읽히거나, 반대로 0을 하나 더 붙이는 일이 흔하다. 한 건의 실수가
   * 중앙값을 크게 흔든다.
   */
  if (draft.totalAmount > MAX_REPORT_AMOUNT) {
    return { ok: false, reason: '금액이 너무 큽니다. 원 단위가 맞는지 확인해 주세요.' };
  }

  if (!/^\d{4}-\d{2}$/.test(draft.contractedOn)) {
    return { ok: false, reason: '계약한 연월을 적어주세요. 가격은 시점에 따라 달라집니다.' };
  }

  return { ok: true };
}

/**
 * 제보 집계.
 *
 * 최소 표본은 계약 중앙값과 같은 값을 쓴다. 제보라고 기준을 낮추면, 신뢰도가
 * 낮은 쪽이 오히려 더 쉽게 숫자를 만들게 된다.
 */
export type ReportedPrice =
  | { available: true; median: number; count: number; periodStart: string; periodEnd: string }
  | { available: false; reason: string; count: number };

export function summarizeReports(
  reports: readonly { totalAmount: number; contractedOn: string }[]
): ReportedPrice {
  if (reports.length < PRICING_POLICY.minimumSampleCount) {
    return {
      available: false,
      reason: `제보가 ${withSubject(`${PRICING_POLICY.minimumSampleCount}건`)} 모여야 보여드립니다.`,
      count: reports.length,
    };
  }

  const amounts = [...reports.map((report) => report.totalAmount)].sort((a, b) => a - b);
  const middle = Math.floor(amounts.length / 2);
  const median =
    amounts.length % 2 === 0
      ? Math.round((amounts[middle - 1]! + amounts[middle]!) / 2)
      : amounts[middle]!;

  const months = [...reports.map((report) => report.contractedOn)].sort();

  return {
    available: true,
    median,
    count: reports.length,
    periodStart: months[0]!,
    periodEnd: months[months.length - 1]!,
  };
}

/**
 * 화면에 함께 나가는 말.
 *
 * 제보를 계약 중앙값처럼 보이게 두면 안 된다. 무엇을 보고 있는지가 숫자 옆에
 * 늘 붙어야 한다.
 */
export const PRICE_REPORT_CAVEAT =
  '제보는 이용자가 직접 적어주신 금액이며 문서로 확인하지 않았습니다. 실제 계약 중앙값과는 다른 값입니다.';

/** 제보와 계약 중앙값을 한 화면에 놓을 때 붙이는 구분 설명. */
export const PRICE_SOURCE_LABEL = {
  contract: '실제 계약',
  report: '이용자 제보',
} as const;

export type PriceSourceKind = keyof typeof PRICE_SOURCE_LABEL;

export const PRICE_SOURCE_NOTE: Record<PriceSourceKind, string> = {
  contract: '계약 내용을 확인한 값입니다.',
  report: '문서 확인 없이 적어주신 값입니다.',
};

/**
 * 둘을 하나의 숫자로 합칠 수 있는가.
 *
 * 없다. 이 함수는 답을 주기 위해서가 아니라, 합치려는 코드가 여기서 걸리게
 * 하려고 있다. 서비스정책서 2번이 시장 대표가격의 근거를 L2 이상으로 못박았고,
 * 제보는 그 근거를 갖지 못한다.
 */
export function canMergePriceSources(): false {
  return false;
}
