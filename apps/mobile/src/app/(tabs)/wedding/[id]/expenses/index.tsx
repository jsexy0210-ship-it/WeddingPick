import type { ExpenseSummaryResponse } from '@weddingpick/api-contract';
import {
  BUDGET_BRACKET_LABEL,
  EXPENSE_BUCKET_COLOR,
  manwon,
  type ExpenseBucket,
} from '@weddingpick/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getExpenses, removeExpense, setBudget } from '@/api/client';
import { BottomSheet, SHEET_PANEL } from '@/features/common/bottom-sheet';
import {
  ActionButton,
  DonutChart,
  ErrorView,
  Fab,
  Layout,
  MaxContentWidth,
  Radius,
  showAlert,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
  SkeletonView,
} from '@weddingpick/ui';
import { won } from '@/features/quotes/quote-result-view';

/**
 * 지출내역. 디자인 핸드오프 14번.
 *
 * **낸 돈과 낼 돈이 다른 자리에 있다.** 잔금을 합계에 더하면 "지금까지 결제한
 * 금액"이 거짓말이 된다 — 아직 안 냈다.
 *
 * 예산을 안 정했으면 시트가 자동으로 뜬다(핸드오프). 다만 **평균값을 깔아두지는
 * 않는다** — 결혼 예산은 사람마다 열 배씩 차이가 나서, 그건 안내가 아니라 유도다.
 *
 * 지출 추가는 시트가 아니라 화면이다 — WP-OUR-014(v3.22 SPEC 13.10)가 지출 입력과
 * Pick 인증을 한 화면에서 처리한다. 돌아오면 다시 읽는다(`useFocusEffect`).
 */
