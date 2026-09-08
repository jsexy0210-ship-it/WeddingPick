import type { ComparisonResponse, Quote } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirmFields, getComparison, getQuote } from '@/api/client';
import { ActionButton, ErrorView, MaxContentWidth, Spacing, ThemedView } from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { AnalysisNotice, QuoteResultView } from '@/features/quotes/quote-result-view';

/** A-08 분석 결과 + A-07 확인 단계 + A-09 가격 비교. */
export default function ResultScreen() {
  const { quoteId } = useLocalSearchParams<{ quoteId: string }>();
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
    return <ErrorView message={error} />;
  }

  if (!quote) {
    return <DelayedLoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <AnalysisNotice />
        <QuoteResultView
          quote={quote}
          comparison={comparison}
          confirm={{
            busy,
            onEdit: (path, value) => setEdits((current) => ({ ...current, [path]: value })),
            onConfirm: confirm,
          }}
          footer={
            <ThemedView style={styles.actions}>
              {/*
               * 확인 단계를 지나야 신청할 수 있다. 서버도 같은 것을 막지만, 누를 수 없는
               * 버튼을 두고 눌러야 이유를 알려주는 것보다 이유를 먼저 보여주는 편이 낫다.
               */}
              <ActionButton
                variant={quote.confirmedAt ? 'primary' : 'secondary'}
                label="자료 확인 신청"
                hint={
                  quote.confirmedAt
                    ? '확인을 마친 자료만 다른 분들의 가격 비교에 쓰여요'
                    : '금액과 계약일을 확인하면 신청할 수 있어요'
                }
                disabled={!quote.confirmedAt}
                onPress={() => router.push(`/capture/verify/${quote.id}`)}
              />
              {/* 원본이 우선한다고 해놓고 고칠 곳이 없으면 말뿐이다. */}
              <ActionButton
                label="원본과 달라요"
                hint="정리된 내용이 문서와 다르면 알려주세요"
                onPress={() =>
                  router.push({
                    pathname: '/my/contact',
                    params: {
                      category: 'analysis_error',
                      subjectKind: 'quote',
                      subjectId: quote.id,
                      subjectName: quote.vendor?.name ?? '분석 결과',
                    },
                  })
                }
              />
            </ThemedView>
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
  actions: {
    gap: Spacing.two,
  },
});
