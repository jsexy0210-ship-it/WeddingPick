/**
 * 공개된 소비자 보호 기준.
 *
 * 계약서에 적힌 조건이 이 기준과 어떻게 다른지 사용자에게 알려주기 위한 것이다.
 * **법률 판단이 아니다** — 이용약관 제3조에 따라 WeddingPick은 계약의 적법성을
 * 판단하지 않는다. 데이터 기반 확인 사항만 제공한다(사업계획서 8번).
 *
 * 출처와 마지막 확인일을 함께 둔다. 기준은 개정되므로 값만 남기면 언제 것인지 알 수 없다
 * (사업계획서 25번).
 */

import { DATA_SOURCES } from './data-sources';

export const STANDARD_SOURCES = {
  weddingHallCancellation: DATA_SOURCES.consumerDisputeStandard,
  sdmEssentialOptions: DATA_SOURCES.weddingAgencyTermsCorrection,
} as const;

/**
 * 예식업 취소 위약금 기준 — 소비자 귀책으로 계약을 해제할 때.
 *
 * 예식예정일까지 남은 날짜가 많을수록 부담이 적다. `minDaysBefore` 이상 남았을 때
 * 적용되며, 위에서부터 처음 맞는 구간을 쓴다.
 */
export const HALL_CANCELLATION_STANDARD = [
  { minDaysBefore: 90, penaltyRate: 0, note: '계약금 환급' },
  { minDaysBefore: 60, penaltyRate: 0.1, note: '총 비용의 10%' },
  { minDaysBefore: 30, penaltyRate: 0.2, note: '총 비용의 20%' },
  { minDaysBefore: 0, penaltyRate: 0.35, note: '총 비용의 35%' },
] as const;

/** 남은 날짜에 해당하는 기준 배상률. */
export function standardPenaltyRate(daysBeforeWedding: number): number {
  const band = HALL_CANCELLATION_STANDARD.find(
    (entry) => daysBeforeWedding >= entry.minDaysBefore
  );

  // 지난 날짜를 넣으면 마지막 구간을 쓴다.
  return band?.penaltyRate ?? 0.35;
}

export type PenaltyComparison =
  | { verdict: 'within_standard'; standardRate: number }
  | { verdict: 'harsher_than_standard'; standardRate: number; contractRate: number };

/**
 * 계약서의 위약금 조항이 기준보다 무거운지 본다.
 *
 * 무겁다고 해서 무효라는 뜻은 아니다. 사용자가 계약 전에 물어볼 거리를 주는 것이다.
 */
export function comparePenalty(input: {
  daysBeforeWedding: number;
  contractRate: number;
}): PenaltyComparison {
  const standardRate = standardPenaltyRate(input.daysBeforeWedding);

  if (input.contractRate <= standardRate) {
    return { verdict: 'within_standard', standardRate };
  }

  return {
    verdict: 'harsher_than_standard',
    standardRate,
    contractRate: input.contractRate,
  };
}

/**
 * 스드메에서 별도 청구하면 안 되는 항목들.
 *
 * 공정거래위원회가 결혼준비대행업체 18곳의 약관을 심사해, 사실상 필수인 서비스를
 * 유료 옵션으로 떼어 청구하던 조항을 시정하고 기본 제공에 포함시켰다.
 * 견적서에 이런 항목이 "추가 비용"으로 잡혀 있으면 사용자에게 알린다.
 */
export const SDM_ESSENTIAL_OPTIONS = [
  { key: 'photo_file', label: '사진 파일 구입비', keywords: ['사진파일', '원본구입', '파일구입'] },
  { key: 'dress_fitting', label: '드레스 피팅비', keywords: ['피팅비', '드레스피팅'] },
  {
    key: 'makeup_early_start',
    label: '메이크업 얼리스타트비',
    keywords: ['얼리스타트', '얼리비'],
  },
] as const;

export type EssentialOption = (typeof SDM_ESSENTIAL_OPTIONS)[number];

const compact = (value: string) => value.toLowerCase().replace(/[\s()[\]{}·・,._/-]/g, '');

/**
 * 추가비용 항목 이름이 "기본 제공이어야 하는 필수 옵션"에 해당하는지.
 * 해당하면 그 항목을, 아니면 null을 준다.
 */
export function matchEssentialOption(label: string): EssentialOption | null {
  const needle = compact(label);

  return (
    SDM_ESSENTIAL_OPTIONS.find((option) =>
      option.keywords.some((keyword) => needle.includes(compact(keyword)))
    ) ?? null
  );
}
