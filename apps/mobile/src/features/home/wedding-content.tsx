import { Pressable, StyleSheet, View } from 'react-native';

import {
  Border,
  Layout,
  LetterSpacing,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

import { CategoryImage } from './category-image';
import type { WeddingContentItem } from './content';

/**
 * 웨딩피드 — 규격서 docs/design/figma-export/01-home.dc.html(2026-09-15 대표 지시 「규격서의 수를 그대로」).
 *
 *   div 390×224
 *     article 390×106  flex · gap 12 · pad 12 12 12 12 · mar 0 0 12 0 · bg #FFFFFF · r16 · border 1 #000000 6%
 *       img 80×80  bg #F7F8F9 · r18
 *       div 244×80  flex/column · justify center
 *         p "예산" · 10/700 #868B94 · lh 15 · ls 0.25px
 *         p "예산을 넘기지 않는 스드메 조합 3가지" · 14/600 #1A1C20 · lh 20 · mar 4 0 0 0
 *         p "웨딩픽 에디터 · 5분" · 11/400 #868B94 · lh 17 · mar 4 0 0 0
 *       svg 16×16  mar 32 0 32 0 (`my-auto` — 세로 가운데)  IconChevronRightRegular
 *
 * **규격서와 다르게 둔 것.** 셋째 줄(«웨딩픽 에디터 · 5분»)은 우리 `WeddingContentItem`에 그 값이
 * 없어 그리지 않는다 — 없는 값을 지어내지 않는다. 콘텐츠 API가 오면 그 자리에 넣는다.
 */

export type WeddingContentProps = {
  items: readonly WeddingContentItem[];
  onPressItem: (id: string) => void;
};

export function WeddingContent({ items, onPressItem }: WeddingContentProps) {
  const theme = useTheme();

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => onPressItem(item.id)}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: theme.background, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <ThemedView type="backgroundElement" style={styles.image}>
            <CategoryImage uri={item.imageUri} />
          </ThemedView>
          <View style={styles.body}>
            <ThemedText type="f10" themeColor="textAssistive" style={styles.category} numberOfLines={1}>
              {item.categoryLabel}
            </ThemedText>
            <ThemedText type="f14" style={styles.title} numberOfLines={2}>
              {item.title}
            </ThemedText>
          </View>
          <View style={styles.chevron}>
            <SeedIcon name="chevronRightRegular" size={Layout.iconField} color={theme.textAssistive} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  /* 카드 사이 «mar 0 0 12 0». */
  list: { gap: Layout.inlineGap },
  /* «flex · gap 12 · pad 12 · r16 · border 1». */
  card: {
    flexDirection: 'row',
    gap: Layout.inlineGap,
    padding: Layout.inlineGap,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
  },
  /* «img 80×80 · r18». */
  image: {
    width: Layout.thumbFeed,
    height: Layout.thumbFeed,
    borderRadius: Radius.thumb,
    overflow: 'hidden',
  },
  /* «flex/column · justify center». */
  body: { flex: 1, minWidth: 0, justifyContent: 'center' },
  /* «10/700 · ls 0.25px». */
  category: { fontWeight: 700, letterSpacing: LetterSpacing.p025 },
  /* «14/600 · mar 4 0 0 0». */
  title: { fontWeight: 600, marginTop: Spacing.one },
  /* 「svg 16×16 · mar 32 0 32 0」 — `my-auto`라 세로 가운데. */
  chevron: { alignSelf: 'center' },
  pressed: { opacity: 0.8 },
});
