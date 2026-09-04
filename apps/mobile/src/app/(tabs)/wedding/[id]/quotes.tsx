import type { Quote } from '@weddingpick/api-contract';
import { DOCUMENT_TYPE_LABEL, manwon } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listQuotes } from '@/api/client';
import {
  ActionButton,
  ErrorView,
  LoadingView,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  VerificationBadge,
} from '@weddingpick/ui';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function QuoteCard({ quote }: { quote: Quote }) {
  const vendorName = quote.vendor?.name ?? quote.planner?.name ?? '업체 미상';
  const docLabel = DOCUMENT_TYPE_LABEL[quote.docType];

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedView style={styles.cardHead}>
        <ThemedText type="t5">{vendorName}</ThemedText>
        <VerificationBadge level={quote.verificationLevel} />
      </ThemedView>

      <ThemedText type="t7" themeColor="textSecondary">
        {docLabel}
        {quote.productName ? ` · ${quote.productName}` : ''}
      </ThemedText>

      {quote.totalAmount != null ? (
        <ThemedText type="t4" numeric>
          {manwon(quote.totalAmount)}
        </ThemedText>
      ) : (
        <ThemedText type="t7" themeColor="textAssistive">금액 미확인</ThemedText>
      )}

      {quote.contractDate ? (
        <ThemedText type="t7" themeColor="textAssistive">
          계약일: {quote.contractDate}
        </ThemedText>
      ) : null}

      <ThemedText type="t7" themeColor="textAssistive">
        등록일: {formatDate(quote.createdAt)}
        {quote.confirmedAt ? null : ' · 확인 전'}
      </ThemedText>

      <ActionButton
        label="결과 보기"
        onPress={() => router.push(`/capture/result/${quote.id}`)}
      />
    </ThemedView>
  );
}

/**
 * 내 웨딩에 올린 견적·계약서 목록.
 *
 * 서버가 AI로 읽어낸 견적이 여기 모인다. 확인 전·후 무관하게 보인다.
 */
export default function WeddingQuotesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    void listQuotes(id)
      .then((res) => {
        setQuotes(res.quotes);
        setNextCursor(res.nextCursor);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : '불러오지 못했어요.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  async function loadMore() {
    if (!nextCursor) return;
    try {
      const res = await listQuotes(id, nextCursor);
      setQuotes((prev) => [...prev, ...res.quotes]);
      setNextCursor(res.nextCursor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '더 불러오지 못했어요.');
    }
  }

  if (loading) return <LoadingView />;

  if (error && quotes.length === 0) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="t2">올린 Pick 인증 자료</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              앱으로 올린 문서를 웨딩픽이 읽어낸 결과예요. 확인 전 자료는 가격 비교에 쓰이지 않아요.
            </ThemedText>
          </ThemedView>

          {quotes.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">
                아직 올린 문서가 없어요. 촬영·업로드 탭에서 Pick 인증 자료를 올려보세요.
              </ThemedText>
            </ThemedView>
          ) : (
            quotes.map((q) => <QuoteCard key={q.id} quote={q} />)
          )}

          {error ? (
            <ThemedText type="t7" themeColor="cautionary">{error}</ThemedText>
          ) : null}

          {nextCursor ? (
            <ActionButton label="더 보기" onPress={() => void loadMore()} />
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  section: { gap: Spacing.one, marginBottom: Spacing.two },
  card: { borderRadius: Radius.medium, padding: Spacing.four, gap: Spacing.two },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
