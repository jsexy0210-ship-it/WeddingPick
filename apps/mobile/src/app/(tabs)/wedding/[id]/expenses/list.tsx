import type { ExpenseSummaryResponse } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getExpenses } from '@/api/client';
import { formatDateDot } from '@/features/common/format-date';
import { useDepthBack } from '@/features/navigation/depth-back';
import { ActionButton, ErrorView, Layout, SkeletonView, Spacing } from '@weddingpick/ui';
import { Badge, ListRow, NavBar, RowValue, Screen, Section } from '@/features/wedding/screen-kit';

/**
 * 지출 목록. WP-OUR-014b · `docs/design/React_Native/note.jsx` frame-007.
 *
 *   nav    «지출내역» · 좌측 X 닫기(공통 풀팝업) · 오른쪽은 빈 칸(navPad) — 등록은
 *          헤더에 하나만 두는 규칙이라 예산현황 헤더의 «예산 추가»가 그 자리다
 *   행     spendRow — 항목 15/22 700 · 날짜 12 · 금액 15/22 700 · Pick 인증 배지
 *
 * 정본은 Hero 요약도 필터 칩도 없다 — «낸 금액이 있는 항목만 쌓입니다» 한 줄이 전부라
 * status가 paid인 것만 보여준다(잔금 예정은 예산현황 카드에서 이미 보인다). 상담
 * 정리 출처는 v3.28 대조표 「금액 출처」 결정(2026-09-23)으로 실 제보와 같은 목록에
 * 들어오되 배지로 출처를 다르게 적는다 — Pick 인증 배지 자리에 함께 둔다.
 */
export default function ExpenseListScreen() {
  const depthBack = useDepthBack();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [page, setPage] = useState<ExpenseSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getExpenses(id)
      .then(setPage)
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useFocusEffect(load);

  if (error) {
    return <ErrorView message={error} onBack={depthBack} onRetry={load} />;
  }

  if (!page) {
    return <SkeletonView />;
  }

  const rows = page.expenses.filter((expense) => expense.status === 'paid');
  const openAdd = () => router.push(`/wedding/${id}/expenses/add` as never);

  return (
    <Screen>
      <NavBar title="지출내역" variant="close" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {rows.length === 0 ? (
          <View style={styles.emptyAction}>
            <ActionButton variant="ghost" size="large" label="지출 넣기" onPress={openAdd} />
          </View>
        ) : (
          <Section>
            {rows.map((expense) => (
              <ListRow
                key={expense.id}
                title={expense.label}
                sub={expense.spentOn ? formatDateDot(expense.spentOn) : null}
                subLines={1}
                right={
                  <View style={styles.rowRight}>
                    <RowValue color="text" bold>
                      {manwon(expense.amount)}
                    </RowValue>
                    {expense.source === 'payment_proof' ? <Badge label="Pick 인증" tone="ok" /> : null}
                    {expense.source === 'consultation' ? <Badge label="상담 정리" tone="wait" /> : null}
                  </View>
                }
                onPress={() => router.push(`/wedding/${id}/expenses/${expense.id}` as never)}
                accessibilityLabel={`${expense.label} 상세 보기`}
              />
            ))}
          </Section>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: Spacing.two, paddingBottom: Spacing.two },
  emptyAction: { paddingHorizontal: Layout.gutter },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
