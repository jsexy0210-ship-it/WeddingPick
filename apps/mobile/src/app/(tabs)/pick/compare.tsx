import type { CandidateListResponse } from '@weddingpick/api-contract';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  ThemedView,
  readWebInteractionState,
  useTheme,
} from '@weddingpick/ui';
import { getCurrentUser, listCandidates } from '@/api/client';

/**
 * Pick 후보 비교 선택 화면. WP-PICK-002 비교 흐름 진입점.
 *
 * 카테고리의 후보 중 2~3곳을 골라 비교를 시작한다.
 * 선택 완료 후 `/search/compare?ids=…`로 넘어간다.
 */

const MAX_COMPARE = 3;
const MIN_COMPARE = 2;

function CandidateRowSkeleton() {
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <Skeleton height={19} width="60%" />
      <Skeleton height={15} width="35%" style={{ marginTop: 4 }} />
    </ThemedView>
  );
}

export default function PickCompareScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();

  const [candidates, setCandidates] = useState<CandidateListResponse['groups'][number]['candidates'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setError(null);
    setCandidates(null);
    getCurrentUser()
      .then(async (me) => {
        if (!me.weddingId) throw new Error('결혼 정보가 없어요.');
        const res = await listCandidates(me.weddingId);
        const group = res.groups.find((g) => g.category === category);
        setCandidates(group?.candidates ?? []);
      })
      .catch((e: Error) => setError(e.message));
  }, [category]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const categoryLabel =
    category ? (VENDOR_CATEGORY_LABEL[category as VendorCategory] ?? category) : '';

  if (error) {
    return (
      <ErrorView
        title="후보를 불러오지 못했어요"
        message={error}
        onRetry={load}
        retryLabel="다시 시도"
        onBack={() => router.back()}
        backLabel="돌아가기"
      />
    );
  }

  function toggle(vendorId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) {
        next.delete(vendorId);
      } else if (next.size < MAX_COMPARE) {
        next.add(vendorId);
      }
      return next;
    });
  }

  function startCompare() {
    const ids = Array.from(selected).join(',');
    router.push({ pathname: '/search/compare', params: { ids } });
  }

  const canCompare = selected.size >= MIN_COMPARE;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* 안내 */}
          <ThemedView style={styles.header}>
            <ThemedText type="t2">{categoryLabel} 비교</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              같은 카테고리에서 2~3곳까지
            </ThemedText>
          </ThemedView>

          {/* 로딩 */}
          {candidates === null ? (
            <>
              <CandidateRowSkeleton />
              <CandidateRowSkeleton />
              <CandidateRowSkeleton />
            </>
          ) : candidates.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.empty}>
              <ThemedText type="t6" themeColor="textSecondary">
                비교할 후보가 없어요
              </ThemedText>
              <ThemedText type="t7" themeColor="textAssistive">
                먼저 이 카테고리에서 업체를 Pick해주세요.
              </ThemedText>
            </ThemedView>
          ) : (
            candidates.map((c) => {
              const isSelected = selected.has(c.vendorId);
              const isDisabled = !isSelected && selected.size >= MAX_COMPARE;
              return (
                <CandidateRow
                  key={c.id}
                  candidate={c}
                  isSelected={isSelected}
                  isDisabled={isDisabled}
                  onToggle={() => toggle(c.vendorId)}
                />
              );
            })
          )}

          {/* Primary CTA */}
          <ThemedView style={styles.cta}>
            <ActionButton
              variant="primary"
              label={
                selected.size >= MIN_COMPARE
                  ? `${selected.size}곳 비교하기`
                  : '2곳 이상 골라주세요'
              }
              disabled={!canCompare}
              onPress={startCompare}
            />
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

type CandidateItem = CandidateListResponse['groups'][number]['candidates'][number];

function CandidateRow({
  candidate: c,
  isSelected,
  isDisabled,
  onToggle,
}: {
  candidate: CandidateItem;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onToggle}
      disabled={isDisabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
      accessibilityLabel={c.vendorName}>
      {(state) => {
        const { hovered, focused } = readWebInteractionState(state);
        return (
          <ThemedView
            type="backgroundElement"
            style={[
              styles.row,
              isSelected && { borderColor: theme.tint, borderWidth: 1.5 },
              isDisabled && styles.rowDisabled,
              !isDisabled && hovered ? { backgroundColor: theme.backgroundSelected } : null,
              focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: -2 } : null,
            ]}
          >
            <View style={styles.rowContent}>
              <ThemedText type="t6" numberOfLines={1}>
                {c.vendorName}
              </ThemedText>
              <ThemedText type="t7" themeColor="textSecondary" numberOfLines={1}>
                {VENDOR_CATEGORY_LABEL[c.category as VendorCategory] ?? c.category} · {c.region}
              </ThemedText>
              {c.addedByPartner ? (
                <ThemedText type="tab" themeColor="positive">
                  배우자도 고른 곳
                </ThemedText>
              ) : null}
            </View>
            {/* 선택 인디케이터 */}
            <View
              style={[
                styles.check,
                { borderColor: isSelected ? theme.tint : theme.border },
                isSelected && { backgroundColor: theme.tint },
              ]}
            />
          </ThemedView>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionGap,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.two,
  },
  header: {
    gap: Spacing.one,
    paddingTop: Layout.sectionGap,
    paddingBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    minHeight: 56,
  },
  rowContent: { flex: 1, gap: 2 },
  rowDisabled: { opacity: 0.4 },
  check: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  empty: {
    borderRadius: Radius.medium,
    padding: Spacing.four,
    gap: Spacing.one,
    alignItems: 'center',
  },
  cta: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
});
