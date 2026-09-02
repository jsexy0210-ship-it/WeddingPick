import type { PlannerDetail } from '@weddingpick/api-contract';
import { DOCUMENT_TYPE_LABEL } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPlanner } from '@/api/client';
import { ActionButton, ErrorView, LoadingView, MaxContentWidth, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';
import { won } from '@/features/quotes/quote-result-view';

/**
 * 플래너 상세.
 *
 * 플래너는 개인이다. 그래서 화면에 두 가지를 늘 함께 둔다 — 왜 이 사람이 검색에
 * 나오는지, 그리고 원하지 않을 때 어떻게 하는지. 둘 다 서버가 문장으로 내려준다.
 *
 * 별점도 후기도 없다. 사업계획서 11번이 플래너를 독립 비교대상으로 본 이유는 실제
 * 계약 자료로 견주기 위해서지, 사람에게 점수를 매기기 위해서가 아니다.
 */
export default function PlannerDetailScreen() {
  const { plannerId } = useLocalSearchParams<{ plannerId: string }>();
  const [planner, setPlanner] = useState<PlannerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlanner(plannerId)
      .then(setPlanner)
      .catch((caught: Error) => setError(caught.message));
  }, [plannerId]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!planner) {
    return <LoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">{planner.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {/* 프리랜서면 소속이 없다. 없는 것을 빈칸으로 두지 않고 그렇다고 적는다. */}
              {[planner.vendor?.name ?? '프리랜서', planner.regions.join(' · ')]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">
              {planner.listingBasis}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {planner.withdrawalNotice}
            </ThemedText>
            {/* 안내만 하고 받을 곳이 없으면 지키지 않을 약속이다. */}
            <ActionButton
              label="검색에서 내려주세요"
              onPress={() =>
                router.push({
                  pathname: '/my/contact',
                  params: {
                    category: 'planner_delisting',
                    subjectKind: 'planner',
                    subjectId: planner.id,
                    subjectName: planner.name,
                  },
                })
              }
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">이 플래너를 통한 실제 계약</ThemedText>

            {planner.products.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  {planner.comparableQuoteCount === 0
                    ? '확인된 계약 자료가 아직 없어요.'
                    : `확인된 계약이 ${planner.comparableQuoteCount}건 모였지만, 같은 상품끼리 견주기에는 아직 모자라요.`}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  자료가 모이기 전에는 가격을 지어내지 않아요.
                </ThemedText>
              </ThemedView>
            ) : (
              planner.products.map((product) => (
                <ThemedView
                  key={`${product.productLabel}-${product.docType}`}
                  type="backgroundElement"
                  style={styles.card}>
                  <ThemedText type="smallBold">{product.productLabel}</ThemedText>
                  <ThemedText type="subtitle">{won(product.stat.median)}</ThemedText>
                  {/* 사업계획서 9번: 표본 수와 기준 기간을 늘 함께 보인다. */}
                  <ThemedText type="small" themeColor="textSecondary">
                    {DOCUMENT_TYPE_LABEL[product.docType]} · 확인된 계약{' '}
                    {product.stat.sampleCount}건 · {product.stat.periodStart}~
                    {product.stat.periodEnd}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    가운데 절반이 {won(product.stat.p25)}~{won(product.stat.p75)} 사이예요
                  </ThemedText>
                </ThemedView>
              ))
            )}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ActionButton
              variant="primary"
              label="내 금액과 비교하기"
              hint="자료를 올리면 Pick 가격대와 견줘 보여드려요"
              onPress={() => router.push('/capture')}
            />
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </ThemedView>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
