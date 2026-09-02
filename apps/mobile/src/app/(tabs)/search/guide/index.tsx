import type { GuideArticleSummary } from '@weddingpick/api-contract';
import {
  LIFECYCLE_STAGES,
  LIFECYCLE_STAGE_LABEL,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type LifecycleStage,
  type VendorCategory,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listGuideArticles } from '@/api/client';
import {
  ActionButton,
  EmptyView,
  ErrorView,
  FilterChip,
  LoadingView,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

function formatDate(iso: string) {
  const date = new Date(iso);

  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
}

/**
 * WP-EXPO-003 웨딩 정보 목록.
 *
 * 준비단계 필터는 `LIFECYCLE_STAGES`를 그대로 쓴다 — 사용자의 지금 단계를
 * 새로 재는 대신, 글에 붙은 분류와 같은 말을 쓴다.
 */
export default function GuideArticleListScreen() {
  const theme = useTheme();
  const [stage, setStage] = useState<LifecycleStage | null>(null);
  const [category, setCategory] = useState<VendorCategory | null>(null);
  const [articles, setArticles] = useState<GuideArticleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  /*
   * 필터를 바꿔도 이전 목록을 지우지 않는다 — 지우고 다시 채우면 그 사이 화면이
   * 한 번 깜빡인다. 새 결과가 오면 그때 바뀐다.
   */
  const load = useCallback((selectedStage: LifecycleStage | null, selectedCategory: VendorCategory | null) => {
    listGuideArticles({ stage: selectedStage ?? undefined, category: selectedCategory ?? undefined })
      .then((response) => {
        setArticles(response.articles);
        setCursor(response.nextCursor);
        setError(null);
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  useEffect(() => {
    load(stage, category);
  }, [stage, category, load]);

  function loadMore() {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    listGuideArticles({ stage: stage ?? undefined, category: category ?? undefined, cursor })
      .then((response) => {
        setArticles((current) => [...(current ?? []), ...response.articles]);
        setCursor(response.nextCursor);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  }

  if (error) {
    return (
      <ErrorView message={error} onRetry={() => load(stage, category)} onBack={() => router.back()} />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="t2">웨딩 정보</ThemedText>
          <ThemedText type="t6" themeColor="textSecondary">
            준비단계와 분류별로 골라 보세요.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.chips}>
          <FilterChip label="전체 단계" selected={stage === null} onPress={() => setStage(null)} />
          {LIFECYCLE_STAGES.map((value) => (
            <FilterChip
              key={value}
              label={LIFECYCLE_STAGE_LABEL[value]}
              selected={stage === value}
              onPress={() => setStage(stage === value ? null : value)}
            />
          ))}
        </ThemedView>

        <ThemedView style={styles.chips}>
          <FilterChip label="전체 분류" selected={category === null} onPress={() => setCategory(null)} />
          {VENDOR_CATEGORIES.map((value) => (
            <FilterChip
              key={value}
              label={VENDOR_CATEGORY_LABEL[value]}
              selected={category === value}
              onPress={() => setCategory(category === value ? null : value)}
            />
          ))}
        </ThemedView>

        {articles === null ? (
          <LoadingView />
        ) : articles.length === 0 ? (
          <EmptyView
            title="아직 등록된 웨딩 정보가 없어요"
            description="확인되는 대로 이 자리에 올려드릴게요"
          />
        ) : (
          <FlatList
            contentContainerStyle={styles.list}
            data={articles}
            keyExtractor={(item) => item.id}
            onEndReachedThreshold={0.4}
            onEndReached={loadMore}
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={theme.tint} style={styles.spinner} /> : null
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title} 읽기`}
                onPress={() => router.push(`/search/guide/${item.id}`)}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold" numberOfLines={2} ellipsizeMode="tail">
                    {item.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[
                      item.stage ? LIFECYCLE_STAGE_LABEL[item.stage] : null,
                      item.relatedCategory ? VENDOR_CATEGORY_LABEL[item.relatedCategory] : null,
                      formatDate(item.publishedAt),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            )}
          />
        )}

        <ThemedView style={styles.footer}>
          <ActionButton label="검색으로 돌아가기" onPress={() => router.back()} />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.five, gap: Spacing.one },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  list: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  spinner: { paddingVertical: Spacing.three },
  footer: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four },
});
