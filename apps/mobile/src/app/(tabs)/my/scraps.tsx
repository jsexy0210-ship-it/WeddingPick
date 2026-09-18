import type { WeddingFeedScrapItem } from '@weddingpick/api-contract';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ActionButton, ErrorView, FilterChip, Layout, Spacing } from '@weddingpick/ui';
import { listMyWeddingFeedScraps } from '@/api/client';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { EmptyBox, Row, Rows, Section, SubScreen } from '@/features/settings/my-kit';

const FILTERS = ['전체', '드레스', '예산', '일정'] as const;
type Filter = (typeof FILTERS)[number];

/** 스크랩 · 07-lounge-my 4-6. 실제 저장한 공개 웨딩피드 글만 보여준다. */
export default function ScrapsScreen() {
  const [filter, setFilter] = useState<Filter>('전체');
  const [items, setItems] = useState<WeddingFeedScrapItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void listMyWeddingFeedScraps()
      .then((response) => {
        setItems(response.items);
        setError(null);
      })
      .catch((caught: Error) => setError(caught.message || '스크랩을 불러오지 못했어요'));
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const shown = useMemo(
    () => items?.filter((item) => filter === '전체' || item.categoryLabel === filter) ?? [],
    [filter, items]
  );

  if (error) return <ErrorView message={error} onRetry={load} />;
  if (items === null) return <DelayedLoadingView />;

  return (
    <SubScreen title="스크랩">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => (
          <FilterChip
            key={item}
            label={item}
            selected={filter === item}
            onPress={() => setFilter(item)}
            role="radio"
          />
        ))}
      </ScrollView>

      <Section>
        {shown.length > 0 ? (
          <Rows>
            {shown.map((item) => (
              <Row
                key={item.id}
                name={item.title}
                meta={item.categoryLabel}
                chevron
                onPress={() => router.push(`/feed/${item.id}`)}
              />
            ))}
          </Rows>
        ) : (
          <>
            <EmptyBox>
              {filter === '전체' ? '아직 스크랩한 글이 없어요' : `${filter} 스크랩이 아직 없어요`}
            </EmptyBox>
            <View style={styles.action}>
              <ActionButton
                variant="secondary"
                size="large"
                label="라운지 둘러보기"
                onPress={() => router.push('/community' as never)}
              />
            </View>
          </>
        )}
      </Section>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  filterScroll: { flexGrow: 0 },
  filters: {
    gap: Layout.chipGap,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionHeadGap,
  },
  action: { marginTop: Spacing.two },
});
