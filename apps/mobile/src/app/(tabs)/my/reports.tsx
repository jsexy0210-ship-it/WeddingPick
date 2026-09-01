import type { MyReport } from '@weddingpick/api-contract';
import { MY_REPORTS_EMPTY, MY_REPORTS_EMPTY_CTA, formatWeddingDate } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { listMyReports } from '@/api/client';
import { won } from '@/features/quotes/quote-result-view';

/**
 * 내 제보 내역. 디자인 핸드오프 20번.
 *
 * 종류가 행마다 붙고, **그 자료가 어디에 쓰이는지도 함께 붙는다.** 내가 낸 것이
 * 무엇에 쓰이는지 모르는 채로 쌓이면 그건 제보가 아니라 수집이다.
 */
export default function MyReportsScreen() {
  const theme = useTheme();
  const [reports, setReports] = useState<MyReport[] | null>(null);

  const load = useCallback(() => {
    void listMyReports()
      .then((response) => setReports(response.reports))
      .catch(() => setReports([]));
  }, []);

  useEffect(load, [load]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">내 제보내역</ThemedText>

          {reports !== null && reports.length === 0 ? (
            <ThemedView style={styles.empty}>
              <ThemedText type="t6" themeColor="textSecondary">
                {MY_REPORTS_EMPTY}
              </ThemedText>
              <ActionButton
                variant="primary"
                label={MY_REPORTS_EMPTY_CTA}
                onPress={() => router.push('/capture/payment/consent')}
              />
            </ThemedView>
          ) : null}

          {(reports ?? []).map((report) => (
            <ThemedView key={report.id} type="backgroundElement" style={styles.card}>
              <ThemedView type="backgroundElement" style={styles.cardHead}>
                <View style={[styles.badge, { backgroundColor: theme.tintSubtle }]}>
                  <ThemedText type="badge" themeColor="tint">
                    {report.kindLabel}
                  </ThemedText>
                </View>
                {/* 남아 있는 것과 쓰이는 것은 다르다. 다르면 다르다고 적는다. */}
                <ThemedText type="t7" themeColor="textAssistive">
                  {report.inUse
                    ? formatWeddingDate(report.reportedAt.slice(0, 10))
                    : '사용 안 함'}
                </ThemedText>
              </ThemedView>

              <ThemedText type="t5">{report.subject}</ThemedText>

              {report.amount === null ? null : (
                <ThemedText type="t5" numeric>
                  {won(report.amount)}
                </ThemedText>
              )}

              <ThemedText type="t7" themeColor="textSecondary">
                {report.note ?? report.use}
              </ThemedText>
            </ThemedView>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  empty: {
    gap: Spacing.three,
    paddingVertical: Spacing.five,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
});
