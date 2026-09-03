import type {
  CandidateListResponse,
  CurrentUser,
  VendorSummary,
} from '@weddingpick/api-contract';
import {
  hasUnread,
  lifecycle,
  MANY_CONFIRMED,
  TERMS,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getCurrentUser,
  getNotificationSummary,
  listCandidates,
  searchVendors,
} from '@/api/client';
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
import { Board, FoldedBoard } from '@/features/home/board';
import { listWeddingContent, type WeddingContentItem } from '@/features/home/content';
import { HomeSkeleton } from '@/features/home/home-skeleton';
import { homeView, nextUpCategory, type HomeView } from '@/features/home/state';
import {
  hasTaste,
  loadTaste,
  saveTaste,
  toggleTaste,
  type Taste,
} from '@/features/home/taste';
import { TastePicker } from '@/features/home/taste-picker';
import { TodaysPick } from '@/features/home/todays-pick';
import { VendorList } from '@/features/home/vendor-list';
import { WeddingContent } from '@/features/home/wedding-content';

/**
 * 홈. 디자인 확정본 `웨딩픽 홈 C-1 상태`.
 *
 * **모든 상태가 상황 → 추천 → 근거 → Pick 한 흐름을 따른다.** 상황은 D-day와
 * 현황판, 추천은 오늘의 Pick, 근거는 그 안의 금액 줄, 행동은 비교 하나다. 가격
 * TOP3처럼 오늘의 Pick과 경쟁하는 영역은 두지 않는다 — 확정 단계에서 없앤 자리다.
 *
 * **섹션 순서는 고정이다.** 이전 홈에는 사용자가 순서를 바꾸는 «홈 편집»이
 * 있었는데, C-1은 위계 자체가 설계라서 순서를 바꾸면 «지금 할 일»이 아래로
 * 내려갈 수 있다. `home-edit` 화면 파일은 남아 있지만 홈에서 들어가는 길은 없다.
 *
 * 여섯 시안이 어떻게 다섯 상태로 접히는지는 `features/home/state.ts`에 적어 뒀다.
 */

type HomeData = {
  me: CurrentUser | null;
  candidates: CandidateListResponse | null;
  /** 오늘의 Pick 자리에 올릴 세 곳. 지목받은 업종에서 확인된 정보가 많은 순. */
  recommended: readonly VendorSummary[];
  /** 많이 확인된 곳. 비회원 홈의 본문이기도 하다. */
  popular: readonly VendorSummary[];
  content: readonly WeddingContentItem[];
  /** 안 읽은 알림 수. 벨의 점이 이 값을 본다. */
  unread: number;
};

const EMPTY: HomeData = {
  me: null,
  candidates: null,
  recommended: [],
  popular: [],
  content: [],
  unread: 0,
};

/** 오늘의 Pick에 세우는 곳의 수. 셋을 넘기면 한 줄에 들어가지 않는다. */
const PICK_COUNT = 3;
/** 많이 확인된 곳에 세우는 줄 수. */
const POPULAR_COUNT = 4;

