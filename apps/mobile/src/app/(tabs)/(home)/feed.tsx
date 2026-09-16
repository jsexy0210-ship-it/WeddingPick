import { WEDDING_FEED_GROUPS, inWeddingFeedGroup, type WeddingFeedGroupKey } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listWeddingContent, type WeddingContentItem } from '@/features/home/content';
import { WeddingContent } from '@/features/home/wedding-content';
import { BackBar } from '@/components/back-bar';
import {
  ActionButton,
  EmptyView,
  FilterChip,
  ErrorView,
  Layout,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
  SkeletonView,
} from '@weddingpick/ui';

/**
 * 개인화 웨딩피드. WP-HOME-006.
 *
 * 홈 탭에서 진입. `listWeddingContent()`가 공개된 글을 전부 받아온다 — 목록이
 * 비면 안내 문구를 보여준다.
 *
 * **위에 탭 넷이 선다 — 전체 · 준비·예산 · 업체·서비스 · 계약·여행**(2026-09-16 대표 지시).
 * 카테고리가 열셋이라 그대로 세우면 탭이 열셋이 된다. 목록은 `@weddingpick/domain`의
 * `WEDDING_FEED_GROUPS` 하나가 정한다 — 관리자 쪽도 같은 것을 읽어야 둘이 안 갈린다.
 *
 * **거르는 것은 화면 안에서 한다.** 서버에 그룹 질의를 더하지 않았다 — 공개된 글이
 * 여덟 안팎이라(`WEDDING_FEED_TARGET_PUBLISHED`) 전부 받아 두고 추리는 편이 탭을
 * 누를 때마다 다시 받는 것보다 빠르고, 탭 사이를 오갈 때 로딩이 끼어들지 않는다.
 *
 * **카드의 배지는 원래 카테고리명 그대로다**(같은 지시 — 「기존 카테고리명을 배지로
 * 유지하면 됩니다」). 탭은 추리는 도구이고 배지는 무엇에 관한 글인지를 말한다.
 */
export default function FeedScreen() {
  const [items, setItems] = useState<readonly WeddingContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<WeddingFeedGroupKey>('all');

  const load = useCallback(() => {
    listWeddingContent()
      .then((result) => {
        setError(null);
        setItems(result);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const shown = useMemo(
    () => (items ?? []).filter((item) => inWeddingFeedGroup(item.categoryLabel, group)),
    [items, group]
  );

  if (error) return <ErrorView message={error} onBack={() => router.back()} onRetry={load} />;
  if (!items) return <SkeletonView />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t4">웨딩픽 콘텐츠</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              두 분의 준비에 맞는 이야기를 골라드려요.
            </ThemedText>
          </ThemedView>

          {/*
            탭은 글이 하나도 없을 때는 세우지 않는다 — 네 칸 전부 빈 목록으로 가는
            탭 줄은 누를 이유가 없고, 「준비 중」 안내를 위로 밀어낸다.
           */}
          {items.length > 0 && (
            <View style={styles.tabs}>
              {WEDDING_FEED_GROUPS.map((g) => (
                <FilterChip
                  key={g.key}
                  label={g.label}
                  role="radio"
                  selected={g.key === group}
                  onPress={() => setGroup(g.key)}
                />
              ))}
            </View>
          )}

          {items.length === 0 ? (
            <EmptyView title="준비 중이에요. 곧 새로운 콘텐츠가 올라올 거예요." />
          ) : shown.length === 0 ? (
            /* 글은 있는데 이 탭에만 없다. 「준비 중」과 다른 말이어야 한다. */
            <EmptyView title="이 주제의 글은 아직 없어요." />
          ) : (
            <WeddingContent
              items={shown}
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
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
