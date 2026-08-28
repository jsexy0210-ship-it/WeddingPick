import type { ComparisonResponse, Quote } from '@weddingpick/api-contract';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirmFields, getComparison, getQuote } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { AiNotice, QuoteResultView } from '@/features/quotes/quote-result-view';
import { useTheme } from '@/hooks/use-theme';

/** A-08 분석 결과 + A-07 확인 단계 + A-09 가격 비교. */
export default function ResultScreen() {
  const { quoteId } = useLocalSearchParams<{ quoteId: string }>();
  const theme = useTheme();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComparison = useCallback(async (loaded: Quote) => {
    if (!loaded.confirmedAt) return;

    try {
      setComparison(await getComparison(loaded.id));
    } catch {
      // 비교를 못 불러와도 분석 결과는 보여준다.
    }
  }, []);

  useEffect(() => {
    getQuote(quoteId)
      .then(async (loaded) => {
        setQuote(loaded);
        await loadComparison(loaded);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [quoteId, loadComparison]);

  async function confirm(paths: string[]) {
    if (busy || !quote) return;
    setBusy(true);

    try {
      const updated = await confirmFields(
        quote.id,
        paths.map((path) => ({ path, ...(edits[path] && { correctedValue: edits[path] }) }))
      );

      setQuote(updated);
      await loadComparison(updated);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">불러오지 못했습니다</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            {error}
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!quote) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ActivityIndicator color={theme.tint} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <AiNotice />
        <QuoteResultView
          quote={quote}
          comparison={comparison}
          confirm={{
            busy,
            onEdit: (path, value) => setEdits((current) => ({ ...current, [path]: value })),
            onConfirm: confirm,
          }}
          header={
            <ThemedText type="code" themeColor="textSecondary">
              A-08 · PHASE 1
            </ThemedText>
          }
        />
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
});
