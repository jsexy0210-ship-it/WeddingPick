import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getMyInviteCode } from '@/api/client';
import { shareOrCopy } from '@/components/share-or-copy';
import {
  ActionButton,
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

const S = {
  title: '친구 초대',
  heroTitle: '친구가 첫 Pick 인증을 하면\n혜택을 드려요',
  heroSub: '최대 100건까지 받을 수 있어요',
  codeSection: '내 초대 코드',
  codeCopied: '공유 완료',
  'cta.copy': '코드 복사',
  'cta.share': '공유하기',
  shareText: '웨딩픽에서 실제로 낸 금액을 확인하고 Pick해보세요. 초대 코드: ',
  statsSection: '초대 현황',
  'stats.invited': '초대한 사람',
  'stats.qualified': 'Pick 인증 완료',
  'stats.unit': '명',
  'stats.hint': 'Pick 인증까지 완료한 분의 수예요',
  'empty.title': '아직 초대한 친구가 없어요',
  'empty.description': '코드를 공유하면 이곳에 현황이 나와요',
  error: '초대 현황을 불러오지 못했어요',
};

export default function ReferralScreen() {
  const theme = useTheme();

  const [data, setData] = useState<{ code: string; uses: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMyInviteCode()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = useCallback(async () => {
    if (!data) return;
    // expo-clipboard 미설치 — 공유 시트 또는(웹에서 지원 안 되면) 클립보드 복사로 코드를 내보낸다.
    const result = await shareOrCopy(data.code);
    if (result.shared || result.copied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [data]);

  const handleShare = useCallback(async () => {
    if (!data) return;
    await shareOrCopy(S.shareText + data.code);
  }, [data]);

  const styles = makeStyles();

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
        <View style={[styles.codeCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.codeText}>{data.code}</ThemedText>
          {copied && (
            <ThemedText themeColor="positive" style={styles.copiedHint}>
              {S.codeCopied}
            </ThemedText>
          )}
        </View>
        <View style={styles.ctaRow}>
          <View style={styles.ctaHalf}>
            <ActionButton
              variant="secondary"
              label={S['cta.copy']}
              onPress={handleCopy}
            />
          </View>
          <View style={styles.ctaHalf}>
            <ActionButton
              variant="primary"
              label={S['cta.share']}
              onPress={handleShare}
            />
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={[styles.divider, { backgroundColor: theme.line }]} />
      <View style={styles.section}>
        <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
          {S.statsSection}
        </ThemedText>

        {data.uses === 0 ? (
          <EmptyView title={S['empty.title']} description={S['empty.description']} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                  {S['stats.qualified']}
                </ThemedText>
                <View style={styles.statValueRow}>
                  <ThemedText style={[styles.statValue, { color: theme.tint }]}>
                    {data.uses}
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

function makeStyles() {
  return StyleSheet.create({
    flex: { flex: 1 },
    hero: {
      paddingHorizontal: Layout.gutter,
      paddingTop: Spacing.five,
      paddingBottom: Spacing.four,
    },
    heroTitle: {
      fontSize: FontSize.t2,
      lineHeight: LineHeight.t2,
      fontWeight: '700',
      marginBottom: Spacing.two,
    },
    heroSub: {
      fontSize: FontSize.t6,
      lineHeight: LineHeight.t6,
    },
    section: {
      paddingHorizontal: Layout.gutter,
      paddingTop: Spacing.four,
      paddingBottom: Spacing.four,
    },
    sectionLabel: {
      fontSize: FontSize.t7,
      lineHeight: LineHeight.t7,
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
      fontSize: FontSize.t2,
      lineHeight: LineHeight.t2,
      fontWeight: '700',
      letterSpacing: 4,
    },
    copiedHint: {
      fontSize: FontSize.t7,
      lineHeight: LineHeight.t7,
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
      borderRadius: Radius.medium,
      borderWidth: 1,
      padding: Spacing.three,
    },
    statLabel: {
      fontSize: FontSize.t7,
      lineHeight: LineHeight.t7,
      marginBottom: Spacing.one,
    },
    statValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: Spacing.half,
    },
    statValue: {
      fontSize: FontSize.t4,
      lineHeight: LineHeight.t4,
      fontWeight: '700',
    },
    statUnit: {
      fontSize: FontSize.t6,
      lineHeight: LineHeight.t6,
    },
    statsHint: {
      fontSize: FontSize.t7,
      lineHeight: LineHeight.t7,
    },
  });
}
