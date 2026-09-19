import type {
  ExpoItem,
  LoungeReviewListResponse,
  WeddingFeedListResponse,
} from '@weddingpick/api-contract';
import { VENDOR_CATEGORY_LABEL, daysUntil } from '@weddingpick/domain';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Badge,
  Border,
  FilterChip,
  Layout,
  LineHeight,
  MaxContentWidth,
  Radius,
  SegmentedTabs,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { getWeddingFeed, listExpos, listLoungeReviews, setReviewHelpful } from '@/api/client';
import { useSession } from '@/features/auth/use-session';
import { FullScreenError } from '@/features/errors/full-screen-error';
import { CategoryImage } from '@/features/home/category-image';
import { DelayedLoader, DelayedLoadingView } from '@/features/loading/delayed-loader';
import { appendLoungeReviewPage, loungeReviewCategory } from '@/features/community/lounge-reviews';
import { NavBar } from '@/features/wedding/screen-kit';
import strings from '../../../../../../spec/strings.ko.json';

const S = strings.community;
const R = strings.review;

type Tab = 'review' | 'feed' | 'expo';
const TABS: { value: Tab; label: string }[] = [
  { value: 'review', label: '후기' },
  { value: 'feed', label: '웨딩피드' },
  { value: 'expo', label: '박람회' },
];
const CATEGORIES = ['전체', '웨딩홀', '드레스', '스튜디오', '메이크업', '예산', '허니문'] as const;
type CategoryLabel = (typeof CATEGORIES)[number];
type Loaded<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };
type LoungeReview = LoungeReviewListResponse['reviews'][number];

/**
 * 라운지 — docs/design/figma-export/07-lounge-my.dc.html 1~3.
 *
 * Root 탭이 아니다. 홈/MY에서 들어오는 하위 화면이고, 헤더 Back은 진입한 화면으로 돌아간다.
 * 후기에는 별점/평점 숫자를 노출하지 않는다. 서버의 과거 후기 계약에 정본 3축 값이
 * 아직 전부 없으므로 실제로 의미가 대응되는 축만 정본 답변 칩으로 바꿔 보여준다.
 */
