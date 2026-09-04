import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listWeddingContent, type WeddingContentItem } from '@/features/home/content';
import { WeddingContent } from '@/features/home/wedding-content';
import {
  ActionButton,
  EmptyView,
  ErrorView,
  Layout,
  LoadingView,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

/**
 * 개인화 웨딩피드. WP-HOME-006.
 *
 * 홈 탭에서 진입. 서버에 콘텐츠 API가 없어 지금은 listWeddingContent()가
 * 빈 배열을 반환한다 — 그때는 안내 문구를 보여준다.
 * 콘텐츠 API가 생기면 features/home/content.ts에서 호출하면 된다.
 */
export default function FeedScreen() {
  const [items, setItems] = useState<readonly WeddingContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listWeddingContent()
      .then((result) => {
        setError(null);
        setItems(result);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  if (error) return <ErrorView message={error} onBack={() => router.back()} />;
  if (!items) return <LoadingView />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t4">웨딩픽 콘텐츠</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              두 분의 준비에 맞는 이야기를 골라드려요.
            </ThemedText>
          </ThemedView>

          {items.length === 0 ? (
            <EmptyView title="준비 중이에요. 곧 새로운 콘텐츠가 올라올 거예요." />
          ) : (
            <WeddingContent
              items={items}
              onPressItem={(id) => {
                void id;
              }}
            />
          )}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  header: { gap: Spacing.two },
});
