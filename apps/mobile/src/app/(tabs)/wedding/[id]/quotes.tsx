import type { Quote } from '@weddingpick/api-contract';
import { DOCUMENT_TYPE_LABEL, manwon } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import strings from '../../../../../../../spec/strings.ko.json';
import { listQuotes } from '@/api/client';
import { formatDateDot } from '@/features/common/format-date';
import { BackBar } from '@/components/back-bar';
import {
  ActionButton,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  SkeletonView,
  Spacing,
  ThemedText,
  ThemedView,
  VerificationBadge,
} from '@weddingpick/ui';


function QuoteCard({ quote }: { quote: Quote }) {
  const vendorName = quote.vendor?.name ?? quote.planner?.name ?? '업체 미상';
  const docLabel = DOCUMENT_TYPE_LABEL[quote.docType];

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHead}>
        <ThemedText type="t5">{vendorName}</ThemedText>
        <VerificationBadge level={quote.verificationLevel} />
      </View>

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
        등록일: {formatDateDot(quote.createdAt)}
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
 * 내 웨딩에 올린 문서를 읽어낸 결과 목록.
 *
 * 서버가 AI로 읽어낸 견적·계약서가 여기 모인다. 확인 전·후 무관하게 보인다.
 *
 * 화면 상단은 **Pick 인증이 아니다.** `Pick 인증 자료`는 결제를 증명하는 자료
 * 한 종류(`VERIFICATION_EVIDENCE_RULES.payment_receipt`)의 이름이고, 여기 모이는
 * 것은 `DOCUMENT_TYPE_LABEL` 여덟 단계 전부를 읽어낸 결과다. 둘을 같은 말로
 * 적으면 사용자가 무엇을 보고 있는지 알 수 없다(journey-open-03).
 */
export default function WeddingQuotesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  /** 지금 이어받는 중인 커서. 같은 것을 두 번 붙이지 않으려고 든다. */
  const loadingCursor = useRef<string | null>(null);
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

  /* 같은 커서를 두 번 이어붙이지 않는다 — 연달아 누르면 같은 견적이 두 번 보인다. */
  async function loadMore() {
    if (!nextCursor || loadingCursor.current === nextCursor) return;

    const cursor = nextCursor;

    loadingCursor.current = cursor;

    try {
      const res = await listQuotes(id, cursor);

      setQuotes((prev) => [...prev, ...res.quotes]);
      setNextCursor(res.nextCursor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '더 불러오지 못했어요.');
    } finally {
      loadingCursor.current = null;
    }
  }

  if (loading) return <SkeletonView />;

  if (error && quotes.length === 0) {
    return <ErrorView message={error} onBack={() => router.back()} onRetry={load} />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="t2">{strings.journey.documentListTitle}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {strings.journey.documentListBody}
            </ThemedText>
          </ThemedView>

          {quotes.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">
                {strings.journey.documentEmpty}
              </ThemedText>
              <ActionButton
                label={strings.journey.uploadDocument}
                onPress={() => router.push('/capture/quote/consent')}
              />
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
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  section: { gap: Spacing.one, marginBottom: Spacing.two },
  card: { borderRadius: Radius.medium, padding: Layout.cardPadding, gap: Spacing.two },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
