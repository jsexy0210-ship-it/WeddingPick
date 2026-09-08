import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

import { CategoryImage } from './category-image';
import type { WeddingContentItem } from './content';

/**
 * 두 분을 위한 웨딩 정보 — 홈 아래쪽 2열 피드.
 *
 * 감성 영역이라 이미지가 크다. 판단·비교 영역(실 제보, 오늘의 Pick의 금액
 * 줄)과 성격이 다르고, 시안이 그 둘을 일부러 갈라 놓았다.
 *
 * 카드 정렬 규칙: 이미지는 정사각, 업종 줄과 제목 줄은 각각 따로 둔다. 한 줄에
 * 붙여두면 제목이 길어질 때 옆 칸과 아래가 어긋난다.
 */

export type WeddingContentProps = {
  items: readonly WeddingContentItem[];
  onPressItem: (id: string) => void;
};

export function WeddingContent({ items, onPressItem }: WeddingContentProps) {
  return (
    <ThemedView style={styles.grid}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => onPressItem(item.id)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <View style={styles.image}>
            <CategoryImage uri={item.imageUri} />
          </View>
          <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
            {item.categoryLabel}
          </ThemedText>
          <ThemedText type="t5" numberOfLines={2}>
            {item.title}
          </ThemedText>
        </Pressable>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.gap2col },
  card: { flexBasis: '48%', flexGrow: 1, minWidth: 0, gap: Spacing.two },
  pressed: { opacity: 0.8 },
  image: { width: '100%', aspectRatio: 1, borderRadius: Radius.medium, overflow: 'hidden' },
});
