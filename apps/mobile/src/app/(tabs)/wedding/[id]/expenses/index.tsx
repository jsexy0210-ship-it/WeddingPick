import type { ExpenseSummaryResponse } from '@weddingpick/api-contract';
import { BUDGET_BRACKET_LABEL, VENDOR_CATEGORY_LABEL, manwon, type VendorCategory } from '@weddingpick/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { getExpenses, setBudget } from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import {
  ActionButton,
  ErrorView,
  Layout,
  ProgressBar,
  Radius,
  SkeletonView,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';
import {
  ListRow,
  NavBar,
  RowValue,
  Screen,
  Section,
  StatCard,
} from '@/features/wedding/screen-kit';

/** 핸드오프 08-schedule-sub #4: 진행바 6 · 비중 막대 10. `ProgressBar` 기본값(8)과 달라 여기서 준다. */
const TRACK_HEIGHT = 6;
const STACK_HEIGHT = 10;
/** 비중 막대의 업종 색 — coral을 100 · 55 · 30 · 18%로 옅혀 간다(시안 #ff6f61 · #ffb3ab · #ffd6d1). */
const STACK_OPACITY = [1, 0.55, 0.3, 0.18] as const;

type Group = {
  key: string;
  label: string;
  amount: number;
  /** 한 줄이라도 Pick 인증 자료에서 왔으면 «실 제보 연결», 아니면 «직접 입력». */
  linked: boolean;
};

/** 낸 지출을 업종(category, 없으면 bucket)으로 묶는다. 금액 큰 순. */
function groupByCategory(page: ExpenseSummaryResponse): Group[] {
  const groups = new Map<string, Group>();

  for (const expense of page.expenses) {
    if (expense.status !== 'paid') continue;

    const key = expense.category ?? `bucket:${expense.bucket}`;
    const label = expense.category
      ? VENDOR_CATEGORY_LABEL[expense.category as VendorCategory]
      : (page.buckets.find((bucket) => bucket.bucket === expense.bucket)?.label ?? expense.bucket);
    const group = groups.get(key) ?? { key, label, amount: 0, linked: false };

    group.amount += expense.amount;
    group.linked = group.linked || expense.source === 'payment_proof';
    groups.set(key, group);
  }

  return [...groups.values()].filter((group) => group.amount > 0).sort((a, b) => b.amount - a.amount);
}

