import type {
  CandidateListResponse,
  CurrentUser,
  MyMonthlyDrawResponse,
  VendorCandidate,
  VendorSummary,
} from '@weddingpick/api-contract';
import { daysUntil, hasUnread } from '@weddingpick/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAppBootstrap, getMyMonthlyDraw } from '@/api/client';
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
import { Board } from '@/features/home/board';
import { CategoryGrid } from '@/features/home/category-grid';
import { listWeddingContent, type WeddingContentItem } from '@/features/home/content';
import {
  DEFAULT_HOME_LAYOUT,
  readHomeLayout,
  visibleHomeSections,
  type HomeLayout,
  type HomeSectionKey,
} from '@/features/home/layout';
import { Recommendation } from '@/features/home/recommendation';
import { homeView, type HomeView } from '@/features/home/state';
import { WeddingContent } from '@/features/home/wedding-content';
import { PickDoneSheet, UnpickSheet } from '@/features/pick/pick-sheets';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import { isWebShellScreen } from '@/features/webshell/config';
import { WebShellView } from '@/features/webshell/WebShellView';

/**
 * 홈 — 규격서 docs/figma-spec/home.txt(2026-09-15 대표 지시 「규격서의 수를 그대로」).
 *
 * 위에서부터 header → 히어로 → 준비현황 → 웨딩픽 추천 → 카테고리 → 웨딩피드. 규격서의 수는
 * 각 조각의 주석에 그대로 적었다(`Header` · `Hero` · 아래 `styles`). 히어로는 늘 맨 위 고정이고,
 * 그 아래는 홈 편집(WP-HOME-007)이 정한 순서를 따른다.
 *
 * **규격서와 다르게 둔 것과 근거.**
 * - 옛 홈의 회색 밴드 · 조건 칩 · «다음 준비» 줄 · 준비 현황 «더 보기» 링크 · 히어로의 두 줄 제목과
 *   진행바는 규격서에 없어 뺐다. 홈 편집의 «다음 준비» 항목은 켜도 아무것도 그리지 않는다(판단 필요 —
 *   PR 본문).
 * - 홈 편집 진입 줄은 규격서에 없지만 남긴다 — 온보딩이 «홈 맨 아래 홈 편집에서 바꿀 수 있어요»라고
 *   약속한 주소다(보이는 것이 아니라 부르는 주소).
 * - 히어로 «서울 그랜드 워커힐»(예식장)은 우리 계약(`CurrentUser`)에 없어 지역으로 대신한다.
 * - 아바타 면 `#F7D2C4` · `#C9DAEC`, 준비현황 하늘색 `#F0F9FF` · `#B8E6FE` · `#0084D1`은 토큰에 없다 —
 *   색은 MASTER 몫이라 만들지 않고 있는 토큰으로 두고 PR에 보고했다.
 * - 히어로 «더보기» 24 단추는 피그마에서 히어로 색 팔레트를 연다. 팔레트는 넣지 않기로 했던
 *   자리(2026-09-14)라 단추만 그리고 잠가 둔다(판단 필요 — PR 본문).
 *
 * 화면이 무엇을 보여주는지는 전부 `features/home/state.ts`가 정한다. 여기는 그린다.
 */

