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
  Spacing,
  ThemedText,
  ThemedView,
  SkeletonView,
} from '@weddingpick/ui';
import strings from '../../../../../../spec/strings.ko.json';

const S = strings.weddingFeed;

/**
 * 개인화 웨딩피드. WP-HOME-006.
 *
 * 홈 탭에서 진입. `listWeddingFeed()`가 공개된 글과 탭을 **한 번에** 받아온다 —
 * 목록이 비면 안내 문구를 보여준다.
 *
 * **위에 탭이 선다 — 전체 · 준비·예산 · 업체·서비스 · 계약·여행**(2026-09-16 대표 지시).
 * 카테고리가 열셋이라 그대로 세우면 탭이 열셋이 된다.
 *
 * **그 목록이 이제 서버에서 온다.** 같은 날까지는 `WEDDING_FEED_GROUPS` 상수를 읽었고
 * 탭을 하나 바꾸려면 배포해야 했다 — 「탭별 카테고리별로 다 설정 가능해야한다」를
 * 만족하지 못하는 자리였다(`docs/sync/backend-wiring-audit-2026-09-16.md`). 이제
 * 관리자가 표에서 고치고 앱은 받은 것을 그대로 그린다.
 *
 * **탭만 따로 부르지 않는다.** 목록은 이미 한 번에 받아 오고 있어서, 탭을 따로
 * 부르면 글이 먼저 그려지고 탭 줄이 나중에 끼어들어 본문이 손가락 아래에서 밀린다.
 * 한 응답으로 오면 둘이 같이 나타나거나 같이 안 나타난다 — 그동안은 로더 하나다.
 *
 * **거르는 것은 화면 안에서 한다.** 서버에 탭별 질의를 더하지 않았다 — 공개된 글이
 * 여덟 안팎이라(`WEDDING_FEED_TARGET_PUBLISHED`) 전부 받아 두고 추리는 편이 탭을
 * 누를 때마다 다시 받는 것보다 빠르고, 탭 사이를 오갈 때 로딩이 끼어들지 않는다.
 *
 * **카드의 배지는 원래 카테고리명 그대로다**(같은 지시 — 「기존 카테고리명을 배지로
 * 유지하면 됩니다」). 탭은 추리는 도구이고 배지는 무엇에 관한 글인지를 말한다.
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

          {/*
            탭은 글이 하나도 없을 때는 세우지 않는다 — 칸 전부 빈 목록으로 가는
            탭 줄은 누를 이유가 없고, 「준비 중」 안내를 위로 밀어낸다.

            **「전체」 하나만 올 때도 세우지 않는다.** 운영자가 탭을 전부 꺼 두면
            서버가 「전체」만 보내는데, 고를 것이 하나뿐인 줄은 자리만 먹는다.
           */}
          {items.length > 0 && tabs.length > 1 && (
            <View style={styles.tabs}>
              {tabs.map((t) => (
                <FilterChip
                  key={t.key}
                  label={t.label}
                  role="radio"
                  selected={t.key === (tab ?? tabs[0]!.key)}
                  onPress={() => setTab(t.key)}
                />
              ))}
            </View>
          )}

          {items.length === 0 ? (
            <EmptyView title={S['empty.all']} />
          ) : shown.length === 0 ? (
            /* 글은 있는데 이 탭에만 없다. 「준비 중」과 다른 말이어야 한다. */
            <EmptyView title={S['empty.tab']} />
          ) : (
            <WeddingContent
              items={shown}
              onPressItem={(id) => router.push(`/feed/${id}`)}
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
