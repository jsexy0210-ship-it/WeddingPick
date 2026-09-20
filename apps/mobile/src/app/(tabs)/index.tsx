import type {
  AppBootstrapResponse,
  CandidateListResponse,
  CategoryRecommendation,
  CurrentUser,
  MyMonthlyDrawResponse,
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAppBootstrap, getCategoryRecommendations, getMyMonthlyDraw } from '@/api/client';
import {
  ActionButton,
  ErrorView,
  Layout,
  LetterSpacing,
  MaxContentWidth,
  Motion,
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
import { BenefitSheet } from '@/features/home/benefit-sheet';
import { hasSeenBenefitSheet, markBenefitSheetSeen } from '@/features/home/benefit-sheet-seen';
import { listWeddingContent, type WeddingContentItem } from '@/features/home/content';
import { Hero } from '@/features/home/hero';
import { HomeBudget, PendingPreparation } from '@/features/home/home-summary';
import { HomeRecommendations } from '@/features/home/pick-recommend';
import { categoryStatuses } from '@/features/home/state';
import { WeddingContent } from '@/features/home/wedding-content';
import { PickDoneSheet, UnpickSheet } from '@/features/pick/pick-sheets';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import { isWebShellScreen } from '@/features/webshell/config';
import { WebShellView } from '@/features/webshell/WebShellView';
import strings from '../../../../../spec/strings.ko.json';

const S = strings.home;
const HOME_FEED_PREVIEW_COUNT = 2;

/**
 * 홈. WP-HOME-001.
 *
 * 화면 모양과 섹션 순서는 `docs/design/figma-export/01-home.dc.html`이 정한다.
 * 수치·문구·상태는 `docs/design/handoff/`를 적용하되 화면 골격을 바꾸지 않는다.
 * 코랄 D-day → 남은 준비 → 가로 추천 → 예산현황 → 웨딩피드 순서를 유지한다.
 */

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
  const [data, setData] = useState<HomeData>(EMPTY);
  const [bootError, setBootError] = useState(false);
  const [recommendationStatus, setRecommendationStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [contentStatus, setContentStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  /*
   * 한 번이라도 받아왔는가. **자료가 없는 것과 아직 모르는 것은 다르다** — 앞은
   * 시작 전 구간이고 뒤는 스켈레톤이다. 하나로 뭉치면 프로필을 못 불러온 사람에게
   * 영원히 스켈레톤이 돈다.
   */
  // 하이브리드 웹뷰 쉘 POC일 때는 애초에 스켈레톤을 거칠 일이 없어 settled로 시작한다.
  const [settled, setSettled] = useState(() => isWebShellScreen('home'));
  const [fullScreen] = useState(takeFullScreenLoading);
  const [setupCoveredLoading] = useState(takeHomeLoadingCoveredBySetup);
  /*
   * 혜택 안내 시트(WP-SHT-017) — 온보딩 완료 후 홈 최초 진입 1회, 400ms 뒤. 남은 응모
   * 조건이 0이면 띄우지 않는다(서버가 응모 완료 알림으로 대신한다). 닫으면 sheetSeen을
   * 저장해 다시 띄우지 않는다.
   */
  const [benefit, setBenefit] = useState<MyMonthlyDrawResponse | null>(null);
  const [benefitOpen, setBenefitOpen] = useState(false);
  const benefitChecked = useRef(false);
  const candidates = useMyCandidates();
  const reloadCandidates = candidates.reload;
  const [pickDoneOpen, setPickDoneOpen] = useState(false);
  const [unpickTarget, setUnpickTarget] = useState<VendorCandidate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    // 웹뷰 쉘로 대체할 때는 이 밑 자료를 안 쓴다 — 훅 순서를 지키려고 호출
    // 자체는 남기고, 몸통만 건너뛴다.
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

    /*
     * 회원 · 알림 · 담아둔 후보 · 개인화 추천을 한 번에 받는다(GET /v1/app/bootstrap).
     * 서버 안에서 병렬로 모은 것이라 기기가 인터넷을 여러 번 왕복하지 않는다.
     */
    void getAppBootstrap()
      .then((boot) => {
        if (!current()) return;
        setData((previous) => ({
          ...previous,
          me: boot.member,
          candidates: boot.candidates,
          budget: boot.budget,
          bracketAnswered: boot.bracketAnswered,
          partnerInvitePending: boot.partnerInvitePending,
          unread: boot.notifications?.unread ?? 0,
        }));
      })
      .catch(() => { if (current()) setBootError(true); })
      .finally(() => { if (current()) setSettled(true); });

    void getCategoryRecommendations(HOME_RECOMMEND_CATEGORIES)
      .then((response) => {
        if (!current()) return;
        setData((previous) => ({
          ...previous,
          groups: response.groups,
          remaining: response.remaining,
          remainingCategories: response.remainingCategories,
        }));
        setRecommendationStatus('ready');
      })
      .catch(() => { if (current()) setRecommendationStatus('error'); });
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    void reloadCandidates().catch(() => undefined);
    return () => { loadVersion.current += 1; };
  }, [load, reloadCandidates]));

  useEffect(() => {
    if (!settled || data.me?.setupComplete !== true || benefitChecked.current) return;
    benefitChecked.current = true;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    void hasSeenBenefitSheet().then(async (seen) => {
      if (seen || !alive) return;
      try {
        const draw = await getMyMonthlyDraw();
        if (!alive) return;
        if (draw.remaining === 0) {
          // 조건을 다 채웠다 — 시트 대신 응모 완료 알림. 다시 묻지 않는다.
          void markBenefitSheetSeen();
          return;
        }
        setBenefit(draw);
        timer = setTimeout(() => setBenefitOpen(true), Motion.benefitSheetDelay.duration);
      } catch {
        // 혜택 현황을 못 받았으면 시트를 띄우지 않는다. 다음 진입에 한 번 더 본다.
      }
    });

    return () => {
      alive = false;
      if (timer !== null) clearTimeout(timer);
    };
  }, [settled, data.me?.setupComplete]);

  const dismissBenefit = useCallback(() => {
    setBenefitOpen(false);
    void markBenefitSheetSeen();
  }, []);

  const openBenefit = useCallback(() => {
    setBenefitOpen(false);
    void markBenefitSheetSeen();
    router.push('/my/rewards');
  }, []);

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

  /*
   * 첫 진입 — 추천을 계산하는 동안 업종 순회 로딩(WP-ST-015). 서비스가 무엇을
   * 보고 있는지 순서대로 보여준다. 핸드오프 v3.15 «추천 계산 · 첫 진입».
   */
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
        <Header
          unread={data.unread}
          onPressSearch={() => router.push('/search')}
          onPressBell={() => router.push('/my/notifications')}
        />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
            statuses={categoryStatuses({
              candidates: data.candidates,
              preparedCategories: data.me?.preparedCategories ?? [],
            })}
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
          ) : (
            <HomeRecommendations
              groups={data.groups}
              isPicked={(vendorId) => candidates.candidateFor(vendorId) !== null}
              onPressVendor={(vendorId) => router.push(`/search/${vendorId}`)}
              onPressPick={(vendor) => void onPressPick(vendor)}
              onPressCompare={(vendorIds) =>
                router.push({ pathname: '/search/compare', params: { ids: vendorIds.join(',') } })
              }
              onPressMore={() => router.push('/recommendations')}
            />
          )}

          <HomeBudget
            budget={data.budget}
            onOpen={() => router.push(
              data.me?.weddingId == null
                ? '/my/wedding-settings'
                : '/wedding?tab=budget' as never
            )}
          />

          <View style={styles.block}>
            <View style={styles.sectionHead}>
              <ThemedText type="f20" style={styles.bold}>웨딩피드</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="웨딩피드 자세히"
                onPress={() => router.push('/community?tab=feed' as never)}
                style={({ pressed }) => [styles.feedMore, pressed && styles.pressed]}>
                <ThemedText type="f13" themeColor="textAssistive">{S.more}</ThemedText>
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
            ) : (
              <WeddingContent
                items={data.content}
                onPressItem={(id) => router.push(`/feed/${encodeURIComponent(id)}`)}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {benefit ? (
        <BenefitSheet
          visible={benefitOpen}
          draw={benefit}
          onDismiss={dismissBenefit}
          onOpenBenefit={openBenefit}
        />
      ) : null}
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

/* ---------------------------------------------------------------- 공통 조각 */

function Header({
  unread,
  onPressSearch,
  onPressBell,
}: {
  unread: number;
  onPressSearch: () => void;
  onPressBell: () => void;
}) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.header}>
      <ThemedText type="f26" style={styles.brand}>웨딩픽</ThemedText>

      <View style={styles.headerButtons}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="검색"
          onPress={onPressSearch}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <SeedIcon name="searchRegular" size={Layout.iconRow} color={theme.text} />
        </Pressable>
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
    </ThemedView>
  );
}

/** 웨딩홀로 최종 결정한 업체 이름이 예식장 이름이다. */
function venueName(candidates: CandidateListResponse | null, me: CurrentUser | null): string | null {
  const hall = categoryStatuses({
    candidates,
    preparedCategories: me?.preparedCategories ?? [],
  }).find((row) => row.category === 'hall');

  return hall?.decidedName ?? null;
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  pressed: { opacity: 0.8 },
});