export default function HomeScreen() {
  const [data, setData] = useState<HomeData>(EMPTY);
  const [taste, setTaste] = useState<readonly Taste[]>([]);
  /*
   * 한 번이라도 받아왔는가. **자료가 없는 것과 아직 모르는 것은 다르다** — 앞은
   * 비회원 홈이고 뒤는 스켈레톤이다. 하나로 뭉치면 로그인 안 한 사람에게 영원히
   * 스켈레톤이 돈다.
   */
  const [settled, setSettled] = useState(false);

  const load = useCallback(() => {
    void loadTaste().then(setTaste);

    /*
     * 하나가 실패해도 나머지는 보여준다. 로그인 안 한 사람은 개인화 자료가 전부
     * 실패하는데, 그때도 홈은 떠야 한다 — 비회원이 보는 화면이기도 하다.
     */
    void (async () => {
      const [popular, content] = await Promise.all([
        searchVendors({ sort: 'data' })
          .then((page) => page.vendors.slice(0, POPULAR_COUNT))
          .catch(() => []),
        listWeddingContent().catch(() => []),
      ]);

      setData((current) => ({ ...current, popular, content }));

      const me = await getCurrentUser().catch(() => null);

      if (me === null) {
        setData((current) => ({ ...current, me: null }));

        return;
      }

      const notifications = await getNotificationSummary().catch(() => null);

      setData((current) => ({ ...current, me, unread: notifications?.unread ?? 0 }));

      if (me.weddingId === null) return;

      const candidates = await listCandidates(me.weddingId).catch(() => null);

      setData((current) => ({ ...current, candidates }));

      /*
       * 추천은 후보 목록이 지목한 업종에서 가져온다. 업종을 모르면 부르지 않는다 —
       * 아무 업종에서나 세 곳을 뽑아 «오늘의 Pick»이라고 부를 수는 없다.
       */
      if (candidates?.nextCategory == null) return;

      const recommended = await searchVendors({
        category: candidates.nextCategory,
        sort: 'data',
      })
        .then((page) => page.vendors.slice(0, PICK_COUNT))
        .catch(() => []);

      setData((current) => ({ ...current, recommended }));
    })().finally(() => setSettled(true));
  }, []);

  useEffect(load, [load]);

  // 골격이 같은 스켈레톤을 덮는다. 자료가 왔을 때 화면이 튀지 않게 하려는 것이다.
  if (!settled) {
    return <HomeSkeleton />;
  }

  const view = homeView({
    me: data.me,
    candidates: data.candidates,
    recommended: data.recommended,
    tasteChosen: hasTaste(taste),
  });

  const onToggleTaste = (picked: Taste) => {
    const next = toggleTaste(taste, picked);

    setTaste(next);
    void saveTaste(next);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header
          guest={view.state === 'guest'}
          unread={data.unread}
          onPressBell={() => router.push('/my/notifications')}
          onPressSignIn={() => router.push('/login')}
        />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {view.state === 'guest' ? (
            <GuestHome popular={data.popular} content={data.content} />
          ) : (
            <MemberHome
              me={data.me}
              candidates={data.candidates}
              recommended={data.recommended}
              popular={data.popular}
              content={data.content}
              view={view}
              taste={taste}
              onToggleTaste={onToggleTaste}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/* ------------------------------------------------------------------ 비회원 */

/**
 * 비회원 홈.
 *
 * **개인화를 하나도 꺼내지 않는다.** 이름·D-day·진행률·현황판·추천 이유를 모두
 * 숨긴다 — 아는 것이 없는데 아는 척하면 앱이 갑자기 점쟁이가 된다. 대신 조건 없이
 * 보여줄 수 있는 확인된 정보가 본문이 되고, 로그인은 막지 않고 위에서 권한다.
 */
function GuestHome({
  popular,
  content,
}: {
  popular: readonly VendorSummary[];
  content: readonly WeddingContentItem[];
}) {
  const theme = useTheme();

  return (
    <>
      <ThemedView style={styles.hero}>
        <ThemedText type="t1">결혼 준비,{'\n'}어디서부터 볼까요?</ThemedText>
        <ThemedText type="t6" themeColor="textSecondary" numberOfLines={1}>
          {TERMS.verifiedData}부터 비교해보세요
        </ThemedText>
      </ThemedView>

      {/*
        업종 입구. 시안에는 칸마다 «확인된 정보 N건»이 붙어 있지만 그 숫자를 낼
        API가 아직 없어 적지 않았다 — 근거 없는 숫자를 화면에 올리지 않는다.
      */}
      <ThemedView style={styles.block}>
        <ThemedView style={styles.grid}>
          {CATEGORY_ENTRIES.map((category) => (
            <Pressable
              key={category}
              accessibilityRole="button"
              onPress={() => router.push(`/search?category=${category}`)}
              style={({ pressed }) => [
                styles.entry,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="t5" numberOfLines={1}>
                {CATEGORY_META[category]?.icon ?? '•'} {VENDOR_CATEGORY_LABEL[category]}
              </ThemedText>
              <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
                {categoryCountLabel(category, popular)}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      </ThemedView>

      <Section title={MANY_CONFIRMED}>
        <VendorList vendors={popular} onPressVendor={openVendor} />
      </Section>

      <Band />

      <ContentSection title="웨딩 정보" items={content} />
    </>
  );
}

/** 비회원에게 여는 업종. 초기에 실제로 자료가 모이는 넷이다. */
const CATEGORY_ENTRIES: readonly VendorCategory[] = ['hall', 'sdm', 'snap', 'planner_agency'];

/** 목업의 두 줄 업종 카드 구조를 유지한다. 숫자는 서버가 내려준 자료만 사용한다. */
const CATEGORY_META: Partial<Record<VendorCategory, { icon: string }>> = {
  hall: { icon: '🏛' },
  sdm: { icon: '💄' },
  snap: { icon: '📷' },
  planner_agency: { icon: '📁' },
};

function categoryCountLabel(category: VendorCategory, vendors: readonly VendorSummary[]) {
  const count = vendors
    .filter((vendor) => vendor.category === category)
    .reduce((total, vendor) => total + vendor.paidPrice.count, 0);

  return count > 0 ? `${TERMS.verifiedData} ${count}건` : `${TERMS.verifiedData} 확인하기`;
}

/* -------------------------------------------------------------------- 회원 */

function MemberHome({
  me,
  candidates,
  recommended,
  popular,
  content,
  view,
  taste,
  onToggleTaste,
}: {
  me: CurrentUser | null;
  candidates: CandidateListResponse | null;
  recommended: readonly VendorSummary[];
  popular: readonly VendorSummary[];
  content: readonly WeddingContentItem[];
  view: HomeView;
  taste: readonly Taste[];
  onToggleTaste: (taste: Taste) => void;
}) {
  /*
   * 남은 기간에 맞는 상태 문구를 도메인이 고른다. 시안은 «두근두근»으로 그려져
   * 있지만 그건 예시 하나이고, 정책 v3.4가 300일 남은 사람에게 그 말은 아무 뜻도
   * 없다고 정했다 — 문구는 `lifecycle`이 정한다.
   */
  const stage = lifecycle(me?.weddingDate ?? null);
  const groups = candidates?.groups ?? [];
  const focusGroup = groups.find((group) => group.category === view.focus) ?? null;
  const upNext = nextUpCategory(groups, view.focus);
  const decided = groups.filter((group) => group.decidedVendorId !== null);

  return (
    <>
      <ThemedView style={styles.hero}>
        <ThemedView style={styles.who}>
          <Avatar name={me?.displayName ?? null} />
          <ThemedText type="t6" themeColor="textSecondary" numberOfLines={1}>
            {me?.displayName ?? '우리'}
            {me?.spouseLinked === true ? ' · 함께 준비 중' : ''}
          </ThemedText>
        </ThemedView>
        <ThemedText type="t1">
          {stage.mood}
          {'\n'}
          {stage.note}
        </ThemedText>
      </ThemedView>

      {/* 상황 — 현황판. 채울 것이 없으면 격자를 접고 한 줄로 대신한다. */}
      <ThemedView style={styles.block}>
        {view.board === 'grid' ? (
          <Board
            groups={groups}
            focus={view.focus}
            onPressCategory={(category) => router.push(`/pick?category=${category}`)}
          />
        ) : (
          <FoldedBoard onPress={() => router.push('/pick')} />
        )}
      </ThemedView>

      {view.state === 'taste' ? (
        /* 추천이 아직 성립하지 않는다. 그 자리를 취향 고르기가 대신한다. */
        <Section title="어떤 결혼식을 원하세요?">
          <TastePicker chosen={taste} onToggle={onToggleTaste} />
          <ActionButton
            label="취향 고르고 추천받기"
            variant="primary"
            size="xlarge"
            disabled={taste.length === 0}
            onPress={() => router.push('/search')}
          />
        </Section>
      ) : (
        /* 추천 — 오늘의 Pick. 근거와 행동이 이 안에 함께 있다. */
        <ThemedView style={styles.block}>
          <TodaysPick
            categoryLabel={focusGroup?.categoryLabel ?? null}
            vendors={recommended}
            comparable={view.comparable}
            onPressVendor={openVendor}
            onCompare={() => router.push('/search/compare')}
            onReport={() => router.push('/capture')}
          />
        </ThemedView>
      )}

      <Band />

      {view.state === 'taste' ? (
        <>
          <Section title={TERMS.verifiedData}>
            <VendorList vendors={popular} onPressVendor={openVendor} />
          </Section>
          {/*
            금액이 아직 안 나오는 곳이 섞여 있을 때만 그 까닭을 적는다. 전부 금액이
            있는데도 «수집 중»을 설명하면 없는 문제를 만들어 보여주는 셈이다.
          */}
          {popular.some((row) => row.paidPrice.stage === 'collecting') ? (
            <ThemedView style={styles.block}>
              <ThemedView type="backgroundElement" style={styles.note}>
                <ThemedText type="t5">정보 수집 중</ThemedText>
                <ThemedText type="body" themeColor="textSecondary">
                  정보가 더 모이면 금액 범위를 보여드려요
                </ThemedText>
              </ThemedView>
            </ThemedView>
          ) : null}
        </>
      ) : view.showsDecided ? (
        /* 정한 곳은 카드가 아니라 한 줄로 내려간다 — 이미 끝난 일이다. */
        <Section title="정한 곳">
          <ThemedView style={styles.decidedList}>
            {decided.map((group) => (
              <ThemedView key={group.category} style={styles.decidedRow}>
                <ThemedText type="t6" themeColor="textSecondary" style={styles.decidedCategory}>
                  {group.categoryLabel}
                </ThemedText>
                <ThemedText type="t5" numberOfLines={1} style={styles.grow}>
                  {group.candidates.find((row) => row.vendorId === group.decidedVendorId)
                    ?.vendorName ?? '결정 완료'}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>
        </Section>
      ) : upNext === null ? null : (
        <Section title="다음 준비">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/pick?category=${upNext.category}`)}
            style={({ pressed }) => [styles.nextRow, pressed && styles.pressed]}>
            <ThemedText type="t5" numberOfLines={1} style={styles.grow}>
              {upNext.categoryLabel}
            </ThemedText>
            <ThemedText type="t6" themeColor="textAssistive">
              ›
            </ThemedText>
          </Pressable>
        </Section>
      )}

      {view.state === 'taste' ? null : (
        <>
          <Band />
          <ContentSection
            title={me?.spouseLinked === true ? '두 분을 위한 웨딩 정보' : '웨딩 정보'}
            items={content}
          />
        </>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- 공통 조각 */

function Header({
  guest,
  unread,
  onPressBell,
  onPressSignIn,
}: {
  guest: boolean;
  unread: number;
  onPressBell: () => void;
  onPressSignIn: () => void;
}) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.header}>
      <ThemedText type="t4">웨딩픽</ThemedText>

      {guest ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPressSignIn}
          style={({ pressed }) => [
            styles.signIn,
            { backgroundColor: theme.backgroundSelected },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="t7" themeColor="textSecondary" style={styles.signInLabel}>
            로그인
          </ThemedText>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            hasUnread({ unread, total: unread }) ? `알림 ${unread}건` : '알림'
          }
          onPress={onPressBell}
          style={styles.bell}>
          <ThemedText type="t4">🔔</ThemedText>
          {/* 개수를 적지 않는다. 세는 것이 목적이 아니다. */}
          {hasUnread({ unread, total: unread }) ? (
            <View style={[styles.bellDot, { backgroundColor: theme.negative }]} />
          ) : null}
        </Pressable>
      )}
    </ThemedView>
  );
}

/**
 * 섹션 — 제목 한 줄 → 콘텐츠 → 행동.
 *
 * **서브카피를 쓰지 않는다.** 제목 아래 설명 줄을 두면 화면마다 높이가 달라지고,
 * 대개는 제목이 이미 한 말을 되풀이한다.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ThemedView style={styles.block}>
      <ThemedView style={styles.section}>
        <ThemedText type="t4">{title}</ThemedText>
        {children}
      </ThemedView>
    </ThemedView>
  );
}

/** 콘텐츠가 없으면 섹션째 접는다 — 빈 자리를 제목으로 알리지 않는다. */
function ContentSection({
  title,
  items,
}: {
  title: string;
  items: readonly WeddingContentItem[];
}) {
  if (items.length === 0) return null;

  return (
    <Section title={title}>
      <WeddingContent items={items} onPressItem={(id) => router.push(`/search?content=${id}`)} />
    </Section>
  );
}

/** 섹션을 가르는 회색 밴드. 그림자 대신 이것으로 구획한다. */
function Band() {
  const theme = useTheme();

  return <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />;
}

function Avatar({ name }: { name: string | null }) {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, { backgroundColor: theme.tintSubtle }]}>
      <ThemedText type="t7" themeColor="tint" style={styles.avatarLabel}>
        {(name ?? '웨').slice(0, 1)}
      </ThemedText>
    </View>
  );
}

function openVendor(vendorId: string) {
  router.push(`/search/${vendorId}`);
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  header: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Layout.gutter,
    paddingRight: 20,
  },
  signIn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInLabel: { fontWeight: 700 },
  bell: {
    minWidth: Layout.touchTarget,
    minHeight: Layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: Radius.pill },

  /*
   * 가로 여백을 여기 두지 않는다. 회색 밴드가 화면 끝까지 닿아야 해서, 거터는
   * 섹션마다 준다.
   */
  content: { paddingBottom: Spacing.six },

  hero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: 20,
    paddingBottom: Layout.gutter,
    gap: 10,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { fontWeight: 700 },

  block: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
  section: { gap: Layout.sectionHeadGap },
  band: { height: Layout.sectionBand, marginBottom: Layout.sectionGap },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  entry: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 0,
    minHeight: Layout.rowMinHeight,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 3,
  },
  pressed: { opacity: 0.8 },

  note: { borderRadius: Radius.card, padding: 20, gap: Spacing.two },

  decidedList: { gap: 2 },
  decidedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    minHeight: Layout.rowMinHeight,
    paddingVertical: 12,
  },
  decidedCategory: { width: 76 },
  grow: { flex: 1, minWidth: 0 },

  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    minHeight: Layout.rowMinHeight,
    paddingHorizontal: 2,
  },
});
