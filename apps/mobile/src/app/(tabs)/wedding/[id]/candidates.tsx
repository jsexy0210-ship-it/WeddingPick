import type { CandidateListResponse } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listCandidates, removeCandidate } from '@/api/client';
import {
  ActionButton,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/**
 * 담아둔 업체.
 *
 * 사업계획서 v3 8번의 COMPARE. 비교 기능은 있었는데 담아둘 곳이 없어, 볼 때마다
 * 업체를 다시 찾아 골라야 했다. 결혼 준비는 몇 달에 걸친 일이다.
 *
 * **배우자와 같은 목록을 본다.** 후보가 사람이 아니라 웨딩에 매달려 있기 때문이다 —
 * 각자 다른 목록을 들고 같은 이야기를 할 수는 없다(사업계획서 12번).
 */
export default function CandidatesScreen() {
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

  if (error) {
    return (
      <Frame>
        <ThemedText type="subtitle">불러오지 못했습니다</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
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

  async function remove(candidateId: string) {
    try {
      await removeCandidate(id, candidateId);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '빼지 못했습니다.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">담아둔 곳</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {page.total}곳 · {page.limit}곳까지 담을 수 있습니다
            </ThemedText>
          </ThemedView>

          {page.total === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                아직 담아둔 곳이 없습니다. 검색에서 마음에 드는 업체를 담아두시면 여기
                모입니다.
              </ThemedText>
              <ActionButton
                variant="primary"
                label="업체 찾아보기"
                onPress={() => router.push('/search')}
              />
            </ThemedView>
          ) : (
            page.groups.map((group) => (
              <ThemedView key={group.category} style={styles.section}>
                <ThemedText type="smallBold">
                  {group.categoryLabel} {group.candidates.length}곳
                </ThemedText>

                {group.candidates.map((candidate) => (
                  <ThemedView key={candidate.id} type="backgroundElement" style={styles.card}>
                    <ThemedText type="smallBold">{candidate.vendorName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {candidate.region}
                      {/* 상대가 마음에 들어 한 곳인지 알아야 이야기가 된다. */}
                      {candidate.addedByPartner ? ' · 배우자가 담았습니다' : ''}
                    </ThemedText>
                    {candidate.note ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {candidate.note}
                      </ThemedText>
                    ) : null}
                    <ActionButton
                      label="자세히 보기"
                      onPress={() => router.push(`/search/${candidate.vendorId}`)}
                    />
                    <ActionButton label="빼기" onPress={() => void remove(candidate.id)} />
                  </ThemedView>
                ))}

                {/*
                  비교는 같은 업종끼리만 뜻이 있다. 웨딩홀과 스튜디오의 가격을
                  나란히 놓으면 그 표는 아무것도 말하지 않는다.
                */}
                {group.comparable ? (
                  <ActionButton
                    variant="primary"
                    label={`${group.categoryLabel} 견주기`}
                    hint="담아둔 곳을 나란히 놓고 봅니다"
                    onPress={() =>
                      router.push(
                        `/search/compare?ids=${group.candidates
                          .slice(0, 3)
                          .map((candidate) => candidate.vendorId)
                          .join(',')}`
                      )
                    }
                  />
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    두 곳 이상 담으시면 나란히 견줘 보실 수 있습니다.
                  </ThemedText>
                )}
              </ThemedView>
            ))
          )}

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
        <ThemedView style={styles.content}>{children}</ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: { gap: Spacing.two },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
});
