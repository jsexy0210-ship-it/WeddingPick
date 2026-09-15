import type { CategoryRecommendation, VendorCandidate, VendorSummary } from '@weddingpick/api-contract';
import { nextStepsCountLine, type VendorCategory } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCategoryRecommendations } from '@/api/client';
import { BackBar } from '@/components/back-bar';
import {
  EmptyView,
  ErrorView,
  Layout,
  MaxContentWidth,
  SkeletonView,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
} from '@weddingpick/ui';
import { PickRecommend } from '@/features/home/pick-recommend';
import { useOpenCategory } from '@/features/home/use-open-category';
import { PickDoneSheet, UnpickSheet } from '@/features/pick/pick-sheets';
import { useMyCandidates } from '@/features/pick/use-my-candidates';

/**
 * 웨딩픽 추천 전체 — 2026-09-15 대표 사양 §10~§15.
 *
 * 홈은 지금 우선순위가 높은 업종 셋만 보여주고, 여기서는 **아직 결정하지 않은 모든 업종의
 * 추천**을 한 번에 본다. 진입은 홈 > Pick 추천 > 더보기 하나다(§15).
 *
 * **홈과 같은 데이터를 쓴다**(§12 · §14). `GET /v1/me/recommendations`를 `limit` 없이 부를
 * 뿐이고, 홈은 같은 것을 `limit=3`으로 부른다 — 별도 추천 로직도, 별도 상태 복제도 없다.
 * 카드도 홈과 같은 컴포넌트(`VendorCard`)이고, 업종 줄도 홈과 같은 `PickRecommend`다.
 * 그래서 여기서 Pick한 것이 홈에 그대로 있고, 홈에서 정한 업종은 여기서 사라진다.
 *
 * **업종이 많아 세로가 길어지므로 아코디언을 쓴다**(§12가 「현재 UX 구조를 보고 결정」하라고
 * 열어둔 자리다). 미결정 업종이 열둘까지 가고, 각 업종이 카드 줄을 하나씩 펼치면 홈보다
 * 네 배 긴 화면이 된다 — 무엇이 있는지 훑는 것이 먼저다.
 *
 * **홈의 「더보기」와 이름이 겹치지 않게 한다**(§13). 업종마다 「더 찾아보기」가 서고 그것은
 * 검색으로 간다 — 홈의 「더보기」는 이 화면으로 오는 단추라 같은 이름을 쓰면 어느 쪽이
 * 어디로 가는지 눌러봐야 안다. 이 단추는 홈에 두지 않는다.
 */
/** 아직 못 받았을 때 훅에 넘길 빈 목록. 렌더마다 새 배열을 만들지 않는다. */
const NO_GROUPS: readonly CategoryRecommendation[] = [];

type State = {
  groups: readonly CategoryRecommendation[];
  remaining: number;
  remainingCategories: readonly VendorCategory[];
};

export default function RecommendationsScreen() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candidates = useMyCandidates();
  const [pickDoneOpen, setPickDoneOpen] = useState(false);
  const [unpickTarget, setUnpickTarget] = useState<VendorCandidate | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /* 홈과 같은 single-open 아코디언 규칙을 쓴다 — 첫 업종이 기본으로 펼쳐진다. */
  const { open, toggle } = useOpenCategory(state?.groups ?? NO_GROUPS);

  const load = useCallback(() => {
    getCategoryRecommendations()
      .then((response) => {
        setError(null);
        setState(response);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function onPressPick(vendor: VendorSummary) {
    const existing = candidates.candidateFor(vendor.id);
    if (existing) {
      setUnpickTarget(existing);
      return;
    }
    const result = await candidates.pick(vendor.id);
    if (result === 'picked') setPickDoneOpen(true);
    else if (result === 'login') router.push('/login');
    else setToast('Pick하지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  async function confirmUnpick() {
    if (!unpickTarget) return;
    const ok = await candidates.unpick(unpickTarget);
    setUnpickTarget(null);
    if (!ok) setToast('후보를 빼지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  if (error) return <ErrorView message={error} onBack={() => router.back()} onRetry={load} />;
  if (state === null) return <SkeletonView />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="f26" style={styles.bold}>
              웨딩픽 추천
            </ThemedText>
            <ThemedText type="f12" themeColor="textAssistive" style={styles.sub}>
              아직 남은 준비를 한눈에 확인해보세요
            </ThemedText>
            {state.groups.length === 0 ? null : (
              <ThemedText type="f12" numeric themeColor="textAssistive" style={styles.sub}>
                {nextStepsCountLine(state.remaining)}
              </ThemedText>
            )}
          </View>

          {state.groups.length === 0 ? (
            <EmptyView title="정할 준비를 다 끝냈어요." />
          ) : (
            <PickRecommend
              groups={state.groups}
              open={open}
              onToggle={toggle}
              /*
               * 「다음 준비」 요약은 홈에만 둔다 — 여기가 그 더보기가 오는 곳이라, 같은 줄을
               * 다시 두면 자기 자신으로 가는 단추가 된다.
               */
              remaining={state.remaining}
              remainingCategories={[]}
              isPicked={(vendorId) => candidates.candidateFor(vendorId) !== null}
              onPressVendor={(vendorId) => router.push(`/search/${vendorId}`)}
              onPressPick={(vendor) => void onPressPick(vendor)}
              onPressCompare={(category) => router.push(`/pick/${category}`)}
              /* 홈의 「더보기」와 이름을 구분한다(§13) — 이쪽은 검색으로 간다. */
              onPressSearchMore={(category) => router.push(`/search?category=${category}`)}
              onPressMore={() => undefined}
              /* 화면 제목이 이미 「웨딩픽 추천」이다 — 섹션 제목을 한 번 더 두지 않는다. */
              heading={false}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      <PickDoneSheet visible={pickDoneOpen} onDismiss={() => setPickDoneOpen(false)} />
      <UnpickSheet
        candidate={unpickTarget}
        partnerName={candidates.partnerName}
        busy={candidates.busyVendorId !== null}
        onConfirm={() => void confirmUnpick()}
        onDismiss={() => setUnpickTarget(null)}
      />
      <Toast message={toast} onHidden={() => setToast(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: { paddingBottom: Spacing.five },
  header: { paddingHorizontal: Layout.pageX, paddingBottom: Spacing.four },
  bold: { fontWeight: 700 },
  sub: { marginTop: Spacing.half },
});
