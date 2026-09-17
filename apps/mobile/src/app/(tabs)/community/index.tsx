import type { CurrentUser, ExpoItem, WeddingFeedListResponse } from '@weddingpick/api-contract';
import { daysUntil } from '@weddingpick/domain';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Border,
  FilterChip,
  Layout,
  MaxContentWidth,
  Radius,
  SegmentedTabs,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { getCurrentUser, getWeddingFeed, listExpos } from '@/api/client';
import { useSession } from '@/features/auth/use-session';
import { FullScreenError } from '@/features/errors/full-screen-error';
import { CategoryImage } from '@/features/home/category-image';
import { DelayedLoader, DelayedLoadingView } from '@/features/loading/delayed-loader';
import { NavBar } from '@/features/wedding/screen-kit';
import strings from '../../../../../../spec/strings.ko.json';

const S = strings.community;

type Tab = 'review' | 'feed' | 'expo';

const TABS: { value: Tab; label: string }[] = [
  { value: 'review', label: S['tab.review'] },
  { value: 'feed', label: S['tab.feed'] },
  { value: 'expo', label: S['tab.expo'] },
];

/** 웨딩정보 탭의 「전체」 칩. 서버가 주는 `tabs`의 맨 앞이 언제나 이것이다(`weddingFeedListResponseSchema`). */
const ALL_TAB = 0;

type Loaded<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };

/**
 * 라운지 · `docs/design/figma-export/07-lounge-my.dc.html` 1 · 2 · 3.
 *
 * **탭이 아니라 하위 화면이다**(2026-09-17 대표 지시 · 새 패키지). Root 탭에서 내렸고
 * 진입은 홈 「웨딩 소식」 우측과 MY 「둘러보기」 둘이다. 그래서 탭바 없이 back nav만
 * 붙는다 — `OFF_TAB_ROUTES`에 `community`가 있어 탭 바가 스스로 숨는다(`tab-bar.tsx`).
 * 주소 `/community`는 그대로다.
 *
 *   nav 56(뒤로 · 「라운지」 · 우측 「글쓰기」) → 세 칸 탭(후기 · 웨딩정보 · 박람회) → 본문
 *
 * **글쓰기는 후기 탭에서 Pick 인증 회원에게만 보인다**(SPEC 13.8 · 5 「후기는 Pick 인증
 * 회원만 · 인증한 업체에만」). 웨딩정보는 웨딩픽이 쓰고 박람회는 주최사 공지에서 모으므로
 * 그 두 탭에는 글쓰기가 없다. 누르면 「내가 쓴 후기」의 「쓸 수 있는 곳」으로 간다 — 어느
 * 업체에 쓸 수 있는지가 거기 있다.
 *
 * **빈 상태가 정상 상태다**(v3.28 LNG-0). 섹션마다 따로 · 행동 하나만 · 안내는 한 줄.
 * 후기는 전체 목록을 주는 계약이 없어(`/v1/vendors/{id}/reviews`는 업체별) 늘 빈 상태이고,
 * 행동은 Pick 인증 하나다. 웨딩정보는 `/v1/wedding-feed`, 박람회는 `/v1/expos`를 그린다.
 */
