import { useMemo } from 'react';

import type { VendorCategory } from '@weddingpick/domain';
import type { CategoryIconKind } from '@weddingpick/ui';

import { categoryIconKind } from '@/features/search/category-icon-kind';

import { useCurrentUserSnapshot } from './current-user-snapshot';

const NONE: readonly CategoryIconKind[] = [];

/**
 * 온보딩 «결정 완료» 업종 → 로더 순회에서 뺄 아이콘. 핸드오프 v3.20 «이미 결정한
 * 업종은 순회에서 뺍니다» — 이미 정한 웨딩홀을 다시 찾는 척하지 않는다. 글리프가
 * 없는 기타는 건너뛴다.
 */
export function categoryKindsFor(prepared: readonly VendorCategory[]): CategoryIconKind[] {
  const kinds: CategoryIconKind[] = [];
  for (const category of prepared) {
    const kind = categoryIconKind(category);
    if (kind && !kinds.includes(kind)) kinds.push(kind);
  }
  return kinds;
}

/**
 * 지금 알려진 «나»의 결정 완료 업종을 `CategoryCycleLoader`의 `exclude`로. 서버를
 * 부르지 않는다 — 아직 모르면 빈 배열이라 12업종 전체가 돈다.
 */
export function usePreparedExclude(): readonly CategoryIconKind[] {
  const me = useCurrentUserSnapshot();
  const prepared = me?.preparedCategories;
  return useMemo(() => (prepared && prepared.length > 0 ? categoryKindsFor(prepared) : NONE), [prepared]);
}
