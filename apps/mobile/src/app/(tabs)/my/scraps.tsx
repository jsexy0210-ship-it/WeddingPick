import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ActionButton, FilterChip, Layout, Spacing } from '@weddingpick/ui';
import { EmptyBox, Section, SubScreen } from '@/features/settings/my-kit';

const FILTERS = ['전체', '드레스', '예산', '일정'] as const;
type Filter = (typeof FILTERS)[number];

/**
 * 스크랩 · 07-lounge-my 4-6.
 * 저장 API 계약이 아직 없으므로 가짜 목록 대신 정본의 필터·빈 상태·라운지 진입까지만 둔다.
 */
export default function ScrapsScreen() {
  const [filter, setFilter] = useState<Filter>('전체');

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
        <EmptyBox>{filter === '전체' ? '아직 스크랩한 글이 없어요' : `${filter} 스크랩이 아직 없어요`}</EmptyBox>
        <View style={styles.action}>
          <ActionButton
            variant="secondary"
            size="large"
            label="라운지 둘러보기"
            onPress={() => router.push('/community' as never)}
          />
        </View>
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
