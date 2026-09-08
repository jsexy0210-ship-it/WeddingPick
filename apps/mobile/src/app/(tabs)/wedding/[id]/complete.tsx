import type { ExpenseSummaryResponse, WeddingDetail, WeddingTaskListResponse } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getExpenses, getWedding, listWeddingTasks } from '@/api/client';
import {
  ActionButton,
  ErrorView,
  Layout,
  LoadingView,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

type PageData = {
  wedding: WeddingDetail;
  tasks: WeddingTaskListResponse;
  expenses: ExpenseSummaryResponse;
};

/**
 * 예식 완료. WP-OUR-013.
 *
 * 예식이 끝난 커플에게 보여주는 마무리 화면.
 * 준비 알림 중단 안내, 최종 지출 요약, 후기·제보 유도.
 */
export default function WeddingCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([getWedding(id), listWeddingTasks(id), getExpenses(id)])
      .then(([wedding, tasks, expenses]) => {
        setError(null);
        setData({ wedding, tasks, expenses });
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  if (error) return <ErrorView message={error} onBack={() => router.back()} />;
  if (!data) return <LoadingView />;

  const { wedding, tasks, expenses } = data;
  const weddingDateLabel = wedding.weddingDate
    ? new Date(wedding.weddingDate).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.hero}>
            <ThemedText type="t2">결혼 축하드려요!</ThemedText>
            {weddingDateLabel ? (
              <ThemedText type="t7" themeColor="textSecondary">
                {weddingDateLabel}의 아름다운 예식을 마쳤어요.
              </ThemedText>
            ) : null}
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t5">준비 기록</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              총 {tasks.progress.total}개 항목 중 {tasks.progress.done}개 완료
            </ThemedText>
            <ActionButton
              label="타임라인 보기"
              onPress={() => router.push(`/wedding/${id}/timeline`)}
            />
          </ThemedView>

          {expenses.paidTotal > 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t5">최종 지출</ThemedText>
              <ThemedText type="t4" numeric>
                {manwon(expenses.paidTotal)}
              </ThemedText>
              {expenses.budget.set ? (
                <ThemedText
                  type="t7"
                  themeColor={expenses.budget.over ? 'negative' : 'positive'}>
                  {expenses.budget.over
                    ? `예산보다 ${manwon(-expenses.budget.remaining)} 더 썼어요`
                    : `예산보다 ${manwon(expenses.budget.remaining)} 아꼈어요`}
                </ThemedText>
              ) : null}
              <ActionButton
                label="지출 내역 보기"
                onPress={() => router.push(`/wedding/${id}/expenses`)}
              />
            </ThemedView>
          ) : null}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t5">실제 가격, 다음 커플에게</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              두 분이 낸 실제 금액을 제보하면 비슷한 상황의 커플이 더 잘 준비할 수 있어요.
              제보된 정보는 개인정보 없이 통계로만 쓰여요.
            </ThemedText>
            <ActionButton
              variant="primary"
              label="실제 가격 제보하기"
              onPress={() => router.push('/capture')}
            />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t5">웨딩픽 알림</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              예식이 지났으니 준비 관련 알림은 더 이상 보내지 않아요.
              설정에서 언제든지 바꿀 수 있어요.
            </ThemedText>
          </ThemedView>

          <ActionButton label="웨딩일정으로" onPress={() => router.push('/wedding')} />
        </ScrollView>
      </SafeAreaView>
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
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
