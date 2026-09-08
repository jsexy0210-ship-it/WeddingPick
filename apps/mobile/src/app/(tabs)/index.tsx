import type {
  CandidateListResponse,
  CurrentUser,
  VendorSummary,
} from '@weddingpick/api-contract';
import {
  hasUnread,
  lifecycle,
  MANY_CONFIRMED,
  PREPARATION_STATE_LABEL,
  TERMS,
  VENDOR_CATEGORY_LABEL,
  withObject,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAppBootstrap } from '@/api/client';
import {
  ActionButton,
  Layout,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
  RecommendingView,
} from '@weddingpick/ui';
import { Board, FoldedBoard } from '@/features/home/board';
import { listWeddingContent, type WeddingContentItem } from '@/features/home/content';
import { homeView, nextUpCategory, type HomeView } from '@/features/home/state';
import {
  chosenKeysFor,
  hasTaste,
  loadTaste,
  NO_TASTE,
  saveTaste,
  tasteCategoryFor,
  toggleTaste,
  type TasteCategory,
  type TasteSelection,
} from '@/features/home/taste';
import { TastePicker } from '@/features/home/taste-picker';
import { TodaysPick } from '@/features/home/todays-pick';
import { VendorList } from '@/features/home/vendor-list';
import { WeddingContent } from '@/features/home/wedding-content';
import { isWebShellScreen } from '@/features/webshell/config';
import { WebShellView } from '@/features/webshell/WebShellView';

/**
 * 홈. 디자인 확정본 `웨딩픽 홈 C-1 상태`(`03-home.dc.html`).
 *
 * **모든 상태가 상황 → 추천 → 근거 → Pick 한 흐름을 따른다.** 상황은 D-day와
 * 현황판, 추천은 오늘의 Pick, 근거는 그 안의 금액 줄, 행동은 비교 하나다. 가격
 * TOP3처럼 오늘의 Pick과 경쟁하는 영역은 두지 않는다 — 확정 단계에서 없앤 자리다.
 *
 * **섹션 순서는 고정이다.** 이전 홈에는 사용자가 순서를 바꾸는 «홈 편집»이
 * 있었는데, C-1은 위계 자체가 설계라서 순서를 바꾸면 «지금 할 일»이 아래로
 * 내려갈 수 있다. `home-edit` 화면과 `sections.ts`는 삭제했다.
 *
 * 여섯 시안이 어떻게 다섯 상태로 접히는지는 `features/home/state.ts`에 적어 뒀다.
 */

