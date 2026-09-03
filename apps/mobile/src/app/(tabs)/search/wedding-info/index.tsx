import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  EmptyView,
  ErrorView,
  FilterChip,
  Layout,
  MaxContentWidth,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

// TODO: API 미구현 — GET /v1/wedding-info (웨딩 정보 목록)
type WeddingInfoCategory =
  | 'planning'
  | 'venue'
  | 'dress'
  | 'photo'
  | 'beauty'
  | 'catering'
  | 'honeymoon';

type WeddingInfoStage = 'early' | 'mid' | 'late' | 'all';

type WeddingInfoItem = {
  id: string;
  title: string;
  summary: string;
  category: WeddingInfoCategory;
  stage: WeddingInfoStage;
  publishedAt: string;
  thumbnailUrl: string | null;
};

type SortKey = 'latest' | 'stage' | 'category';

const CATEGORY_LABEL: Record<WeddingInfoCategory, string> = {
  planning: '전체 계획',
  venue: '예식장',
  dress: '드레스',
  photo: '촬영',
  beauty: '뷰티',
  catering: '케이터링',
  honeymoon: '허니문',
};

const STAGE_LABEL: Record<WeddingInfoStage, string> = {
  all: '전체',
  early: '초기 준비',
  mid: '중반 준비',
  late: '막바지 준비',
};

const CATEGORIES: WeddingInfoCategory[] = [
  'planning', 'venue', 'dress', 'photo', 'beauty', 'catering', 'honeymoon',
];

const STAGES: WeddingInfoStage[] = ['all', 'early', 'mid', 'late'];
const SORTS: SortKey[] = ['latest', 'stage', 'category'];

const SORT_LABEL: Record<SortKey, string> = {
  latest: '최신순',
  stage: '준비단계순',
  category: '카테고리순',
};

/** 스켈레톤 — 웨딩 정보 카드 3장을 미리 잡는다. */
function WeddingInfoListSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <ThemedView key={i} type="backgroundElement" style={styles.skeletonCard}>
          <Skeleton height={16} width="25%" />
          <Skeleton height={22} width="80%" />
          <Skeleton height={16} width="65%" />
          <Skeleton height={14} width="30%" />
        </ThemedView>
      ))}
    </>
  );
}

/**
 * 웨딩 정보 목록. 핸드오프 WP-EXPO-003.
 * 준비단계별·카테고리별·최신순 필터.
 * 상태: 로딩 → 빈 상태 / 목록 있음 / 오류.
 */
export default function WeddingInfoListScreen() {
  const [sort, setSort] = useState<SortKey>('latest');
  const [stage, setStage] = useState<WeddingInfoStage>('all');
  const [category, setCategory] = useState<WeddingInfoCategory | 'all'>('all');
  const [items, setItems] = useState<WeddingInfoItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: API 미구현 — GET /v1/wedding-info?sort={sort}&stage={stage}&category={category}
    // 서버 연동 전: 빈 목록으로 떨어진다.
    setItems([]);
  }, []);

  function retry() {
    setError(null);
    setItems(null);
    // TODO: API 미구현 — 재시도 시 API 호출
    setItems([]);
  }

  if (error) {
    return (
      <ErrorView
        title="웨딩 정보를 불러오지 못했어요"
        message={error}
        onRetry={retry}
        retryLabel="다시 시도"
      />
    );
  }

  const filtered = (items ?? []).filter((item) => {
    const stageMatch = stage === 'all' || item.stage === stage;
    const categoryMatch = category === 'all' || item.category === category;
    return stageMatch && categoryMatch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'latest') return b.publishedAt.localeCompare(a.publishedAt);
    if (sort === 'stage') return a.stage.localeCompare(b.stage);
    return a.category.localeCompare(b.category);
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t2">웨딩 정보</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              준비 단계별 알아두면 좋은 정보를 모았어요
            </ThemedText>
          </ThemedView>

          {/* 정렬 */}
          <ThemedView style={styles.chipRow}>
            {SORTS.map((s) => (
              <FilterChip
                key={s}
                label={SORT_LABEL[s]}
                selected={sort === s}
                onPress={() => setSort(s)}
                role="radio"
              />
            ))}
          </ThemedView>

          {/* 준비 단계 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollChips}
          >
            {STAGES.map((s) => (
              <FilterChip
                key={s}
                label={STAGE_LABEL[s]}
                selected={stage === s}
                onPress={() => setStage(s)}
                role="radio"
              />
            ))}
          </ScrollView>

          {/* 카테고리 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollChips}
          >
            <FilterChip
              label="전체"
              selected={category === 'all'}
              onPress={() => setCategory('all')}
              role="radio"
            />
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c}
                label={CATEGORY_LABEL[c]}
                selected={category === c}
                onPress={() => setCategory(c)}
                role="radio"
              />
            ))}
          </ScrollView>

          {/* 로딩 */}
          {items === null ? (
            <WeddingInfoListSkeleton />
          ) : sorted.length === 0 ? (
            /* 빈 상태 */
            <EmptyView
              title="아직 웨딩 정보가 없어요"
              description="좋은 정보를 준비하고 있어요"
            />
          ) : (
            sorted.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} 자세히 보기`}
                onPress={() => router.push(`/search/wedding-info/${item.id}`)}
              >
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedView style={styles.cardMeta}>
                    <ThemedText type="badge" themeColor="tint">
                      {CATEGORY_LABEL[item.category]}
                    </ThemedText>
                    <ThemedText type="badge" themeColor="textSecondary">
                      {STAGE_LABEL[item.stage]}
                    </ThemedText>
                  </ThemedView>
                  <ThemedText type="t5" numberOfLines={1}>{item.title}</ThemedText>
                  <ThemedText type="t7" themeColor="textSecondary" numberOfLines={2}>
                    {item.summary}
                  </ThemedText>
                  <ThemedText type="t7" themeColor="textAssistive">
                    {item.publishedAt}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))
          )}
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
    gap: Spacing.two,
  },
  header: { gap: Spacing.one },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  /** 가로 스크롤 칩 — 부모의 paddingHorizontal과 겹치지 않게 패딩 제거. */
  scrollChips: { flexDirection: 'row', gap: Spacing.one },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
    minHeight: Layout.rowMinHeight,
  },
  skeletonCard: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardMeta: { flexDirection: 'row', gap: Spacing.one },
});
