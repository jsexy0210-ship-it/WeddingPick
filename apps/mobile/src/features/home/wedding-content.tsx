import { Pressable, StyleSheet, View } from 'react-native';

import {
  Border,
  Layout,
  LetterSpacing,
  LineHeight,
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
 * 홈 「웨딩 준비 팁」 카드 — 정본 `docs/design/React_Native/home.jsx` frame-012
 * WP-HOME-001 `feedCard`(gap 12 · padding 12 · radius 16 · 선 1) · `feedThumb`(80 · r10) ·
 * `feedCat` · `feedTitle` · `feedChev`.
 *
 * **정본과 다르게 둔 것.** 셋째 줄 `feedMeta`(«웨딩픽 에디터 · 5분»)는 `WeddingContentItem`에
 * 그 값이 없어 그리지 않는다 — 없는 값을 지어내지 않는다. 콘텐츠 API가 오면 그 자리에 넣는다.
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
            {/* `feedChev` — 16 · #adb1ba(가장 가까운 토큰 textDisabled #b0b3ba). */}
            <SeedIcon name="chevronRightRegular" size={Layout.iconField} color={theme.textDisabled} />
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
  /* home.jsx frame-012 `feedThumb` — 80×80 · radius 10. */
  image: {
    width: Layout.thumbFeed,
    height: Layout.thumbFeed,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  /* «flex/column · justify center». */
  body: { flex: 1, minWidth: 0, justifyContent: 'center' },
  /* `feedCat` — 10/14 · 700 · 자간 .04em(0.4 — 토큰이 없어 가장 가까운 0.25를 쓴다). */
  category: { fontWeight: 700, lineHeight: LineHeight.lh14, letterSpacing: LetterSpacing.p025 },
  /* `feedTitle` — 14/20 · 700 · 위 4 · 두 줄. */
  title: { fontWeight: 700, marginTop: Spacing.one },
  /* 「svg 16×16 · mar 32 0 32 0」 — `my-auto`라 세로 가운데. */
  chevron: { alignSelf: 'center' },
  pressed: { opacity: 0.8 },
});
