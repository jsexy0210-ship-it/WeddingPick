import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryIcon, Layout, Radius, ThemedText, ThemedView } from '@weddingpick/ui';

import { categoryIconKind } from '@/features/search/category-icon-kind';

/**
 * 카테고리 — 홈에서 업종별 검색으로 바로 들어가는 3×2 격자.
 *
 * **2026-09-15에 새로 넣었다.** 피그마 시안(`Home.tsx` `CATEGORIES`)에는 있는데 앱에는
 * 아예 없던 자리다. 2026-09-14에 대표님이 앱을 열어 보시고 「피그마랑 아예 다르잖아」
 * 라고 하신 일곱 자리 중 하나다.
 *
 * **여섯 칸인 이유.** 12업종을 다 펼치면 격자가 화면 하나를 통째로 먹고, 그러면 그
 * 아래 웨딩피드가 첫 화면에서 사라진다. 준비 현황이 4칸으로 줄여 든 것과 같은 판단이다 —
 * 나머지는 검색 탭의 업종 격자가 전부 보여준다.
 *
 * **어느 여섯인가는 시안이 정했다**(웨딩홀 · 스튜디오 · 드레스 · 메이크업 · 본식스냅 ·
 * 허니문). 준비 순서 앞 여섯(결정사 · 웨딩홀 · 스튜디오 · 드레스 · 메이크업 · 헤어변형)과
 * 다르다 — 결정사는 결혼을 정하기 전의 일이고 허니문은 맨 뒤인데도 들어 있다. 「지금
 * 준비할 순서」가 아니라 「찾아 들어가는 입구」라 고른 기준이 다르다고 읽는다.
 *
 * **이름은 정본을 쓴다.** 시안은 `snap`을 「스냅」으로 적지만 공용 이름은 **본식스냅**이다
 * (CLAUDE.md 2026-09-11 대표 지시 — 세어서 본식스냅 14 · 스냅 6). 칩 폭 때문에 줄여
 * 적은 표기를 공용 이름으로 올리지 않는다.
 *
 * **아이콘은 업종 아이콘(WP-ST-016)이고 이모지가 아니다** — `board.tsx`와 같은 이유다.
 */

/** 시안 `CATEGORIES` 여섯. 순서도 그대로다. */
export const HOME_CATEGORY_TILES: readonly VendorCategory[] = [
  'hall',
  'studio',
  'dress',
  'makeup',
  'snap',
  'honeymoon',
];

export type CategoryGridProps = {
  onPressCategory: (category: VendorCategory) => void;
};

export function CategoryGrid({ onPressCategory }: CategoryGridProps) {
  return (
    <View style={styles.grid}>
      {HOME_CATEGORY_TILES.map((category) => {
        const kind = categoryIconKind(category);
        const label = VENDOR_CATEGORY_LABEL[category];

        return (
          <Pressable
            key={category}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => onPressCategory(category)}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={styles.tileBody}>
              {kind === null ? null : <CategoryIcon kind={kind} size={Layout.iconTab} />}
              <ThemedText type="micro" numberOfLines={1} style={styles.label}>
                {label}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  /* 3열. 칸 사이는 3열 격자 토큰(`gap3col` 10)이고 행 사이도 같다. */
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Layout.gap3col, rowGap: Layout.gap3col },
  /*
   * 한 줄에 셋. `minWidth: '30%'`가 줄바꿈 자리를 정한다 — 셋은 90%라 들어가고
   * 넷은 120%라 못 들어간다. 퍼센트를 직접 폭으로 주면 gap만큼 넘쳐 한 칸이 밀린다.
   */
  tile: { flexGrow: 1, flexBasis: 0, minWidth: '30%' },
  tileBody: {
    borderRadius: Radius.medium,
    paddingVertical: Layout.cardGap,
    alignItems: 'center',
    gap: Layout.rowGap + 4,
  },
  label: { fontWeight: 700 },
  pressed: { opacity: 0.8 },
});
