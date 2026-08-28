import type { ComparisonResponse, Quote } from '@weddingpick/api-contract';
import { PRICE_JUDGEMENT_LABEL } from '@weddingpick/domain';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirmFields, getComparison, getQuote } from '@/api/client';
import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerificationBadge } from '@/components/verification-badge';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const FIELD_LABEL: Record<string, string> = {
  totalAmount: '계약금액',
  contractDate: '계약일',
  refundTerms: '환불조건',
  vendorName: '업체',
  plannerName: '플래너',
  productName: '상품',
  discountAmount: '할인',
};

const KIND_LABEL = {
  included: '포함',
  excluded: '별도',
  additional_candidate: '추가 가능',
} as const;

const UNAVAILABLE_MESSAGE = {
  not_enough_samples: '아직 비교할 만큼 인증된 계약이 모이지 않았습니다.',
  vendor_unknown: '어느 업체인지 확정되지 않아 비교할 수 없습니다.',
  product_unknown: '어떤 상품과 견줄지 정할 수 없습니다.',
  amount_unconfirmed: '금액을 확인하면 비교할 수 있습니다.',
} as const;

const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;

/**
 * A-08 분석 결과 + A-07 확인 단계 + A-09 가격 비교.
 *
 * 서비스정책서 1번을 화면이 그대로 따른다 — 상단 고지 고정, 신뢰도 낮은 항목을 숨기지
 * 않고 "확인 필요"로 드러내기, 핵심 필드는 확인 전까지 비교에 쓰지 않기.
 */
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

  const pending = (quote?.extractionFields ?? []).filter(
    (field) => field.requiresConfirmation && !field.confirmedByUser
  );

  async function confirm(paths: string[]) {
    if (busy || !quote) return;
    setBusy(true);

    try {
      const updated = await confirmFields(
        quote.id,
        paths.map((path) => ({
          path,
          ...(edits[path] && { correctedValue: edits[path] }),
        }))
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
        {/* 서비스정책서 1번: 결과 화면 상단에 고정한다. */}
        <ThemedView type="backgroundElement" style={styles.notice}>
          <ThemedText type="small" themeColor="textSecondary">
            AI 분석 결과이며 법적 효력이 없습니다. 원본 문서와 다를 경우 원본이 우선합니다.
          </ThemedText>
        </ThemedView>

        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="code" themeColor="textSecondary">
              A-08 · PHASE 1
            </ThemedText>
            <ThemedText type="subtitle">{quote.vendor?.name ?? '업체 미확인'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[quote.productName, quote.contractDate].filter(Boolean).join(' · ') || '—'}
            </ThemedText>
            <VerificationBadge level={quote.verificationLevel} />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">
              계약금액
            </ThemedText>
            <ThemedText type="subtitle">
              {quote.totalAmount === null ? '읽지 못함' : won(quote.totalAmount)}
            </ThemedText>
          </ThemedView>

          {pending.length > 0 ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">확인이 필요합니다</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                이 항목들은 확인하기 전까지 비교에 쓰이지 않습니다.
              </ThemedText>

              {pending.map((field) => (
                <ThemedView key={field.path} type="backgroundElement" style={styles.card}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {FIELD_LABEL[field.path] ?? field.path} · 확인 필요
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    defaultValue={field.correctedValue ?? field.value}
                    onChangeText={(text) => setEdits((current) => ({ ...current, [field.path]: text }))}
                    multiline={field.path === 'refundTerms'}
                  />
                  <ActionButton
                    label="이 값이 맞아요"
                    disabled={busy}
                    onPress={() => confirm([field.path])}
                  />
                </ThemedView>
              ))}

              <ActionButton
                variant="primary"
                label={busy ? '확인 중…' : '전부 맞아요'}
                disabled={busy}
                onPress={() => confirm(pending.map((field) => field.path))}
              />
            </ThemedView>
          ) : null}

          {comparison ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">실제 계약과 비교</ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                {comparison.available ? (
                  <>
                    <ThemedText type="subtitle">
                      {PRICE_JUDGEMENT_LABEL[comparison.judgement]}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      내 견적 {won(comparison.myAmount)} · 실제 계약 중앙값{' '}
                      {won(comparison.stat.median)}
                    </ThemedText>
                    {/* 사업계획서 9번: 표본 수와 기준 기간을 늘 함께 보인다. */}
                    <ThemedText type="small" themeColor="textSecondary">
                      인증된 계약 {comparison.stat.sampleCount}건 · {comparison.stat.periodStart}~
                      {comparison.stat.periodEnd}
                    </ThemedText>
                  </>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    {UNAVAILABLE_MESSAGE[comparison.reason]}
                  </ThemedText>
                )}
              </ThemedView>
            </ThemedView>
          ) : null}

          {quote.lineItems.length > 0 ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">항목</ThemedText>
              {quote.lineItems.map((item) => (
                <ThemedView key={item.id} type="backgroundElement" style={styles.row}>
                  <ThemedText type="small">{item.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {KIND_LABEL[item.kind]}
                    {item.amount === null ? '' : ` · ${won(item.amount)}`}
                  </ThemedText>
                </ThemedView>
              ))}
            </ThemedView>
          ) : null}

          {quote.terms.length > 0 ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">계약조건</ThemedText>
              {quote.terms.map((term) => (
                <ThemedView key={term.id} type="backgroundElement" style={styles.card}>
                  <ThemedText type="small" themeColor={term.flagged ? 'text' : 'textSecondary'}>
                    {term.flagged ? '⚠ ' : ''}
                    {term.body}
                  </ThemedText>
                </ThemedView>
              ))}
            </ThemedView>
          ) : null}
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  notice: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
});
