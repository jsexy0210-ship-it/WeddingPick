import {
  nextTasteCategory,
  reconcileTasteSelection,
  summarizeTasteKeys,
  TASTE_MIN_PICKS,
  TASTE_SETS,
  tasteLabel,
  tasteStepDescription,
  type TasteCategory,
  type TasteOption,
  type TasteSelection,
  type VendorCategory,
} from '@weddingpick/domain';

import { getTaste, updateTaste } from '@/api/client';

/**
 * 취향. 홈 C-1 시안 1 «어떤 결혼식을 원하세요?» · MY «취향 다시 고르기» ·
 * 온보딩 5/5(WP-APP-021). 핸드오프 v3.19~v3.22 SPEC §13.6.
 *
 * **한 번에 한 업종만 묻는다.** 어느 업종인지는 준비 현황에서 완료로 체크하지
 * 않은 첫 업종이고(`nextTasteCategory`), 업종마다 세트가 다르다(`TASTE_SETS` —
 * 각 6장 · 2×3 격자). 아홉 업종을 전부 준비한 사람에게는 물을 것이 없어 null인데,
 * 홈과 MY는 그래도 화면을 그려야 하므로 웨딩홀로 돌아간다(`tasteCategoryFor`).
 *
 * 서버(`/v1/me/taste`)에 `{category, keys}`로 저장한다 — 로그인한 사람에게만 이
 * 화면이 뜨므로(`state.ts`의 `guest` 갈림), 기기를 바꿔도 고른 것이 남는다.
 *
 * 서버가 안 불리면(오프라인 등) 조용히 안 고른 것으로 본다 — 그게 취향 화면이
 * 안 뜨는 것보다 낫다. 화면은 `loadTaste`/`saveTaste` 두 함수만 알고 있어서
 * 저장 방식이 바뀌어도 그대로다.
 *
 * 2026-09-08 이전의 단일 세트(white · daylight · …)와 그 Unsplash 사진은 없앴다 —
 * 아홉 세트 쉰네 장에 붙일 사진이 아직 없어 카드는 업종 기본 면 위에 라벨 배지만
 * 얹는다(`taste-picker.tsx`).
 */

export {
  summarizeTasteKeys,
  TASTE_SETS,
  tasteLabel,
  tasteStepDescription,
  type TasteCategory,
  type TasteOption,
  type TasteSelection,
};

/** 아직 안 고른 상태. 업종도 없다. */
export const NO_TASTE: TasteSelection = { category: null, keys: [] };

/**
 * 물을 업종이 없을 때(아홉 업종을 전부 준비함) 돌아가는 업종. 우선순위의 첫째다 —
 * 온보딩은 이때 5/5를 건너뛰지만 홈·MY는 빈 화면을 둘 수 없다.
 */
export const DEFAULT_TASTE_CATEGORY: TasteCategory = 'hall';

/** 이 사람에게 취향을 물을 업종. 준비 현황에서 안 끝낸 첫 업종, 없으면 웨딩홀. */
export function tasteCategoryFor(prepared: readonly VendorCategory[]): TasteCategory {
  return nextTasteCategory(prepared) ?? DEFAULT_TASTE_CATEGORY;
}

/**
 * 저장된 것 중 모르는 업종·키는 버린다. 항목이 바뀌어도 화면이 빈 칸을 그리지
 * 않게.
 */
export function reconcileTaste(
  category: string | null,
  keys: readonly string[] | null
): TasteSelection {
  return reconcileTasteSelection(category, keys ?? []);
}

/** 하나라도 골랐는가. 홈이 취향 고르기를 계속 띄울지 이 값으로 정한다. */
export function hasTaste(selection: TasteSelection): boolean {
  return selection.keys.length >= TASTE_MIN_PICKS;
}

/**
 * 지금 그리는 업종에서 고른 키. 저장된 업종이 다르면 빈 배열 — 스튜디오에서
 * 고른 «필름»을 드레스 격자 위에 체크된 것처럼 그리지 않는다.
 */
export function chosenKeysFor(selection: TasteSelection, category: TasteCategory): readonly string[] {
  return selection.category === category ? selection.keys : [];
}

/** 눌렀던 것을 다시 누르면 빠진다. 한 번 고르면 못 무르는 화면을 만들지 않는다. */
export function toggleTaste(chosen: readonly string[], key: string): readonly string[] {
  return chosen.includes(key) ? chosen.filter((row) => row !== key) : [...chosen, key];
}

export async function loadTaste(): Promise<TasteSelection> {
  try {
    const stored = await getTaste();

    return reconcileTaste(stored.category, stored.keys);
  } catch {
    // 못 불러오거나(오프라인·미로그인) 서버가 이상하면 안 고른 것으로 본다.
    // 홈이 안 뜨는 것보다 낫다.
    return NO_TASTE;
  }
}

/**
 * 고른 전체를 그대로 덮어쓴다. 최소 1장 — 서버가 빈 배열을 받지 않으므로
 * (contract `TASTE_MIN_PICKS`) 다 풀었을 때는 보내지 않는다. 화면은 낙관적으로
 * 갱신돼 있고, 다음에 열면 서버에 남은 마지막 선택으로 돌아갈 뿐이다.
 */
export async function saveTaste(category: TasteCategory, keys: readonly string[]): Promise<void> {
  if (keys.length < TASTE_MIN_PICKS) return;

  try {
    await updateTaste({ category, keys: [...keys] });
  } catch {
    // 화면은 이미 낙관적으로 갱신됐다(app/(tabs)/index.tsx) — 저장이 실패해도
    // 다음에 다시 열면 서버 값으로 되돌아갈 뿐, 여기서 사용자를 막지 않는다.
  }
}
