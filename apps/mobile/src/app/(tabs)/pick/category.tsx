import type { CandidateListResponse } from '@weddingpick/api-contract';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getCurrentUser,
  listCandidates,
  removeCandidate,
} from '@/api/client';
import {
  ActionButton,
  ErrorView,
  Layout,
  ListSkeleton,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  WeddingMark,
  useTheme,
} from '@weddingpick/ui';

/**
 * 카테고리별 Pick 후보 목록. WP-PICK-002.
 *
 * 같은 업종끼리만 비교가 뜻이 있기 때문에, Pick 탭 전체 목록에서 업종 하나를
 * 골라 들어오는 화면이다. 업체 카드에서 Pick 상태를 바로 토글할 수 있고,
 * 후보가 하나 이상 있으면 "결정 완료" 버튼이 활성화된다.
 *
 * Pick을 담는 행위는 **후보를 올리는 것**이지 결정이 아니다. 결정은 confirm 시트를
 * 별도로 거친다 — 그래야 실수로 결정이 되는 일이 없다.
 */
export default function PickCategoryScreen() {
  const theme = useTheme();
  const { category } = useLocalSearchParams<{ category: string }>();
  const cat = category as VendorCategory;

  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [group, setGroup] = useState<CandidateListResponse['groups'][number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getCurrentUser()
      .then(async (me) => {
        if (!me.weddingId) throw new Error('결혼 정보가 없어요.');
        setWeddingId(me.weddingId);
        const res = await listCandidates(me.weddingId);
        const found = res.groups.find((g) => g.category === cat) ?? null;
        setGroup(found);
      })
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setLoading(false));
  }, [cat]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [load]);

  function openConfirm(vendorId: string, vendorName: string) {
    router.push({
      pathname: '/(tabs)/pick/confirm' as never,
      params: { category: cat, vendorId, vendorName },
    });
  }

  function remove(candidateId: string, vendorName: string) {
    if (!weddingId) return;
    Alert.alert('후보에서 뺄까요?', `${vendorName}을 후보에서 제외해요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '빼기',
        style: 'destructive',
        onPress: () =>
          removeCandidate(weddingId, candidateId)
            .then(load)
            .catch((caught: Error) => setError(caught.message)),
      },
    ]);
  }

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  const categoryLabel = VENDOR_CATEGORY_LABEL[cat] ?? cat;
  const candidates = group?.candidates ?? [];
  const decidedId = group?.decidedVendorId ?? null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* 헤더 */}
          <ThemedView style={styles.section}>
            <ThemedText type="t2">{categoryLabel}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              후보 {candidates.length}곳
            </ThemedText>
          </ThemedView>

          {/* 목록 */}
          {loading ? (
            <ListSkeleton rows={3} />
          ) : candidates.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">
                아직 담아둔 곳이 없어요. 업체 화면에서 마음에 드는 곳을 담아보세요.
              </ThemedText>
              <ActionButton
                variant="primary"
                label={`${categoryLabel} 둘러보기`}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/search', params: { filterCategory: cat } })
                }
              />
            </ThemedView>
          ) : (
            candidates.map((candidate) => {
              const isDecided = decidedId === candidate.vendorId;

              return (
                <ThemedView
                  key={candidate.id}
                  type="backgroundElement"
                  style={[styles.card, isDecided && { borderColor: theme.tint, borderWidth: 1.5 }]}>
                  <View style={styles.rowMain}>
                    <View style={styles.nameRow}>
                      <ThemedText type="t5">{candidate.vendorName}</ThemedText>
                      {isDecided ? (
                        <WeddingMark size={20} color={theme.tint as string} />
                      ) : null}
                    </View>
                    <ThemedText type="t7" themeColor="textSecondary">
                      {candidate.region}
                      {candidate.addedByPartner ? ' · 배우자도 골랐어요' : ''}
                    </ThemedText>
                    {candidate.note ? (
                      <ThemedText type="t7" themeColor="textAssistive">
                        {candidate.note}
                      </ThemedText>
                    ) : null}
                  </View>

                  <View style={styles.rowActions}>
                    {!isDecided ? (
                      <ActionButton
                        variant="primary"
                        label="결정할게요"
                        onPress={() => openConfirm(candidate.vendorId, candidate.vendorName)}
                      />
                    ) : (
                      <ThemedText type="t7" themeColor="positive">
                        결정 완료
                      </ThemedText>
                    )}
                    <ActionButton
                      label="빼기"
                      onPress={() => remove(candidate.id, candidate.vendorName)}
                    />
                  </View>
                </ThemedView>
              );
            })
          )}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  section: { gap: Spacing.one, marginBottom: Spacing.two },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  rowMain: { gap: Spacing.half },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});
