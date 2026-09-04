import type { ExpenseDetail } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getExpenseDetail } from '@/api/client';
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
  useTheme,
} from '@weddingpick/ui';

/**
 * 지출 상세. WP-OUR-010. 지출내역(WP-OUR-009) 목록에서 줄을 누르면 들어온다.
 *
 * 결제인증(Pick 인증 자료)에서 온 줄과 직접 입력한 줄을 함께 다룬다. 환불
 * 상태 · 분할 결제는 직접 입력에만 있다 — 결제인증 줄은 늘 정상 · 분할 결제
 * 없음으로 고정해 보여준다(서버 계약이 그렇게 내려준다).
 */
export default function ExpenseDetailScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const theme = useTheme();
  const [detail, setDetail] = useState<ExpenseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getExpenseDetail(id, expenseId)
      .then(setDetail)
      .catch((caught: Error) => setError(caught.message));
  }, [id, expenseId]);

  useEffect(load, [load]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!detail) {
    return <LoadingView />;
  }

  const refundColor =
    detail.refundStatus === 'cancelled'
      ? 'negative'
      : detail.refundStatus === 'partial_refund'
        ? 'cautionary'
        : 'text';

  const rows: {
    label: string;
    value: string;
    numeric?: boolean;
    themeColor?: 'text' | 'negative' | 'cautionary';
  }[] = [
    { label: '상태', value: detail.statusLabel },
    { label: '낸 날짜', value: detail.spentOn ?? '아직 없어요', numeric: detail.spentOn !== null },
    { label: '등록 방법', value: detail.sourceLabel },
    { label: '등록자', value: detail.registeredByPartner ? '배우자' : '나' },
    { label: '환불 상태', value: detail.refundStatusLabel, themeColor: refundColor },
    {
      label: '등록일',
      value: new Date(detail.registeredAt).toLocaleDateString('ko-KR'),
      numeric: true,
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {detail.source === 'payment_proof' ? (
            <ThemedView style={[styles.badge, { backgroundColor: theme.tintSubtle }]}>
              <ThemedText type="badge" themeColor="tint">
                {detail.sourceLabel}
              </ThemedText>
            </ThemedView>
          ) : null}

          <View style={styles.amountBlock}>
            <ThemedText type="t7" themeColor="textSecondary">
              낸 금액
            </ThemedText>
            <ThemedText type="amount" themeColor="tint" numeric>
              {manwon(detail.amount)}
            </ThemedText>
          </View>

          <View>
            <ThemedText type="t5">{detail.label}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {detail.bucketLabel}
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            {rows.map((row, idx) => (
              <View key={row.label}>
                <View style={styles.row}>
                  <ThemedText type="t7" themeColor="textSecondary" style={styles.grow}>
                    {row.label}
                  </ThemedText>
                  <ThemedText
                    type="t6"
                    numeric={row.numeric}
                    themeColor={row.themeColor ?? 'text'}>
                    {row.value}
                  </ThemedText>
                </View>
                {idx < rows.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                )}
              </View>
            ))}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t6">나눠 낸 내역</ThemedText>
            {detail.splitPayments.length === 0 ? (
              <ThemedText type="t7" themeColor="textAssistive">
                아직 없어요
              </ThemedText>
            ) : (
              <ThemedView type="backgroundElement" style={styles.card}>
                {detail.splitPayments.map((split, idx) => (
                  <View key={split.id}>
                    <View style={styles.row}>
                      <ThemedText type="t7" themeColor="textSecondary" style={styles.grow}>
                        {split.label}
                        {split.paidOn ? ` · ${split.paidOn}` : ''}
                      </ThemedText>
                      <ThemedText type="t6" numeric>
                        {manwon(split.amount)}
                      </ThemedText>
                    </View>
                    {idx < detail.splitPayments.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    )}
                  </View>
                ))}
              </ThemedView>
            )}
          </ThemedView>

          {detail.source === 'payment_proof' ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6">이 금액은 확인된 정보에 들어가요</ThemedText>
              <ThemedText type="t7" themeColor="textSecondary">
                업체별 금액 구간에 반영되고, 누가 냈는지는 공개하지 않아요.
              </ThemedText>
            </ThemedView>
          ) : null}

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
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  amountBlock: { gap: Spacing.half },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  section: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.rowMinHeight,
    gap: Spacing.two,
  },
  grow: { flex: 1, minWidth: 0 },
  divider: { height: 1 },
});
