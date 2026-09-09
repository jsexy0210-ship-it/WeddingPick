import type { DecisionListResponse } from '@weddingpick/api-contract';
import { TERMS, manwon } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { listDecisions } from '@/api/client';
import { formatDateDot, formatMonthDayDot } from '@/features/common/format-date';
import { ActionButton, ErrorView, Layout, ProductSymbol, SkeletonView, Spacing, useTheme } from '@weddingpick/ui';
import { Badge, Hero, ListRow, NavBar, RowValue, Screen, Section } from '@/features/wedding/screen-kit';

/** `spec/strings.ko.json` `ourWedding.decided.*`. */
const S = {
  title: '결정한 업체',
  events: '관련 일정',
  eventsEmpty: '관련 일정이 없어요',
  expenses: '관련 지출',
  expensesEmpty: '등록된 지출이 없어요',
  memo: '메모',
  memoCta: '메모 남기기',
  decidedByPartner: `${TERMS.spouse}가 정했어요`,
} as const;

/**
 * 결정한 업체. WP-OUR-003. 업종별 결정 업체 + 결정정보 + 관련 일정 + 관련 지출 + 메모.
 *
 *   nav     «결정한 업체»
 *   hero    «N곳을 정했어요»
 *   업종별 그룹  업체명 18/24 700 + «지역 · 결정일» + «결정» 배지 · 관련 일정 · 관련 지출 · 메모 남기기
 *
 * 관련 지출은 업체가 아니라 **업종**으로 묶는다 — 지출 표에는 업체 연결이 없다(서버 주석).
 * 그래서 두 곳을 같은 업종으로 결정했다면 금액은 둘을 가르지 못한다 — 그대로 둔다.
 */
export default function DecidedVendorsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [page, setPage] = useState<DecisionListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listDecisions(id)
      .then(setPage)
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useEffect(load, [load]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!page) {
    return <SkeletonView />;
  }

  const count = page.decisions.length;

  return (
    <Screen>
      <NavBar title={S.title} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero
          title={count > 0 ? `${count}곳을 정했어요` : '아직 정한 곳이 없어요'}
          sub={count > 0 ? null : '업종마다 마음에 드는 곳을 정하면 여기 모여요'}
        />

        {count === 0 ? (
          <View style={styles.emptyAction}>
            <ActionButton variant="ghost" size="large" label="Pick 보러 가기" onPress={() => router.push('/pick' as never)} />
          </View>
        ) : (
          page.decisions.map((decision) => {
            const paid = decision.expenses.paidCount > 0;
            const scheduled = decision.expenses.scheduledCount > 0;

            return (
              <Section key={decision.category} label={decision.categoryLabel}>
                <ListRow
                  title={decision.vendor.name}
                  titleBold
                  sub={`${decision.vendor.region} · ${formatDateDot(decision.decidedAt)}${
                    decision.decidedByPartner ? ` · ${S.decidedByPartner}` : ''
                  }`}
                  subLines={1}
                  right={<Badge label="결정" tone="ok" />}
                />
                {decision.events.length > 0 ? (
                  decision.events.map((event) => (
                    <ListRow
                      key={event.id}
                      title={event.title}
                      sub={S.events}
                      subLines={1}
                      right={<RowValue>{formatMonthDayDot(event.startsAt)}</RowValue>}
                      onPress={() => router.push(`/wedding/${id}/events/${event.id}` as never)}
                    />
                  ))
                ) : (
                  <ListRow title={S.events} right={<RowValue numeric={false}>{S.eventsEmpty}</RowValue>} />
                )}
                <ListRow
                  title={S.expenses}
                  sub={
                    paid
                      ? `${decision.expenses.paidCount}건${scheduled ? ` · 낼 금액 ${manwon(decision.expenses.scheduledTotal)}` : ''}`
                      : null
                  }
                  subLines={1}
                  right={
                    <RowValue color={paid ? 'text' : 'textAssistive'} bold={paid} numeric={paid}>
                      {paid ? manwon(decision.expenses.paidTotal) : S.expensesEmpty}
                    </RowValue>
                  }
                  onPress={() => router.push(`/wedding/${id}/expenses` as never)}
                />
                <ListRow
                  title={S.memoCta}
                  titleColor="tint"
                  titleBold
                  right={<ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />}
                  onPress={() =>
                    router.push(
                      `/wedding/${id}/notes?vendorId=${decision.vendor.id}&vendorLabel=${encodeURIComponent(decision.vendor.name)}` as never
                    )
                  }
                />
              </Section>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.two },
  emptyAction: { paddingHorizontal: Layout.gutter },
});
