import type { ExpenseSummaryResponse } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getExpenses } from '@/api/client';
import { useDepthBack } from '@/features/navigation/depth-back';
import { noteMonthDay } from '@/features/wedding/note-format';
import { Border, ErrorView, Layout, Radius, SkeletonView, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import { NavBar, Screen } from '@/features/wedding/screen-kit';

/**
 * 지출 목록. WP-OUR-014b · `docs/design/React_Native/note.jsx` frame-007.
 *
 *   nav    «지출내역» · 좌측 X 닫기(공통 풀팝업) · 오른쪽은 빈 칸(navPad) — 등록은
 *          헤더에 하나만 두는 규칙이라 예산현황 헤더의 «예산 추가»가 그 자리다
 *   sec    `padding:0 24px 20px;gap:12px`
 *   행     `spendRow` — `margin:0 20px;padding:14px 0;gap:10px`, 아래 선.
 *          항목 15/700 · 날짜 12 · 금액 15/700 · Pick 인증 배지 24 · 11/700
 *
 * 정본은 Hero 요약도 필터 칩도 빈 상태 단추도 없다 — «낸 금액이 있는 항목만 쌓입니다»
 * 한 줄이 전부라 status가 paid인 것만 보여준다(잔금 예정은 예산현황 카드에서 이미
 * 보인다). 상담 정리 출처는 v3.28 대조표 「금액 출처」 결정(2026-09-23)으로 실 제보와
 * 같은 목록에 들어오되 배지로 출처를 다르게 적는다 — Pick 인증 배지 자리에 함께 둔다.
 */
export default function ExpenseListScreen() {
  const depthBack = useDepthBack();
  const theme = useTheme();
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

  return (
    <Screen>
      <NavBar title="지출내역" variant="close" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sec}>
          {rows.map((expense) => {
            const badge =
              expense.source === 'payment_proof'
                ? { label: 'Pick 인증', text: theme.positive, background: theme.positiveBackground }
                : expense.source === 'consultation'
                  ? { label: '상담 정리', text: theme.cautionary, background: theme.cautionaryBackground }
                  : null;
            return (
              <Pressable
                key={expense.id}
                accessibilityRole="button"
                accessibilityLabel={`${expense.label} 상세 보기`}
                onPress={() => router.push(`/wedding/${id}/expenses/${expense.id}` as never)}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: theme.border },
                  pressed ? styles.pressed : null,
                ]}>
                <View style={styles.col}>
                  <ThemedText type="f15" numberOfLines={1} style={styles.bold}>
                    {expense.label}
                  </ThemedText>
                  {expense.spentOn ? (
                    <ThemedText type="f12" themeColor="textAssistive" numeric>
                      {noteMonthDay(expense.spentOn)}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText type="f15" numeric style={styles.bold}>
                  {manwon(expense.amount)}
                </ThemedText>
                {badge ? (
                  <View style={[styles.badge, { backgroundColor: badge.background }]}>
                    <ThemedText type="f11" style={[styles.bold, { color: badge.text }]}>
                      {badge.label}
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* 프레임 끝 `height:24px` 빈 칸. */
  content: { paddingBottom: Spacing.four },
  sec: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.listGap, gap: Layout.inlineGap },
  row: {
    marginHorizontal: Layout.cardPadding,
    paddingVertical: 14,
    borderBottomWidth: Border.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  col: { flex: 1, minWidth: 0, gap: 3 },
  bold: { fontWeight: 700 },
  /* `spendBadge` — `height:24px;padding:0 8px;border-radius:4px`. 글자가 커져도 잘리지 않게 minHeight로 둔다. */
  badge: { minHeight: 24, paddingHorizontal: Spacing.two, borderRadius: Radius.badge, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
