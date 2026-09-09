import type {
  CandidateListResponse,
  CurrentUser,
  MyMonthlyDrawResponse,
  VendorSummary,
} from '@weddingpick/api-contract';
import { daysUntil, hasUnread } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAppBootstrap, getMyMonthlyDraw } from '@/api/client';
import {
  Layout,
  MaxContentWidth,
  Motion,
  ProductSymbol,
  ProgressBar,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { DelayedRecommendingView } from '@/features/loading/delayed-loader';
import { BenefitSheet } from '@/features/home/benefit-sheet';
import { hasSeenBenefitSheet, markBenefitSheetSeen } from '@/features/home/benefit-sheet-seen';
import { Board } from '@/features/home/board';
import { listWeddingContent, type WeddingContentItem } from '@/features/home/content';
import { Recommendation } from '@/features/home/recommendation';
import { homeView, type ConditionChip, type HomeView } from '@/features/home/state';
import { WeddingContent } from '@/features/home/wedding-content';
import { isWebShellScreen } from '@/features/webshell/config';
import { WebShellView } from '@/features/webshell/WebShellView';

/**
 * 홈. WP-HOME-001 · 핸드오프 v3.22 `03-home-states.dc.html`.
 *
 * 상태는 **2층**이다(SPEC §13.8). 1층 진행 상황(0개 · 1~8개 · 9개 이상)이 히어로 ·
 * 준비 현황 4칸 · 다음 준비 자리를 정하고, 2층 정보량(실 제보 3건 이상 · 미만)은
 * 금액 글자색과 CTA만 바꾼다. 어느 층도 섹션 순서와 개수를 바꾸지 않는다.
 *
 * 순서는 고정이다. 히어로 → 준비 현황 → 웨딩픽 추천 → 밴드 → 다음 준비 → 웨딩 콘텐츠.
 *
 * **코랄은 네 곳뿐이다**(SPEC §13.13). 준비 현황 현재 업종 테두리 · 진행바 ·
 * 웨딩픽 추천 라벨 · CTA · D-day. 조건 칩 · 완료 표시 · 아바타는 무채색이다.
 *
 * 화면이 무엇을 보여주는지는 전부 `features/home/state.ts`가 정한다. 여기는 그린다.
 */

type HomeData = {
  me: CurrentUser | null;
  candidates: CandidateListResponse | null;
  /** 웨딩픽 추천 자리에 올릴 세 곳. 첫째가 대표, 둘째·셋째가 서브 카드. */
  recommended: readonly VendorSummary[];
  content: readonly WeddingContentItem[];
  /** 안 읽은 알림 수. 벨의 점이 이 값을 본다. */
  unread: number;
};

const EMPTY: HomeData = { me: null, candidates: null, recommended: [], content: [], unread: 0 };

export default function HomeScreen() {
  const [data, setData] = useState<HomeData>(EMPTY);
  /*
   * 한 번이라도 받아왔는가. **자료가 없는 것과 아직 모르는 것은 다르다** — 앞은
   * 시작 전 구간이고 뒤는 스켈레톤이다. 하나로 뭉치면 프로필을 못 불러온 사람에게
   * 영원히 스켈레톤이 돈다.
   */
  // 하이브리드 웹뷰 쉘 POC일 때는 애초에 스켈레톤을 거칠 일이 없어 settled로 시작한다.
  const [settled, setSettled] = useState(() => isWebShellScreen('home'));
  /*
   * 혜택 안내 시트(WP-SHT-017) — 온보딩 완료 후 홈 최초 진입 1회, 400ms 뒤. 남은 응모
   * 조건이 0이면 띄우지 않는다(서버가 응모 완료 알림으로 대신한다). 닫으면 sheetSeen을
   * 저장해 다시 띄우지 않는다.
   */
  const [benefit, setBenefit] = useState<MyMonthlyDrawResponse | null>(null);
  const [benefitOpen, setBenefitOpen] = useState(false);
  const benefitChecked = useRef(false);

  const load = useCallback(() => {
    // 웹뷰 쉘로 대체할 때는 이 밑 자료를 안 쓴다 — 훅 순서를 지키려고 호출
    // 자체는 남기고, 몸통만 건너뛴다.
    if (isWebShellScreen('home')) return;

    void listWeddingContent()
      .then((content) => setData((current) => ({ ...current, content })))
      .catch(() => undefined);

    /*
     * 회원 · 알림 · 담아둔 후보 · 웨딩픽 추천을 한 번에 받는다(GET /v1/app/bootstrap).
     * 서버 안에서 병렬로 모은 것이라 기기가 인터넷을 여러 번 왕복하지 않는다.
     */
    void getAppBootstrap()
      .then((boot) => {
        setData((current) => ({
          ...current,
          me: boot.member,
          candidates: boot.candidates,
          recommended: boot.recommendations,
          unread: boot.notifications?.unread ?? 0,
        }));
      })
      .catch(() => undefined)
      .finally(() => setSettled(true));
  }, []);

  useEffect(load, [load]);

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

  // 하이브리드 웹뷰 쉘 POC. `EXPO_PUBLIC_WEBSHELL_SCREENS`에 "home"이 없으면
  // (기본값) 이 분기는 타지 않고 기존 네이티브 화면 그대로다.
  if (isWebShellScreen('home')) {
    return <WebShellView path="/" />;
  }

  /*
   * 첫 진입 — 추천을 계산하는 동안 업종 순회 로딩(WP-ST-015). 웨딩픽이 무엇을
   * 보고 있는지 순서대로 보여준다. 핸드오프 v3.15 «추천 계산 · 첫 진입».
   */
  if (!settled) {
    return <DelayedRecommendingView nickname={data.me?.displayName ?? undefined} />;
  }

  const daysLeft = data.me?.weddingDate == null ? null : daysUntil(data.me.weddingDate);
  const view = homeView({
    me: data.me,
    candidates: data.candidates,
    recommended: data.recommended,
    daysLeft,
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header unread={data.unread} onPressBell={() => router.push('/my/notifications')} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Hero me={data.me} view={view} daysLeft={daysLeft} />

          {/* 준비 현황 — 항상 4칸. 완료 개수는 격자가 아니라 헤더 링크에 적는다. */}
          <ThemedView style={styles.block}>
            <ThemedView style={styles.section}>
              <View style={styles.sectionHead}>
                <ThemedText type="t4">준비 현황</ThemedText>
                {/* 시작 전 구간에는 링크가 없다(시안 1) — 펼쳐도 빈 칸 12개다. */}
                {view.boardMore === null ? null : (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => router.push('/progress')}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedText type="t7" themeColor="textAssistive" style={styles.more}>
                      {view.boardMore}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              <Board
                cells={view.cells}
                onPressCategory={(category) => router.push(`/pick?category=${category}`)}
              />
              {view.boardNote === null ? null : (
                <ThemedText type="t7" themeColor="textAssistive">
                  {view.boardNote}
                </ThemedText>
              )}
            </ThemedView>
          </ThemedView>

          {/* 웨딩픽 추천 — 근거(조건 칩 · 금액 줄)와 행동(CTA)이 이 안에 함께 있다. */}
          <ThemedView style={styles.block}>
            <Recommendation
              categoryLabel={view.currentLabel}
              chips={view.chips}
              vendors={data.recommended}
              cta={view.cta}
              onPressChip={(chip) => openSearchWithout(chip, view, data.me)}
              onPressVendor={openVendor}
              onPressCta={() => {
                if (view.cta.kind === 'compare') {
                  /* 홈 추천 CTA — 추천 세 곳이 그대로 A·B·C(SPEC §13.11). */
                  router.push({
                    pathname: '/search/compare',
                    params: { ids: view.cta.ids.join(',') },
                  });
                } else {
                  router.push('/capture');
                }
              }}
            />
          </ThemedView>

          <Band />

          {view.next === null ? null : (
            <ThemedView style={styles.block}>
              <ThemedView style={styles.section}>
                <ThemedText type="t4">{view.next.title}</ThemedText>
                <NextRow
                  name={view.next.name}
                  meta={view.next.meta}
                  aside={view.next.aside}
                  onPress={() => {
                    const target = view.next!.target;

                    if (target.kind === 'capture') router.push('/capture');
                    else router.push(`/pick?category=${target.category}`);
                  }}
                />
              </ThemedView>
            </ThemedView>
          )}

          <ContentSection
            title={data.me?.spouseLinked === true ? '두 분을 위한 웨딩 정보' : '웨딩 정보'}
            items={data.content}
          />
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
    </ThemedView>
  );
}

/**
 * 조건 칩을 누르면 **그 조건을 뺀** 검색 결과로 간다(SPEC §13.8).
 *
 * 검색이 실제로 거르는 축은 업종과 지역뿐이다 — 예산·스타일·날짜 칩은 업종과
 * 지역만 들고 간다. 지역 칩을 누르면 지역을 뺀다.
 */
function openSearchWithout(chip: ConditionChip, view: HomeView, me: CurrentUser | null) {
  const params: Record<string, string> = {};

  if (view.current !== null) params.category = view.current;
  if (chip.kind !== 'region' && me?.region != null) params.region = me.region;

  router.push({ pathname: '/search', params });
}

/* ------------------------------------------------------------------ 히어로 */

/**
 * 히어로. 아바타 + 닉네임 ↔ D-day, 26px 두 줄 제목, 진행바 + N / 12.
 *
 * **D-day는 코랄이다**(2026-09-09 사용자 오더 · screens.json WP-HOME-001 «D-day 15 coral»).
 * v3.21이 홈 코랄을 네 곳으로 줄이며 D-day를 무채색으로 바꿨는데, 그러면 예식일이
 * 화면에서 사라진다 — 홈에서 가장 먼저 찾는 값이라 다섯째 코랄로 되돌린다.
 * 시안의 D-day 15px은 토큰 사다리에 없어 14(t7).
 */
function Hero({ me, view, daysLeft }: { me: CurrentUser | null; view: HomeView; daysLeft: number | null }) {
  return (
    <ThemedView style={styles.hero}>
      <View style={styles.who}>
        <Avatar name={me?.displayName ?? null} />
        <ThemedText type="t7" themeColor="textSecondary" numberOfLines={1} style={styles.whoName}>
          {identityLine(me)}
        </ThemedText>
        <ThemedText type="t7" numeric themeColor="tint" style={styles.dday}>
          {daysLeft === null ? '예식일 미정' : `D-${daysLeft}`}
        </ThemedText>
      </View>

      <ThemedText type="t2">
        {view.hero.line1}
        {'\n'}
        {view.hero.line2}
      </ThemedText>

      <View style={styles.progressRow}>
        {/* 시안 track: 6 · #EAEBEE(border) · 채움 coral. ProgressBar 기본값이 그대로다. */}
        <View style={styles.progressTrack}>
          <ProgressBar value={view.progress} />
        </View>
        <ThemedText type="micro" numeric themeColor="textAssistive">
          {view.progressText}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

/**
 * 히어로의 이름 줄. 배우자가 연결돼 있고 이름을 정했으면 «지수 · 준호».
 *
 * 이름이 없는 사람에게 없는 이름을 지어내 부르지 않는다 — 그때는 «우리»다.
 */
function identityLine(me: CurrentUser | null): string {
  const name = me?.displayName ?? '우리';

  if (me?.spouseLinked === true && me.partnerDisplayName !== null) {
    return `${name} · ${me.partnerDisplayName}`;
  }

  return name;
}

/** 아바타 24 원형. 무채색 — 사진이 오기 전까지 첫 글자다. */
function Avatar({ name }: { name: string | null }) {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="t7" themeColor="textSecondary" style={styles.avatarLabel}>
        {(name ?? '우').slice(0, 1)}
      </ThemedText>
    </View>
  );
}

/* ---------------------------------------------------------------- 공통 조각 */

function Header({ unread, onPressBell }: { unread: number; onPressBell: () => void }) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.header}>
      <ThemedText type="t4">웨딩픽</ThemedText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasUnread({ unread, total: unread }) ? `알림 ${unread}건` : '알림'}
        onPress={onPressBell}
        style={({ pressed }) => [styles.bell, pressed && styles.pressed]}>
        {/* 시안 head 아이콘 stroke #212124. */}
        <ProductSymbol name="bell" size={Layout.iconTab} color={theme.text} />
        {/* 개수를 적지 않는다. 세는 것이 목적이 아니다. */}
        {hasUnread({ unread, total: unread }) ? (
          <View style={[styles.bellDot, { backgroundColor: theme.negative }]} />
        ) : null}
      </Pressable>
    </ThemedView>
  );
}

