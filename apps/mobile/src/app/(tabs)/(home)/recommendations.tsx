import type { CategoryRecommendation, VendorCandidate, VendorSummary } from '@weddingpick/api-contract';
import { nextStepsCountLine, VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getCategoryRecommendations } from '@/api/client';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { recommendationsAreComplete } from '@/features/home/canon-state';
import strings from '../../../../../../spec/strings.ko.json';
import {
  Border,
  EmptyView,
  ErrorView,
  Layout,
  LetterSpacing,
  Radius,
  SeedIcon,
  Skeleton,
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

/** 예전 저장 링크도 Pick 1Depth의 추천 보기로 모은다. */
export default function RecommendationsRoute() {
  const { category } = useLocalSearchParams<{ category?: string | string[] }>();
  const requestedCategory = Array.isArray(category) ? category[0] : category;

  return (
    <Redirect
      href={{
        pathname: '/pick',
        params: requestedCategory
          ? { section: 'recommendations', category: requestedCategory }
          : { section: 'recommendations' },
      }}
    />
  );
}

/** Pick 루트 안에서 탭·하단 네비게이션을 공유하는 추천 본문. */
export function RecommendationsContent({
  requestedCategory = null,
}: {
  requestedCategory?: VendorCategory | null;
}) {
  const version = useRef(0);
  const loadedOnce = useRef(false);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const candidates = useMyCandidates();
  const reloadCandidates = candidates.reload;
  const [pickDoneOpen, setPickDoneOpen] = useState(false);
  const [unpickTarget, setUnpickTarget] = useState<VendorCandidate | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /* 홈과 같은 single-open 아코디언 규칙을 쓴다 — 첫 업종이 기본으로 펼쳐진다. */
  const { open, toggle } = useOpenCategory(state?.groups ?? NO_GROUPS, requestedCategory);

  const load = useCallback(async () => {
    const request = ++version.current;
    setError(null);
    try {
      const response = await getCategoryRecommendations();
      if (request !== version.current) return;
      loadedOnce.current = true;
      setState(response);
    } catch {
      if (request !== version.current) return;
      if (loadedOnce.current) setToast(S['recommend.error']);
      else setError(S['recommend.error']);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    const hadData = loadedOnce.current;
    if (hadData) setRefreshing(true);

    void Promise.allSettled([load(), reloadCandidates()])
      .finally(() => {
        if (active && hadData) setRefreshing(false);
      });

    return () => {
      active = false;
      version.current += 1;
    };
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

  if (error) return <ErrorView message={error} onRetry={load} />;
  if (state === null) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="f26" style={[styles.bold, styles.title]}>{S['recommend.title']}</ThemedText>
        </View>
        <View style={styles.initialSkeleton}>
          {Array.from({ length: 3 }, (_, index) => (
            <View key={index} style={styles.initialGroup}>
              <View style={styles.initialHead}>
                <Skeleton width="34%" height={18} />
                <Skeleton width="22%" height={13} />
              </View>
              {index === 0 ? (
                <View style={styles.initialCards}>
                  <Skeleton width="47%" height={190} radius={Radius.medium} />
                  <Skeleton width="47%" height={190} radius={Radius.medium} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  const requestedCategoryMissing =
    requestedCategory !== null && !state.groups.some((group) => group.category === requestedCategory);
  const requestedCategoryLabel = requestedCategory ? VENDOR_CATEGORY_LABEL[requestedCategory] : null;

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="f26" style={[styles.bold, styles.title]}>
            {S['recommend.title']}
          </ThemedText>
          <DelayedLoader active={refreshing} size={20} />
        </View>
        {state.groups.length === 0 || requestedCategoryMissing ? null : (
          <ThemedText type="f13" numeric themeColor="textAssistive" style={styles.sub}>
            {nextStepsCountLine(state.remaining)}
          </ThemedText>
        )}

        {requestedCategoryMissing && requestedCategory && requestedCategoryLabel ? (
          <EmptyView
            scope="section"
            title={`${requestedCategoryLabel} 추천은 지금 보여드릴 항목이 없어요`}
            description={`이미 결정했거나 현재 추천할 업체가 없어요. ${requestedCategoryLabel} Pick에서 후보와 결정 상태를 확인해주세요.`}
            actionLabel={`${requestedCategoryLabel} Pick 보기`}
            onAction={() => router.push(`/pick/${requestedCategory}`)}
          />
        ) : state.groups.length === 0 ? (
          recommendationsAreComplete(state) ? (
            <RecommendationsDone onOpenNote={() => router.push('/wedding')} />
          ) : (
            <EmptyView scope="section"
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
            interactionDisabled={refreshing}
            heading={false}
          />
        )}
      </ScrollView>

      <PickDoneSheet visible={pickDoneOpen} onDismiss={() => setPickDoneOpen(false)} />
      <UnpickSheet
        candidate={unpickTarget}
        partnerName={candidates.partnerName}
        busy={candidates.busyVendorId !== null}
        onConfirm={() => void confirmUnpick()}
        onDismiss={() => setUnpickTarget(null)}
      />
      <Toast message={toast} onHidden={() => setToast(null)} />
    </>
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
  scroll: { flex: 1 },
  content: { paddingBottom: Spacing.five },
  header: {
    height: Layout.navBar,
    paddingHorizontal: Layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  bold: { fontWeight: 700 },
  title: { letterSpacing: LetterSpacing.n065 },
  sub: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionHeadGap },
  initialSkeleton: { paddingBottom: Layout.sectionGap },
  initialGroup: {
    paddingHorizontal: Layout.gutter,
    paddingVertical: Layout.sectionHeadGap,
    gap: Spacing.three,
  },
  initialHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  initialCards: { flexDirection: 'row', gap: Layout.inlineGap },
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
