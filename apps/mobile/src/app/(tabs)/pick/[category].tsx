import type { CandidateListResponse, VendorCandidate } from '@weddingpick/api-contract';
import {
  VENDOR_CATEGORY_LABEL,
  withInstrument,
  type VendorCategory,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  EmptyView,
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
import {
  decideCategory,
  getCurrentUser,
  listCandidates,
  removeCandidate,
} from '@/api/client';

/**
 * 카테고리별 Pick 목록. 핸드오프 WP-PICK-002.
 * 해당 카테고리의 후보를 보여주고 최종 결정으로 이어진다.
 */

function CandidateCardSkeleton() {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Skeleton height={19} width="60%" />
      <Skeleton height={16} width="40%" />
      <Skeleton height={14} width="30%" />
    </ThemedView>
  );
}

export default function CategoryPickScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();

  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [group, setGroup] = useState<CandidateListResponse['groups'][number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getCurrentUser()
      .then(async (user) => {
        if (!user.weddingId) {
          setGroup(null);
          return;
        }
        setWeddingId(user.weddingId);
        const res = await listCandidates(user.weddingId);
        const found = res.groups.find((g) => g.category === category) ?? null;
        setGroup(found);
      })
      .catch((e: Error) => setError(e.message));
  }, [category]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [load]);

  async function decide(candidate: VendorCandidate) {
    if (!weddingId) return;
    setDeciding(candidate.id);
    try {
      await decideCategory(weddingId, {
        category: category as VendorCategory,
        vendorId: candidate.vendorId,
      });
      router.push({
        pathname: '/pick/confirm' as never,
        params: {
          category,
          vendorId: candidate.vendorId,
          vendorName: candidate.vendorName,
        },
      });
    } catch {
      Alert.alert('정하지 못했어요', `${candidate.vendorName}으로 정하지 못했어요. 잠시 후 다시 시도해주세요.`);
    } finally {
      setDeciding(null);
    }
  }

  async function remove(candidate: VendorCandidate) {
    if (!weddingId) return;
    Alert.alert(
      '후보에서 뺄까요?',
      candidate.addedByPartner ? '배우자 목록에서도 함께 사라져요' : undefined,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '빼기',
          style: 'destructive',
          onPress: async () => {
            setRemoving(candidate.id);
            try {
              await removeCandidate(weddingId, candidate.id);
              load();
            } catch {
              Alert.alert('오류', '후보를 빼지 못했어요. 잠시 후 다시 시도해주세요.');
            } finally {
              setRemoving(null);
            }
          },
        },
      ]
    );
  }

  const categoryLabel =
    category ? (VENDOR_CATEGORY_LABEL[category as VendorCategory] ?? category) : '';

  if (error) {
    return (
      <ErrorView
        title="목록을 불러오지 못했어요"
        message={error}
        onRetry={load}
        retryLabel="다시 시도"
        onBack={() => router.back()}
        backLabel="돌아가기"
      />
    );
  }

  const isDecided = group?.state === 'decided';
  const decidedVendorId = group?.decidedVendorId ?? null;
  const candidates = group?.candidates ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* 헤더 */}
          <ThemedView style={styles.header}>
            <ThemedText type="t2">{categoryLabel}</ThemedText>
            {group ? (
              <ThemedText type="t7" themeColor="textSecondary">
                {isDecided
                  ? `${categoryLabel} 결정 완료`
                  : `후보 ${candidates.length}곳`}
              </ThemedText>
            ) : null}
          </ThemedView>

          {/*
            결정 완료 배지. 준비 현황(온보딩 3/5)에서 «이미 정했다»고 체크한 업종은
            업체가 없다(decidedVendorId null) — 이름을 찾다 빈 문장을 만들지 않고
            어디서 정했는지만 적는다.
          */}
          {isDecided ? (
            <ThemedView type="backgroundElement" style={styles.decidedBanner}>
              <ThemedText type="t6" themeColor="positive">
                결정 완료
              </ThemedText>
              <ThemedText type="t7" themeColor="textSecondary">
                {decidedVendorName(candidates, decidedVendorId) ?? '웨딩픽 밖에서 이미 정한 업종이에요'}
              </ThemedText>
            </ThemedView>
          ) : null}

          {/* 로딩 */}
          {group === null && !error ? (
            <>
              <CandidateCardSkeleton />
              <CandidateCardSkeleton />
              <CandidateCardSkeleton />
            </>
          ) : candidates.length === 0 ? (
            <EmptyView
              title="아직 Pick한 곳이 없어요"
              description="마음에 드는 곳을 담아두면 여기서 비교할 수 있어요"
              actionLabel={`${categoryLabel} 검색`}
              onAction={() => router.push({ pathname: '/search', params: { category } })}
            />
          ) : (
            candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                isDecidedVendor={candidate.vendorId === decidedVendorId}
                isDecided={isDecided}
                deciding={deciding === candidate.id}
                removing={removing === candidate.id}
                onDecide={() => void decide(candidate)}
                onRemove={() => void remove(candidate)}
              />
            ))
          )}

          {/* 비교하기 */}
          {!isDecided && candidates.length >= 2 && (
            <ActionButton
              variant="secondary"
              size="large"
              label="비교하기"
              onPress={() =>
                router.push({
                  pathname: '/pick/compare' as never,
                  params: { category },
                })
              }
            />
          )}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** «더채플 강남으로 정했어요». 정한 업체가 후보에 없거나(삭제) 애초에 없으면 null. */
