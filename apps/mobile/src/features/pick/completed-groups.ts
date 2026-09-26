import type { CandidateListResponse } from '@weddingpick/api-contract';
import { PREPARATION_GROUPS, type PreparationGroupKey, type VendorCategory } from '@weddingpick/domain';

/**
 * 결정이 끝난 준비 묶음(2026-09-26 대표 지시 — 「온보딩에서 결정이 확정된 카테고리는 Pick
 * 화면에서 완료 처리된 별도 UX가 필요하다」).
 *
 * **끝난 묶음 = 묶음 안 업종이 모두 «실제 결정»으로 채워졌을 때다**(2026-09-26 대표 결정 —
 * 「결정 취소」하면 «결정 완료»도 풀린다). 실제 결정은 둘뿐이다: Pick한 업체로 정함
 * (`groups[].decidedVendorId`) · 이름으로만 정함(`manualDecisions`, 0440).
 *
 * 온보딩 3/5 준비 현황(`preparedCategories`)은 **세지 않는다.** 그것은 «이미 정했다»는 체크일 뿐
 * 결정 카드가 없어, 세면 결정을 취소해도 «결정 완료»가 남는다. 그래서 이 판정은 홈
 * «내 웨딩 준비»의 «계약 완료»(`homePrepCards` — 준비 현황도 센다)와 **일부러 갈린다** —
 * 바꾼 쪽은 Pick이고 홈은 그대로다.
 */
export function completedPickGroups(candidates: CandidateListResponse | null): ReadonlySet<PreparationGroupKey> {
  const decided = new Set<VendorCategory>([
    ...(candidates?.groups ?? [])
      .filter((group) => group.decidedVendorId !== null)
      .map((group) => group.category),
    ...(candidates?.manualDecisions ?? []).map((one) => one.category),
  ]);

  return new Set(
    PREPARATION_GROUPS.filter(
      (group) => group.categories.length > 0 && group.categories.every((category) => decided.has(category))
    ).map((group) => group.key)
  );
}

/**
 * 끝난 묶음의 카드 순서 — 결정한 곳이 맨 위, 나머지는 받은 순서(최신순) 그대로.
 * 정렬이 안정적이라 같은 쪽끼리는 순서가 바뀌지 않는다.
 */
export function decidedFirst<T extends { isDecided: boolean }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => Number(b.isDecided) - Number(a.isDecided));
}
