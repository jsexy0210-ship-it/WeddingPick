import type { WeddingDetail } from '@weddingpick/api-contract';
import { isBeforeWedding, lifecycle, manwon } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getExpenses, getWedding, listCandidates } from '@/api/client';
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

type DecidedVendor = { vendorId: string; vendorName: string; categoryLabel: string };

/**
 * 예식 완료. 핸드오프 IA WP-OUR-013.
 *
 * **예식일이 아직 안 지났으면 정리할 것이 없다.** `lifecycle()`이 이미
 * `newlywed`/`married_life`/`beyond`로 예식 뒤를 구분해 두고 있어서, 그 값을
 * 그대로 문지기로 쓴다 — 이 화면만의 별도 판정을 새로 만들지 않는다.
 *
 * **알림을 여기서 끄지 않는다.** 푸시를 실제로 보내는 쪽은 서버라, 이 화면이
 * 스위치를 흉내 내면 화면과 실제 동작이 갈라질 수 있다. 예식 뒤에는 준비
 * 알림을 그만 보낸다는 안내만 적는다.
 */
export default function WeddingCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [wedding, setWedding] = useState<WeddingDetail | null>(null);
  const [unreported, setUnreported] = useState<
    readonly { id: string; label: string; amount: number }[] | null
  >(null);
  const [paidTotal, setPaidTotal] = useState<number | null>(null);
  const [decided, setDecided] = useState<readonly DecidedVendor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([getWedding(id), getExpenses(id), listCandidates(id)])
      .then(([weddingDetail, expenses, candidates]) => {
        setWedding(weddingDetail);
        setPaidTotal(expenses.paidTotal);
        setUnreported(
          expenses.expenses
            .filter((expense) => expense.status === 'paid' && expense.source === 'manual')
            .map((expense) => ({ id: expense.id, label: expense.label, amount: expense.amount }))
        );
        setDecided(
          candidates.groups.flatMap((group) => {
            const vendor = group.candidates.find(
              (candidate) => candidate.vendorId === group.decidedVendorId
            );

            return vendor
              ? [{ vendorId: vendor.vendorId, vendorName: vendor.vendorName, categoryLabel: group.categoryLabel }]
              : [];
          })
        );
      })
      .catch((caught: Error) => setError(caught.message || '불러오지 못했어요.'));
  }, [id]);

  useEffect(load, [load]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (wedding === null || unreported === null || paidTotal === null || decided === null) {
    return <LoadingView />;
  }

  const view = lifecycle(wedding.weddingDate);

  if (wedding.weddingDate === null || isBeforeWedding(view.stage) || view.stage === 'wedding_day') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="t2">예식 완료</ThemedText>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">
                예식을 마치시면 여기서 지출을 정리하고 후기를 남길 수 있어요. 지금은
                {wedding.weddingDate === null ? ' 예식일이 등록돼 있지 않아요.' : ` ${view.note}.`}
              </ThemedText>
            </ThemedView>
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="t2">{view.mood}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {view.note}. 이제부터 준비 알림 대신 지난 기록을 보여드려요
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t7" themeColor="textSecondary">
              총 지출
            </ThemedText>
            <ThemedText type="t2" numeric>
              {manwon(paidTotal)}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t4">최종 후기</ThemedText>
            {decided.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="t7" themeColor="textSecondary">
                  결정한 업체가 없어요.
                </ThemedText>
              </ThemedView>
            ) : (
              decided.map((vendor) => (
                <ThemedView key={vendor.vendorId} type="backgroundElement" style={styles.row}>
                  <ThemedView style={styles.rowText}>
                    <ThemedText type="t5">{vendor.vendorName}</ThemedText>
                    <ThemedText type="t7" themeColor="textSecondary">
                      {vendor.categoryLabel}
                    </ThemedText>
                  </ThemedView>
                  <ActionButton
                    label="후기 쓰기"
                    onPress={() => router.push(`/search/${vendor.vendorId}/write-review`)}
                  />
                </ThemedView>
              ))
            )}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="t4">미제보 결제내역</ThemedText>
            {unreported.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="t7" themeColor="textSecondary">
                  직접 적어둔 지출이 모두 확인됐어요.
                </ThemedText>
              </ThemedView>
            ) : (
              <>
                <ThemedText type="t7" themeColor="textSecondary">
                  Pick 인증 없이 직접 적어둔 지출이에요. 자료가 있으면 제보해 확인받을 수
                  있어요.
                </ThemedText>
                {unreported.map((expense) => (
                  <ThemedView key={expense.id} type="backgroundElement" style={styles.row}>
                    <ThemedView style={styles.rowText}>
                      <ThemedText type="t5">{expense.label}</ThemedText>
                    </ThemedView>
                    <ThemedText type="t5" numeric>
                      {manwon(expense.amount)}
                    </ThemedText>
                  </ThemedView>
                ))}
                <ActionButton
                  variant="primary"
                  label="제보하기"
                  onPress={() => router.push('/capture')}
                />
              </>
            )}
          </ThemedView>

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
  section: { gap: Spacing.two },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    minHeight: Layout.rowMinHeight,
  },
  rowText: { flex: 1, gap: Spacing.half },
});
