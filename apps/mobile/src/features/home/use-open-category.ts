import type { CategoryRecommendation } from '@weddingpick/api-contract';
import type { VendorCategory } from '@weddingpick/domain';
import { useCallback, useState } from 'react';

/**
 * Pick 추천 아코디언에서 **지금 펼쳐진 업종 하나**.
 *
 * 규칙 둘을 한꺼번에 지킨다.
 *
 *   §5  홈 최초 진입 시 «가장 우선순위가 높은 첫 번째 카테고리»가 기본으로 펼쳐진다.
 *       한 번에 하나만 펼쳐진다.
 *   §8  업종을 정하면(DECIDED) 그 업종이 목록에서 빠지고, **다음 업종이 자동으로 펼쳐진다.**
 *
 * **펼친 값을 state에 담아두고 useEffect로 고치지 않는다.** 그 방식은 목록이 바뀔 때마다
 * 한 번 더 렌더하고, 그 사이 프레임에서 «아무것도 안 펼쳐진 홈»이 한 번 보인다. 여기서는
 * 사용자가 «어느 목록에 대해» 고른 것인지를 같이 들고 있다가, 목록이 달라지면 그 선택을
 * 버리고 첫 업종으로 돌아간다 — 계산이라 렌더가 한 번이다.
 *
 * 목록이 달라지는 경우가 곧 §8이다. 웨딩홀을 정하면 `groups`에서 웨딩홀이 빠지고, 열쇠가
 * 달라지고, 첫째인 스튜디오가 펼쳐진다. 따로 승격 코드를 쓰지 않는다.
 *
 * 사용자가 펼친 것을 다시 누르면 접힌다(`null`). 그 접힘도 그 목록에 대해서만 유효하다 —
 * 다음 업종이 승격되면 다시 펼쳐진다.
 */
export function useOpenCategory(
  groups: readonly CategoryRecommendation[],
  preferredCategory: VendorCategory | null = null
): {
  open: VendorCategory | null;
  toggle: (category: VendorCategory) => void;
} {
  /** 어느 목록에 대해 무엇을 골랐는가. 아직 안 골랐으면 null. */
  const [chosen, setChosen] = useState<{ key: string; category: VendorCategory | null } | null>(null);

  const preferred = preferredCategory !== null && groups.some((group) => group.category === preferredCategory)
    ? preferredCategory
    : null;
  const key = `${preferred ?? ''}|${groups.map((group) => group.category).join(',')}`;
  const fallback = preferred ?? groups[0]?.category ?? null;
  const open = chosen !== null && chosen.key === key ? chosen.category : fallback;

  const toggle = useCallback(
    (category: VendorCategory) => {
      setChosen((current) => {
        const openNow = current !== null && current.key === key ? current.category : fallback;

        return { key, category: openNow === category ? null : category };
      });
    },
    [fallback, key]
  );

  return { open, toggle };
}
