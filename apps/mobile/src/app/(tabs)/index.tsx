import type {
  AppBootstrapResponse,
  CandidateListResponse,
  CategoryRecommendation,
  CurrentUser,
  ExpoItem,
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
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getAppBootstrap,
  getCategoryRecommendations,
  getMyMonthlyDraw,
  listExpos,
} from '@/api/client';
import {
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
import { takeFullScreenLoading } from '@/features/loading/first-run';
import { BenefitSheet } from '@/features/home/benefit-sheet';
import { hasSeenBenefitSheet, markBenefitSheetSeen } from '@/features/home/benefit-sheet-seen';
import { listWeddingContent, type WeddingContentItem } from '@/features/home/content';
import { EventBanner } from '@/features/home/event-banner';
import { ExpoStrip } from '@/features/home/expo-strip';
import { Hero } from '@/features/home/hero';
import { PickRecommend } from '@/features/home/pick-recommend';
import { useOpenCategory } from '@/features/home/use-open-category';
import { categoryStatuses } from '@/features/home/state';
import { WeddingContent } from '@/features/home/wedding-content';
import { PickDoneSheet, UnpickSheet } from '@/features/pick/pick-sheets';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import { isWebShellScreen } from '@/features/webshell/config';
import { WebShellView } from '@/features/webshell/WebShellView';

/**
 * 홈 — 2026-09-15 대표 사양(홈 전면 개편).
 *
 * **홈은 전체 카테고리를 나열하는 검색 페이지가 아니다**(§1). 사용자가 여기서 빠르게
 * 확인하는 것은 남은 기간 · 예식 정보 · 예산 · 커플 연결 · 지금 고를 업종과 그 업종의
 * 업체 · 가까운 박람회 · 읽을거리 · 진행 중인 혜택이다.
 *
 *   1 히어로 → 2 Pick 추천 → 3 박람회 → 4 웨딩피드 → 5 이벤트      (§1 · 고정 순서)
 *
 * **옛 홈에서 빠진 것과 근거.**
 * - 준비현황 2×2(`Board`)는 Pick 추천에 흡수됐다 — 상태를 보는 곳과 업체를 보는 곳이 따로
 *   있으면 무엇을 정할지 알고도 한 번 더 눌러야 업체가 나온다.
 * - 카테고리 6 그리드(`CategoryGrid`)는 뺐다 — §19 「전체 카테고리 목록은 홈에 직접
 *   나열하지 않는다」. 전체 업종으로 가는 길은 상단 검색이다.
 * - 조건 칩 · 「N곳 비교하기」는 뺐다 — §4가 카테고리 헤더의 개수 표시를 금지한다.
 * - `Board` · `CategoryGrid` · `Recommendation` 파일 자체는 남겨 뒀다(다른 화면이 쓰지는
 *   않는다). 지울지는 MASTER가 정한다.
 *
 * **피그마와의 관계.** 이 구조는 피그마에 없다. 구조는 대표 사양이 이기고(2026-09-15
 * 「저대로 만들어」), 값(색 · 여백 · 타이포 · 곡률)은 피그마 규칙과 `spec/tokens.json`에서
 * 온다 — 좌우 20(`Layout.pageX`) · SEED 토큰 · Pretendard. 화면 코드에 hex · px를 적지 않는다.
 */

/** 홈이 웨딩피드에서 보여주는 카드 수(§17 「홈 최대 3건」). */
const HOME_FEED_PREVIEW_COUNT = 3;

/** 홈이 박람회에서 보여주는 카드 수(§16 「홈 최대 3건」). */
const HOME_EXPO_COUNT = 3;

type HomeData = {
  me: CurrentUser | null;
  candidates: CandidateListResponse | null;
  budget: AppBootstrapResponse['budget'];
  bracketAnswered: boolean;
  partnerInvitePending: boolean;
  groups: readonly CategoryRecommendation[];
  remaining: number;
  remainingCategories: readonly VendorCategory[];
  expos: readonly ExpoItem[];
  content: readonly WeddingContentItem[];
  draw: MyMonthlyDrawResponse | null;
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
  expos: [],
  content: [],
  draw: null,
  unread: 0,
};

export default function HomeScreen() {
  const [data, setData] = useState<HomeData>(EMPTY);
  /*
   * 한 번이라도 받아왔는가. **자료가 없는 것과 아직 모르는 것은 다르다** — 앞은
   * 시작 전 구간이고 뒤는 로더다. 하나로 뭉치면 프로필을 못 불러온 사람에게
   * 영원히 로더가 돈다.
   */
  const [settled, setSettled] = useState(() => isWebShellScreen('home'));
  const [benefitOpen, setBenefitOpen] = useState(false);
  const benefitChecked = useRef(false);
  /*
   * 이 홈이 전체 화면 로딩을 써도 되는가. 마운트 때 한 번만 묻는다 — 렌더마다 물으면
   * 첫 렌더가 예산을 쓰고 두 번째 렌더가 못 받아 로더가 도중에 바뀐다.
   */
  const [fullScreen] = useState(takeFullScreenLoading);
  /*
   * 지금 펼쳐진 업종. **한 번에 하나만 펼쳐진다**(§5) — 기본은 첫 업종이고, 업종을 정해
   * 목록이 바뀌면 다음 업종이 자동으로 펼쳐진다(§8). 규칙은 훅 하나에 있다.
   */
  const { open, toggle } = useOpenCategory(data.groups);
  const candidates = useMyCandidates();
  const [pickDoneOpen, setPickDoneOpen] = useState(false);
  const [unpickTarget, setUnpickTarget] = useState<VendorCandidate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    // 웹뷰 쉘로 대체할 때는 이 밑 자료를 안 쓴다 — 훅 순서를 지키려고 호출
    // 자체는 남기고, 몸통만 건너뛴다.
    if (isWebShellScreen('home')) return;

    void listWeddingContent(HOME_FEED_PREVIEW_COUNT)
      .then((content) => setData((current) => ({ ...current, content })))
      .catch(() => undefined);

    /*
     * 박람회 — 가까운 일정부터. **종료된 것은 내보내지 않는다**(§16). 서버가 `status`를
     * 내려주므로 여기서 거른다. 셋을 채우려고 끝난 행사를 끌어오지 않는다.
     */
    void listExpos({ sort: 'date' })
      .then(({ items }) =>
        setData((current) => ({
          ...current,
          expos: items.filter((expo) => expo.status !== 'closed').slice(0, HOME_EXPO_COUNT),
        }))
      )
      .catch(() => undefined);

    /* 회원 · 알림 · 담아둔 후보 · 히어로의 예산과 초대를 한 번에 받는다. */
    void getAppBootstrap()
      .then((boot) => {
        setData((current) => ({
          ...current,
          me: boot.member,
          candidates: boot.candidates,
          budget: boot.budget,
          bracketAnswered: boot.bracketAnswered,
          partnerInvitePending: boot.partnerInvitePending,
          unread: boot.notifications?.unread ?? 0,
        }));
      })
      .catch(() => undefined)
      .finally(() => setSettled(true));

    /*
     * Pick 추천 — 홈은 앞의 셋만 받는다. 「웨딩픽 추천」 전체 페이지가 같은 엔드포인트를
     * `limit` 없이 부른다(§12 · §14 — 같은 추천 데이터, 별도 상태 복제 금지).
     * 로그인 전에는 세울 업종이 없어 빈 목록이다.
     */
    void getCategoryRecommendations(HOME_RECOMMEND_CATEGORIES)
      .then((response) =>
        setData((current) => ({
          ...current,
          groups: response.groups,
          remaining: response.remaining,
          remainingCategories: response.remainingCategories,
        }))
      )
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (!settled || data.me?.setupComplete !== true || benefitChecked.current) return;
    benefitChecked.current = true;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    void hasSeenBenefitSheet().then(async (seen) => {
      try {
        const draw = await getMyMonthlyDraw();
        if (!alive) return;
        /* 이벤트 배너가 이 값을 쓴다 — 시트를 이미 봤어도 배너는 계속 선다. */
        setData((current) => ({ ...current, draw }));

        if (seen) return;
        if (draw.remaining === 0) {
          // 조건을 다 채웠다 — 시트 대신 응모 완료 알림. 다시 묻지 않는다.
          void markBenefitSheetSeen();
          return;
        }
        timer = setTimeout(() => setBenefitOpen(true), Motion.benefitSheetDelay.duration);
      } catch {
        // 혜택 현황을 못 받았으면 시트도 배너도 없다. 다음 진입에 한 번 더 본다.
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

  /** 카드의 하트. Pick 전이면 후보에 담고 완료 시트, Pick 후면 해제 시트. 로그인 전이면 로그인으로. */
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
        <DelayedLoader size={40} />
      </ThemedView>
    );
  }

  const daysLeft = data.me?.weddingDate == null ? null : daysUntil(data.me.weddingDate);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Header unread={data.unread} onPressBell={() => router.push('/my/notifications')} />

          <Hero
            me={data.me}
            daysLeft={daysLeft}
            venueName={venueName(data.candidates, data.me)}
            budget={data.budget}
            bracketAnswered={data.bracketAnswered}
            partnerInvitePending={data.partnerInvitePending}
            onPressDate={() => router.push('/my/wedding-settings')}
            onPressVenue={() => openHall(data.groups, toggle, open)}
            onPressBudget={() =>
              router.push(
                data.me?.weddingId == null
                  ? '/my/wedding-settings'
                  : `/wedding/${data.me.weddingId}/expenses`
              )
            }
            onPressPartner={() => router.push('/wedding/partner')}
          />

          <PickRecommend
            groups={data.groups}
            open={open}
            onToggle={toggle}
            remaining={data.remaining}
            remainingCategories={data.remainingCategories}
            isPicked={(vendorId) => candidates.candidateFor(vendorId) !== null}
            onPressVendor={(vendorId) => router.push(`/search/${vendorId}`)}
            onPressPick={(vendor) => void onPressPick(vendor)}
            onPressCompare={(category) => router.push(`/pick/${category}`)}
            onPressMore={() => router.push('/recommendations')}
          />

          <ExpoStrip
            items={data.expos}
            onPressExpo={(expoId) => router.push(`/search/expo/${expoId}`)}
            onPressMore={() => router.push('/search/expo')}
          />

          {/* 웨딩피드 — 콘텐츠가 없으면 섹션째 접는다. 빈 자리를 제목으로 알리지 않는다. */}
          {data.content.length === 0 ? null : (
            <View style={styles.block}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadText}>
                  <ThemedText type="f14" style={styles.semibold}>
                    웨딩피드
                  </ThemedText>
                  <ThemedText type="f12" themeColor="textAssistive" style={styles.sub}>
                    지금 알아두면 좋은 것만 모았어요
                  </ThemedText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="웨딩피드 전체 보기"
                  onPress={() => router.push('/feed')}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedText type="f12" style={styles.semibold}>
                    더보기
                  </ThemedText>
                </Pressable>
              </View>
              <WeddingContent items={data.content} onPressItem={(id) => router.push(`/feed/${id}`)} />
            </View>
          )}

          <EventBanner draw={data.draw} onPress={() => router.push('/my/rewards')} />
        </ScrollView>
      </SafeAreaView>

      {data.draw ? (
        <BenefitSheet
          visible={benefitOpen}
          draw={data.draw}
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
 * 「예식장 미정」을 눌렀을 때 — 웨딩홀 추천으로 잇는다(§3-2).
 *
 * 홈을 떠나지 않는다. 웨딩홀이 아직 목록에 있으면 그 아코디언을 펼치는 것이 가장 짧은
 * 길이고, 거기에 이미 추천 업체가 들어 있다. 목록에 없으면(정했거나 목록 밖) 검색으로 간다.
 */
function openHall(
  groups: readonly CategoryRecommendation[],
  toggle: (category: VendorCategory) => void,
  open: VendorCategory | null
): void {
  if (groups.some((group) => group.category === 'hall')) {
    /* 이미 펼쳐져 있으면 그대로 둔다 — 여기서 toggle을 부르면 도리어 접힌다. */
    if (open !== 'hall') toggle('hall');
    return;
  }

  router.push('/search?category=hall');
}

/**
 * 헤더 — 브랜드 · 검색 · 알림(§2).
 *
 * 검색 단추가 검색의 유일한 입구다(2026-09-14 대표 지시 — 검색은 탭에서 내렸다).
 * **전체 업종 목록은 홈에 나열하지 않는다**(§19) — 그 길이 이 단추다.
 */
function Header({ unread, onPressBell }: { unread: number; onPressBell: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.header}>
      <ThemedText type="f26" style={styles.brand}>
        웨딩픽
      </ThemedText>

      <View style={styles.headerButtons}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="업체 검색"
          onPress={() => router.push('/search')}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.four,
    paddingHorizontal: Layout.pageX,
    paddingBottom: Spacing.three,
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

  block: { paddingHorizontal: Layout.pageX, marginBottom: Spacing.four },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Layout.sectionHeadGapCompact,
    gap: Spacing.two,
  },
  sectionHeadText: { flex: 1, minWidth: 0 },
  sub: { marginTop: Spacing.half },
  semibold: { fontWeight: 600 },

  pressed: { opacity: 0.8 },
});