/** 다음 준비 한 줄 — 제목 + 메타 + 오른쪽 표시 + chevron. */
function NextRow({
  name,
  meta,
  aside,
  onPress,
}: {
  name: string;
  meta: string;
  aside: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.nextRow, pressed && styles.pressed]}>
      <View style={styles.nextBody}>
        <ThemedText type="t5" numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="t7" themeColor="textAssistive" numberOfLines={2}>
          {meta}
        </ThemedText>
      </View>
      <ThemedText type="t7" numeric themeColor="textAssistive" style={styles.nextAside}>
        {aside}
      </ThemedText>
      <View style={styles.nextChevron}>
        <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />
      </View>
    </Pressable>
  );
}

/**
 * 콘텐츠가 없으면 섹션째 접는다 — 빈 자리를 제목으로 알리지 않는다.
 *
 * 앞의 밴드도 함께 접는다. 섹션이 없는데 밴드만 남으면 화면 끝에 회색 띠 하나가
 * 이유 없이 놓인다.
 */
function ContentSection({
  title,
  items,
}: {
  title: string;
  items: readonly WeddingContentItem[];
}) {
  if (items.length === 0) return null;

  return (
    <>
      <Band />
      <ThemedView style={styles.block}>
        <ThemedView style={styles.section}>
          <ThemedText type="t4">{title}</ThemedText>
          <WeddingContent items={items} onPressItem={(id) => router.push(`/search?content=${id}`)} />
        </ThemedView>
      </ThemedView>
    </>
  );
}

