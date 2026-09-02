import type { CandidateListResponse } from '@weddingpick/api-contract';
import {
  CANNOT_COMPARE,
  PREPARATION_STATE_LABEL,
  TERMS,
  type VendorCategory,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { decideCategory, listCandidates, removeCandidate, removeDecision } from '@/api/client';

/** 내 웨딩 → 담아둔 곳 보기. Pick 탭과 같은 데이터를 wedding 맥락에서 연다. */
export default function WeddingCandidatesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [page, setPage] = useState<CandidateListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listCandidates(id)
      .then(setPage)
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useEffect(load, [load]);

  async function decide(category: VendorCategory, vendorId: string, vendorName: string) {
    try {
      await decideCategory(id, { category, vendorId });
      load();
    } catch {
      Alert.alert('정하지 못했어요', `${vendorName}으로 정하지 못했어요. 잠시 후 다시 시도해주세요.`);
    }
  }

  async function undo(category: VendorCategory) {
    try {
      await removeDecision(id, category);
      load();
    } catch {
      Alert.alert('되돌리지 못했어요', '잠시 후 다시 시도해주세요.');
    }
  }

  function confirmRemove(candidateId: string, vendorName: string) {
    Alert.alert('Pick에서 뺄까요', `${vendorName}이 목록에서 사라져요`, [
      { text: '그만두기', style: 'cancel' },
      {
        text: '빼기',
        style: 'destructive',
        onPress: () => void removeCandidate(id, candidateId).then(load).catch(() => undefined),
      },
    ]);
  }

  if (error) {
    return (
      <Frame>
        <ThemedText type="t2">{TERMS.picked}</ThemedText>
        <ThemedText type="t6" themeColor="textSecondary">
          {error}
        </ThemedText>
        <ActionButton label="돌아가기" onPress={() => router.back()} />
      </Frame>
    );
  }

  if (!page) {
    return (
      <Frame>
        <ActivityIndicator color={theme.tint} />
      </Frame>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="t2">{TERMS.picked}</ThemedText>

          <ThemedText type="t6" themeColor="textSecondary">
            {page.progress.label}
          </ThemedText>

          {page.groups.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6" themeColor="textSecondary">
                아직 Pick한 곳이 없어요. 검색에서 마음에 드는 곳을 찾아보세요
              </ThemedText>
              <ActionButton label="검색으로 가기" onPress={() => router.push('/search')} />
            </ThemedView>
          ) : null}

          {page.groups.map((group) => (
            <ThemedView key={group.category} type="backgroundElement" style={styles.card}>
              <ThemedView type="backgroundElement" style={styles.cardHead}>
                <ThemedText type="t5">
                  {group.categoryLabel} {group.candidates.length}곳
                </ThemedText>
                <ThemedText
                  type="badge"
                  themeColor={group.state === 'decided' ? 'positive' : 'textAssistive'}>
                  {group.stateLabel}
                </ThemedText>
              </ThemedView>

              {group.candidates.map((candidate) => {
                const decided = group.decidedVendorId === candidate.vendorId;

                return (
                  <ThemedView key={candidate.id} type="backgroundElement" style={styles.row}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${candidate.vendorName} 자세히 보기`}
                      onPress={() => router.push(`/search/${candidate.vendorId}`)}>
                      <ThemedView type="backgroundElement" style={styles.rowHead}>
                        <ThemedText type="t6">{candidate.vendorName}</ThemedText>
                        {decided ? (
                          <ThemedText type="badge" themeColor="tint">
                            여기로 정했어요
                          </ThemedText>
                        ) : null}
                      </ThemedView>

                      <ThemedText type="t7" themeColor="textSecondary">
                        {candidate.region}
                        {candidate.addedByPartner ? ' · 배우자가 Pick' : ''}
                      </ThemedText>

                      {candidate.note ? (
                        <ThemedText type="t7" themeColor="textSecondary">
                          {candidate.note}
                        </ThemedText>
                      ) : null}
                    </Pressable>

                    <ThemedView type="backgroundElement" style={styles.actions}>
                      {decided ? (
                        <ActionButton label="결정 되돌리기" onPress={() => void undo(group.category)} />
                      ) : (
                        <ActionButton
                          label="여기로 정하기"
                          onPress={() =>
                            void decide(group.category, candidate.vendorId, candidate.vendorName)
                          }
                        />
                      )}
                      <ActionButton
                        label="빼기"
                        onPress={() => confirmRemove(candidate.id, candidate.vendorName)}
                      />
                    </ThemedView>
                  </ThemedView>
                );
              })}

              {group.comparable ? (
                <ActionButton
                  variant="primary"
                  label={`${group.candidates.length}곳 비교`}
                  onPress={() =>
                    router.push(
                      `/search/compare?ids=${group.candidates
                        .map((c) => c.vendorId)
                        .join(',')}`
                    )
                  }
                />
              ) : (
                <ThemedText type="t7" themeColor="textAssistive">
                  {CANNOT_COMPARE}
                </ThemedText>
              )}
            </ThemedView>
          ))}

          {page.nextCategory ? (
            <ActionButton
              label="다음 준비 찾아보기"
              hint={`${PREPARATION_STATE_LABEL.before}인 업종이 남아 있어요`}
              onPress={() => router.push(`/search?category=${page.nextCategory}`)}
            />
          ) : null}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  card: { borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.three },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { gap: Spacing.one },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingTop: Spacing.one },
});
