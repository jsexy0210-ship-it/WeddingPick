import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  EmptyView,
  FilterChip,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

// TODO: API 미구현 — GET /v1/expos (박람회 목록)
type ExpoStatus = 'upcoming' | 'ongoing' | 'closed';

type ExpoItem = {
  id: string;
  title: string;
  organizer: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  region: string;
  status: ExpoStatus;
  isDeadlineSoon: boolean;
};

const REGIONS = ['전체', '서울', '경기', '부산', '대구', '인천', '기타'];
type SortKey = 'date' | 'region';

const STATUS_LABEL: Record<ExpoStatus, string> = {
  upcoming: '진행예정',
  ongoing: '진행중',
  closed: '종료',
};

const STATUS_TINT: Record<ExpoStatus, string> = {
  upcoming: '#5856D6',
  ongoing: '#34C759',
  closed: '#8E8E93',
};

/**
 * 박람회 목록. 핸드오프 WP-EXPO-001.
 * API 연동 전까지 빈 상태로 렌더링된다.
 */
export default function ExpoListScreen() {
  const [sort, setSort] = useState<SortKey>('date');
  const [region, setRegion] = useState('전체');

  // TODO: API 미구현 — 박람회 목록 로드 후 expos 채우기
  const expos: ExpoItem[] = [];

  const filtered =
    region === '전체'
      ? expos
      : expos.filter((e) => e.region === region);

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'date') return a.startsAt.localeCompare(b.startsAt);
    return a.region.localeCompare(b.region);
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t2">박람회</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              결혼 준비에 도움 되는 웨딩 박람회를 찾아보세요.
            </ThemedText>
          </ThemedView>

          {/* 정렬 */}
          <View style={styles.chipRow}>
            <FilterChip
              label="일정순"
              selected={sort === 'date'}
              onPress={() => setSort('date')}
              role="radio"
            />
            <FilterChip
              label="지역순"
              selected={sort === 'region'}
              onPress={() => setSort('region')}
              role="radio"
            />
          </View>

          {/* 지역 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.regionChips}
          >
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

          {/* 목록 */}
          {sorted.length === 0 ? (
            <EmptyView
              title="등록된 박람회가 없어요."
              description="아직 일정이 없거나 조건에 맞는 박람회가 없습니다."
            />
          ) : (
            sorted.map((expo) => (
              <Pressable
                key={expo.id}
                onPress={() => router.push(`/search/expo/${expo.id}`)}
              >
                <ThemedView type="backgroundElement" style={styles.card}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: STATUS_TINT[expo.status] }]}>
                      <ThemedText type="badge" style={styles.badgeText}>
                        {STATUS_LABEL[expo.status]}
                      </ThemedText>
                    </View>
                    {expo.isDeadlineSoon && (
                      <View style={[styles.badge, { backgroundColor: '#FF3B30' }]}>
                        <ThemedText type="badge" style={styles.badgeText}>
                          마감 임박
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText type="t5">{expo.title}</ThemedText>
                  <ThemedText type="t7" themeColor="textSecondary">
                    {expo.startsAt} ~ {expo.endsAt}
                  </ThemedText>
                  <ThemedText type="t7" themeColor="textSecondary">
                    {expo.venue} · {expo.region}
                  </ThemedText>
                  <ThemedText type="t7" themeColor="textSecondary">
                    주최: {expo.organizer}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))
          )}

          {/* 지난 일정 안내 */}
          {sorted.length > 0 && sorted.every((e) => e.status === 'closed') && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">
                모두 종료된 박람회입니다. 필터를 조정하면 예정된 박람회를 찾을 수 있어요.
              </ThemedText>
            </ThemedView>
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
  regionChips: { flexDirection: 'row', gap: Spacing.one, paddingHorizontal: Layout.gutter },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  badgeRow: { flexDirection: 'row', gap: Spacing.one },
  badge: { borderRadius: Radius.small, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff' },
});