/**
 * 지출 요약. WP-OUR-008 · 핸드오프 08-schedule-sub #4.
 *
 *   nav        «지출» · 오른쪽 «내역»(WP-OUR-009)
 *   요약 카드    총액 32 ↔ «예산 3,800만원» · 진행바 6 · «1,660만원 남았어요»
 *   비중        stacked bar 10 + 범례(업종 % · 남은 예산 %)
 *   업종별       업종 18/24 · «58% · 실 제보 연결» · 금액 16/22 700
 *
 * **낸 돈과 낼 돈이 다른 자리에 있다.** 잔금을 합계에 더하면 «지금까지 낸 금액»이
 * 거짓말이 된다 — 아직 안 냈다. 시안의 «남은 업종 예상» 3행과 그 안내 카드는 실 제보
 * 구간을 내려주는 API가 없어 넣지 않았다 — 없는 수치를 만들지 않는다.
 *
 * 예산을 안 정했고 온보딩 구간도 없으면 시트가 한 번 뜬다. 평균값을 깔아두지는 않는다 —
 * 결혼 예산은 사람마다 열 배씩 차이가 나서, 그건 안내가 아니라 유도다.
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

  function openBudget() {
    setDraft(page!.budget.set ? String(page!.budget.budget) : '');
    setBudgetOpen(true);
  }

  const groups = groupByCategory(page);
  const budget = page.budget;
  const total = budget.set ? Math.max(budget.budget, page.paidTotal) : page.paidTotal;
  const remaining = budget.set && !budget.over ? budget.remaining : 0;
  const percent = (amount: number) => (total > 0 ? Math.round((amount / total) * 100) : 0);

  const budgetLine = budget.set
    ? budget.over
      ? `${manwon(-budget.remaining)} 넘었어요`
      : `${manwon(budget.remaining)} 남았어요`
    : page.budgetBracket
      ? `예산 ${BUDGET_BRACKET_LABEL[page.budgetBracket]}`
      : budget.note;

  return (
    <Screen>
      <NavBar
        title="지출"
        right={{ label: '내역', onPress: () => router.push(`/wedding/${id}/expenses/list` as never) }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 요약 카드 — 총액 32 · 예산 · 진행바 6 · 남은 예산 한 줄. 예산 글자를 누르면 고친다. */}
        <View style={styles.block}>
          <StatCard>
            <View style={styles.spendHead}>
              <ThemedText type="amount" numeric>
                {manwon(page.paidTotal)}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={budget.set ? '예산 고치기' : '예산 정하기'}
                onPress={openBudget}
                hitSlop={8}>
                <ThemedText type="t7" themeColor={budget.set ? 'textAssistive' : 'tint'} numeric style={!budget.set && styles.bold}>
                  {budget.set ? `예산 ${manwon(budget.budget)}` : '예산 정하기'}
                </ThemedText>
              </Pressable>
            </View>
            <ProgressBar
              value={budget.set ? budget.spent / budget.budget : page.paidTotal > 0 ? 1 : 0}
              height={TRACK_HEIGHT}
            />
            <ThemedText type="t7" themeColor={budget.set && budget.over ? 'negative' : 'textAssistive'} numeric>
              {budgetLine}
            </ThemedText>
          </StatCard>
          {page.scheduledTotal > 0 ? (
            <ThemedText type="t7" themeColor="textAssistive">
              {page.scheduledNote}
            </ThemedText>
          ) : null}
        </View>

        {/* 업종 비중 — stacked bar 10 + 범례. 낸 돈이 없으면 그릴 것이 없어 접는다. */}
        {groups.length > 0 ? (
          <View style={[styles.block, styles.stackBlock]}>
            <View style={[styles.stack, { backgroundColor: theme.border }]}>
              {groups.map((group, index) => (
                <View
                  key={group.key}
                  style={{
                    flex: group.amount,
                    backgroundColor: theme.tint,
                    opacity: STACK_OPACITY[Math.min(index, STACK_OPACITY.length - 1)],
                  }}
                />
              ))}
              {remaining > 0 ? <View style={{ flex: remaining }} /> : null}
            </View>
            <View style={styles.legend}>
              {groups.map((group, index) => (
                <View key={group.key} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: theme.tint, opacity: STACK_OPACITY[Math.min(index, STACK_OPACITY.length - 1)] },
                    ]}
                  />
                  <ThemedText type="t7" themeColor="textSecondary">
                    {group.label}
                  </ThemedText>
                  <ThemedText type="t7" numeric style={styles.bold}>
                    {percent(group.amount)}%
                  </ThemedText>
                </View>
              ))}
              {remaining > 0 ? (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.border }]} />
                  <ThemedText type="t7" themeColor="textSecondary">
                    남은 예산
                  </ThemedText>
                  <ThemedText type="t7" numeric style={styles.bold}>
                    {percent(remaining)}%
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {groups.length > 0 ? (
          <Section label="업종별">
            {groups.map((group) => (
              <ListRow
                key={group.key}
                title={group.label}
                sub={`${percent(group.amount)}% · ${group.linked ? '실 제보 연결' : '직접 입력'}`}
                subLines={1}
                right={
                  <RowValue color="text" bold>
                    {manwon(group.amount)}
                  </RowValue>
                }
              />
            ))}
          </Section>
        ) : (
          <View style={styles.block}>
            <ThemedText type="t6" themeColor="textAssistive">
              아직 넣은 지출이 없어요
            </ThemedText>
            <ActionButton
              variant="ghost"
              size="large"
              label="지출 넣기"
              onPress={() => router.push(`/wedding/${id}/expenses/add` as never)}
            />
          </View>
        )}
      </ScrollView>

      {/* 예산 시트 — 제목 24/32 · 입력 52 · «나중에» + «정하기». */}
      <BottomSheet visible={budgetOpen} onRequestClose={() => setBudgetOpen(false)}>
        <SheetPanel style={styles.sheet}>
          <ThemedText type="t3">예산을 정할까요?</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            정하면 남은 금액을 함께 보여드려요. 나중에 바꿀 수 있어요.
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.fieldBorder }]}
            value={draft}
            onChangeText={(text) =>
              setDraft(text.replace(/[^0-9]/g, '').slice(0, 12).replace(/\B(?=(\d{3})+(?!\d))/g, ','))
            }
            keyboardType="number-pad"
            placeholder="예: 30,000,000"
            placeholderTextColor={theme.textDisabled}
            maxLength={15}
            accessibilityLabel="예산"
          />
          <View style={styles.sheetActions}>
            <View style={styles.sheetButton}>
              <ActionButton size="xlarge" label="나중에" onPress={() => setBudgetOpen(false)} />
            </View>
            <View style={styles.sheetButton}>
              <ActionButton size="xlarge" variant="primary" label="정하기" onPress={() => void saveBudget()} />
            </View>
          </View>
        </SheetPanel>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.six },
  block: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four, gap: Layout.cardGap },
  spendHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Layout.rowPaddingY },
  stackBlock: { gap: Layout.sectionHeadGap },
  stack: {
    height: STACK_HEIGHT,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: Layout.cardGap },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + Spacing.half },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  bold: { fontWeight: 700 },
  sheet: { gap: Layout.rowPaddingY },
  input: {
    height: Layout.field,
    borderRadius: Radius.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.three - Spacing.half,
  },
  sheetActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  sheetButton: { flex: 1 },
});
