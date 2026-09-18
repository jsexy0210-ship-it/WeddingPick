import type { MyReport } from '@weddingpick/api-contract';
import { formatCount, formatDateDot } from '@weddingpick/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorView, Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import { listMyReports } from '@/api/client';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { won } from '@/features/quotes/quote-result-view';
import { Badge, Dock, EmptyBox, Hero, Section, SubScreen } from '@/features/settings/my-kit';

const S = {
  title: 'Pick 인증내역',
  newProof: '새로 인증하기',
  empty: '아직 Pick 인증내역이 없어요',
  emptyCta: '첫 Pick 인증하기',
  hero: (total: number, used: number) => [`${formatCount(total)}건 인증했고`, `${formatCount(used)}건이 반영됐어요`],
  heroEmpty: ['아직 Pick 인증한 것이', '없어요'],
  inUse: '반영됨',
  checking: '확인 중',
  needsCheck: '보완 필요',
} as const;

function badgeKind(report: MyReport): 'none' | 'ok' | 'wait' {
  return report.inUse ? 'ok' : report.needsCheck ? 'wait' : 'none';
}

function badgeLabel(report: MyReport): string {
  return report.inUse ? S.inUse : report.needsCheck ? S.needsCheck : S.checking;
}

export default function MyReportsScreen() {
  const theme = useTheme();
  const [reports, setReports] = useState<MyReport[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadVersion = useRef(0);

  const load = useCallback(() => {
    const version = ++loadVersion.current;
    void listMyReports()
      .then((response) => {
        if (version !== loadVersion.current) return;
        setLoadError(null);
        setReports(response.reports);
      })
      .catch((caught: Error) => {
        if (version === loadVersion.current) setLoadError(caught.message ?? 'Pick 인증내역을 불러오지 못했어요');
      });
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    return () => { loadVersion.current += 1; };
  }, [load]));

  if (loadError) return <ErrorView message={loadError} onRetry={load} />;
  if (reports === null) return <DelayedLoadingView />;

  const proofs = reports.filter((report) => report.kind !== 'review');
  const used = proofs.filter((report) => report.inUse).length;
  const empty = proofs.length === 0;
  const stats = [
    { label: S.inUse, value: used, color: theme.positive },
    { label: S.checking, value: proofs.filter((report) => !report.inUse && !report.needsCheck).length, color: theme.text },
    { label: S.needsCheck, value: proofs.filter((report) => !report.inUse && report.needsCheck).length, color: theme.cautionary },
  ];

  return (
    <SubScreen
      title={S.title}
      dock={
        <Dock
          primary={{
            label: empty ? S.emptyCta : S.newProof,
            onPress: () => router.push('/capture/payment/consent'),
          }}
        />
      }>
      <Hero lines={empty ? S.heroEmpty : S.hero(proofs.length, used)} />

      {empty ? null : (
        <Section gap="events">
          <View style={styles.statRow}>
            {stats.map((stat) => (
              <View key={stat.label} style={[styles.statCell, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="f24" numeric style={[styles.statValue, { color: stat.color }]}>
                  {formatCount(stat.value)}
                </ThemedText>
                <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1}>
                  {stat.label}
                </ThemedText>
              </View>
            ))}
          </View>
        </Section>
      )}

      <Section gap="events">
        {empty ? (
          <EmptyBox>{S.empty}</EmptyBox>
        ) : (
          <View style={styles.list}>
            {proofs.map((report) => (
              <View key={report.id} style={[styles.card, { borderColor: theme.track }]}>
                <View style={styles.cardHead}>
                  <Badge kind={badgeKind(report)}>{badgeLabel(report)}</Badge>
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
              </View>
            ))}
          </View>
        )}
      </Section>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Layout.rowPaddingY },
  statRow: { flexDirection: 'row', gap: Layout.cardGap },
  statCell: {
    flex: 1,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    paddingHorizontal: Layout.rowPaddingY,
    alignItems: 'center',
    gap: Spacing.one,
  },
  statValue: { fontWeight: '700' },
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
});