export default function CommunityScreen() {
  const { state, refresh } = useSession();
  const [tab, setTab] = useState<Tab>('review');
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [feed, setFeed] = useState<Loaded<WeddingFeedListResponse>>({ status: 'loading' });
  const [feedTab, setFeedTab] = useState(ALL_TAB);
  const [expos, setExpos] = useState<Loaded<ExpoItem[]>>({ status: 'loading' });
  const loadVersion = useRef(0);

  const isSignedIn = state.status === 'signedIn';

  const load = useCallback(() => {
    const version = ++loadVersion.current;
    if (!isSignedIn) return;
    void getCurrentUser()
      .then((user) => { if (version === loadVersion.current) setMe(user); })
      .catch(() => { /* 글쓰기 단추만 못 그린다 — 목록은 그대로 보인다. */ });
    setFeed({ status: 'loading' });
    void getWeddingFeed()
      .then((response) => { if (version === loadVersion.current) setFeed({ status: 'ready', value: response }); })
      .catch(() => { if (version === loadVersion.current) setFeed({ status: 'error' }); });
    setExpos({ status: 'loading' });
    void listExpos({ sort: 'date' })
      .then((response) => { if (version === loadVersion.current) setExpos({ status: 'ready', value: response.items }); })
      .catch(() => { if (version === loadVersion.current) setExpos({ status: 'error' }); });
  }, [isSignedIn]);

  useFocusEffect(useCallback(() => {
    load();
    return () => { loadVersion.current += 1; };
  }, [load]));

  if (state.status === 'error') return <FullScreenError kind={state.kind} onRetry={() => void refresh()} />;
  if (state.status === 'loading') return <DelayedLoadingView />;
  if (state.status === 'signedOut') return <Redirect href="/login" />;

  const canWrite = tab === 'review' && me?.hasPaymentProof === true;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* 시안 navBar: 56 · 뒤로 24 · 제목 16/700 · 우측 「글쓰기」 15/700 코랄. 뒤로는 다른 상세 화면과 같은 `NavBar`다. */}
        <NavBar
          title={S.title}
          right={canWrite ? { label: S.write, brand: true, onPress: () => router.push('/my/reviews' as never) } : null}
        />

        {/* 시안 segWrap: `margin:0 20px 12px` — 좌우는 대표님이 정한 24(`Layout.gutter`). */}
        <View style={styles.segment}>
          <SegmentedTabs items={TABS} value={tab} onChange={(next) => setTab(next as Tab)} accessibilityLabel={S.title} />
        </View>

        {tab === 'feed' && feed.status === 'ready' && feed.value.tabs.length > 1 ? (
          /* 시안 chipBar: gap 8 · `padding:0 20px 14px` · 가로 스크롤. 칩은 서버가 주는 탭 그대로다(홈과 같다). */
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipBar}>
            {feed.value.tabs.map((item, index) => (
              <FilterChip key={item.key} label={item.label} selected={feedTab === index} onPress={() => setFeedTab(index)} role="radio" />
            ))}
          </ScrollView>
        ) : null}

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {tab === 'review' ? (
            <Empty
              title={S['review.empty.title']}
              body={S['review.empty.body']}
              action={{ label: S['review.empty.cta'], onPress: () => router.push('/capture/payment/consent' as never) }}
            />
          ) : tab === 'feed' ? (
            <FeedList state={feed} tab={feedTab} onRetry={load} />
          ) : (
            <ExpoList state={expos} onRetry={load} />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── 웨딩정보 ────────────────────────────────────────────────────

function FeedList({ state, tab, onRetry }: { state: Loaded<WeddingFeedListResponse>; tab: number; onRetry: () => void }) {
  const theme = useTheme();

  if (state.status === 'loading') return <DelayedLoader size={28} />;
  if (state.status === 'error') return <LoadFailed onRetry={onRetry} />;

  const chosen = state.value.tabs[tab];
  const items =
    tab === ALL_TAB || !chosen
      ? state.value.items
      : state.value.items.filter((item) => chosen.categories.includes(item.categoryLabel));

  if (items.length === 0) return <Empty title={S['feed.empty.title']} body={S['feed.empty.body']} />;

  return (
    <View>
      {items.map((item) => (
        /* 시안 guideRow: gap 14 · `padding:16px 20px` · 아래 선 · 썸네일 88 radius 10 · 업종 12/700 코랄 · 제목 15/700 2줄 · 메타 12. */
        <View key={item.id} style={[styles.guideRow, { borderBottomColor: theme.border }]}>
          <View style={styles.guideThumb}>
            <CategoryImage uri={item.imageUrl} />
          </View>
          <View style={styles.guideCol}>
            <ThemedText type="f12" themeColor="tint" style={styles.bold}>
              {item.categoryLabel}
            </ThemedText>
            <ThemedText type="f15" numberOfLines={2} style={styles.bold}>
              {item.title}
            </ThemedText>
            <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1}>
              {item.summary}
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── 박람회 ──────────────────────────────────────────────────────

function ExpoList({ state, onRetry }: { state: Loaded<ExpoItem[]>; onRetry: () => void }) {
  const theme = useTheme();

  if (state.status === 'loading') return <DelayedLoader size={28} />;
  if (state.status === 'error') return <LoadFailed onRetry={onRetry} />;
  if (state.value.length === 0) return <Empty title={S['expo.empty.title']} body={S['expo.empty.body']} />;

  return (
    <View style={styles.section}>
      {state.value.map((expo) => {
        const past = expo.status === 'closed';
        return (
          /* 시안 expo 카드: radius 10 · 18 · gap 12 · 진행은 테두리, 종료는 recessed 바탕에 회색 글자. */
          <Pressable
            key={expo.id}
            accessibilityRole="button"
            accessibilityLabel={expo.title}
            onPress={() => router.push(`/search/expo/${expo.id}` as never)}
            style={({ pressed }) => [
              styles.expoCard,
              past
                ? { backgroundColor: theme.backgroundElement }
                : { borderWidth: Border.hairline, borderColor: theme.track, backgroundColor: theme.background },
              pressed ? styles.pressed : null,
            ]}>
            <View style={styles.expoHead}>
              <View style={styles.expoCol}>
                <ThemedText type="f16" numberOfLines={1} themeColor={past ? 'textDisabled' : 'text'} style={styles.bold}>
                  {expo.title}
                </ThemedText>
                <ThemedText type="f13" themeColor="textAssistive" numeric>
                  {expoDateRange(expo)}
                </ThemedText>
                <ThemedText type="f13" themeColor="textAssistive" numberOfLines={1}>
                  {expo.venue}
                </ThemedText>
              </View>
              <ThemedText type="f14" themeColor={past ? 'textDisabled' : 'tint'} numeric style={styles.bold}>
                {expoDday(expo)}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
      {/* 시안 note: 13/20 muted — 출처를 밝힌다. */}
      <ThemedText type="f13" themeColor="textAssistive">
        {S['expo.note']}
      </ThemedText>
    </View>
  );
}

/** «9월 19일~20일» · 달이 다르면 «9월 30일~10월 1일». 값은 `YYYY-MM-DD`로 시작한다. */
function expoDateRange(expo: ExpoItem): string {
  const start = ymd(expo.startsAt);
  const end = ymd(expo.endsAt);
  if (!start || !end) return `${expo.startsAt}~${expo.endsAt}`;
  const from = `${start.month}월 ${start.day}일`;
  if (start.month === end.month && start.day === end.day) return from;
  return start.month === end.month ? `${from}~${end.day}일` : `${from}~${end.month}월 ${end.day}일`;
}

/** 우측 상태 — 시작 전은 D-day(당일은 「오늘」) · 진행 중 · 종료는 끝난 날짜. */
function expoDday(expo: ExpoItem): string {
  if (expo.status === 'closed') {
    const end = ymd(expo.endsAt);
    return end ? S['expo.closedDate'].replace('{date}', `${end.month}월 ${end.day}일`) : S['expo.closed'];
  }
  if (expo.status === 'ongoing') return S['expo.ongoing'];
  const days = daysUntil(expo.startsAt.slice(0, 10));
  if (days <= 0) return S['expo.today'];
  return S['expo.dday'].replace('{n}', String(days));
}

function ymd(iso: string): { month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return { month: Number(match[2]), day: Number(match[3]) };
}

// ─── 빈 상태 · 오류 ───────────────────────────────────────────────

/** LNG-0 — 제목 한 줄 · 안내 한 줄 · 행동은 하나뿐이거나 없다. */
function Empty({ title, body, action }: { title: string; body: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.empty}>
      <ThemedText type="f16" style={[styles.bold, styles.center]}>
        {title}
      </ThemedText>
      <ThemedText type="f13" themeColor="textAssistive" style={styles.center}>
        {body}
      </ThemedText>
      {action ? (
        <View style={styles.emptyAction}>
          <ActionButton variant="secondary" size="large" label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.empty}>
      <ThemedText type="f13" themeColor="textAssistive" style={styles.center}>
        {strings.journey.loadFailed}
      </ThemedText>
      <View style={styles.emptyAction}>
        <ActionButton variant="secondary" size="large" label={strings.common['cta.retry']} onPress={onRetry} />
      </View>
    </View>
  );
}

// ─── Styles — 모양은 07-lounge-my.dc.html, 수치는 docs/design/handoff/tokens.json ───

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  bold: { fontWeight: 700 },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.8 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.four },
  /* segWrap `margin:0 20px 12px` — 좌우 24 · 아래 12. */
  segment: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.inlineGap },
  chipScroll: { flexGrow: 0 },
  /* chipBar `gap:8px;padding:0 20px 14px`. */
  chipBar: { gap: Layout.chipGap, paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionHeadGap },
  /* guideRow `gap:14px;padding:16px 20px` + 아래 선 1. */
  guideRow: {
    flexDirection: 'row',
    gap: Layout.sectionHeadGap,
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.three,
    borderBottomWidth: Border.hairline,
  },
  /* guideThumb 88 · radius 10. */
  guideThumb: { width: Layout.avatarLarge, height: Layout.avatarLarge, borderRadius: Radius.medium, overflow: 'hidden' },
  guideCol: { flex: 1, minWidth: 0, justifyContent: 'center', gap: Spacing.one },
  /* sec `padding:0 20px 20px;gap:12px`. */
  section: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.listGap, gap: Layout.inlineGap },
  /* 카드 radius 10 · 안쪽 18(handoff card.paddingCompact) · gap 12. */
  expoCard: { borderRadius: Radius.medium, padding: Layout.cardPaddingCompactY, gap: Layout.inlineGap },
  expoHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Layout.inlineGap },
  expoCol: { flex: 1, minWidth: 0, gap: Spacing.one },
  /* 빈 상태 — 본문 가운데. 헤더 · 탭은 그대로 두고 본문만 비운다. */
  empty: { paddingHorizontal: Layout.gutter, paddingTop: Layout.sectionGap, gap: Spacing.two, alignItems: 'center' },
  emptyAction: { marginTop: Spacing.two, alignSelf: 'stretch' },
});