type HomeData = {
  me: CurrentUser | null;
  candidates: CandidateListResponse | null;
  /** 웨딩픽 추천 자리에 올릴 곳들 — 가로 카드. */
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
  /*
   * 홈 편집이 정한 구성. 기기에서 읽으므로 기본값으로 시작한다 — 읽는 동안 홈이
   * 비어 보이면 안 된다. 편집하고 돌아왔을 때 반영되도록 화면이 뜰 때마다 다시 읽는다.
   */
  const [layout, setLayout] = useState<HomeLayout>(DEFAULT_HOME_LAYOUT);
  /*
   * 이 홈이 전체 화면 로딩을 써도 되는가. 마운트 때 한 번만 묻는다 — 렌더마다 물으면
   * 첫 렌더가 예산을 쓰고 두 번째 렌더가 못 받아 로더가 도중에 바뀐다.
   */
  const [fullScreen] = useState(takeFullScreenLoading);
  /*
   * 추천 카드의 하트 — 검색 카드와 같은 Pick이다(SPEC §13.1). 담으면 완료 시트, 빼는 것은
   * 해제 시트로 한 번 더 묻는다.
   */
  const candidates = useMyCandidates();
  const [pickDoneOpen, setPickDoneOpen] = useState(false);
  const [unpickTarget, setUnpickTarget] = useState<VendorCandidate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      void readHomeLayout().then((stored) => {
        if (alive) setLayout(stored);
      });

      return () => {
        alive = false;
      };
    }, []),
  );

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

  /** 추천 카드의 하트. Pick 전이면 후보에 담고 완료 시트, Pick 후면 해제 시트. 로그인 전이면 로그인으로. */
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

  /*
   * 아직 못 받았을 때.
   *
   * **업종 순회 로딩(WP-ST-015)은 앱을 켠 뒤 한 번뿐이다**(2026-09-09 사용자 오더).
   * 그 화면은 «앱이 지금 막 켜졌다»는 신호라, 홈에 들어올 때마다 뜨면 매번 처음부터
   * 시작하는 것처럼 읽힌다. 두 번째부터는 자리만 지키는 아이콘 로더로 대신한다.
   */
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
  const view = homeView({
    me: data.me,
    candidates: data.candidates,
    recommended: data.recommended,
    daysLeft,
  });
  const sections = homeSectionBlocks({
    view,
    data,
    layout,
    isPicked: (vendorId) => candidates.candidateFor(vendorId) !== null,
    onPressPick: (vendor) => void onPressPick(vendor),
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Header unread={data.unread} onPressBell={() => router.push('/my/notifications')} />
          <Hero me={data.me} daysLeft={daysLeft} />

          {/* 히어로 밑은 홈 편집(WP-HOME-007)이 정한 순서대로 그린다. */}
          {sections.map((section) => (
            <View key={section.key}>{section.node}</View>
          ))}

          {/* 홈 편집 — 온보딩이 «홈 맨 아래 홈 편집에서 바꿀 수 있어요»라고 약속한 자리다. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/home-edit')}
            style={({ pressed }) => [styles.editEntry, pressed && styles.pressed]}>
            <ThemedText type="f12" themeColor="textAssistive" style={styles.semibold}>
              홈 편집
            </ThemedText>
          </Pressable>
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

/** 히어로 밑 섹션 하나. */
type HomeSectionBlock = {
  key: HomeSectionKey;
  node: ReactNode;
};

/**
 * 홈 편집이 정한 순서대로, 보여줄 섹션만.
 *
 * 그릴 것이 없는 섹션은 자리도 차지하지 않는다(SPEC §2).
 */
function homeSectionBlocks({
  view,
  data,
  layout,
  isPicked,
  onPressPick,
}: {
  view: HomeView;
  data: HomeData;
  layout: HomeLayout;
  isPicked: (vendorId: string) => boolean;
  onPressPick: (vendor: VendorSummary) => void;
}): readonly HomeSectionBlock[] {
  const done = view.cells.filter((cell) => cell.tone === 'done').length;

  const blocks: Record<HomeSectionKey, HomeSectionBlock> = {
    /*
     * 준비현황 — 규격서 «div 430×248 · pad 0 20 0 20 · mar 0 0 24 0»
     *   div 390×20  flex · space-between · center · mar 0 0 12 0
     *     h3 "준비현황" · 14/600 · lh 20        span "4개 중 1개 완료" · 12/600 #868B94 · lh 16
     *   div 390×216  grid ← Board
     */
    board: {
      key: 'board',
      node: (
        <View style={styles.block}>
          <View style={styles.sectionHead}>
            <ThemedText type="f14" style={styles.semibold}>
              준비현황
            </ThemedText>
            <ThemedText type="f12" numeric themeColor="textAssistive" style={styles.semibold}>
              {view.cells.length}개 중 {done}개 완료
            </ThemedText>
          </View>
          <Board
            cells={view.cells}
            onPressCategory={(category) => router.push(`/pick?category=${category}`)}
          />
        </View>
      ),
    },

    /* 웨딩픽 추천 — 가로 카드. 여백은 Recommendation 안에 있다(카드 줄이 오른쪽 끝까지 닿는다). */
    recommendation: {
      key: 'recommendation',
      node: (
        <Recommendation
          vendors={data.recommended}
          cta={view.cta}
          isPicked={isPicked}
          onPressVendor={openVendor}
          onPressPick={onPressPick}
          onPressCompare={() => {
            if (view.cta.kind !== 'compare') return;
            /* 홈 추천 CTA — 추천 세 곳이 그대로 A·B·C(SPEC §13.11). */
            router.push({ pathname: '/search/compare', params: { ids: view.cta.ids.join(',') } });
          }}
        />
      ),
    },

    /*
     * 카테고리 — 규격서 «div 430×216 · pad 0 20 0 20 · mar 0 0 24 0»
     *   h3 "카테고리" · 14/600 · lh 20 · mar 0 0 12 0
     *   div 390×184  grid ← CategoryGrid
     */
    category: {
      key: 'category',
      node: (
        <View style={styles.block}>
          <ThemedText type="f14" style={[styles.semibold, styles.sectionTitle]}>
            카테고리
          </ThemedText>
          <CategoryGrid onPressCategory={(category) => router.push(`/search?category=${category}`)} />
        </View>
      ),
    },

    /* 규격서에 없는 섹션 — 그리지 않는다(위 파일 JSDoc). */
    next: { key: 'next', node: null },

    /*
     * 웨딩피드 — 규격서 «div 430×256 · pad 0 20 0 20»
     *   div 390×20  flex · space-between · center · mar 0 0 12 0
     *     h3 "웨딩피드" · 14/600 · lh 20        button "더보기" · 12/600 #1A1C20 · lh 16
     *   div 390×224 ← WeddingContent
     * 콘텐츠가 없으면 섹션째 접는다 — 빈 자리를 제목으로 알리지 않는다.
     */
    content: {
      key: 'content',
      node:
        data.content.length === 0 ? null : (
          <View style={styles.block}>
            <View style={styles.sectionHead}>
              <ThemedText type="f14" style={styles.semibold}>
                웨딩피드
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/community')}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="f12" style={styles.semibold}>
                  더보기
                </ThemedText>
              </Pressable>
            </View>
            <WeddingContent items={data.content} onPressItem={(id) => router.push(`/search?content=${id}`)} />
          </View>
        ),
    },
  };

  return visibleHomeSections(layout)
    .map((key) => blocks[key])
    .filter((block) => block.node !== null);
}

/* ------------------------------------------------------------------ 히어로 */

/**
 * 히어로 — 규격서
 *
 *   div 390×158  pad 16 16 16 16 · mar 0 20 24 20 · bg primary · r22
 *     div 144×144  bg #FFFFFF 10% · r9999                       (absolute -right-8 -top-8 = −32)
 *     div 112×112  r9999 · border 14 #FFFFFF 7%                 (absolute -bottom-8 -left-6 = −32 · −24)
 *     div 358×126
 *       div 358×24  flex · space-between · center · mar 0 0 8 0
 *         p "두근두근" · 9/400 #FFFFFF 55% · lh 14 · ls 1.8px
 *         button 24×24  bg #FFFFFF 15% · r9999   svg 14×14 IconMoreHorizRegular
 *       div 358×66  flex · space-between · align flex-end
 *         span "D-127" · 46/700 #FFFFFF · lh 46 · ls -1.38px
 *         p "2027년 1월 15일 (금) · 서울 그랜드 워커힐" · 12/400 #FFFFFF 70% · lh 16 · mar 4 0 0 0
 *       div 358×16  flex · gap 6 · center · mar 12 0 0 0
 *         span 16×16 "지" · 7/700 · lh 11 · mar 0 -4 0 0 · r9999 · border 1 #FFFFFF 50%   ×2
 *         span "지윤 · 준혁 · 함께 준비 중" · 10/400 #FFFFFF 55% · lh 15
 *
 * 흰색의 55% · 70% · 10% · 7% · 15% · 50%는 `onTint`(흰)에 `opacity`를 준 것이다 — 색을 새로
 * 만들지 않는다. 아바타 면 색(#F7D2C4 · #C9DAEC)은 토큰에 없어 `backgroundElement`로 두고 보고했다.
 */
function Hero({ me, daysLeft }: { me: CurrentUser | null; daysLeft: number | null }) {
  const theme = useTheme();
  const names = heroNames(me);

  return (
    <View style={[styles.hero, { backgroundColor: theme.tint }]}>
      <View style={[styles.decorLarge, { backgroundColor: theme.onTint }]} />
      <View style={[styles.decorSmall, { borderColor: theme.onTint }]} />

      <View style={styles.heroTop}>
        <ThemedText type="f9" themeColor="onTint" style={styles.mood}>
          두근두근
        </ThemedText>
        {/* 피그마는 히어로 색 팔레트를 연다 — 팔레트는 넣지 않는 자리라 잠가 둔다(위 JSDoc). */}
        <Pressable accessibilityRole="button" accessibilityLabel="히어로 색상 더보기" disabled style={styles.more}>
          <View style={[styles.moreFill, { backgroundColor: theme.onTint }]} />
          <View>
            <SeedIcon name="moreHorizRegular" size={Layout.iconSmall} color={theme.onTint} />
          </View>
        </Pressable>
      </View>

      <View style={styles.heroMain}>
        <View style={styles.shrink}>
          <ThemedText type="f46" numeric themeColor="onTint" style={styles.dday}>
            {daysLeft === null ? '예식일 미정' : `D-${daysLeft}`}
          </ThemedText>
          <ThemedText type="f12" themeColor="onTint" numberOfLines={1} style={styles.heroDate}>
            {heroDateLine(me)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.couple}>
        <View style={styles.avatars}>
          {names.map((name, index) => (
            <View
              key={`${name}-${index}`}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.avatar,
                { backgroundColor: theme.backgroundElement, borderColor: theme.onTint },
                index < names.length - 1 && styles.avatarOverlap,
              ]}>
              <ThemedText type="f7" themeColor="textSecondary" style={styles.bold}>
                {name.slice(0, 1)}
              </ThemedText>
            </View>
          ))}
        </View>
        <ThemedText type="f10" themeColor="onTint" numberOfLines={1} style={styles.coupleText}>
          {names.join(' · ')} · 함께 준비 중
        </ThemedText>
      </View>
    </View>
  );
}

/** 히어로의 이름들. 배우자가 연결돼 있고 이름을 정했으면 둘, 아니면 하나. 없는 이름은 «우리». */
function heroNames(me: CurrentUser | null): readonly string[] {
  const name = me?.displayName ?? '우리';

  if (me?.spouseLinked === true && me.partnerDisplayName !== null && me.partnerDisplayName !== undefined) {
    return [name, me.partnerDisplayName];
  }

  return [name];
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * «2027년 1월 15일 (금) · 서울» — 규격서의 «· 서울 그랜드 워커힐»(예식장) 자리는 우리 계약에
 * 예식장이 없어 지역이 선다. 둘 다 없으면 빈 줄 대신 안내 한 마디.
 */
function heroDateLine(me: CurrentUser | null): string {
  const parts: string[] = [];

  if (me?.weddingDate) {
    const [year, month, day] = me.weddingDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    parts.push(`${year}년 ${month}월 ${day}일 (${WEEKDAYS[date.getDay()]})`);
  }
  if (me?.region) parts.push(me.region);

  return parts.length === 0 ? '예식일과 지역을 정하면 여기에 보여요' : parts.join(' · ');
}

/* ---------------------------------------------------------------- 공통 조각 */

/**
 * 헤더 — 규격서
 *
 *   header 430×80  flex · space-between · center · pad 24 20 16 20
 *     h1 "웨딩픽" · 26/700 #1A1C20 · lh 39 · ls -0.52px
 *     div 84×40  flex · gap 4 · center
 *       button 40×40 · r9999   svg 20×20 IconSearchRegular      → /search
 *       button 40×40 · r9999   svg 20×20 IconNotificationRegular
 *
 * 검색 단추가 검색의 유일한 입구다(2026-09-14 대표 지시 — 검색은 탭에서 내렸다).
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
          accessibilityLabel={hasUnread({ unread, total: unread }) ? `알림 ${unread}건` : '알림'}
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

function openVendor(vendorId: string) {
  router.push(`/search/${vendorId}`);
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  /* «header 430×80 · pad 24 20 16 20». */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.four,
    paddingHorizontal: Layout.pageX,
    paddingBottom: Spacing.three,
  },
  /* «26/700 · lh 39 · ls -0.52px». */
  brand: { fontWeight: 700, letterSpacing: LetterSpacing.n052 },
  /* «div 84×40 · gap 4». */
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  /* «button 40×40 · r9999». */
  iconButton: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: Radius.pill },

  /* 「div 430×1386 · pad 0 0 16 0」. */
  content: { paddingBottom: Spacing.three },

  /* 두 번째부터의 로딩 — 아이콘 로더 하나만 가운데 둔다. */
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* 홈 편집 — 맨 아래 한 줄. 규격서에 없는 자리라 크기만 웨딩피드 «더보기»(12/600)와 같다. */
  editEntry: {
    minHeight: Layout.rowMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.pageX,
  },

  /* «pad 16 · mar 0 20 24 20 · r22». 장식 원이 밖으로 나가므로 overflow hidden. */
  hero: {
    marginHorizontal: Layout.pageX,
    marginBottom: Spacing.four,
    borderRadius: Radius.hero,
    padding: Spacing.three,
    overflow: 'hidden',
  },
  /* «div 144×144 · bg #FFFFFF 10%» — `-right-8 -top-8`(−32). */
  decorLarge: {
    position: 'absolute',
    top: -Spacing.five,
    right: -Spacing.five,
    width: Layout.heroDecorLarge,
    height: Layout.heroDecorLarge,
    borderRadius: Radius.pill,
    opacity: 0.1,
  },
  /* «div 112×112 · border 14 #FFFFFF 7%» — `-bottom-8 -left-6`(−32 · −24). */
  decorSmall: {
    position: 'absolute',
    bottom: -Spacing.five,
    left: -Spacing.four,
    width: Layout.heroDecorSmall,
    height: Layout.heroDecorSmall,
    borderRadius: Radius.pill,
    borderWidth: Layout.heroDecorBorder,
    opacity: 0.07,
  },
  /* «div 358×24 · space-between · center · mar 0 0 8 0». */
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  /* «9/400 · 55% · ls 1.8px». */
  mood: { opacity: 0.55, letterSpacing: LetterSpacing.p18 },
  /* «button 24×24 · bg #FFFFFF 15% · r9999». */
  more: {
    width: Layout.heroMore,
    height: Layout.heroMore,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  moreFill: { ...StyleSheet.absoluteFill, opacity: 0.15 },
  /* «div 358×66 · space-between · align flex-end». */
  heroMain: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  shrink: { flexShrink: 1, minWidth: 0 },
  /* «46/700 · lh 46 · ls -1.38px». */
  dday: { fontWeight: 700, letterSpacing: LetterSpacing.n138 },
  /* «12/400 · 70% · mar 4 0 0 0». */
  heroDate: { opacity: 0.7, marginTop: Spacing.one },
  /* «div 358×16 · gap 6 · center · mar 12 0 0 0». */
  couple: { flexDirection: 'row', alignItems: 'center', gap: Layout.menuGroupGap, marginTop: Layout.inlineGap },
  avatars: { flexDirection: 'row' },
  /* «span 16×16 · r9999 · border 1 #FFFFFF 50%». 테두리의 50%는 못 준다(테두리만 옅게 할 길이 없다). */
  avatar: {
    width: Layout.avatarMini,
    height: Layout.avatarMini,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* «mar 0 -4 0 0» — 둘이 4 겹친다. */
  avatarOverlap: { marginRight: -Spacing.one },
  /* «10/400 · 55%». */
  coupleText: { opacity: 0.55, flexShrink: 1 },

  /* 섹션 공통 «pad 0 20 0 20 · mar 0 0 24 0». */
  block: { paddingHorizontal: Layout.pageX, marginBottom: Spacing.four },
  /* 섹션 머리 «space-between · center · mar 0 0 12 0». */
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Layout.sectionHeadGapCompact,
  },
  sectionTitle: { marginBottom: Layout.sectionHeadGapCompact },
  semibold: { fontWeight: 600 },
  bold: { fontWeight: 700 },

  pressed: { opacity: 0.8 },
});