function decidedVendorName(
  candidates: readonly { vendorId: string; vendorName: string }[],
  decidedVendorId: string | null
): string | null {
  if (decidedVendorId === null) return null;

  const name = candidates.find((c) => c.vendorId === decidedVendorId)?.vendorName;

  return name ? `${withInstrument(name)} 정했어요` : null;
}

function CandidateCard({
  candidate,
  isDecidedVendor,
  isDecided,
  deciding,
  removing,
  onDecide,
  onRemove,
}: {
  candidate: VendorCandidate;
  isDecidedVendor: boolean;
  isDecided: boolean;
  deciding: boolean;
  removing: boolean;
  onDecide: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${candidate.vendorName} 상세 보기`}
      onPress={() => router.push(`/search/${candidate.vendorId}`)}>
      {(state) => {
        const { hovered, focused } = readWebInteractionState(state);
        return (
          <ThemedView
            type="backgroundElement"
            style={[
              styles.card,
              isDecidedVendor && { borderColor: theme.tint, borderWidth: 2 },
              hovered ? { backgroundColor: theme.backgroundSelected } : null,
              focused ? { outlineWidth: 2, outlineColor: theme.tint, outlineStyle: 'solid', outlineOffset: -2 } : null,
            ]}
          >
            <View style={styles.cardHeader}>
              <ThemedText type="t5" numberOfLines={1} style={styles.cardName}>
                {candidate.vendorName}
              </ThemedText>
              {isDecidedVendor && (
                <View
                  style={[styles.decidedBadge, { backgroundColor: theme.tint }]}
                >
                  <ThemedText type="badge" style={{ color: theme.onTint }}>
                    결정
                  </ThemedText>
                </View>
              )}
              {candidate.addedByPartner && !isDecidedVendor && (
                <View
                  style={[styles.partnerBadge, { backgroundColor: theme.tintSubtle }]}
                >
                  <ThemedText type="badge" themeColor="tint">
                    둘 다 Pick
                  </ThemedText>
                </View>
              )}
            </View>

            <ThemedText type="t7" themeColor="textSecondary">
              {candidate.region}
            </ThemedText>

            {candidate.note ? (
              <ThemedText type="t7" themeColor="textAssistive" numberOfLines={2}>
                {candidate.note}
              </ThemedText>
            ) : null}

            {/* CTA */}
            {!isDecided && (
              <View style={styles.cardActions}>
                <ActionButton
                  variant="secondary"
                  size="large"
                  label="빼기"
                  disabled={removing}
                  onPress={onRemove}
                />
                <View style={styles.decideBtn}>
                  <ActionButton
                    variant="primary"
                    size="large"
                    label={deciding ? '정하는 중' : '최종 결정'}
                    disabled={deciding}
                    onPress={onDecide}
                  />
                </View>
              </View>
            )}
          </ThemedView>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Layout.sectionGap,
    gap: Spacing.two,
  },
  header: { gap: Spacing.one, marginBottom: Spacing.one },
  decidedBanner: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
    minHeight: Layout.rowMinHeight,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  cardName: { flex: 1 },
  decidedBadge: {
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  partnerBadge: {
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  decideBtn: { flex: 1 },
});
