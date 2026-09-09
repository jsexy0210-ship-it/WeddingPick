import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getCurrentUser, getRemovedCandidates, listCandidates } from '@/api/client';
import type { CandidateListResponse } from '@weddingpick/api-contract';
import {
  EmptyView,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  readWebInteractionState,
  useTheme,
} from '@weddingpick/ui';
import { NavBar, Screen } from '@/features/wedding/screen-kit';

/**
 * WP-PICK-007 결정 내역. 시안 07-pick #17e — navBack «결정 내역» + Hero.
 * 뒤로는 Pick 탭(WP-PICK-001)이다.
 */
const S = {
  title: '결정 내역',
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
          <Skeleton width={80} height={14} radius={Radius.badge} style={{ marginBottom: Spacing.two }} />
          <Skeleton width="100%" height={72} radius={Radius.medium} style={{ marginBottom: Spacing.one }} />
          <Skeleton width="100%" height={72} radius={Radius.medium} />
        </View>
      ))}
    </View>
  );
}

export default function PickHistoryScreen() {
  const theme = useTheme();

  const [data, setData] = useState<CandidateListResponse | null>(null);
  const [hasRemoved, setHasRemoved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (!user.weddingId) {
          setLoading(false);
          return;
        }
        return Promise.all([
          listCandidates(user.weddingId).then(setData),
          getRemovedCandidates(user.weddingId).then((res) =>
            setHasRemoved(res.groups.some((g) => g.items.length > 0))
          ),
        ]);
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
      <Screen>
        <NavBar title={S.title} />
        <HistorySkeleton />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <NavBar title={S.title} />
        <ErrorView message={S.error} />
      </Screen>
    );
  }

  const hasAnyCandidate =
    data && data.groups.some((g) => g.candidates.length > 0 || g.decidedVendorId !== null);

  if (!data || !hasAnyCandidate) {
    return (
      <Screen>
        <NavBar title={S.title} />
        <EmptyView
          title={S['empty.title']}
          description={S['empty.description']}
          actionLabel={S['empty.cta']}
          onAction={() => router.push('/(tabs)/search')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar title={S.title} />
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
                <ThemedText type="t6" themeColor="textSecondary" style={styles.categoryLabel}>
                  {group.categoryLabel}
                </ThemedText>
                <ThemedText type="t7" themeColor="textAssistive">
                  {group.stateLabel}
                </ThemedText>
              </View>

              {/* Decided vendor */}
              {decidedCandidate && (
                <View style={styles.subSection}>
                  <ThemedText type="t7" themeColor="textAssistive" style={styles.subSectionLabel}>
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
                      <ThemedText type="t6" style={styles.vendorName} numberOfLines={1}>
                        {decidedCandidate.vendorName}
                      </ThemedText>
                      <ThemedText type="t7" themeColor="textAssistive">
                        {formatDate(decidedCandidate.addedAt)}
                      </ThemedText>
                    </View>
                    <View style={[styles.decidedBadge, { backgroundColor: theme.tint }]}>
                      <ThemedText
                        type="badge"
                        style={[styles.bold, { color: theme.onTint }]}
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
                  <ThemedText type="t7" themeColor="textAssistive" style={styles.subSectionLabel}>
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
                        <ThemedText type="t6" style={styles.vendorName} numberOfLines={1}>
                          {candidate.vendorName}
                        </ThemedText>
                        <ThemedText type="t7" themeColor="textAssistive">
                          {formatDate(candidate.addedAt)}
                          {candidate.addedByPartner ? ' · 배우자 추가' : ''}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Add candidate CTA */}
              <DashedCta
                label={S['cta.addCandidate']}
                labelColor="tint"
                onPress={() => handleAddCandidate(group.category)}
              />
            </View>
          );
        })}

        {/* 제거된 후보 링크 — 실제로 제거된 항목이 있을 때만 노출 */}
        {hasRemoved && (
          <DashedCta
            label="제거된 후보 보기"
            labelColor="textSecondary"
            onPress={() => router.push('/(tabs)/pick/removed' as never)}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function DashedCta({
  label,
  labelColor,
  onPress,
}: {
  label: string;
  labelColor: 'tint' | 'textSecondary';
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Pressable
      style={(state) => {
        const { pressed, hovered, focused } = readWebInteractionState(state);
        return [
          styles.addCta,
          { borderColor: theme.border },
          pressed && { opacity: 0.6 },
          !pressed && hovered ? { backgroundColor: theme.backgroundSelected } : null,
          focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: -2 } : null,
        ];
      }}
      onPress={onPress}
      hitSlop={8}
    >
      <ThemedText type="t6" themeColor={labelColor} style={styles.bold}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    scroll: {
      paddingHorizontal: Layout.gutter,
      paddingTop: Spacing.four,
      paddingBottom: Spacing.two,
      maxWidth: MaxContentWidth,
      alignSelf: 'center',
      width: '100%',
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
      fontWeight: '700',
    },
    subSection: {
      marginBottom: Spacing.two,
    },
    subSectionLabel: {
      marginBottom: Spacing.one,
    },
    /* 카드 — component.card «radius 10 · paddingCompact 18px 20px». */
    vendorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: Layout.rowMinHeight,
      borderRadius: Radius.medium,
      borderWidth: 1,
      paddingHorizontal: Layout.cardPadding,
      paddingVertical: Layout.cardPaddingCompactY,
      marginBottom: Spacing.one,
    },
    decidedRow: {
      borderWidth: 1.5,
    },
    vendorInfo: {
      flex: 1,
    },
    vendorName: {
      fontWeight: '700',
      marginBottom: Spacing.half,
    },
    decidedBadge: {
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.two,
      paddingVertical: 3,
      marginLeft: Spacing.two,
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
    bold: {
      fontWeight: '700',
    },
  });
}
