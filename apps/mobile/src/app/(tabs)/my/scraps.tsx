import type { WeddingFeedScrapItem } from '@weddingpick/api-contract';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ActionButton,
  Border,
  ErrorView,
  FilterChip,
  Layout,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';
import { listMyWeddingFeedScraps } from '@/api/client';
import { CategoryImage } from '@/features/home/category-image';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { EmptyBox, Section, SubScreen } from '@/features/settings/my-kit';

const FILTERS = ['전체', '드레스', '예산', '일정'] as const;
type Filter = (typeof FILTERS)[number];

/** ISO 저장 시각을 정본의 «9월 8일 저장» 꼴로 바꾼다. */
export function savedAtLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return '저장됨';

  return `${Number(match[2])}월 ${Number(match[3])}일 저장`;
}

/**
 * 스크랩 · 07-lounge-my 4-6.
 *
 * 정본은 설정 목록이 아니라 웨딩정보 guide row다.
 * 88×88 이미지 · 코랄 카테고리 · 2줄 제목 · 저장일 · 코랄 bookmark를 한 행에 둔다.
 */
export default function ScrapsScreen() {
  const theme = useTheme();
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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

      {shown.length > 0 ? (
        <View>
          {shown.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${item.categoryLabel}, ${savedAtLabel(item.savedAt)}`}
              onPress={() => router.push(`/feed/${encodeURIComponent(item.id)}` as never)}
              style={({ pressed }) => [
                styles.guideRow,
                { borderBottomColor: theme.border },
                pressed ? styles.pressed : null,
              ]}>
              <View style={styles.guideThumb}>
                <CategoryImage uri={item.imageUrl} />
              </View>
              <View style={styles.guideCol}>
                <ThemedText type="f12" themeColor="tint" style={styles.bold}>
                  {item.categoryLabel}
                </ThemedText>
                <ThemedText type="f15" numberOfLines={2} style={styles.bold}>
                  {item.title}
                </ThemedText>
                <ThemedText type="f12" themeColor="textAssistive" numeric numberOfLines={1}>
                  {savedAtLabel(item.savedAt)}
                </ThemedText>
              </View>
              <View style={styles.bookmark} accessibilityElementsHidden>
                <ProductSymbol name="bookmark" size={20} color={theme.tint} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Section>
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
        </Section>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: 700 },
  pressed: { opacity: 0.8 },
  filterScroll: { flexGrow: 0 },
  filters: {
    gap: Layout.chipGap,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionHeadGap,
  },
  guideRow: {
    flexDirection: 'row',
    gap: Layout.sectionHeadGap,
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.three,
    borderBottomWidth: Border.hairline,
  },
  guideThumb: {
    width: Layout.avatarLarge,
    height: Layout.avatarLarge,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  guideCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: Spacing.one,
  },
  bookmark: {
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  action: { marginTop: Spacing.two },
});
