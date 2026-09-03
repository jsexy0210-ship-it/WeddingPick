import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getCurrentUser, listCandidates } from '@/api/client';
import type { CandidateListResponse } from '@weddingpick/api-contract';
import {
  EmptyView,
  ErrorView,
  FontSize,
  Layout,
  LineHeight,
  LoadingView,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

const S = {
  title: 'Pick 히스토리',
  decided: '결정',
  'section.decided': '결정한 곳',
  'section.candidates': '후보',
  'cta.addCandidate': '다시 후보 추가',
  'empty.title': '아직 Pick한 곳이 없어요',
  'empty.description': '업체를 찾아 Pick에 담아보세요',
  'empty.cta': '업체 검색',
  error: '후보 목록을 불러오지 못했어요',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function HistorySkeleton() {
  return (
    <View style={{ paddingHorizontal: Layout.gutter, paddingTop: Spacing.four }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ marginBottom: Spacing.four }}>
          <Skeleton width={80} height={14} radius={4} style={{ marginBottom: Spacing.two }} />
          <Skeleton width="100%" height={72} radius={Radius.card} style={{ marginBottom: Spacing.one }} />
          <Skeleton width="100%" height={72} radius={Radius.card} />
        </View>
      ))}
    </View>
  );
}

export default function PickHistoryScreen() {
  const theme = useTheme();

  const [data, setData] = useState<CandidateListResponse | null>(null);
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (!user.weddingId) {
          setLoading(false);
          return;
        }
        setWeddingId(user.weddingId);
        return listCandidates(user.weddingId).then(setData);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const handleAddCandidate = useCallback(
    (category: string) => {
      router.push({ pathname: '/(tabs)/search', params: { category } });
    },
    []
  );

  const styles = makeStyles(theme);

  if (loading) {
    return (
      <ThemedView style={styles.flex}>
        <Stack.Screen options={{ title: S.title }} />
        <HistorySkeleton />
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.flex}>
        <Stack.Screen options={{ title: S.title }} />
        <ErrorView message={S.error} />
      </ThemedView>
    );
  }

  const hasAnyCandidate =
    data && data.groups.some((g) => g.candidates.length > 0 || g.decidedVendorId !== null);

  if (!data || !hasAnyCandidate) {
    return (
      <ThemedView style={styles.flex}>
        <Stack.Screen options={{ title: S.title }} />
        <EmptyView
          title={S['empty.title']}
          description={S['empty.description']}
          actionLabel={S['empty.cta']}
          onAction={() => router.push('/(tabs)/search')}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: S.title }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {data.groups.map((group) => {
          const decidedCandidate = group.decidedVendorId
            ? group.candidates.find((c) => c.vendorId === group.decidedVendorId)
            : null;
          const otherCandidates = group.candidates.filter(
            (c) => c.vendorId !== group.decidedVendorId
          );

          if (group.candidates.length === 0 && !group.decidedVendorId) return null;

          return (
            <View key={group.category} style={styles.categoryBlock}>
              {/* Category header */}
              <View style={styles.categoryHeader}>
                <ThemedText themeColor="textSecondary" style={styles.categoryLabel}>
                  {group.categoryLabel}
                </ThemedText>
                <ThemedText themeColor="textAssistive" style={styles.stateLabel}>
                  {group.stateLabel}
                </ThemedText>
              </View>

              {/* Decided vendor */}
              {decidedCandidate && (
                <View style={styles.subSection}>
                  <ThemedText themeColor="textAssistive" style={styles.subSectionLabel}>
                    {S['section.decided']}
                  </ThemedText>
                  <View
                    style={[
                      styles.vendorRow,
                      styles.decidedRow,
                      { borderColor: theme.tint, backgroundColor: theme.tintSubtle },
                    ]}
                  >
                    <View style={styles.vendorInfo}>
                      <ThemedText style={styles.vendorName} numberOfLines={1}>
                        {decidedCandidate.vendorName}
                      </ThemedText>
                      <ThemedText themeColor="textAssistive" style={styles.vendorMeta}>
                        {formatDate(decidedCandidate.addedAt)}
                      </ThemedText>
                    </View>
                    <View style={[styles.decidedBadge, { backgroundColor: theme.tint }]}>
                      <ThemedText
                        style={[styles.decidedBadgeText, { color: theme.onTint }]}
                      >
                        {S.decided}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              )}

              {/* Other candidates */}
              {otherCandidates.length > 0 && (
                <View style={styles.subSection}>
                  <ThemedText themeColor="textAssistive" style={styles.subSectionLabel}>
                    {S['section.candidates']}
                  </ThemedText>
                  {otherCandidates.map((candidate) => (
                    <View
                      key={candidate.id}
                      style={[
                        styles.vendorRow,
                        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                      ]}
                    >
                      <View style={styles.vendorInfo}>
                        <ThemedText style={styles.vendorName} numberOfLines={1}>
                          {candidate.vendorName}
                        </ThemedText>
                        <ThemedText themeColor="textAssistive" style={styles.vendorMeta}>
                          {formatDate(candidate.addedAt)}
                          {candidate.addedByPartner ? ' · 배우자 추가' : ''}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Add candidate CTA */}
              <Pressable
                style={({ pressed }) => [
                  styles.addCta,
                  { borderColor: theme.border },
                  pressed && { opacity: 0.6 },
                ]}
                onPress={() => handleAddCandidate(group.category)}
                hitSlop={8}
              >
                <ThemedText themeColor="tint" style={styles.addCtaText}>
                  {S['cta.addCandidate']}
                </ThemedText>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    scroll: {
      paddingHorizontal: Layout.gutter,
      paddingTop: Spacing.four,
      paddingBottom: Spacing.six,
    },
    categoryBlock: {
      marginBottom: Layout.sectionGap,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.two,
    },
    categoryLabel: {
      fontSize: FontSize.t6,
      lineHeight: LineHeight.t6,
      fontWeight: '700',
    },
    stateLabel: {
      fontSize: FontSize.t7,
      lineHeight: LineHeight.t7,
    },
    subSection: {
      marginBottom: Spacing.two,
    },
    subSectionLabel: {
      fontSize: FontSize.t7,
      lineHeight: LineHeight.t7,
      marginBottom: Spacing.one,
    },
    vendorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: Layout.rowMinHeight,
      borderRadius: Radius.card,
      borderWidth: 1,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      marginBottom: Spacing.one,
    },
    decidedRow: {
      borderWidth: 1.5,
    },
    vendorInfo: {
      flex: 1,
    },
    vendorName: {
      fontSize: FontSize.t6,
      lineHeight: LineHeight.t6,
      fontWeight: '700',
      marginBottom: 2,
    },
    vendorMeta: {
      fontSize: FontSize.t7,
      lineHeight: LineHeight.t7,
    },
    decidedBadge: {
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.two,
      paddingVertical: 3,
      marginLeft: Spacing.two,
    },
    decidedBadgeText: {
      fontSize: FontSize.badge,
      fontWeight: '700',
    },
    addCta: {
      height: Layout.controlMedium,
      borderRadius: Radius.medium,
      borderWidth: 1,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Spacing.one,
    },
    addCtaText: {
      fontSize: FontSize.t6,
      lineHeight: LineHeight.t6,
      fontWeight: '700',
    },
  });
}
