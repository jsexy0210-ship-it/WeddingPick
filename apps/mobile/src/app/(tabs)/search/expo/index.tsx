import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listExpos, type ExpoItem, type ExpoStatus } from '@/api/client';
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
  useTheme,
} from '@weddingpick/ui';

type SortKey = 'date' | 'region';

/** WP-EXPO-001 박람회 목록 */

const REGIONS = ['전체', '서울', '경기', '부산', '대구', '인천', '기타'];

const STATUS_LABEL: Record<ExpoStatus, string> = {
  upcoming: '진행 예정',
  ongoing: '진행 중',
  closed: '종료',
};

const SORT_LABEL: Record<SortKey, string> = {
  date: '일정순',
  region: '지역순',
};

/** 스켈레톤 — 박람회 카드 3장을 미리 잡는다. */
function ExpoListSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <ThemedView key={i} type="backgroundElement" style={styles.skeletonCard}>
          <Skeleton height={19} width="40%" />
          <Skeleton height={24} width="80%" />
          <Skeleton height={19} width="60%" />
          <Skeleton height={19} width="50%" />
        </ThemedView>
      ))}
    </>
  );
}

/**
 * 박람회 목록. 핸드오프 WP-EXPO-001.
 * 상태: 로딩 → 빈 상태 / 목록 있음 / 오류.
 * 목록이 있을 때 일정순·지역 필터·마감 임박 배지를 노출한다.
 */
export default function ExpoListScreen() {
  const theme = useTheme();
  const [sort, setSort] = useState<SortKey>('date');
  const [region, setRegion] = useState('전체');
  const [expos, setExpos] = useState<ExpoItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setExpos(null);
    listExpos({ sort, region })
      .then((res) => setExpos(res.items))
      .catch(() => setError('박람회 목록을 불러오지 못했어요'));
  }, [sort, region]);

  useEffect(() => {
    load();
  }, [load]);

  const STATUS_COLOR: Record<ExpoStatus, string> = {
    upcoming: theme.tint,
    ongoing: theme.positive,
    closed: theme.tintInactive,
  };

  if (error) {
    return (
      <ErrorView
        title="박람회 목록을 불러오지 못했어요"
        message={error}
        onRetry={load}
        retryLabel="다시 시도"
      />
    );
  }

  const filtered =
    region === '전체' ? (expos ?? []) : (expos ?? []).filter((e) => e.region === region);

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'date') return a.startsAt.localeCompare(b.startsAt);
    return a.region.localeCompare(b.region);
  });

  const allClosed = sorted.length > 0 && sorted.every((e) => e.status === 'closed');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t2">박람회</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              결혼 준비에 도움 되는 박람회를 모았어요
            </ThemedText>
          </ThemedView>

          {/* 정렬 칩 */}
          <ThemedView style={styles.chipRow}>
            {(['date', 'region'] as SortKey[]).map((s) => (
              <FilterChip
                key={s}
                label={SORT_LABEL[s]}
                selected={sort === s}
                onPress={() => setSort(s)}
                role="radio"
              />
            ))}
          </ThemedView>

          {/* 지역 필터 — 가로 스크롤 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.regionChips}>
            {REGIONS.map((r) => (
              <FilterChip
                key={r}
                label={r}
                selected={region === r}
                onPress={() => setRegion(r)}
                role="radio"
              />
            ))}
          </ScrollView>

          {/* 로딩 */}
          {expos === null ? (
            <ExpoListSkeleton />
          ) : sorted.length === 0 ? (
            /* 빈 상태 */
            <EmptyView
              title="등록된 박람회가 없어요"
              description="새로운 박람회가 생기면 알려드릴게요"
            />
          ) : (
            <>
              {/* 목록 */}
              {sorted.map((expo) => (
                <Pressable
                  key={expo.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${expo.title} 자세히 보기`}
                  onPress={() => router.push(`/search/expo/${expo.id}`)}>
                  <ThemedView type="backgroundElement" style={styles.card}>
                    {/* 상태 배지 */}
                    <ThemedView style={styles.badgeRow}>
                      <ThemedView
                        style={[styles.badge, { backgroundColor: STATUS_COLOR[expo.status] }]}>
                        <ThemedText type="badge" style={{ color: theme.onTint }}>
                          {STATUS_LABEL[expo.status]}
                        </ThemedText>
                      </ThemedView>
                      {expo.isDeadlineSoon && expo.status !== 'closed' && (
                        <ThemedView
                          style={[styles.badge, { backgroundColor: theme.negative }]}>
                          <ThemedText type="badge" style={{ color: theme.onTint }}>
                            마감 임박
                          </ThemedText>
                        </ThemedView>
                      )}
                    </ThemedView>

                    <ThemedText type="t5" numberOfLines={1}>
                      {expo.title}
                    </ThemedText>
                    <ThemedText type="t7" themeColor="textSecondary">
                      {expo.startsAt} ~ {expo.endsAt}
                    </ThemedText>
                    <ThemedText type="t7" themeColor="textSecondary" numberOfLines={1}>
                      {expo.venue} · {expo.region}
                    </ThemedText>
                    <ThemedText type="t7" themeColor="textAssistive">
                      주최 {expo.organizer} · 마지막 확인 {expo.lastVerifiedAt}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ))}

              {/* 모두 종료된 경우 안내 */}
              {allClosed && (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="t7" themeColor="textSecondary">
                    모두 종료된 박람회예요
                  </ThemedText>
                  <ThemedText type="t7" themeColor="textAssistive">
                    예정된 박람회를 보려면 필터를 바꿔보세요
                  </ThemedText>
                </ThemedView>
              )}
            </>
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
    paddingBottom: Layout.sectionGap,
    gap: Spacing.two,
  },
  header: { gap: Spacing.one, marginBottom: Spacing.one },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  /** 가로 스크롤 칩 — full-bleed 영역이므로 부모의 패딩과 겹치지 않게 마진으로 상쇄한다. */
  regionChips: { flexDirection: 'row', gap: Spacing.one },
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
  badgeRow: { flexDirection: 'row', gap: Spacing.one },
  badge: {
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
});