export default function CommunityScreen() {
  const { state, refresh } = useSession();
  const params = useLocalSearchParams<{ from?: string; tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'feed' ? 'feed' : 'review');
  const [category, setCategory] = useState<CategoryLabel>('전체');
  const [reviews, setReviews] = useState<Loaded<LoungeReviewListResponse>>({ status: 'loading' });
  const [reviewMoreLoading, setReviewMoreLoading] = useState(false);
  const [reviewMoreError, setReviewMoreError] = useState(false);
  const [feed, setFeed] = useState<Loaded<WeddingFeedListResponse>>({ status: 'loading' });
  const [expos, setExpos] = useState<Loaded<ExpoItem[]>>({ status: 'loading' });
  const loadVersion = useRef(0);
  const reviewVersion = useRef(0);
  const reviewLoadingMore = useRef(false);
  const categoryRef = useRef<CategoryLabel>('전체');
  const isSignedIn = state.status === 'signedIn';

  const loadReviews = useCallback((label: CategoryLabel, cursor?: string) => {
    if (!isSignedIn) return;
    const append = Boolean(cursor);
    if (append && reviewLoadingMore.current) return;
    const version = ++reviewVersion.current;

    if (append) {
      reviewLoadingMore.current = true;
      setReviewMoreLoading(true);
      setReviewMoreError(false);
    } else {
      reviewLoadingMore.current = false;
      setReviewMoreLoading(false);
      setReviewMoreError(false);
      setReviews({ status: 'loading' });
    }

    void listLoungeReviews({
      category: loungeReviewCategory(label),
      cursor,
      limit: 20,
    })
      .then((response) => {
        if (version !== reviewVersion.current) return;
        setReviews((current) => {
          if (append && current.status === 'ready') {
            return { status: 'ready', value: appendLoungeReviewPage(current.value, response) };
          }
          return { status: 'ready', value: response };
        });
      })
      .catch(() => {
        if (version !== reviewVersion.current) return;
        if (append) setReviewMoreError(true);
        else setReviews({ status: 'error' });
      })
      .finally(() => {
        if (version !== reviewVersion.current) return;
        reviewLoadingMore.current = false;
        setReviewMoreLoading(false);
      });
  }, [isSignedIn]);

  const load = useCallback(() => {
    const version = ++loadVersion.current;
    if (!isSignedIn) return;

    loadReviews(categoryRef.current);

    setFeed({ status: 'loading' });
    void getWeddingFeed()
      .then((response) => { if (version === loadVersion.current) setFeed({ status: 'ready', value: response }); })
      .catch(() => { if (version === loadVersion.current) setFeed({ status: 'error' }); });

    setExpos({ status: 'loading' });
    void listExpos({ sort: 'date' })
      .then((response) => { if (version === loadVersion.current) setExpos({ status: 'ready', value: response.items }); })
      .catch(() => { if (version === loadVersion.current) setExpos({ status: 'error' }); });
  }, [isSignedIn, loadReviews]);

  const loadMoreReviews = useCallback(() => {
    if (reviews.status !== 'ready' || reviewMoreLoading || reviewMoreError) return;
    if (!reviews.value.nextCursor) return;
    loadReviews(categoryRef.current, reviews.value.nextCursor);
  }, [loadReviews, reviewMoreError, reviewMoreLoading, reviews]);

  useFocusEffect(useCallback(() => {
    load();
    return () => {
      loadVersion.current += 1;
      reviewVersion.current += 1;
      reviewLoadingMore.current = false;
    };
  }, [load]));

  if (state.status === 'error') return <FullScreenError kind={state.kind} onRetry={() => void refresh()} />;
  if (state.status === 'loading') return <DelayedLoadingView />;
  if (state.status === 'signedOut') return <Redirect href="/login" />;

  const hasCategoryChips = tab === 'review' || tab === 'feed';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <NavBar
          title={S.title}
          onBack={() => router.replace(params.from === 'my' ? '/my' : '/')}
          right={
            tab === 'review'
              ? { label: S.write, brand: true, onPress: () => router.push('/community/review/write' as never) }
              : undefined
          }
        />

        <View style={styles.segment}>
          <SegmentedTabs
            items={TABS}
            value={tab}
            onChange={(next) => {
              const nextTab = next as Tab;
              setTab(nextTab);
              categoryRef.current = '전체';
              setCategory('전체');
              if (nextTab === 'review') loadReviews('전체');
            }}
            accessibilityLabel={S.title}
          />
        </View>

        {hasCategoryChips ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipBar}>
            {CATEGORIES.map((label) => (
              <FilterChip
                key={label}
                label={label}
                selected={category === label}
                onPress={() => {
                  categoryRef.current = label;
                  setCategory(label);
                  if (tab === 'review') loadReviews(label);
                }}
                role="radio"
              />
            ))}
          </ScrollView>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={160}
          onScroll={({ nativeEvent }) => {
            if (tab !== 'review') return;
            const distanceToEnd =
              nativeEvent.contentSize.height -
              nativeEvent.layoutMeasurement.height -
              nativeEvent.contentOffset.y;
            if (distanceToEnd < 240) loadMoreReviews();
          }}>
          {tab === 'review' ? (
            <ReviewList
              state={reviews}
              category={category}
              onRetry={() => loadReviews(categoryRef.current)}
              moreLoading={reviewMoreLoading}
              moreError={reviewMoreError}
              onRetryMore={loadMoreReviews}
              signedIn={isSignedIn}
            />
          ) : tab === 'feed' ? (
            <FeedList state={feed} category={category} onRetry={load} />
          ) : (
            <ExpoList state={expos} onRetry={load} />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ReviewList({
  state,
  category,
  onRetry,
  moreLoading,
  moreError,
  onRetryMore,
  signedIn,
}: {
  state: Loaded<LoungeReviewListResponse>;
  category: CategoryLabel;
  onRetry: () => void;
  moreLoading: boolean;
  moreError: boolean;
  onRetryMore: () => void;
  signedIn: boolean;
}) {
  const theme = useTheme();
  const [helpfulOverrides, setHelpfulOverrides] = useState<
    Record<string, { count: number; mine: boolean }>
  >({});
  const [helpfulPending, setHelpfulPending] = useState<Record<string, boolean>>({});

  async function toggleHelpful(review: LoungeReview) {
    if (!signedIn) {
      router.push('/login' as never);
      return;
    }
    if (helpfulPending[review.id]) return;

    const current = helpfulOverrides[review.id] ?? review.helpful;
    setHelpfulPending((value) => ({ ...value, [review.id]: true }));
    try {
      const next = await setReviewHelpful(review.id, !current.mine);
      setHelpfulOverrides((value) => ({ ...value, [review.id]: next }));
    } finally {
      setHelpfulPending((value) => ({ ...value, [review.id]: false }));
    }
  }

  if (state.status === 'loading') return <DelayedLoader size={28} />;
  if (state.status === 'error') return <LoadFailed onRetry={onRetry} />;

  const items = state.value.reviews.filter(
    (review) => category === '전체' || VENDOR_CATEGORY_LABEL[review.vendor.category] === category
  );

  if (items.length === 0) {
    return (
      <Empty
        title={category === '전체' ? S['review.empty.title'] : `${category} 후기가 아직 없어요`}
        body={category === '전체' ? S['review.empty.body'] : '다른 업종의 후기를 먼저 둘러보세요'}
        action={
          category === '전체'
            ? { label: S['review.empty.cta'], onPress: () => router.push('/capture/payment/consent' as never) }
            : undefined
        }
      />
    );
  }

  return (
    <View>
      {items.map((review) => {
        const answers = reviewAnswers(review);
        const verified = review.verification !== 'reported';
        const who = review.mine ? '내 후기' : review.roleLabel;
        const helpful = helpfulOverrides[review.id] ?? review.helpful;
        return (
          <View
            key={review.id}
            style={[styles.reviewCard, { borderBottomColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${review.vendor.name} 후기`}
              onPress={() =>
                router.push(
                  `/search/${encodeURIComponent(review.vendor.id)}/review/${encodeURIComponent(review.id)}` as never
                )
              }
              style={({ pressed }) => [styles.reviewTap, pressed ? styles.pressed : null]}>
            <View style={styles.reviewHead}>
              <View style={[styles.reviewAvatar, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="f13" style={styles.bold}>
                  {review.mine ? '나' : review.roleLabel.slice(0, 1)}
                </ThemedText>
              </View>
              <View style={styles.reviewHeadText}>
                <View style={styles.reviewNameRow}>
                  <ThemedText type="f14" style={styles.bold}>
                    {who}
                  </ThemedText>
                  {verified ? <Badge kind="ok">{R.verifiedBadge}</Badge> : null}
                </View>
                <ThemedText type="f12" themeColor="textAssistive" numeric numberOfLines={1}>
                  {reviewMeta(review)}
                </ThemedText>
              </View>
            </View>

            {answers.length > 0 ? (
              <View style={styles.reviewAnswers}>
                {answers.map((answer) => (
                  <View key={answer} style={[styles.reviewChip, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="f12" style={styles.bold}>
                      {answer}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {review.media[0] ? (
              <Image
                source={{ uri: review.media[0].url }}
                style={styles.reviewImage}
                resizeMode="cover"
                accessibilityLabel="후기 사진"
              />
            ) : null}

            <ThemedText type="f14" style={styles.reviewBody}>
              {review.body}
            </ThemedText>

            {review.rebuttal ? (
              <View style={[styles.rebuttal, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="f12" themeColor="textAssistive" style={styles.bold}>
                  업체 답변
                </ThemedText>
                <ThemedText type="f13">{review.rebuttal.body}</ThemedText>
              </View>
            ) : null}
            </Pressable>

            <View style={styles.reviewActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: helpful.mine, disabled: helpfulPending[review.id] }}
                disabled={helpfulPending[review.id]}
                onPress={() => void toggleHelpful(review)}
                style={({ pressed }) => [styles.reviewAction, pressed ? styles.pressed : null]}>
                <ThemedText
                  type="f12"
                  style={helpful.mine ? [styles.bold, { color: theme.tint }] : styles.bold}>
                  도움돼요 {helpful.count}
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push(
                    `/search/${encodeURIComponent(review.vendor.id)}/review/${encodeURIComponent(review.id)}` as never
                  )
                }
                style={({ pressed }) => [styles.reviewAction, pressed ? styles.pressed : null]}>
                <ThemedText type="f12" style={styles.bold}>
                  댓글 {review.comments.count}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        );
      })}
      {moreLoading ? <DelayedLoader size={20} /> : null}
      {moreError ? <LoadFailed onRetry={onRetryMore} /> : null}
      <ThemedText type="f12" themeColor="textAssistive" style={styles.caveat}>
        {state.value.caveat}
      </ThemedText>
    </View>
  );
}

/**
 * 과거 계약의 숫자를 없는 새 축으로 억지 변환하지 않는다.
 * 의미가 직접 대응되는 result / extra_cost만 정본 3지선다 문구로 읽는다.
 * progress 축은 서버가 별도 값을 주기 전까지 카드에서 생략한다.
 */
function reviewAnswers(review: LoungeReview): string[] {
  const progress = review.aspects.find((aspect) => aspect.key === 'progress');
  const result = review.aspects.find((aspect) => aspect.key === 'result');
  const cost = review.aspects.find((aspect) => aspect.key === 'extra_cost');
  const answers: string[] = [];

  if (progress) answers.push(`${shortAxis(R['axis.progress'])} · ${progressAnswer(progress.rating)}`);
  if (result) answers.push(`${shortAxis(R['axis.result'])} · ${resultAnswer(result.rating)}`);
  if (cost) answers.push(`${shortAxis(R['axis.cost'])} · ${costAnswer(cost.rating)}`);

  return answers;
}

function shortAxis(label: string): string {
  return label.replace('은 어땠나요', '').replace('는 어땠나요', '').replace(' 안내는요', '');
}

function progressAnswer(rating: number): string {
  if (rating >= 4) return R['axis.progress.fast'];
  if (rating <= 2) return R['axis.progress.slow'];
  return R['axis.progress.ok'];
}

function resultAnswer(rating: number): string {
  if (rating >= 4) return R['axis.result.above'];
  if (rating <= 2) return R['axis.result.below'];
  return R['axis.result.met'];
}

function costAnswer(rating: number): string {
  if (rating >= 4) return R['axis.cost.clear'];
  if (rating <= 2) return R['axis.cost.poor'];
  return R['axis.cost.ok'];
}

function reviewMeta(review: LoungeReview): string {
  const date = ymd(review.createdAt);
  const day = date ? `${date.month}월 ${date.day}일` : '';
  return [review.vendor.name, day].filter(Boolean).join(' · ');
}

function FeedList({
  state,
  category,
  onRetry,
}: {
  state: Loaded<WeddingFeedListResponse>;
  category: CategoryLabel;
  onRetry: () => void;
}) {
  const theme = useTheme();
  if (state.status === 'loading') return <DelayedLoader size={28} />;
  if (state.status === 'error') return <LoadFailed onRetry={onRetry} />;

  const items =
    category === '전체'
      ? state.value.items
      : state.value.items.filter((item) => item.categoryLabel === category);

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

  reviewCard: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.cardPaddingCompactY,
    paddingBottom: Layout.cardPadding,
    borderBottomWidth: Border.hairline,
    gap: Layout.inlineGap,
  },
  reviewTap: { gap: Layout.inlineGap },
  reviewImage: {
    width: '100%',
    aspectRatio: 1.55,
    borderRadius: Radius.medium,
    backgroundColor: '#F7F8F9',
  },
  reviewActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  reviewAction: { minHeight: Layout.touchTarget, justifyContent: 'center' },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: Layout.inlineGap },
  reviewAvatar: {
    width: Layout.avatarRow,
    height: Layout.avatarRow,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewHeadText: { flex: 1, minWidth: 0, gap: Spacing.half },
  reviewNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  reviewAnswers: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  reviewChip: { height: 26, borderRadius: Radius.pill, paddingHorizontal: Layout.chipPaddingX, justifyContent: 'center' },
  reviewBody: { lineHeight: LineHeight.lh22 },
  rebuttal: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  caveat: { paddingHorizontal: Layout.gutter, paddingTop: Spacing.three },

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
