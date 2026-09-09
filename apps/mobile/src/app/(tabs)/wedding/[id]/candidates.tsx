import type { CandidateListResponse } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listCandidates } from '@/api/client';
import {
  ActionButton,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  SkeletonView,
} from '@weddingpick/ui';

/**
 * 내 웨딩의 후보 업체 목록. 디자인 핸드오프 — wedding/[id] 탭에서 진입.
 *
 * 담기·빼기·결정은 Pick 탭의 전용 화면에서 한다. 여기는 한눈에 보는 자리다.
 * 남은 자리를 보여준다 — 스키마 주석이 화면이 말할 수 있어야 한다고 명시한다.
 */
export default function WeddingCandidatesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [page, setPage] = useState<CandidateListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listCandidates(id)
      .then(setPage)
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useEffect(load, [load]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} onRetry={load} />;
  }

  if (!page) {
    return <SkeletonView />;
  }

  const remaining = page.limit - page.total;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t2">담아둔 곳</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              {page.progress.label}
            </ThemedText>
            <ThemedText type="t7" themeColor={remaining > 0 ? 'textAssistive' : 'negative'}>
              {remaining > 0
                ? `${remaining}곳 더 담을 수 있어요`
                : '최대로 담았어요. 더는 담을 수 없어요.'}
            </ThemedText>
          </ThemedView>

          {page.groups.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">
                아직 Pick한 곳이 없어요. 검색에서 마음에 드는 곳을 찾아보세요.
              </ThemedText>
              <ActionButton label="검색으로 가기" onPress={() => router.push('/search')} />
            </ThemedView>
          ) : null}

          {page.groups.map((group) => (
            <ThemedView key={group.category} type="backgroundElement" style={styles.card}>
              <View style={styles.cardHead}>
                <ThemedText type="t5">
                  {group.categoryLabel} {group.candidates.length}곳
                </ThemedText>
                <ThemedText
                  type="badge"
                  themeColor={group.state === 'decided' ? 'positive' : 'textAssistive'}>
                  {group.stateLabel}
                </ThemedText>
              </View>

              {group.candidates.map((candidate) => {
                const decided = group.decidedVendorId === candidate.vendorId;

                return (
                  <Pressable
                    key={candidate.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${candidate.vendorName} 상세 보기`}
                    onPress={() => router.push(`/search/${candidate.vendorId}`)}>
                    <View style={styles.row}>
                      <View style={styles.rowHead}>
                        <ThemedText type="t6">{candidate.vendorName}</ThemedText>
                        {decided ? (
                          <ThemedText type="badge" themeColor="tint">
                            여기로 정했어요
                          </ThemedText>
                        ) : null}
                      </View>
                      <ThemedText type="t7" themeColor="textSecondary">
                        {candidate.region}
                        {candidate.addedByPartner ? ' · 배우자가 Pick' : ''}
                      </ThemedText>
                      {candidate.note ? (
                        <ThemedText type="t7" themeColor="textSecondary">
                          {candidate.note}
                        </ThemedText>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ThemedView>
          ))}

          <ActionButton
            label="Pick에서 관리하기"
            hint="담기·빼기·결정은 Pick 탭에서 해요"
            onPress={() => router.push('/pick')}
          />
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
    gap: Spacing.three,
  },
  header: { gap: Spacing.one },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.two },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: { gap: Spacing.one, paddingVertical: Spacing.one },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
});
