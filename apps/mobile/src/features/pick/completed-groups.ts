import type { CandidateListResponse } from '@weddingpick/api-contract';
import { completedPreparationGroups, decidedCategories, type PreparationGroupKey } from '@weddingpick/domain';

/**
 * 결정이 끝난 준비 묶음(2026-09-26 대표 지시 — 「온보딩에서 결정이 확정된 카테고리는 Pick
 * 화면에서 완료 처리된 별도 UX가 필요하다」).
 *
 * **끝난 묶음 = 묶음 안 업종이 모두 «실제 결정»으로 채워졌을 때다**(2026-09-26 대표 결정 A —
 * 「결정 취소」하면 «결정 완료»도 풀린다). 판정은 domain `decidedCategories` ·
 * `completedPreparationGroups` 하나다 — 홈 «내 웨딩 준비»의 «계약 완료»(`homePrepCards`)도
 * 같은 두 함수를 쓴다(2026-09-26 대표 결정 「홈 계약 완료도 결정 후 완료로 진행」). 온보딩 3/5
 * 준비 현황(`preparedCategories`)은 어느 쪽도 세지 않는다.
 */
export function completedPickGroups(candidates: CandidateListResponse | null): ReadonlySet<PreparationGroupKey> {
  return completedPreparationGroups(decidedCategories(candidates));
}

/**
 * 끝난 묶음의 카드 순서 — 결정한 곳이 맨 위, 나머지는 받은 순서(최신순) 그대로.
 * 정렬이 안정적이라 같은 쪽끼리는 순서가 바뀌지 않는다.
 */
export function decidedFirst<T extends { isDecided: boolean }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => Number(b.isDecided) - Number(a.isDecided));
}
