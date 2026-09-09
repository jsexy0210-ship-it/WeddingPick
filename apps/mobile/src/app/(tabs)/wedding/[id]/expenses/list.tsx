import type { ExpenseSummaryResponse } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getExpenses } from '@/api/client';
import { formatDateDot } from '@/features/common/format-date';
import { ActionButton, ErrorView, FilterChip, Layout, SkeletonView, Spacing } from '@weddingpick/ui';
import { Hero, ListRow, NavBar, RowValue, Screen, Section } from '@/features/wedding/screen-kit';

type Filter = 'all' | 'linked' | 'manual';

/** 필터 칩 3 — screens.json WP-OUR-009 «전체 / 제보 연계 / 직접 입력». */
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'linked', label: '제보 연계' },
  { key: 'manual', label: '직접 입력' },
];

/**
 * 지출 내역. WP-OUR-009. 지출 요약(WP-OUR-008) nav의 «내역»으로 들어온다.
 *
 *   nav     «지출 내역» · 오른쪽 «추가»(WP-OUR-014)
 *   hero    «지출 N건을 적었어요» · «총 2,140만원»
 *   칩 3    전체 · 제보 연계 · 직접 입력
 *   행      항목 18/24 · «실 제보 연결 · 2027.05.16(토)» · 금액 16/22 700 — 잔금 예정은 회색
 *
 * 행을 누르면 지출 상세(WP-OUR-010). 삭제는 상세에서 한다 — 목록의 줄마다 단추를 두지 않는다.
 */
export default function ExpenseListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [page, setPage] = useState<ExpenseSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(() => {
    getExpenses(id)
      .then(setPage)
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useFocusEffect(load);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!page) {
    return <SkeletonView />;
  }

  const rows = page.expenses.filter((expense) =>
    filter === 'all' ? true : filter === 'linked' ? expense.source === 'payment_proof' : expense.source === 'manual'
  );
  const openAdd = () => router.push(`/wedding/${id}/expenses/add` as never);

  return (
    <Screen>
      <NavBar title="지출 내역" right={{ label: '추가', brand: true, onPress: openAdd }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero
          title={page.expenses.length > 0 ? `지출 ${page.expenses.length}건을 적었어요` : '아직 지출이 없어요'}
          sub={page.expenses.length > 0 ? `총 ${manwon(page.paidTotal)}` : '낸 금액을 넣어두면 업종별로 모아 보여드려요'}
        />

        {page.expenses.length > 0 ? (
          <View style={styles.chips}>
            {FILTERS.map((item) => (
              <FilterChip
                key={item.key}
                label={item.label}
                selected={filter === item.key}
                role="radio"
                onPress={() => setFilter(item.key)}
              />
            ))}
          </View>
        ) : null}

        {page.expenses.length === 0 ? (
          <View style={styles.emptyAction}>
            <ActionButton variant="ghost" size="large" label="지출 넣기" onPress={openAdd} />
          </View>
        ) : rows.length === 0 ? (
          <Section>
            <ListRow title="이 조건에 맞는 지출이 없어요" titleColor="textAssistive" divider={false} />
          </Section>
        ) : (
          <Section>
            {rows.map((expense) => {
              const scheduled = expense.status === 'scheduled';
              const meta = [
                expense.source === 'payment_proof' ? '실 제보 연결' : '직접 입력',
                expense.spentOn ? formatDateDot(expense.spentOn) : null,
                scheduled ? expense.statusLabel : null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <ListRow
                  key={expense.id}
                  title={expense.label}
                  titleColor={scheduled ? 'textDisabled' : 'text'}
                  sub={meta}
                  subLines={1}
                  right={
                    <RowValue color={scheduled ? 'textAssistive' : 'text'} bold>
                      {manwon(expense.amount)}
                    </RowValue>
                  }
                  onPress={() => router.push(`/wedding/${id}/expenses/${expense.id}` as never)}
                  accessibilityLabel={`${expense.label} 상세 보기`}
                />
              );
            })}
          </Section>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.two },
  /* 칩 줄 — padding 0 24 20 · gap 8. */
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gapHeadlineGrid,
  },
  emptyAction: { paddingHorizontal: Layout.gutter },
});
