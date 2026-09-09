import type { DecisionListResponse, ExpenseSummaryResponse, WeddingDetail } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getExpenses, getWedding, listDecisions } from '@/api/client';
import { formatDateDot } from '@/features/common/format-date';
import { ErrorView, Layout, ProgressBar, Spacing, ThemedText } from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { Badge, CheckBox, Hero, ListRow, NoteCard, RowValue, Section, StatCard } from '@/features/wedding/screen-kit';

/** 핸드오프 08-schedule-sub #6: 진행바 6. */
const TRACK_HEIGHT = 6;

type PageData = {
  wedding: WeddingDetail;
  expenses: ExpenseSummaryResponse;
  decisions: DecisionListResponse;
};

/**
 * 예식 완료 본문. WP-OUR-013 · 핸드오프 08-schedule-sub #6.
 *
 *   hero      eyebrow «2027.05.16(토) · 예식 완료» + «결혼 준비가 끝났어요»
 *   요약 카드   총지출 32 · 예산 · 진행바 6 · «예산 안에서 마쳤어요»
 *   정리하면 좋은 것   Pick 인증 N건 남았어요(«인증» 배지) · 지출 정리(끝난 것은 회색 체크)
 *   우리가 정한 곳     업종 18/24 · 업체명 16/22
 *   note      «준비 알림을 멈췄어요»
 *
 * 웨딩일정 탭이 예식일이 지나면 이 본문을 그대로 보여준다(WP-OUR-001 «예식 완료» 상태).
 * 시안의 «후기 3곳 남았어요»는 어느 업체에 후기를 썼는지 내려주는 API가 없어 넣지 않았다.
 */
export function WeddingCompleteView({ weddingId }: { weddingId: string }) {
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([getWedding(weddingId), getExpenses(weddingId), listDecisions(weddingId)])
      .then(([wedding, expenses, decisions]) => {
        setError(null);
        setData({ wedding, expenses, decisions });
      })
      .catch((caught: Error) => setError(caught.message));
  }, [weddingId]);

  useEffect(load, [load]);

  if (error) return <ErrorView message={error} onRetry={load} />;
  if (!data) return <DelayedLoadingView />;

  const { wedding, expenses, decisions } = data;
  const budget = expenses.budget;
  const paid = expenses.expenses.filter((expense) => expense.status === 'paid');
  const linkedCategories = new Set(
    paid.filter((expense) => expense.source === 'payment_proof').map((expense) => expense.category)
  );
  /* 인증이 남은 것 — 결정했는데 실 제보가 없는 업종 + 직접 입력만 있는 지출(결정 업종 밖). */
  const decidedCategories = new Set(decisions.decisions.map((decision) => decision.category));
  const unverified: { key: string; label: string }[] = [
    ...decisions.decisions
      .filter((decision) => !linkedCategories.has(decision.category))
      .map((decision) => ({ key: `d:${decision.category}`, label: decision.categoryLabel })),
    ...paid
      .filter((expense) => expense.source === 'manual' && (expense.category === null || !decidedCategories.has(expense.category)))
      .map((expense) => ({ key: `e:${expense.id}`, label: expense.label })),
  ];
  const verifiedCount = paid.filter((expense) => expense.source === 'payment_proof').length;

  const budgetLine = budget.set
    ? budget.over
      ? `예산보다 ${manwon(-budget.remaining)} 더 썼어요`
      : '예산 안에서 마쳤어요'
    : `${paid.length}건을 적었어요`;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Hero
        eyebrow={wedding.weddingDate ? `${formatDateDot(wedding.weddingDate)} · 예식 완료` : '예식 완료'}
        title="결혼 준비가 끝났어요"
      />

      <View style={styles.block}>
        <StatCard>
          <View style={styles.spendHead}>
            <ThemedText type="amount" numeric>
              {manwon(expenses.paidTotal)}
            </ThemedText>
            {budget.set ? (
              <ThemedText type="t7" themeColor="textAssistive" numeric>
                예산 {manwon(budget.budget)}
              </ThemedText>
            ) : null}
          </View>
          <ProgressBar value={budget.set ? budget.spent / budget.budget : expenses.paidTotal > 0 ? 1 : 0} height={TRACK_HEIGHT} />
          <ThemedText type="t7" themeColor={budget.set && budget.over ? 'negative' : 'textAssistive'} numeric>
            {budgetLine}
          </ThemedText>
        </StatCard>
      </View>

      <Section label="정리하면 좋은 것">
        {decisions.decisions.length === 0 && paid.length === 0 ? (
          <ListRow
            left={<CheckBox checked={false} />}
            title="Pick 인증할 지출이 없어요"
            sub="낸 금액을 넣으면 여기서 인증할 수 있어요"
            subLines={1}
            right={<Badge label="인증" tone="now" />}
            onPress={() => router.push(`/wedding/${weddingId}/expenses/add` as never)}
          />
        ) : unverified.length > 0 ? (
          <ListRow
            left={<CheckBox checked={false} />}
            title={`Pick 인증 ${unverified.length}건 남았어요`}
            sub={unverified.map((row) => row.label).join(' · ')}
            subLines={1}
            right={<Badge label="인증" tone="now" />}
            onPress={() => router.push(`/wedding/${weddingId}/expenses/add` as never)}
          />
        ) : (
          <ListRow
            left={<CheckBox checked />}
            title="Pick 인증을 마쳤어요"
            titleColor="textDisabled"
            sub={`${verifiedCount}건 모두 실 제보가 됐어요`}
            subLines={1}
          />
        )}
        <ListRow
          left={<CheckBox checked={paid.length > 0} />}
          title="지출 정리"
          titleColor={paid.length > 0 ? 'textDisabled' : 'text'}
          sub={paid.length > 0 ? `${paid.length}건 · ${manwon(expenses.paidTotal)}` : '낸 금액을 넣어두면 여기 모여요'}
          subLines={1}
          onPress={() => router.push(`/wedding/${weddingId}/expenses` as never)}
        />
      </Section>

      {decisions.decisions.length > 0 ? (
        <Section label="우리가 정한 곳">
          {decisions.decisions.map((decision) => (
            <ListRow
              key={decision.category}
              title={decision.categoryLabel}
              right={<RowValue numeric={false}>{decision.vendor.name}</RowValue>}
            />
          ))}
        </Section>
      ) : null}

      <View style={styles.noteWrap}>
        <NoteCard title="준비 알림을 멈췄어요" body="기록은 그대로 남아 있어요. 언제든 다시 볼 수 있어요." />
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.six },
  block: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.four },
  spendHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Layout.rowPaddingY },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
});
