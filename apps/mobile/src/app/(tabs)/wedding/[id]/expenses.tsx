import type { CreateExpenseRequest, ExpenseSummaryResponse } from '@weddingpick/api-contract';
import {
  EXPENSE_BUCKET_COLOR,
  EXPENSE_STATUSES,
  EXPENSE_STATUS_LABEL,
  manwon,
  type ExpenseBucket,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addExpense, getExpenses, removeExpense, setBudget } from '@/api/client';
import {
  ActionButton,
  DonutChart,
  ErrorView,
  Fab,
  FilterChip,
  Layout,
  LoadingView,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
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
 */
export default function ExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [page, setPage] = useState<ExpenseSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [draft, setDraft] = useState('');
  /** 수동 지출 입력 시트 */
  const [addOpen, setAddOpen] = useState(false);
  const [addLabel, setAddLabel] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addStatus, setAddStatus] = useState<CreateExpenseRequest['status']>('paid');
  const [addSpentOn, setAddSpentOn] = useState('');

  const load = useCallback(() => {
    getExpenses(id)
      .then((loaded) => {
        setPage(loaded);
        // 예산이 없으면 시트를 연다. 한 틱 뒤에 열어 초기화와 상쇄되지 않게 한다.
        if (!loaded.budget.set) setTimeout(() => setBudgetOpen(true), 0);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useEffect(load, [load]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!page) {
    return <LoadingView />;
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

  function closeAddSheet() {
    setAddOpen(false);
    setAddLabel('');
    setAddAmount('');
    setAddStatus('paid');
    setAddSpentOn('');
  }

  async function submitExpense() {
    const label = addLabel.trim();
    const amount = parseInt(addAmount.replace(/[^0-9]/g, ''), 10);

    if (!label) {
      Alert.alert('항목 이름을 적어주세요');
      return;
    }
    if (!amount || amount <= 0) {
      Alert.alert('금액을 숫자로 적어주세요');
      return;
    }
    const spentOn = addSpentOn.trim();
    const body: CreateExpenseRequest = {
      label,
      amount,
      status: addStatus,
      ...(spentOn ? { spentOn } : {}),
    };

    try {
      await addExpense(id, body);
      closeAddSheet();
      load();
    } catch (caught) {
      Alert.alert('지출 추가 실패', caught instanceof Error ? caught.message : '다시 시도해주세요.');
    }
  }

  function remove(expenseId: string) {
    Alert.alert('항목 빼기', '이 지출 항목을 빼시겠어요? 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '빼기',
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
                  variant="primary"
                  label="제보하기"
                  onPress={() => router.push('/capture')}
                />
              </ThemedView>
            ) : (
              page.expenses.map((expense) => (
                <ThemedView key={expense.id} type="backgroundElement" style={styles.card}>
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
                    <ActionButton label="빼기" onPress={() => remove(expense.id)} />
                  ) : null}
                </ThemedView>
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

      <Fab label="지출 추가" glyph="+" onPress={() => { closeAddSheet(); setAddOpen(true); }} />

      <Modal visible={addOpen} transparent animationType="slide">
        <ThemedView style={[styles.scrim, { backgroundColor: theme.scrim }]}>
          <ThemedView style={styles.sheet}>
            <ThemedText type="t4">지출 추가</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">항목 이름</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              value={addLabel}
              onChangeText={setAddLabel}
              placeholder="예: 스드메 계약금"
              placeholderTextColor={theme.textAssistive}
              returnKeyType="next"
            />
            <ThemedText type="t7" themeColor="textSecondary">금액 (원)</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              value={addAmount}
              onChangeText={setAddAmount}
              placeholder="예: 500000"
              placeholderTextColor={theme.textAssistive}
              keyboardType="number-pad"
            />
            <ThemedText type="t7" themeColor="textSecondary">상태</ThemedText>
            <ThemedView style={styles.chips}>
              {EXPENSE_STATUSES.map((s) => (
                <FilterChip
                  key={s}
                  label={EXPENSE_STATUS_LABEL[s]}
                  selected={addStatus === s}
                  role="radio"
                  onPress={() => setAddStatus(s)}
                />
              ))}
            </ThemedView>
            <ThemedText type="t7" themeColor="textSecondary">지출일 (선택, YYYY-MM-DD)</ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              value={addSpentOn}
              onChangeText={setAddSpentOn}
              placeholder="예: 2025-04-15"
              placeholderTextColor={theme.textAssistive}
              maxLength={10}
            />
            <ThemedView style={styles.sheetActions}>
              <ActionButton label="취소" onPress={closeAddSheet} />
              <ActionButton variant="primary" label="추가하기" onPress={() => void submitExpense()} />
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>

      <Modal visible={budgetOpen} transparent animationType="slide">
        <ThemedView style={[styles.scrim, { backgroundColor: theme.scrim }]}>
          <ThemedView style={styles.sheet}>
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
              onChangeText={setDraft}
              keyboardType="number-pad"
              placeholder="예: 30000000"
              placeholderTextColor={theme.textAssistive}
              accessibilityLabel="총 예산"
            />
            <ThemedView style={styles.sheetActions}>
              <ActionButton label="나중에" onPress={() => setBudgetOpen(false)} />
              <ActionButton variant="primary" label="정하기" onPress={() => void saveBudget()} />
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>
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
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: Layout.gutter,
    gap: Spacing.two,
  },
  sheetActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  input: {
    height: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
  },
});
