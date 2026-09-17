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
const ALL_TAB = 0;
type Loaded<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };

/**
 * 라운지: docs/design/figma-export/07-lounge-my.dc.html 1~3의 모양과 handoff 수치.
 * Root 탭이 아닌 하위 화면이며 /community 주소는 유지한다.
 * 글쓰기는 Pick 인증 회원의 후기 탭에만 표시하고, 작성 가능한 업체 목록으로 보낸다.
 * 전체 후기 API와 스크랩 계약은 아직 없어 완료 기능으로 표시하지 않는다.
 * 웨딩정보 상세는 통합된 #271의 공개 글 API/화면을 사용한다.
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
    // 재조회 실패 때 이전 계정의 글쓰기 권한을 남기지 않는다.
    setMe(null);
    if (!isSignedIn) return;
    void getCurrentUser()
      .then((user) => { if (version === loadVersion.current) setMe(user); })
      .catch(() => { if (version === loadVersion.current) setMe(null); });
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
        <NavBar
          title={S.title}
          right={canWrite ? { label: S.write, brand: true, onPress: () => router.push('/my/reviews' as never) } : null}
        />
        <View style={styles.segment}>
          <SegmentedTabs items={TABS} value={tab} onChange={(next) => setTab(next as Tab)} accessibilityLabel={S.title} />
        </View>
        {tab === 'feed' && feed.status === 'ready' && feed.value.tabs.length > 1 ? (
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
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          onPress={() => router.push(`/feed/${encodeURIComponent(item.id)}` as never)}
          style={({ pressed }) => [styles.guideRow, { borderBottomColor: theme.border }, pressed ? styles.pressed : null]}>
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
        </Pressable>
      ))}
    </View>
  );
}

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
      <ThemedText type="f13" themeColor="textAssistive">
        {S['expo.note']}
      </ThemedText>
    </View>
  );
}

function expoDateRange(expo: ExpoItem): string {
  const start = ymd(expo.startsAt);
  const end = ymd(expo.endsAt);
  if (!start || !end) return `${expo.startsAt}~${expo.endsAt}`;
  const from = `${start.month}월 ${start.day}일`;
  if (start.month === end.month && start.day === end.day) return from;
  return start.month === end.month ? `${from}~${end.day}일` : `${from}~${end.month}월 ${end.day}일`;
}

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

// #273의 스타일을 보존한다. 모양: 07-lounge-my, 수치: docs/design/handoff/tokens.json.
const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  bold: { fontWeight: 700 },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.8 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.four },
  segment: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.inlineGap },
  chipScroll: { flexGrow: 0 },
  chipBar: { gap: Layout.chipGap, paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionHeadGap },
  guideRow: {
    flexDirection: 'row',
    gap: Layout.sectionHeadGap,
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.three,
    borderBottomWidth: Border.hairline,
  },
  guideThumb: { width: Layout.avatarLarge, height: Layout.avatarLarge, borderRadius: Radius.medium, overflow: 'hidden' },
  guideCol: { flex: 1, minWidth: 0, justifyContent: 'center', gap: Spacing.one },
  section: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.listGap, gap: Layout.inlineGap },
  expoCard: { borderRadius: Radius.medium, padding: Layout.cardPaddingCompactY, gap: Layout.inlineGap },
  expoHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Layout.inlineGap },
  expoCol: { flex: 1, minWidth: 0, gap: Spacing.one },
  empty: { paddingHorizontal: Layout.gutter, paddingTop: Layout.sectionGap, gap: Spacing.two, alignItems: 'center' },
  emptyAction: { marginTop: Spacing.two, alignSelf: 'stretch' },
});
