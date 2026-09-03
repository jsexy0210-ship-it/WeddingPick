import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { getMyRewards } from '@/api/client';
import {
  ActionButton,
  Colors,
  EmptyView,
  ErrorView,
  FontSize,
  Layout,
  LineHeight,
  LoadingView,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import type { MyRewardsResponse } from '@weddingpick/api-contract';

const S = {
  title: '친구 초대',
  heroTitle: '친구가 첫 Pick 인증을 하면\n혜택을 드려요',
  heroSub: '최대 100건까지 받을 수 있어요',
  codeSection: '내 초대 코드',
  codeCopied: '코드를 복사했어요',
  'cta.copy': '코드 복사',
  'cta.share': '공유하기',
  shareText: '웨딩픽에서 실제로 낸 금액을 확인하고 Pick해보세요. 초대 코드: ',
  statsSection: '초대 현황',
  'stats.invited': '초대한 사람',
  'stats.qualified': 'Pick 인증 완료',
  'stats.unit': '명',
  'stats.hint': 'Pick 인증까지 완료한 분의 수예요',
  'empty.title': '아직 초대한 친구가 없어요',
  'empty.body': '코드를 공유하면 이곳에 현황이 나와요',
  error: '초대 현황을 불러오지 못했어요',
};

export default function ReferralScreen() {
  const { colors } = useTheme();

  const [data, setData] = useState<MyRewardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMyRewards()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = useCallback(async () => {
    if (!data) return;
    await Clipboard.setStringAsync(data.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [data]);

  const handleShare = useCallback(async () => {
    if (!data) return;
    await Share.share({
      message: S.shareText + data.referralCode,
    });
  }, [data]);

  const styles = makeStyles(colors);

  if (loading) {
    return (
      <ThemedView style={styles.flex}>
        <Stack.Screen options={{ title: S.title }} />
        <LoadingView />
      </ThemedView>
    );
  }

  if (error || !data) {
    return (
      <ThemedView style={styles.flex}>
        <Stack.Screen options={{ title: S.title }} />
        <ErrorView message={S.error} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: S.title }} />

      {/* Hero */}
      <View style={styles.hero}>
        <ThemedText style={styles.heroTitle}>{S.heroTitle}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.heroSub}>
          {S.heroSub}
        </ThemedText>
      </View>

      {/* Code card */}
      <View style={styles.section}>
        <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
          {S.codeSection}
        </ThemedText>
        <View style={[styles.codeCard, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
          <ThemedText style={styles.codeText}>{data.referralCode}</ThemedText>
          {copied && (
            <ThemedText themeColor="positive" style={styles.copiedHint}>
              {S.codeCopied}
            </ThemedText>
          )}
        </View>
        <View style={styles.ctaRow}>
          <ActionButton
            variant="secondary"
            label={S['cta.copy']}
            onPress={handleCopy}
            style={styles.ctaHalf}
          />
          <ActionButton
            variant="primary"
            label={S['cta.share']}
            onPress={handleShare}
            style={styles.ctaHalf}
          />
        </View>
      </View>

      {/* Stats */}
      <View style={[styles.divider, { backgroundColor: colors.line }]} />
      <View style={styles.section}>
        <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
          {S.statsSection}
        </ThemedText>

        {data.invitedCount === 0 ? (
          <EmptyView title={S['empty.title']} body={S['empty.body']} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                  {S['stats.invited']}
                </ThemedText>
                <View style={styles.statValueRow}>
                  <ThemedText style={styles.statValue}>{data.invitedCount}</ThemedText>
                  <ThemedText themeColor="textAssistive" style={styles.statUnit}>
                    {S['stats.unit']}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                  {S['stats.qualified']}
                </ThemedText>
                <View style={styles.statValueRow}>
                  <ThemedText style={[styles.statValue, { color: colors.tint }]}>
                    {data.qualifiedCount}
                  </ThemedText>
                  <ThemedText themeColor="textAssistive" style={styles.statUnit}>
                    {S['stats.unit']}
                  </ThemedText>
                </View>
              </View>
            </View>
            <ThemedText themeColor="textAssistive" style={styles.statsHint}>
              {S['stats.hint']}
            </ThemedText>
          </>
        )}
      </View>
    </ThemedView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    flex: { flex: 1 },
    hero: {
      paddingHorizontal: Layout.gutter,
      paddingTop: Spacing.five,
      paddingBottom: Spacing.four,
    },
    heroTitle: {
      fontSize: FontSize.title,
      lineHeight: LineHeight.title,
      fontWeight: '700',
      marginBottom: Spacing.two,
    },
    heroSub: {
      fontSize: FontSize.sub,
      lineHeight: LineHeight.sub,
    },
    section: {
      paddingHorizontal: Layout.gutter,
      paddingTop: Spacing.four,
      paddingBottom: Spacing.four,
    },
    sectionLabel: {
      fontSize: FontSize.caption,
      lineHeight: LineHeight.caption,
      fontWeight: '700',
      marginBottom: Spacing.two,
    },
    codeCard: {
      borderRadius: Radius.medium,
      borderWidth: 1,
      paddingVertical: Spacing.three,
      paddingHorizontal: Spacing.three,
      alignItems: 'center',
      marginBottom: Spacing.two,
    },
    codeText: {
      fontSize: FontSize.heading,
      lineHeight: LineHeight.heading,
      fontWeight: '700',
      letterSpacing: 4,
    },
    copiedHint: {
      fontSize: FontSize.caption,
      lineHeight: LineHeight.caption,
      marginTop: Spacing.one,
    },
    ctaRow: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    ctaHalf: {
      flex: 1,
    },
    divider: {
      height: Layout.sectionBand,
    },
    statsRow: {
      flexDirection: 'row',
      gap: Spacing.two,
      marginBottom: Spacing.two,
    },
    statCard: {
      flex: 1,
      borderRadius: Radius.card,
      borderWidth: 1,
      padding: Spacing.three,
    },
    statLabel: {
      fontSize: FontSize.caption,
      lineHeight: LineHeight.caption,
      marginBottom: Spacing.one,
    },
    statValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: Spacing.half,
    },
    statValue: {
      fontSize: FontSize.section,
      lineHeight: LineHeight.section,
      fontWeight: '700',
    },
    statUnit: {
      fontSize: FontSize.sub,
      lineHeight: LineHeight.sub,
    },
    statsHint: {
      fontSize: FontSize.caption,
      lineHeight: LineHeight.caption,
    },
  });
}