type HomeData = {
  me: CurrentUser | null;
  candidates: CandidateListResponse | null;
  /** 오늘의 Pick 자리에 올릴 세 곳. 지목받은 업종에서 실 제보가 많은 순. */
  recommended: readonly VendorSummary[];
  /** 많이 확인된 곳. */
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

export default function HomeScreen() {
  const [data, setData] = useState<HomeData>(EMPTY);
  const [taste, setTaste] = useState<TasteSelection>(NO_TASTE);
  /*
   * 한 번이라도 받아왔는가. **자료가 없는 것과 아직 모르는 것은 다르다** — 앞은
   * '취향 고르기' 상태고 뒤는 스켈레톤이다. 하나로 뭉치면 프로필을 못 불러온
   * 사람에게 영원히 스켈레톤이 돈다.
   */
  // 하이브리드 웹뷰 쉘 POC일 때는 애초에 스켈레톤을 거칠 일이 없어 settled로 시작한다.
  const [settled, setSettled] = useState(() => isWebShellScreen('home'));

  const load = useCallback(() => {
    // 웹뷰 쉘로 대체할 때는 이 밑 자료를 안 쓴다 — 훅 순서를 지키려고 호출
    // 자체는 남기고, 몸통만 건너뛴다.
    if (isWebShellScreen('home')) return;

    void loadTaste().then(setTaste);
    void listWeddingContent()
      .then((content) => setData((current) => ({ ...current, content })))
      .catch(() => undefined);

    /*
     * 회원 · 알림 · 많이 확인된 곳 · 담아둔 후보 · 오늘의 Pick, 다섯을 한 번에
     * 받는다(GET /v1/app/bootstrap). 서버 안에서 병렬로 모은 것이라 기기가
     * 인터넷을 여러 번 왕복하지 않는다 — 순서가 남은 것은 담아둔 후보가 지목한
     * 업종을 알아야 오늘의 Pick이 나오는 진짜 의존관계뿐이고, 그것도 서버 안의
     * 일이다.
     */
    void getAppBootstrap()
      .then((boot) => {
        setData((current) => ({
          ...current,
          me: boot.member,
          candidates: boot.candidates,
          recommended: boot.recommendations,
          popular: boot.popularVendors,
          unread: boot.notifications?.unread ?? 0,
        }));
      })
      .catch(() => undefined)
      .finally(() => setSettled(true));
  }, []);

  useEffect(load, [load]);

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
    return <RecommendingView />;
  }

  const view = homeView({
    me: data.me,
    candidates: data.candidates,
    recommended: data.recommended,
    tasteChosen: hasTaste(taste),
  });

  /*
   * 취향은 준비 현황에서 안 끝낸 첫 업종 한 세트만 묻는다(SPEC §13.6). 저장된
   * 업종이 다르면 그 격자에는 아무것도 체크돼 있지 않다 — 누르는 순간 이 업종의
   * 선택으로 새로 시작한다.
   */
  const tasteCategory = tasteCategoryFor(data.me?.preparedCategories ?? []);
  const tasteChosen = chosenKeysFor(taste, tasteCategory);

  const onToggleTaste = (key: string) => {
    const next = toggleTaste(tasteChosen, key);

    setTaste({ category: tasteCategory, keys: next });
    void saveTaste(tasteCategory, next);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header unread={data.unread} onPressBell={() => router.push('/my/notifications')} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <MemberHome
            me={data.me}
            candidates={data.candidates}
            recommended={data.recommended}
            popular={data.popular}
            content={data.content}
            view={view}
            tasteCategory={tasteCategory}
            tasteChosen={tasteChosen}
            onToggleTaste={onToggleTaste}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/* -------------------------------------------------------------------- 회원 */

function MemberHome({
  me,
  candidates,
  recommended,
  popular,
  content,
  view,
  tasteCategory,
  tasteChosen,
  onToggleTaste,
}: {
  me: CurrentUser | null;
  candidates: CandidateListResponse | null;
  recommended: readonly VendorSummary[];
  popular: readonly VendorSummary[];
  content: readonly WeddingContentItem[];
  view: HomeView;
  tasteCategory: TasteCategory;
  tasteChosen: readonly string[];
  onToggleTaste: (key: string) => void;
}) {
  /*
   * 남은 기간에 맞는 상태 문구를 도메인이 고른다. 시안은 «두근두근»으로 그려져
   * 있지만 그건 예시 하나이고, 정책 v3.4가 300일 남은 사람에게 그 말은 아무 뜻도
   * 없다고 정했다 — 문구는 `lifecycle`이 정한다.
   */
  const stage = lifecycle(me?.weddingDate ?? null);
  const groups = candidates?.groups ?? [];
  const focusGroup = groups.find((group) => group.category === view.focus) ?? null;
  const focusLabel =
    focusGroup?.categoryLabel ?? (view.focus === null ? null : VENDOR_CATEGORY_LABEL[view.focus]);
  const upNext = nextUpCategory(groups, view.focus);
  /*
   * 정한 곳 — 앱에서 정한 업종과 준비 현황(온보딩 3/5)에서 «이미 정했다»고 체크한
   * 업종 둘 다다. 뒤쪽은 업체가 없어 `decidedVendorId`가 null이라 상태로 거른다.
   */
  const decided = groups.filter((group) => group.state === 'decided');

  return (
    <>
      <ThemedView style={styles.hero}>
        <ThemedView style={styles.who}>
          <Avatar name={me?.displayName ?? null} role="primary" />
          {me?.spouseLinked === true && (
            <Avatar name={me.partnerDisplayName} role="secondary" />
          )}
          <ThemedText type="body" themeColor="textSecondary" numberOfLines={1}>
            {identityLine(me)}
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
          <TastePicker category={tasteCategory} chosen={tasteChosen} onToggle={onToggleTaste} />
          <ActionButton
            label="취향 고르고 추천받기"
            variant="primary"
            size="xlarge"
            disabled={tasteChosen.length === 0}
            onPress={() => router.push('/search')}
          />
        </Section>
      ) : (
        /* 추천 — 오늘의 Pick. 근거와 행동이 이 안에 함께 있다. */
        <ThemedView style={styles.block}>
          <TodaysPick
            /*
             * 시안 2(후보 없음)는 부제를 두지 않는다 — 바로 아래 «다음 준비» 카드가
             * «{업종} 먼저 정하기»로 같은 말을 하기 때문이다.
             */
            subtitle={view.state === 'empty' ? null : pickSubtitle(view.state, focusLabel)}
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
                  정보가 더 모이면 금액 범위를 보여드려요.
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
              <Fragment key={group.category}>
                <ThemedView style={styles.decidedRow}>
                  <ThemedText type="t6" themeColor="textSecondary" style={styles.decidedCategory}>
                    {group.categoryLabel}
                  </ThemedText>
                  <ThemedText type="t5" numberOfLines={1} style={styles.grow}>
                    {/* 앱 밖에서 이미 정한 업종은 업체가 없다 — 이름 대신 «결정 완료». */}
                    {group.candidates.find((row) => row.vendorId === group.decidedVendorId)
                      ?.vendorName ?? PREPARATION_STATE_LABEL.decided}
                  </ThemedText>
                  {/*
                    시안은 오른쪽에 정한 금액(«1,620만원»)을 둔다. 후보 목록 계약은
                    가격을 싣지 않아(Level 3 잠금 우회 방지) 지금은 그 자리가 없다 —
                    금액이 계약에 실리면 여기에 t6 · bold · tabular로 붙인다.
                  */}
                </ThemedView>
                <Divider />
              </Fragment>
            ))}
          </ThemedView>
        </Section>
      ) : view.state === 'empty' && view.focus !== null ? (
        /* 비어있는 상태 — 지목된 업종을 카드로 보여 첫 발을 내딛게 한다. */
        <Section title="다음 준비">
          <NextStepCard
            category={view.focus}
            categoryLabel={focusLabel ?? VENDOR_CATEGORY_LABEL[view.focus]}
            daysLeft={stage.daysLeft}
            onPress={() => router.push(`/pick?category=${view.focus!}`)}
          />
        </Section>
      ) : !view.comparable ? (
        /*
         * 시안 3 — 후보는 있는데 실 제보가 없다. 추천이 제보를 권하는 동안
         * 그 아래에는 조건 없이 보여줄 수 있는 «많이 확인된 곳»이 온다.
         */
        <Section title={MANY_CONFIRMED}>
          <VendorList vendors={popular} onPressVendor={openVendor} />
        </Section>
      ) : upNext === null ? null : (
        /* 진행 중 — 다음 업종을 한 줄로, D-day를 붙여서. */
        <Section title="다음 준비">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/pick?category=${upNext.category}`)}
            style={({ pressed }) => [styles.nextRow, pressed && styles.pressed]}>
            <ThemedText type="t5" numberOfLines={1} style={styles.grow}>
              {upNext.categoryLabel}
            </ThemedText>
            {stage.daysLeft !== null && (
              <ThemedText type="t6" numeric themeColor="textAssistive">
                D-{stage.daysLeft}
              </ThemedText>
            )}
            <Chevron />
          </Pressable>
        </Section>
      )}

      {view.state === 'taste' ? null : (
        <ContentSection
          title={me?.spouseLinked === true ? '두 분을 위한 웨딩 정보' : '웨딩 정보'}
          items={content}
        />
      )}
    </>
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

/**
 * 오늘의 Pick 부제. 시안 4는 «스튜디오를 정할 차례예요», 시안 5(결정 직후)는
 * «이제 드레스를 볼 차례예요» — 방금 하나를 끝낸 사람에게는 다음이 이어진다는
 * 말이 먼저다.
 */
function pickSubtitle(state: HomeView['state'], categoryLabel: string | null): string | null {
  if (categoryLabel === null) return null;

  return state === 'decided'
    ? `이제 ${withObject(categoryLabel)} 볼 차례예요`
    : `${withObject(categoryLabel)} 정할 차례예요`;
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
        <ProductSymbol name="bell" size={Layout.iconTab} color={theme.textSecondary} />
        {/* 개수를 적지 않는다. 세는 것이 목적이 아니다. */}
        {hasUnread({ unread, total: unread }) ? (
          <View style={[styles.bellDot, { backgroundColor: theme.negative }]} />
        ) : null}
      </Pressable>
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

/**
 * 콘텐츠가 없으면 섹션째 접는다 — 빈 자리를 제목으로 알리지 않는다.
 *
 * 앞의 밴드도 함께 접는다. 섹션이 없는데 밴드만 남으면 화면 끝에 회색 띠 하나가
 * 이유 없이 놓인다(시안 2·3에는 이 섹션도 밴드도 없다).
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
      <Section title={title}>
        <WeddingContent items={items} onPressItem={(id) => router.push(`/search?content=${id}`)} />
      </Section>
    </>
  );
}

/** 섹션을 가르는 회색 밴드. 그림자 대신 이것으로 구획한다. */
function Band() {
  const theme = useTheme();

  return <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />;
}

/** 행 아래 1px 선. 시안은 마지막 행 아래에도 긋는다. */
function Divider() {
  const theme = useTheme();

  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

/** 행 끝 chevron. 18 · textDisabled — 핸드오프 값 그대로다. */
function Chevron() {
  const theme = useTheme();

  return <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textDisabled} />;
}

function Avatar({ name, role = 'primary' }: { name: string | null; role?: 'primary' | 'secondary' }) {
  const theme = useTheme();
  const isSecondary = role === 'secondary';

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { backgroundColor: isSecondary ? theme.backgroundSelected : theme.tintSubtle },
        isSecondary && styles.avatarSecondary,
      ]}>
      <ThemedText
        type="t7"
        themeColor={isSecondary ? 'textSecondary' : 'tint'}
        style={styles.avatarLabel}>
        {(name ?? '배').slice(0, 1)}
      </ThemedText>
    </View>
  );
}

/**
 * 빈 상태 "다음 준비" 카드. 후보가 하나도 없을 때 지목된 업종을 강조해서 보여준다.
 * 누르면 해당 업종 Pick 화면으로 이동한다.
 *
 * 보조 줄은 웨딩홀에만 있다 — «날짜와 예산이 여기서 정해져요»는 웨딩홀이 먼저인
 * 이유이고, 다른 업종에는 그런 이유를 지어 붙이지 않는다.
 */
function NextStepCard({
  category,
  categoryLabel,
  daysLeft,
  onPress,
}: {
  category: string;
  categoryLabel: string;
  daysLeft: number | null;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.nextCard,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <ThemedView style={styles.nextCardBody}>
        <ThemedText type="t5" numberOfLines={1}>
          {categoryLabel} 먼저 정하기
        </ThemedText>
        {category === 'hall' ? (
          <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
            날짜와 예산이 여기서 정해져요
          </ThemedText>
        ) : null}
      </ThemedView>
      {daysLeft !== null && (
        <ThemedText type="t6" numeric themeColor="textAssistive">
          D-{daysLeft}
        </ThemedText>
      )}
      <Chevron />
    </Pressable>
  );
}

function openVendor(vendorId: string) {
  router.push(`/search/${vendorId}`);
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  /* 시안 head: 56 · padding 0 20 0 24. 오른쪽이 4 좁은 것은 40 원형 버튼 안의 24 아이콘이 거터선에 앉게 하려는 것이다. */
  header: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Layout.gutter,
    paddingRight: 20,
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
  content: { paddingBottom: Spacing.six },

  /* 시안: padding 20 24 24 · gap 10. */
  hero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: 20,
    paddingBottom: Layout.gutter,
    gap: Layout.cardGap,
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
  avatarSecondary: { marginLeft: -10 },

  block: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
  section: { gap: Layout.sectionHeadGap },
  band: { height: Layout.sectionBand, marginBottom: Layout.sectionGap },
  divider: { height: 1 },

  pressed: { opacity: 0.8 },

  note: { borderRadius: Radius.medium, padding: Layout.cardPadding, gap: Spacing.two },

  decidedList: { gap: Spacing.half },
  decidedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY,
  },
  decidedCategory: { width: 76 },
  grow: { flex: 1, minWidth: 0 },

  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    minHeight: Layout.rowMinHeight,
    paddingHorizontal: Spacing.half,
  },
  /* 시안: padding 16 18 · gap 12 · min-height 56 · radius 10. */
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Layout.rowMinHeight,
    borderRadius: Radius.medium,
    paddingHorizontal: 18,
    paddingVertical: Spacing.three,
    gap: Spacing.three - 4,
  },
  nextCardBody: { flex: 1, minWidth: 0, gap: Spacing.half },
});
