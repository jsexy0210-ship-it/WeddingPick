import type { ExpoSummary } from '@weddingpick/api-contract';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listExpoRegions, listExpos } from '@/api/client';
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

/** "9월 12일" — 박람회는 시간 범위가 아니라 날짜가 먼저 읽힌다. */
function formatDate(iso: string) {
  const date = new Date(iso);

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** 오늘부터 며칠 남았는지. 오늘·내일은 이름으로, 그 뒤는 D-n으로. */
function startsLabel(startsAt: string): string {
  const start = new Date(startsAt);
  const today = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const days = Math.round((startDay - todayDay) / (24 * 60 * 60 * 1000));

  if (days === 0) return '오늘 시작';
  if (days === 1) return '내일 시작';
  if (days < 0) return '진행 중';

  return `D-${days}`;
}

/**
 * WP-EXPO-001 박람회 목록.
 *
 * 운영이 올리는 공개 콘텐츠다 — 결제 데이터가 아니라 지금은 빈 목록일 수 있다.
 * 빈 목록도 "아직 없다"고 정직하게 말한다(WP-ST-008).
 */
export default function ExpoListScreen() {
  const theme = useTheme();
  const [region, setRegion] = useState<string | null>(null);
  const [regions, setRegions] = useState<{ name: string; expoCount: number }[]>([]);
  const [expos, setExpos] = useState<ExpoSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  /*
   * 지역을 바꿔도 이전 목록을 지우지 않는다 — 검색 탭의 같은 필터 갱신이 그렇게
   * 한다. 지우고 다시 채우면 그 사이 화면이 한 번 깜빡인다.
   */
  const load = useCallback((selectedRegion: string | null) => {
    listExpos({ region: selectedRegion ?? undefined })
      .then((response) => {
        setExpos(response.expos);
        setCursor(response.nextCursor);
        setError(null);
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  useEffect(() => {
    load(region);
  }, [region, load]);

  useEffect(() => {
    listExpoRegions()
      .then((response) => setRegions(response.regions))
      .catch(() => setRegions([]));
  }, []);

  function loadMore() {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    listExpos({ region: region ?? undefined, cursor })
      .then((response) => {
        setExpos((current) => [...(current ?? []), ...response.expos]);
        setCursor(response.nextCursor);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  }

  if (error) {
    return <ErrorView message={error} onRetry={() => load(region)} onBack={() => router.back()} />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="t2">박람회</ThemedText>
          <ThemedText type="t6" themeColor="textSecondary">
            일정과 장소를 확인하고, 필요하면 사전등록하세요.
          </ThemedText>
        </ThemedView>

        {regions.length > 0 ? (
          <ThemedView style={styles.chips}>
            <FilterChip label="전체" selected={region === null} onPress={() => setRegion(null)} />
            {regions.map((item) => (
              <FilterChip
                key={item.name}
                label={`${item.name} ${item.expoCount}`}
                selected={region === item.name}
                onPress={() => setRegion(region === item.name ? null : item.name)}
              />
            ))}
          </ThemedView>
        ) : null}

        {expos === null ? (
          <LoadingView />
        ) : expos.length === 0 ? (
          <EmptyView
            title="아직 등록된 박람회가 없어요"
            description="확인되는 대로 이 자리에 올려드릴게요"
          />
        ) : (
          <FlatList
            contentContainerStyle={styles.list}
            data={expos}
            keyExtractor={(item) => item.id}
            onEndReachedThreshold={0.4}
            onEndReached={loadMore}
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={theme.tint} style={styles.spinner} /> : null
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name} 자세히 보기`}
                onPress={() => router.push(`/search/expos/${item.id}`)}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedView style={styles.cardHead}>
                    <ThemedText type="t7" themeColor="tint">
                      {startsLabel(item.startsAt)}
                    </ThemedText>
                    <ThemedText type="t7" themeColor="textAssistive">
                      {formatDate(item.startsAt)} ~ {formatDate(item.endsAt)}
                    </ThemedText>
                  </ThemedView>
                  <ThemedText type="smallBold" numberOfLines={1} ellipsizeMode="tail">
                    {item.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[item.venue, item.region].filter(Boolean).join(' · ')}
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
    paddingTop: Spacing.three,
  },
  list: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  spinner: { paddingVertical: Spacing.three },
  footer: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four },
});
