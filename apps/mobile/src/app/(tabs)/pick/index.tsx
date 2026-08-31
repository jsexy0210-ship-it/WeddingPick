import type { CandidateListResponse, CurrentUser } from '@weddingpick/api-contract';
import {
  CANNOT_COMPARE,
  PREPARATION_STATE_LABEL,
  TERMS,
  type VendorCategory,
} from '@weddingpick/domain';
import { router } from 'expo-router';
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
import {
  decideCategory,
  getCurrentUser,
  listCandidates,
  removeCandidate,
  removeDecision,
} from '@/api/client';

/**
 * Pick. 통합정책 v3.2 §6.
 *
 * `관심업체`를 대체한다 — 이름만 바꾼 것이 아니라 **끝이 생겼다.** 예전에는
 * 담아두는 것으로 끝났고 목록은 시간이 지나도 줄지 않았다. 이제 업종마다 하나를
 * 정하면 그 업종이 닫히고, 홈의 진행률이 그만큼 올라간다.
 *
 * 화면은 업종별로 나눈다. 서른 곳을 한 줄로 늘어놓으면 무엇을 견주는 중인지
 * 보이지 않고, 비교는 같은 업종끼리만 뜻이 있다.
 */
export default function PickScreen() {
  const theme = useTheme();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [page, setPage] = useState<CandidateListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getCurrentUser()
      .then(async (current) => {
        setMe(current);

        if (!current.weddingId) {
          setPage(null);
          return;
        }

        setPage(await listCandidates(current.weddingId));
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  useEffect(load, [load]);

  const weddingId = me?.weddingId ?? null;

  async function decide(category: VendorCategory, vendorId: string, vendorName: string) {
    if (!weddingId) return;

    try {
      await decideCategory(weddingId, { category, vendorId });
      load();
    } catch {
      Alert.alert('정하지 못했어요', `${vendorName}으로 정하지 못했어요. 잠시 후 다시 시도해주세요.`);
    }
  }

  async function undo(category: VendorCategory) {
    if (!weddingId) return;

    try {
      await removeDecision(weddingId, category);
      load();
    } catch {
      Alert.alert('되돌리지 못했어요', '잠시 후 다시 시도해주세요.');
    }
  }

  function confirmRemove(candidateId: string, vendorName: string) {
    // 파괴적 동작은 대상 이름을 함께 보여준다. 두 번째 카드를 지우려다 첫 번째를 지운다.
    Alert.alert('Pick에서 뺄까요', `${vendorName}이 목록에서 사라져요`, [
      { text: '그만두기', style: 'cancel' },
      {
        text: '빼기',
        style: 'destructive',
        onPress: () => {
          if (!weddingId) return;

          void removeCandidate(weddingId, candidateId).then(load).catch(() => undefined);
        },
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
      </Frame>
    );
  }

  if (me && !me.weddingId) {
    return (
      <Frame>
        <ThemedText type="t2">{TERMS.picked}</ThemedText>
        <ThemedText type="t6" themeColor="textSecondary">
          마음에 드는 곳을 Pick하면 여기 모여요. 검색에서 마음에 드는 곳을 찾아보세요
        </ThemedText>
        <ActionButton variant="primary" label="검색으로 가기" onPress={() => router.push('/search')} />
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

          {/* 진행률. 분모는 업종 수다 — 많이 담을수록 떨어지는 숫자가 아니다. */}
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
                    {/*
                      상세는 행을 눌러 간다. 버튼 셋을 한 행에 늘어놓으면 좁은
                      화면에서 줄바꿈되면서 CTA 기준선이 어긋나고(v3.2 §11),
                      무엇보다 이 행에서 가장 강한 행동은 정하기 하나다(v3.1 §1).
                     */}
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
                      {/* 상대가 마음에 들어 한 곳인지 알아야 이야기가 된다. */}
                      {candidate.addedByPartner ? ' · 배우자가 Pick' : ''}
                    </ThemedText>

                    {candidate.note ? (
                      <ThemedText type="t7" themeColor="textSecondary">
                        {candidate.note}
                      </ThemedText>
                    ) : null}
                    </Pressable>

                    <ThemedView type="backgroundElement" style={styles.actions}>
                      {/*
                        결정은 업종에 하나다. 이미 정해둔 곳이면 되돌리기가 되고,
                        아니면 이곳으로 정하기가 된다.
                       */}
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

              {/*
                비교는 같은 업종에서 두 곳부터다. 한 곳만 담아두고 눌렀을 때
                "비교할 것이 없어요"가 뜨는 것보다, 그때까지 안 눌리는 편이 낫다.
               */}
              {group.comparable ? (
                <ActionButton
                  variant="primary"
                  label={`${group.candidates.length}곳 비교`}
                  onPress={() =>
                    router.push(
                      `/search/compare?ids=${group.candidates
                        .map((candidate) => candidate.vendorId)
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

          {/* 다 정했으면 다음을 지어내지 않는다 — 서버가 null을 준다. */}
          {page.nextCategory ? (
            <ActionButton
              label="다음 준비 찾아보기"
              hint={`${PREPARATION_STATE_LABEL.before}인 업종이 남아 있어요`}
              onPress={() => router.push(`/search?category=${page.nextCategory}`)}
            />
          ) : null}
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
