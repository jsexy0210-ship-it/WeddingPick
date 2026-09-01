import type { VendorCategory } from './vendor';

/**
 * 후보 업체.
 *
 * 사업계획서 v3 8번의 COMPARE — 찾은 곳을 담아두고, 배우자와 함께 보고, 견준다.
 *
 * **웨딩에 매단다. 사람이 아니라.** 배우자가 담은 곳을 내가 보고, 내가 담은 곳을
 * 배우자가 본다. 사람에 매달면 각자 다른 목록을 들고 같은 이야기를 하게 된다.
 */

/**
 * 한 웨딩에 담을 수 있는 수.
 *
 * 저장 공간 때문이 아니라 **비교가 안 되기 때문이다.** 서른 곳을 담아두면 그건
 * 후보가 아니라 검색 결과 사본이고, 고르는 일을 도와주지 못한다.
 */
export const MAX_CANDIDATES = 30;

export type CandidateCheck = { ok: true } | { ok: false; reason: string };

export function canAddCandidate(input: { currentCount: number }): CandidateCheck {
  if (input.currentCount >= MAX_CANDIDATES) {
    return {
      ok: false,
      reason: `후보는 ${MAX_CANDIDATES}곳까지 담을 수 있어요. 마음이 떠난 곳을 빼주세요.`,
    };
  }

  return { ok: true };
}

/**
 * 업종별로 몇 곳이 담겼는지.
 *
 * 화면이 "웨딩홀 3곳, 스드메 2곳"처럼 보여줄 수 있어야 한다. 서른 곳을 한 줄로
 * 늘어놓으면 무엇을 견주는 중인지 보이지 않는다.
 */
export function groupByCategory<T extends { category: VendorCategory }>(
  candidates: readonly T[]
): Map<VendorCategory, T[]> {
  const grouped = new Map<VendorCategory, T[]>();

  for (const candidate of candidates) {
    const bucket = grouped.get(candidate.category) ?? [];

    bucket.push(candidate);
    grouped.set(candidate.category, bucket);
  }

  return grouped;
}

/**
 * 이 업종의 후보로 비교를 시작할 수 있는가.
 *
 * 비교는 최소 두 곳이 필요하고(MAX_COMPARED_VENDORS의 반대쪽), **같은 업종끼리만**
 * 뜻이 있다. 웨딩홀과 스튜디오의 가격을 나란히 놓으면 그 표는 아무것도 말하지 않는다.
 */
export function comparableWithin(count: number): boolean {
  return count >= 2;
}

/** 담을 때 함께 남기는 말의 길이. 길면 목록이 읽히지 않는다. */
export const MAX_CANDIDATE_NOTE_LENGTH = 200;
