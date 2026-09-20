import type {
  AppBootstrapResponse,
  CandidateListResponse,
  CategoryRecommendation,
  CurrentUser,
  VendorCandidate,
  VendorSummary,
} from '@weddingpick/api-contract';
import {
  HOME_RECOMMEND_CATEGORIES,
  daysUntil,
  formatCount,
  hasUnread,
  type VendorCategory,
} from '@weddingpick/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAppBootstrap, getCategoryRecommendations } from '@/api/client';
import {
  ActionButton,
  ErrorView,
  Layout,
  LetterSpacing,
  MaxContentWidth,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';
import { DelayedLoader, DelayedRecommendingView } from '@/features/loading/delayed-loader';
import {
  takeFullScreenLoading,
  takeHomeLoadingCoveredBySetup,
} from '@/features/loading/first-run';
import { listWeddingContent, type WeddingContentItem } from '@/features/home/content';
import { HomeBudget, PendingPreparation } from '@/features/home/home-summary';
import strings from '../../../../../spec/strings.ko.json';

import { Hero } from '@/features/home/hero';
import { HomeRecommendations } from '@/features/home/pick-recommend';
import { categoryStatuses } from '@/features/home/state';
import { WeddingContent } from '@/features/home/wedding-content';
import { PickDoneSheet, UnpickSheet } from '@/features/pick/pick-sheets';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import { isWebShellScreen } from '@/features/webshell/config';
import { WebShellView } from '@/features/webshell/WebShellView';

const S = strings.home;

/**
 * 최신 홈의 준비현황·예산현황·라운지 진입을 docs/design/01-home과 README에 맞춘다.
 * API 실패는 빈 상태나 완료로 바꾸지 않는다. 추가 데이터/API를 만들지 않고
 * bootstrap과 추천의 실제 값을 사용한다.
 */
/** 홈이 웨딩피드에서 보여주는 카드 수(§17 「홈 최대 3건」). */
const HOME_FEED_PREVIEW_COUNT = 3;

type HomeData = {
  me: CurrentUser | null;
  candidates: CandidateListResponse | null;
  budget: AppBootstrapResponse['budget'];
  bracketAnswered: boolean;
  partnerInvitePending: boolean;
  groups: readonly CategoryRecommendation[];
  remaining: number;
  remainingCategories: readonly VendorCategory[];
  content: readonly WeddingContentItem[];
  /** 안 읽은 알림 수. 벨의 점이 이 값을 본다. */
  unread: number;
};

const EMPTY: HomeData = {
  me: null,
  candidates: null,
  budget: null,
  bracketAnswered: false,
  partnerInvitePending: false,
  groups: [],
  remaining: 0,
  remainingCategories: [],
  content: [],
  unread: 0,
};

export default function HomeScreen() {
  const theme = useTheme();
  const loadVersion = useRef(0);
  const [bootError, setBootError] = useState(false);
  const [recommendationStatus, setRecommendationStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [contentStatus, setContentStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<HomeData>(EMPTY);
  /*
   * 한 번이라도 받아왔는가. **자료가 없는 것과 아직 모르는 것은 다르다** — 앞은
   * 시작 전 구간이고 뒤는 로더다. 하나로 뭉치면 프로필을 못 불러온 사람에게
   * 영원히 로더가 돈다.
   */
  const [settled, setSettled] = useState(() => isWebShellScreen('home'));
  /*
   * 이 홈이 전체 화면 로딩을 써도 되는가. 마운트 때 한 번만 묻는다 — 렌더마다 물으면
   * 첫 렌더가 예산을 쓰고 두 번째 렌더가 못 받아 로더가 도중에 바뀐다.
   */
  const [fullScreen] = useState(takeFullScreenLoading);
  const [setupCoveredLoading] = useState(takeHomeLoadingCoveredBySetup);
  const candidates = useMyCandidates();
  const reloadCandidates = candidates.reload;
  const [pickDoneOpen, setPickDoneOpen] = useState(false);
  const [unpickTarget, setUnpickTarget] = useState<VendorCandidate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    if (isWebShellScreen('home')) return;
    const version = ++loadVersion.current;
    const current = () => version === loadVersion.current;
    setBootError(false);
    setRecommendationStatus('loading');
    setContentStatus('loading');

    void listWeddingContent(HOME_FEED_PREVIEW_COUNT)
      .then((content) => {
        if (!current()) return;
        setData((previous) => ({ ...previous, content }));
        setContentStatus('ready');
      })
      .catch(() => { if (current()) setContentStatus('error'); });


    void getAppBootstrap()
      .then((boot) => {
        if (current()) setData((previous) => ({
          ...previous, me: boot.member, candidates: boot.candidates, budget: boot.budget,
          bracketAnswered: boot.bracketAnswered, partnerInvitePending: boot.partnerInvitePending,
          unread: boot.notifications?.unread ?? 0,
        }));
      })
      .catch(() => { if (current()) setBootError(true); })
      .finally(() => { if (current()) setSettled(true); });

    void getCategoryRecommendations(HOME_RECOMMEND_CATEGORIES)
      .then((response) => {
        if (!current()) return;
        setData((previous) => ({ ...previous, groups: response.groups, remaining: response.remaining,
          remainingCategories: response.remainingCategories }));
        setRecommendationStatus('ready');
      })
      .catch(() => { if (current()) setRecommendationStatus('error'); });
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    void reloadCandidates().catch(() => undefined);
    return () => { loadVersion.current += 1; };
  }, [load, reloadCandidates]));

  /** 카드의 하트. Pick 전이면 후보에 담고 완료 시트, Pick 후면 해제 시트. 로그인 전이면 로그인으로. */
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

  // 하이브리드 웹뷰 쉘 POC. `EXPO_PUBLIC_WEBSHELL_SCREENS`에 "home"이 없으면
  // (기본값) 이 분기는 타지 않고 기존 네이티브 화면 그대로다.
  if (isWebShellScreen('home')) {
    return <WebShellView path="/" />;
  }

  if (!settled) {
    return fullScreen ? (
      <DelayedRecommendingView nickname={data.me?.displayName ?? undefined} />
    ) : (
      <ThemedView style={styles.loading}>
        {setupCoveredLoading ? null : <DelayedLoader size={40} />}
      </ThemedView>
    );
  }

  if (bootError) return <ErrorView message={strings.journey.loadFailed} onRetry={load} />;

  const daysLeft = data.me?.weddingDate == null ? null : daysUntil(data.me.weddingDate);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Header
            unread={data.unread}
            onPressBell={() => router.push('/my/notifications')}
          />

          <Hero
            me={data.me}
            daysLeft={daysLeft}
            venueName={venueName(data.candidates, data.me)}
            showBudget={false}
            budget={data.budget}
            bracketAnswered={data.bracketAnswered}
            partnerInvitePending={data.partnerInvitePending}
            onPressDate={() => router.push('/my/wedding-settings')}
            onPressVenue={() => router.push('/search?category=hall')}
            onPressBudget={() =>
              router.push(
                data.me?.weddingId == null
                  ? '/my/wedding-settings'
                  : '/wedding?tab=budget' as never
              )
            }
            onPressPartner={() => router.push('/wedding/partner')}
          />

          <PendingPreparation
            statuses={categoryStatuses({ candidates: data.candidates, preparedCategories: data.me?.preparedCategories ?? [] })}
            onOpen={(category) => router.push(`/search?category=${category}`)}
            onMore={() => router.push('/progress')}
            onComplete={() => router.push('/wedding')}
          />

          {recommendationStatus === 'error' ? (
            <View style={styles.block}>
              <ThemedText type="f14">{S['recommend.error']}</ThemedText>
              <ActionButton variant="secondary" label={strings.common['cta.retry']} onPress={load} />
            </View>
          ) : recommendationStatus === 'loading' ? (
            <View style={styles.block}><DelayedLoader size={28} /></View>
          ) : <HomeRecommendations
            groups={data.groups}
            isPicked={(vendorId) => candidates.candidateFor(vendorId) !== null}
            onPressVendor={(vendorId) => router.push(`/search/${vendorId}`)}
            onPressPick={(vendor) => void onPressPick(vendor)}
            onPressCompare={(vendorIds) =>
              router.push({
                pathname: '/search/compare',
                params: { ids: vendorIds.join(',') },
              })
            }
            onPressMore={() => router.push('/recommendations')}
          />}

          <HomeBudget
            budget={data.budget}
            onOpen={() => router.push(data.me?.weddingId == null ? '/my/wedding-settings' : '/wedding?tab=budget' as never)}
          />

          {/* 콘텐츠가 없어도 라운지 진입은 유지한다. */}
          {(
            <View style={styles.block}>
              <View style={styles.sectionHead}>
                <ThemedText type="f20" style={styles.bold}>
                  웨딩피드
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="웨딩피드 자세히"
                  onPress={() => router.push('/community?tab=feed' as never)}
                  style={({ pressed }) => [styles.feedMore, pressed && styles.pressed]}>
                  <ThemedText type="f13" themeColor="textAssistive">
                    {S.more}
                  </ThemedText>
                  <SeedIcon name="chevronRightRegular" size={Layout.iconField} color={theme.textAssistive} />
                </Pressable>
              </View>
              {contentStatus === 'loading' ? <DelayedLoader size={28} /> : contentStatus === 'error' ? (
                <View>
                  <ThemedText type="f13" themeColor="textAssistive">{strings.journey.loadFailed}</ThemedText>
                  <ActionButton variant="secondary" label={strings.common['cta.retry']} onPress={load} />
                </View>
              ) : data.content.length === 0 ? (
                <ThemedText type="f13" themeColor="textAssistive">{strings.community['feed.empty.body']}</ThemedText>
              ) : <WeddingContent items={data.content} onPressItem={(id) => router.push(`/feed/${encodeURIComponent(id)}`)} />}
            </View>
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

/**
 * 예식장 이름. **웨딩홀로 «정한» 업체의 이름이 곧 예식장이다**(2026-09-15 확정).
 *
 * 예식장을 따로 적는 칸을 만들지 않는다 — 이 앱에서 예식장이 정해지는 경로가 그것 하나다.
 * 앱 밖에서 정했다고 온보딩에서 체크만 한 경우에는 업체가 없어 null이고, 그때 히어로는
 * 「예식장 미정」이다. 없는 이름을 지어내지 않는다.
 */
function venueName(candidates: CandidateListResponse | null, me: CurrentUser | null): string | null {
  const hall = categoryStatuses({
    candidates,
    preparedCategories: me?.preparedCategories ?? [],
  }).find((row) => row.category === 'hall');

  return hall?.decidedName ?? null;
}

/**
 * 홈 헤더 — 01-home 정본의 워드마크 · 검색 · 알림 순서를 그대로 둔다.
 * 검색은 Root 검색 화면으로 이동하고, 알림은 MY 알림으로 이동한다.
 */
function Header({ unread, onPressBell }: {
  unread: number;
  onPressBell: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.header}>
      <ThemedText type="f26" style={styles.brand}>
        웨딩픽
      </ThemedText>

      <View style={styles.headerButtons}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasUnread({ unread, total: unread }) ? `알림 ${formatCount(unread)}건` : '알림'}
          onPress={onPressBell}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <SeedIcon name="notificationRegular" size={Layout.iconRow} color={theme.text} />
          {/* 개수를 적지 않는다. 세는 것이 목적이 아니다. */}
          {hasUnread({ unread, total: unread }) ? (
            <View style={[styles.bellDot, { backgroundColor: theme.negative }]} />
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  header: {
    minHeight: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
  },
  brand: { fontWeight: 700, letterSpacing: LetterSpacing.n052 },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  iconButton: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: Radius.pill },

  content: { paddingBottom: Spacing.three },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  block: { paddingHorizontal: Layout.gutter, marginBottom: Layout.sectionGap },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Layout.sectionHeadGapCompact,
    gap: Spacing.two,
  },
  bold: { fontWeight: 700 },
  feedMore: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  semibold: { fontWeight: 600 },

  pressed: { opacity: 0.8 },
});
