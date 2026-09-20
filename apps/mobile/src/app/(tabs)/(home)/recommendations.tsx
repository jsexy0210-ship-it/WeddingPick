import type { CategoryRecommendation, VendorCandidate, VendorSummary } from '@weddingpick/api-contract';
import { nextStepsCountLine, type VendorCategory } from '@weddingpick/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCategoryRecommendations } from '@/api/client';
import { useDepthBack } from '@/features/navigation/depth-back';
import { PickSectionTabs } from '@/features/pick/pick-section-tabs';
import { recommendationsAreComplete } from '@/features/home/canon-state';
import strings from '../../../../../../spec/strings.ko.json';
import {
  Border,
  EmptyView,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  SeedIcon,
  SkeletonView,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';
import { PickRecommend } from '@/features/home/pick-recommend';
import { useOpenCategory } from '@/features/home/use-open-category';
import { PickDoneSheet, UnpickSheet } from '@/features/pick/pick-sheets';
import { useMyCandidates } from '@/features/pick/use-my-candidates';

const S = strings.home;

/**
 * 추천 전체: docs/design/figma-export/08-recommendations.dc.html.
 * 미결정 업종만 조회하며 완료·정보 부족·조회 실패를 구분한다.
 * 홈과 같은 API와 카드를 사용하고 다른 화면에서 돌아오면 다시 조회한다.
 */
/** 아직 못 받았을 때 훅에 넘길 빈 목록. 렌더마다 새 배열을 만들지 않는다. */
const NO_GROUPS: readonly CategoryRecommendation[] = [];

type State = {
  groups: readonly CategoryRecommendation[];
  remaining: number;
  remainingCategories: readonly VendorCategory[];
};

export default function RecommendationsScreen() {
  const back = useDepthBack();
  const version = useRef(0);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candidates = useMyCandidates();
  const reloadCandidates = candidates.reload;
  const [pickDoneOpen, setPickDoneOpen] = useState(false);
  const [unpickTarget, setUnpickTarget] = useState<VendorCandidate | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /* 홈과 같은 single-open 아코디언 규칙을 쓴다 — 첫 업종이 기본으로 펼쳐진다. */
  const { open, toggle } = useOpenCategory(state?.groups ?? NO_GROUPS);

  const load = useCallback(() => {
    const request = ++version.current;
    setError(null);
    setState(null);
    void getCategoryRecommendations()
      .then((response) => {
        if (request === version.current) setState(response);
      })
      .catch(() => {
        if (request === version.current) setError(S['recommend.error']);
      });
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    void reloadCandidates().catch(() => undefined);
    return () => { version.current += 1; };
  }, [load, reloadCandidates]));

  async function onPressPick(vendor: VendorSummary) {
    const existing = candidates.candidateFor(vendor.id);
    if (existing) {
      setUnpickTarget(existing);
      return;
    }
    const result = await candidates.pick(vendor.id);
    if (result === 'picked') { setPickDoneOpen(true); load(); }
    else if (result === 'login') router.push('/login');
    else setToast(S['pick.failed']);
  }

  async function confirmUnpick() {
    if (!unpickTarget) return;
    const ok = await candidates.unpick(unpickTarget);
    setUnpickTarget(null);
    if (!ok) setToast(S['unpick.failed']);
    else load();
  }

  if (error) return <ErrorView message={error} onBack={back} onRetry={load} />;
  if (state === null) return <SkeletonView />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <PickSectionTabs active="recommendations" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="f26" style={styles.bold}>
              {S['recommend.title']}
            </ThemedText>
            {state.groups.length === 0 ? null : (
              <ThemedText type="f13" numeric themeColor="textAssistive" style={styles.sub}>
                {nextStepsCountLine(state.remaining)}
              </ThemedText>
            )}
          </View>

          {state.groups.length === 0 ? (
            recommendationsAreComplete(state) ? (
              <RecommendationsDone onOpenNote={() => router.push('/wedding')} />
            ) : (
              <EmptyView
                title={S['recommend.empty']}
                actionLabel={S['recommend.more']}
                onAction={() => router.push('/search')}
              />
            )
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

function RecommendationsDone({ onOpenNote }: { onOpenNote: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.doneSection}>
      <ThemedView type="backgroundElement" style={styles.doneCard}>
        <View style={[styles.doneMark, { backgroundColor: theme.positiveBackground }]}>
          <SeedIcon name="checkFlowerFill" size={Layout.iconTab} color={theme.positive} />
        </View>
        <ThemedText type="f16" style={styles.bold}>{S['recommend.done']}</ThemedText>
        <ThemedText type="f13" themeColor="textAssistive" style={styles.doneBody}>
          {S['done.body']}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={S['note.open']}
          onPress={onOpenNote}
          style={({ pressed }) => [
            styles.doneButton,
            { backgroundColor: theme.background, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="f14" style={styles.bold}>{S['note.open']}</ThemedText>
        </Pressable>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: { paddingBottom: Spacing.five },
  header: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionHeadGap },
  bold: { fontWeight: 700 },
  sub: { marginTop: Spacing.half },
  doneSection: { paddingHorizontal: Layout.gutter, paddingTop: Spacing.two },
  doneCard: {
    borderRadius: Radius.medium,
    paddingHorizontal: Layout.cardPadding,
    paddingVertical: Layout.sectionGap,
    alignItems: 'center',
    gap: Spacing.two,
  },
  doneMark: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBody: { textAlign: 'center' },
  doneButton: {
    minHeight: Layout.ctaInCard,
    marginTop: Spacing.one,
    paddingHorizontal: Layout.cardPadding,
    borderRadius: Radius.control,
    borderWidth: Border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
});
