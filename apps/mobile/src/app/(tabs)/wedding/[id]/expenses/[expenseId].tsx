import type { ExpenseDetail } from '@weddingpick/api-contract';
import { TERMS, VENDOR_CATEGORY_LABEL, manwon, type VendorCategory } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getExpenseDetail, removeExpense } from '@/api/client';
import { formatDateDot, formatMonthDayDot } from '@/features/common/format-date';
import { ErrorView, Layout, Spacing, ThemedText, showAlert } from '@weddingpick/ui';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import {
  Badge,
  Band,
  KeyValueRow,
  ListRow,
  NavBar,
  NoteCard,
  RowValue,
  Screen,
  Section,
} from '@/features/wedding/screen-kit';

/**
 * 지출 상세. WP-OUR-010 · 핸드오프 12-closing #5.
 *
 *   nav      «지출 상세» · 직접 입력한 줄은 오른쪽 «삭제»
 *   hero     배지 «Pick 인증으로 확인된 내역»(제보 연계만) · 금액 32 · «업체 · 업종» 16/24
 *   6행      업체 · 카테고리 · 낸 날짜 · 상태 · 등록 방법 · 등록자 — 라벨 16/22 · 값 16/22 700
 *   밴드 → «분할 결제» 20/27 + 행(계약금 · 날짜 · 금액) — 나눠 낸 줄이 있을 때만
 *   note     제보 연계면 «이 금액은 실 제보에 들어가요»
 *
 * 환불 상태 · 분할 결제는 직접 입력에만 있다 — 제보 연계 줄은 늘 정상 · 분할 없음으로
 * 내려온다(서버 계약). 시안의 «수정»은 금액 · 날짜를 고치는 API가 없어 «삭제»로 대신한다.
 */
export default function ExpenseDetailScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const [detail, setDetail] = useState<ExpenseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getExpenseDetail(id, expenseId)
      .then(setDetail)
      .catch((caught: Error) => setError(caught.message));
  }, [id, expenseId]);

  useEffect(load, [load]);

  if (error && !detail) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!detail) {
    return <DelayedLoadingView />;
  }

  const current = detail;
  const linked = current.source === 'payment_proof';
  const scheduled = current.status === 'scheduled';
  const categoryLabel = current.category
    ? VENDOR_CATEGORY_LABEL[current.category as VendorCategory]
    : current.bucketLabel;
  const refundColor =
    current.refundStatus === 'cancelled' ? 'negative' : current.refundStatus === 'partial_refund' ? 'cautionary' : 'text';

  function remove() {
    showAlert('이 지출을 삭제할까요?', '삭제하면 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          removeExpense(id, expenseId)
            .then(() => router.back())
            .catch((caught: unknown) =>
              setError(caught instanceof Error && caught.message ? caught.message : '삭제하지 못했어요.')
            ),
      },
    ]);
  }

  return (
    <Screen>
      <NavBar title="지출 상세" right={linked ? null : { label: '삭제', onPress: remove }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* hero — padding 12 24 24 · gap 10. */}
        <View style={styles.hero}>
          {linked ? (
            <View style={styles.badgeRow}>
              <Badge label="Pick 인증으로 확인된 내역" tone="ok" />
            </View>
          ) : scheduled ? (
            <View style={styles.badgeRow}>
              <Badge label={current.statusLabel} tone="none" />
            </View>
          ) : null}
          <ThemedText type="amount" themeColor={scheduled ? 'textAssistive' : 'text'} numeric>
            {manwon(current.amount)}
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            {current.label} · {categoryLabel}
          </ThemedText>
        </View>

        <View style={styles.rows}>
          <KeyValueRow label="업체" value={current.label} />
          <KeyValueRow label="카테고리" value={categoryLabel} />
          <KeyValueRow
            label="낸 날짜"
            value={current.spentOn ? formatDateDot(current.spentOn) : '아직 없어요'}
            valueColor={current.spentOn ? 'text' : 'textAssistive'}
            numeric={current.spentOn !== null}
          />
          <KeyValueRow label="상태" value={current.refundStatusLabel} valueColor={refundColor} />
          <KeyValueRow
            label="등록 방법"
            value={`${current.sourceLabel} · ${formatMonthDayDot(current.registeredAt)}`}
            numeric
          />
          <KeyValueRow label="등록자" value={current.registeredByPartner ? TERMS.spouse : '나'} />
        </View>

        {current.splitPayments.length > 0 ? (
          <>
            <Band />
            <Section title="분할 결제" /* pick-language: 시안 WP-OUR-014 밴드 제목 «분할 결제» — 나눠 낸 줄의 이름 */>
              {current.splitPayments.map((split) => (
                <ListRow
                  key={split.id}
                  title={split.label}
                  sub={split.paidOn ? formatDateDot(split.paidOn) : '예정'}
                  subLines={1}
                  right={
                    <RowValue color={split.paidOn ? 'text' : 'textAssistive'} bold>
                      {manwon(split.amount)}
                    </RowValue>
                  }
                />
              ))}
            </Section>
          </>
        ) : null}

        {error ? (
          <ThemedText type="t7" themeColor="negative" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}

        {linked ? (
          <View style={styles.noteWrap}>
            <NoteCard
              title={`이 금액은 ${TERMS.verifiedData}에 들어가요`}
              body="업체별 금액 구간에 반영되고, 누가 냈는지는 공개하지 않아요."
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.six },
  hero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Spacing.four,
    gap: Layout.cardGap,
  },
  badgeRow: { flexDirection: 'row' },
  rows: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap, gap: Spacing.half },
  error: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.three },
  noteWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
});
