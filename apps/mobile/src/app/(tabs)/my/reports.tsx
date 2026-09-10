import type { MyReport } from '@weddingpick/api-contract';
import { MY_REPORTS_EMPTY, MY_REPORTS_EMPTY_CTA, formatDateDot } from '@weddingpick/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ActionButton,
  ErrorView,
  Layout,
  Radius,
  Spacing,
  ThemedText,
  Toast,
  useTheme,
} from '@weddingpick/ui';
import { deleteReview, listMyReports } from '@/api/client';
import { confirmAlert } from '@/components/confirm-alert';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { won } from '@/features/quotes/quote-result-view';
import { Badge, Dock, EmptyBox, Hero, Section, SubScreen } from '@/features/settings/my-kit';

/** 시안 11-report-review 12c WP-RPT-009. */
const S = {
  title: '내 제보 내역',
  hero: (total: number, used: number) => [`${total}건 제보했고`, `${used}건이 반영됐어요`],
  heroEmpty: ['아직 제보한 것이', '없어요'],
  inUse: '반영됨',
  notInUse: '반영 전',
  review: '후기',
  deleteReview: '후기 지우기',
  deleteTitle: '후기를 지울까요',
  deleteBody: (vendor: string) => `${vendor}에 쓴 후기가 지워져요. 다시 되돌릴 수 없어요.`,
  keep: '그대로 둘게요',
  remove: '지우기',
  removeFail: '지우지 못했어요',
} as const;

/**
 * 내 제보 내역 · WP-RPT-009. 카드마다 상태 배지 + 날짜 · 업체명 ↔ 금액 · 사유. 행동 버튼은 할 일이
 * 남은 카드에만 둔다(rule «보완 필요에만 행동 버튼») — 지금은 후기 지우기가 그 자리다.
 *
 * **남아 있는 것과 쓰이는 것은 다르다.** 업체를 못 찾은 Pick 인증처럼 남아 있지만 쓰이지 않는 것은
 * «반영 전»으로 적고 서버가 보낸 사유를 붙인다.
 */
export default function MyReportsScreen() {
  const theme = useTheme();
  const [reports, setReports] = useState<MyReport[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadVersion = useRef(0);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    const version = ++loadVersion.current;
    void listMyReports()
      .then((response) => {
        if (version !== loadVersion.current) return;
        setLoadError(null);
        setReports(response.reports);
      })
      .catch((caught: Error) => {
        if (version === loadVersion.current) setLoadError(caught.message ?? '제보 내역을 불러오지 못했어요');
      });
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    return () => { loadVersion.current += 1; };
  }, [load]));

  if (loadError) return <ErrorView message={loadError} onRetry={load} />;
  if (reports === null) return <DelayedLoadingView />;

  function confirmDelete(reviewId: string, vendor: string) {
    confirmAlert(S.deleteTitle, S.deleteBody(vendor), [
      { text: S.keep, style: 'cancel' },
      {
        text: S.remove,
        style: 'destructive',
        onPress: () => {
          void deleteReview(reviewId)
            .then(load)
            .catch(() => setToast(S.removeFail));
        },
      },
    ]);
  }

  const used = reports.filter((report) => report.inUse).length;
  const empty = reports.length === 0;

  return (
    <SubScreen
      title={S.title}
      dock={
        empty ? (
          <Dock primary={{ label: MY_REPORTS_EMPTY_CTA, onPress: () => router.push('/capture/payment/consent') }} />
        ) : undefined
      }>
      <Hero lines={empty ? S.heroEmpty : S.hero(reports.length, used)} />

      <Section gap="events">
        {empty ? (
          <EmptyBox>{MY_REPORTS_EMPTY}</EmptyBox>
        ) : (
          <View style={styles.list}>
            {reports.map((report) => (
              <View key={report.id} style={[styles.card, { borderColor: theme.track }]}>
                <View style={styles.cardHead}>
                  <Badge kind={report.kind === 'review' ? 'none' : report.inUse ? 'ok' : 'wait'}>
                    {report.kind === 'review' ? S.review : report.inUse ? S.inUse : S.notInUse}
                  </Badge>
                  <ThemedText type="t7" themeColor="textAssistive" numeric>
                    {formatDateDot(report.reportedAt.slice(0, 10))}
                  </ThemedText>
                </View>
                <View style={styles.nameRow}>
                  <ThemedText type="t5" numberOfLines={1} style={styles.name}>
                    {report.subject}
                  </ThemedText>
                  {report.amount === null ? null : (
                    <ThemedText type="t6" numeric numberOfLines={1} style={styles.amount}>
                      {won(report.amount)}
                    </ThemedText>
                  )}
                </View>
                <ThemedText type="t7" themeColor="textSecondary">
                  {report.note ?? report.use}
                </ThemedText>
                {/* 후기는 한 사람이 한 업체에 하나다. 지우는 길이 없으면 다시 쓸 수도 없다. */}
                {report.kind === 'review' ? (
                  <View style={styles.action}>
                    <ActionButton
                      variant="ghost"
                      size="medium"
                      label={S.deleteReview}
                      onPress={() => confirmDelete(report.id, report.subject)}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Section>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Layout.rowPaddingY },
  /* 카드 radius 10 · 1 gray300 · 18 20 · gap 10 */
  card: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: Layout.cardPadding - Spacing.half,
    gap: Layout.cardGap,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Layout.rowPaddingY },
  name: { flex: 1, minWidth: 0 },
  amount: { fontWeight: '700' },
  action: { alignSelf: 'flex-start' },
});
