import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  listWeddingFeed,
  type WeddingContentItem,
  type WeddingFeedTabItem,
} from '@/features/home/content';
import { WeddingContent } from '@/features/home/wedding-content';
import { BackBar } from '@/components/back-bar';
import {
  ActionButton,
  EmptyView,
  ErrorView,
  FilterChip,
  Layout,
  MaxContentWidth,
  SegmentedTabs,
  Spacing,
  ThemedText,
  ThemedView,
  SkeletonView,
} from '@weddingpick/ui';
import strings from '../../../../../../spec/strings.ko.json';

const S = strings.weddingFeed;

/**
 * 탭 줄이 균등 분할을 견디는 개수.
 *
 * `SegmentedTabs`는 칸을 똑같이 나눠 가지고 **넷을 넘으면 글자가 눌린다** — 그때는
 * 칩을 쓰라고 그 컴포넌트가 적어 두었다. 탭 개수는 이제 관리자가 정하므로 화면이
 * 스스로 갈라야 한다. 씨앗값은 「전체」까지 넷이라 균등 분할로 그려진다.
 */
const EVEN_SPLIT_MAX = 4;

/**
 * 개인화 웨딩피드. WP-HOME-006.
 *
 * 홈 탭에서 진입. `listWeddingFeed()`가 공개된 글과 탭을 **한 번에** 받아온다 —
 * 목록이 비면 안내 문구를 보여준다.
 *
 * **탭은 서버가 준다**(2026-09-16 대표 지시 — 「웨딩피드는 탭별 카테고리별로 다 설정
 * 가능해야한다」). 관리자가 표에서 고치고 앱은 받은 것을 그대로 그린다 — 탭을 하나
 * 더하려고 앱을 다시 배포하지 않는다.
 *
 * **탭만 따로 부르지 않는다.** 목록은 이미 한 번에 받아 오고 있어서, 탭을 따로
 * 부르면 글이 먼저 그려지고 탭 줄이 나중에 끼어들어 본문이 손가락 아래에서 밀린다.
 * 한 응답으로 오면 둘이 같이 나타나거나 같이 안 나타난다 — 그동안은 로더 하나다.
 */
export default function FeedScreen() {
  const [items, setItems] = useState<readonly WeddingContentItem[] | null>(null);
  const [tabs, setTabs] = useState<readonly WeddingFeedTabItem[]>([]);
  const [tab, setTab] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listWeddingFeed()
      .then((result) => {
        setError(null);
        setItems(result.items);
        setTabs(result.tabs);
        /*
         * 보고 있던 탭이 사라졌으면 맨 앞으로 돌아간다 — 운영자가 방금 그 탭을
         * 껐을 수 있다. 없는 탭을 고른 채로 두면 화면이 늘 비어 있다.
         */
        setTab((current) =>
          current && result.tabs.some((t) => t.key === current)
            ? current
            : (result.tabs[0]?.key ?? null)
        );
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const shown = useMemo(() => {
    if (!items) return [];

    const picked = tabs.find((t) => t.key === tab);

    // 카테고리가 빈 탭이 「전체」다 — 거르지 않는다.
    if (!picked || picked.categories.length === 0) return items;

    const wanted = new Set(picked.categories);

    return items.filter((item) => wanted.has(item.categoryLabel));
  }, [items, tabs, tab]);

  if (error) return <ErrorView message={error} onBack={() => router.back()} onRetry={load} />;
  if (!items) return <SkeletonView />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t4">{S.title}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {S.sub}
            </ThemedText>
          </ThemedView>

          {/* 탭이 「전체」 하나뿐이면 줄을 그리지 않는다 — 고를 것이 없는 탭 줄은 자리만 먹는다. */}
          {tabs.length > 1 ? (
            <View style={styles.tabs}>
              {tabs.length <= EVEN_SPLIT_MAX ? (
                <SegmentedTabs
                  items={tabs.map((t) => ({ value: t.key, label: t.label }))}
                  value={tab ?? tabs[0]!.key}
                  onChange={setTab}
                  accessibilityLabel={S.title}
                />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}>
                  {tabs.map((t) => (
                    <FilterChip
                      key={t.key}
                      label={t.label}
                      role="radio"
                      selected={t.key === (tab ?? tabs[0]!.key)}
                      onPress={() => setTab(t.key)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}

          {items.length === 0 ? (
            <EmptyView title={S['empty.all']} />
          ) : shown.length === 0 ? (
            <EmptyView title={S['empty.tab']} />
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
  tabs: { marginBottom: Spacing.one },
  chips: { flexDirection: 'row', gap: Spacing.two },
});