export default function ExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [page, setPage] = useState<ExpenseSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [draft, setDraft] = useState('');
  /** 예산 시트는 화면에 처음 들어왔을 때 한 번만 권한다 — 지출을 넣고 돌아올 때마다 뜨면 방해다. */
  const budgetPrompted = useRef(false);

  const load = useCallback(() => {
    getExpenses(id)
      .then((loaded) => {
        setPage(loaded);
        /*
         * 온보딩에서 구간을 이미 답했으면(«4,000만원 이상»·«아직 모르겠어요» 포함)
         * 시트를 억지로 열지 않는다 — budget.set은 숫자 예산이 없다는 뜻일 뿐,
         * 안 답했다는 뜻이 아니다. 정말 안 답한 사람에게만, 한 틱 뒤에 열어
         * 초기화와 상쇄되지 않게 한다.
         */
        if (!loaded.budget.set && loaded.budgetBracket === null && !budgetPrompted.current) {
          budgetPrompted.current = true;
          setTimeout(() => setBudgetOpen(true), 0);
        }
      })
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useFocusEffect(load);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!page) {
    return <SkeletonView />;
  }

  async function saveBudget() {
    const amount = Number(draft.replace(/[^\d]/g, ''));

    try {
      await setBudget(id, Number.isFinite(amount) && amount > 0 ? amount : null);
      setBudgetOpen(false);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '정하지 못했어요.');
    }
  }

  function remove(expenseId: string) {
    showAlert('삭제할까요?', '이 지출 항목을 삭제하면 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          removeExpense(id, expenseId)
            .then(load)
            .catch((caught: unknown) =>
              setError(
                caught instanceof Error && caught.message
                  ? caught.message
                  : '지울 수 없어요.'
              )
            ),
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {/*
            도넛과 총액. 핸드오프 14번 — 140px, 구멍 94px.

            총액을 구멍 안에 둔다. 옆에 두면 눈이 두 번 움직이고, 무엇의 총액인지
            한 번 더 생각해야 한다.
          */}
          <ThemedView style={styles.donutRow}>
            <DonutChart
              slices={page.buckets.map((bucket) => ({
                key: bucket.bucket,
                value: bucket.amount,
                color: theme[EXPENSE_BUCKET_COLOR[bucket.bucket as ExpenseBucket].bar],
              }))}>
              <ThemedText type="t7" themeColor="textSecondary">
                지금까지
              </ThemedText>
              <ThemedText type="t4" numeric>
                {manwon(page.paidTotal)}
              </ThemedText>
            </DonutChart>
          </ThemedView>

          <ThemedView style={styles.legend}>
            {page.buckets.map((bucket) => (
              <ThemedView key={bucket.bucket} style={styles.legendItem}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        theme[EXPENSE_BUCKET_COLOR[bucket.bucket as ExpenseBucket].bar],
                    },
                  ]}
                />
                <ThemedText
                  type="t7"
                  themeColor={EXPENSE_BUCKET_COLOR[bucket.bucket as ExpenseBucket].text}>
                  {bucket.label}
                </ThemedText>
                <ThemedText type="t7" numeric themeColor="textSecondary">
                  {won(bucket.amount)}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t7" themeColor="textSecondary">
              총 예산
            </ThemedText>
            {page.budget.set ? (
              <>
                <ThemedText type="t4" numeric>
                  {won(page.budget.budget)}
                </ThemedText>
                <ThemedText
                  type="t7"
                  themeColor={page.budget.over ? 'negative' : 'textSecondary'}>
                  {page.budget.over
                    ? `${won(-page.budget.remaining)} 넘었어요`
                    : `${won(page.budget.remaining)} 남았어요`}
                </ThemedText>
              </>
            ) : page.budgetBracket ? (
              // 답은 했지만(예: «4,000만원 이상») 견줄 숫자가 없다 — 구간 그대로 보여준다.
              <ThemedText type="t4">{BUDGET_BRACKET_LABEL[page.budgetBracket]}</ThemedText>
            ) : (
              <ThemedText type="t7" themeColor="textSecondary">
                {page.budget.note}
              </ThemedText>
            )}
            <ActionButton
              label={page.budget.set ? '예산 고치기' : '예산 정하기'}
              onPress={() => {
                setDraft(page.budget.set ? String(page.budget.budget) : '');
                setBudgetOpen(true);
              }}
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t4">항목</ThemedText>
            {page.expenses.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="t7" themeColor="textSecondary">
                  아직 항목이 없어요. 지출을 등록하시면 여기 모여요.
                </ThemedText>
                <ActionButton
                  label="지출 넣기"
                  onPress={() => router.push(`/wedding/${id}/expenses/add` as never)}
                />
              </ThemedView>
            ) : (
              page.expenses.map((expense) => (
                <Pressable
                  key={expense.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${expense.label} 상세 보기`}
                  onPress={() => router.push(`/wedding/${id}/expenses/${expense.id}` as never)}>
                  <ThemedView type="backgroundElement" style={styles.card}>
                    <ThemedText
                      type="t5"
                      // 잔금 예정 행은 회색이다. 낸 돈과 다르게 보여야 한다.
                      themeColor={expense.status === 'scheduled' ? 'textAssistive' : 'text'}>
                      {expense.label}
                    </ThemedText>
                    <ThemedText
                      type="t5"
                      numeric
                      themeColor={expense.status === 'scheduled' ? 'textAssistive' : 'text'}>
                      {won(expense.amount)}
                    </ThemedText>
                    <ThemedText type="t7" themeColor="textAssistive">
                      {expense.sourceLabel}
                      {expense.spentOn ? ` · ${expense.spentOn}` : ''}
                      {expense.status === 'scheduled' ? ` · ${expense.statusLabel}` : ''}
                    </ThemedText>
                    {expense.source === 'manual' ? (
                      <ActionButton
                        label="빼기"
                        onPress={(event) => {
                          event.stopPropagation();
                          remove(expense.id);
                        }}
                      />
                    ) : null}
                  </ThemedView>
                </Pressable>
              ))
            )}

            {page.scheduledTotal > 0 ? (
              <ThemedText type="t7" themeColor="textAssistive">
                {page.scheduledNote}
              </ThemedText>
            ) : null}
          </ThemedView>

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>

      {/* 지출 추가 — WP-OUR-014로 간다. 시트가 아니라 화면이다. */}
      <Fab
        label="지출 추가"
        glyph="+"
        onPress={() => router.push(`/wedding/${id}/expenses/add` as never)}
      />

      <BottomSheet dismissible={false} visible={budgetOpen} onRequestClose={() => setBudgetOpen(false)}>
          <ThemedView style={[SHEET_PANEL, styles.sheet]}>
            <ThemedText type="t4">총 예산</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              정하시면 남은 금액을 함께 보여드려요. 나중에 바꾸셔도 돼요.
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.backgroundSelected },
              ]}
              value={draft}
              onChangeText={(text) =>
                setDraft(
                  text.replace(/[^0-9]/g, '').slice(0, 12).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                )
              }
              keyboardType="number-pad"
              placeholder="예: 30000000"
              placeholderTextColor={theme.textAssistive}
              maxLength={15}
              accessibilityLabel="총 예산"
            />
            <ThemedView style={styles.sheetActions}>
              <ActionButton label="나중에" onPress={() => setBudgetOpen(false)} />
              <ActionButton variant="primary" label="정하기" onPress={() => void saveBudget()} />
            </ThemedView>
          </ThemedView>
      </BottomSheet>
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
  section: { gap: Spacing.two },
  donutRow: { alignItems: 'center', paddingVertical: Spacing.two },
  legend: { gap: Spacing.one },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: Radius.pill },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  sheet: {
    padding: Layout.gutter,
    gap: Spacing.two,
  },
  sheetActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  input: {
    height: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
  },
});