/** 섹션을 가르는 회색 밴드. 그림자 대신 이것으로 구획한다. */
function Band() {
  const theme = useTheme();

  return <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />;
}

function openVendor(vendorId: string) {
  router.push(`/search/${vendorId}`);
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  /*
   * 시안 head: 56 · padding 0 24. 03-home(오른쪽 20)과 03-home-states(오른쪽 24)가 갈려
   * 최신인 03-home-states를 따른다(2026-09-09 패딩 감사).
   */
  header: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
  },
  bell: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: Radius.pill },

  /*
   * 가로 여백을 여기 두지 않는다. 회색 밴드가 화면 끝까지 닿아야 해서, 거터는
   * 섹션마다 준다.
   */
  content: { paddingBottom: Spacing.two },

  /* 시안 heroWrap: padding 14 24 24 · gap 10. */
  hero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: 14,
    paddingBottom: Layout.gutter,
    gap: Layout.cardGap,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  whoName: { flexShrink: 1, fontWeight: 700 },
  dday: { marginLeft: 'auto', fontWeight: 700 },
  avatar: {
    width: Layout.iconTab,
    height: Layout.iconTab,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { fontWeight: 700 },
  /* 시안 progRow: gap 10 · padding-top 2 · track 6 r999 · progText 13/18 700. */
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Layout.cardGap, paddingTop: Spacing.half },
  progressTrack: { flex: 1 },

  block: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
  /* 시안 padSec: gap 11. */
  section: { gap: Layout.gap2col },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three - 4,
  },
  more: { fontWeight: 700 },
  band: { height: Layout.sectionBand, marginBottom: Layout.sectionGap },

  pressed: { opacity: 0.8 },

  /* 시안 nextRow: gap 12 · min-height 56 · padding 12 0. */
  nextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three - 4,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY,
  },
  nextBody: { flex: 1, minWidth: 0, gap: 3 },
  nextAside: { paddingTop: 3 },
  nextChevron: { paddingTop: 3 },
});
