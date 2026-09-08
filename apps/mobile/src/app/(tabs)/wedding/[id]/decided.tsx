import type { DecisionListResponse } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listDecisions } from '@/api/client';
import { formatDateDot, formatMonthDayDot } from '@/features/common/format-date';
import {
  ActionButton,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
  SkeletonView,
} from '@weddingpick/ui';

/**
 * 결정한 업체. WP-OUR-003. `wedding/index.tsx`의 준비현황에서 들어온다.
 *
 * 업종별로 결정한 곳 하나씩과 결정정보 · 관련 일정 · 관련 지출 · 메모 진입을
 * 묶어 보여준다. 관련 지출은 업체가 아니라 **업종**으로 묶는다 — 지출 표에는
 * 업체 연결이 없다(서버 주석 참고). 그래서 두 곳을 같은 업종으로 결정했다면
 * 지출 금액은 둘을 가르지 못한다 — 발견한 한계라 지어내지 않고 그대로 둔다.
 */
export default function DecidedVendorsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [page, setPage] = useState<DecisionListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listDecisions(id)
      .then(setPage)
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useEffect(load, [load]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!page) {
    return <SkeletonView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">결정한 업체</ThemedText>

          {page.decisions.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t5">아직 결정한 곳이 없어요</ThemedText>
              <ThemedText type="t7" themeColor="textSecondary">
                업종마다 마음에 드는 곳을 정하면 여기 모여요
              </ThemedText>
            </ThemedView>
          ) : (
            page.decisions.map((decision) => {
              const hasEvents = decision.events.length > 0;
              const hasExpenses =
                decision.expenses.paidCount > 0 || decision.expenses.scheduledCount > 0;

              return (
                <ThemedView
                  key={decision.category}
                  type="backgroundElement"
                  style={styles.card}>
                  {/* 결정정보 */}
                  <View style={styles.cardHead}>
                    <ThemedText type="badge" themeColor="tint">
                      {decision.categoryLabel}
                    </ThemedText>
                  </View>
                  <ThemedText type="t5">{decision.vendor.name}</ThemedText>
                  <ThemedText type="t7" themeColor="textSecondary">
                    {decision.vendor.region} ·{' '}
                    {formatDateDot(decision.decidedAt)}에 정했어요
                    {decision.decidedByPartner ? ' · 배우자가 정했어요' : ''}
                  </ThemedText>

                  <View style={[styles.divider, { backgroundColor: theme.border }]} />

                  {/* 관련 일정 */}
                  <ThemedText type="t6">관련 일정</ThemedText>
                  {hasEvents ? (
                    <View style={styles.list}>
                      {decision.events.map((event) => {
                        return (
                          <View key={event.id} style={styles.listRow}>
                            <ThemedText type="t7" numberOfLines={1} style={styles.grow}>
                              {event.title}
                            </ThemedText>
                            <ThemedText type="t7" themeColor="textAssistive" numeric>
                              {formatMonthDayDot(event.startsAt)}
                            </ThemedText>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <ThemedText type="t7" themeColor="textAssistive">
                      관련 일정이 없어요
                    </ThemedText>
                  )}

                  <View style={[styles.divider, { backgroundColor: theme.border }]} />

                  {/* 관련 지출 */}
                  <ThemedText type="t6">관련 지출</ThemedText>
                  {hasExpenses ? (
                    <View style={styles.list}>
                      <View style={styles.listRow}>
                        <ThemedText type="t7" themeColor="textSecondary" style={styles.grow}>
                          낸 금액 · {decision.expenses.paidCount}건
                        </ThemedText>
                        <ThemedText type="t7" numeric>
                          {manwon(decision.expenses.paidTotal)}
                        </ThemedText>
                      </View>
                      {decision.expenses.scheduledCount > 0 ? (
                        <View style={styles.listRow}>
                          <ThemedText
                            type="t7"
                            themeColor="textAssistive"
                            style={styles.grow}>
                            낼 금액 · {decision.expenses.scheduledCount}건
                          </ThemedText>
                          <ThemedText type="t7" themeColor="textAssistive" numeric>
                            {manwon(decision.expenses.scheduledTotal)}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <ThemedText type="t7" themeColor="textAssistive">
                      등록된 지출이 없어요
                    </ThemedText>
                  )}

                  <ActionButton
                    label="메모 남기기"
                    onPress={() =>
                      router.push(
                        `/wedding/${id}/notes?vendorId=${decision.vendor.id}&vendorLabel=${encodeURIComponent(decision.vendor.name)}` as never
                      )
                    }
                  />
                </ThemedView>
              );
            })
          )}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
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
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: 1, marginVertical: Spacing.one },
  list: { gap: Spacing.half },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grow: { flex: 1, minWidth: 0 },
});
