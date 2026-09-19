/**
 * 홈 카테고리 3×2 — 규격서 docs/design/figma-export/01-home.dc.html(2026-09-15 대표 지시 「규격서의 수를 그대로」).
 *
 *   div 390×184  grid · cols 124.656px ×3 · gap 8
 *     button 125×88  flex/column · gap 8 · align center · pad 16 · bg #F7F8F9 · r16
 *       span "🏛️" · 24/500 · lh 32
 *       span "웨딩홀" · 12/600 · lh 16
 *
 * 아이콘은 피그마가 그린 **이모지 그대로**다(2026-09-15 대표 지시 「전체 이모지 SEED 걸로 사용,
 * 선 아이콘 X»). 앞 세션이 선 아이콘(CategoryIcon)으로 바꿨던 것을 되돌렸다. 이름은 용어 규칙
 * (피그마 「스냅」 → 본식스냅)만 정본이고 자리 · 크기 · 색은 규격서다.
 */
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, LineHeight, Radius, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

import { CATEGORY_EMOJI } from './board';

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
        const label = VENDOR_CATEGORY_LABEL[category];
        const emoji = CATEGORY_EMOJI[category];

        return (
          <Pressable
            key={category}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => onPressCategory(category)}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={styles.tileBody}>
              {emoji ? (
                <ThemedText type="f24" style={styles.emoji}>
                  {emoji}
                </ThemedText>
              ) : (
                <View style={styles.emojiSlot} />
              )}
              <ThemedText type="f12" numberOfLines={1} style={styles.label}>
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
  /* 「grid · cols ×3 · gap 8」. */
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.two, rowGap: Spacing.two },
  tile: { flexGrow: 1, flexBasis: 0, minWidth: '30%' },
  /* 「pad 16 · bg #F7F8F9 · r16 · gap 8 · align center」. */
  tileBody: {
    borderRadius: Radius.cardLarge,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  /* 이모지 «24/500 · lh 32». */
  emoji: { fontWeight: 500, lineHeight: LineHeight.lh32 },
  emojiSlot: { width: Layout.iconTab, height: LineHeight.lh32 },
  /* 이름 «12/600 · lh 16». */
  label: { fontWeight: 600 },
  pressed: { opacity: 0.8 },
});
