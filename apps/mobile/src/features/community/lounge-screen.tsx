import type {
  ExpoItem,
  LoungeReviewListResponse,
  WeddingFeedListResponse,
} from '@weddingpick/api-contract';
import { WEDDING_FEED_LOUNGE_LIMIT, daysUntil } from '@weddingpick/domain';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Svg, { Path } from 'react-native-svg';

import {
  ActionButton,
  Border,
  CanonGray,
  Layout,
  LineHeight,
  MaxContentWidth,
  Radius,
  SeedIcon,
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
import { notifyRefreshFailed, usePullRefresh } from '@/features/refresh/use-pull-refresh';
import {
  LOUNGE_CATEGORIES,
  appendLoungeReviewPage,
  loungeFeedMatches,
  loungeReviewCategory,
  loungeVendorMatches,
  type LoungeCategory,
} from '@/features/community/lounge-reviews';
import { feedDetailHref } from '@/features/community/feed-href';
import { CatChipBar } from '@/features/settings/my-kit';
import { chainOrigin } from '@/features/navigation/depth-back';
import { NavBar } from '@/features/wedding/screen-kit';
import strings from '../../../../../spec/strings.ko.json';
import { ReviewWriteSheet } from '@/app/(tabs)/search/[vendorId]/write-review';
import { LoungeReviewVendorSheet } from '@/app/(tabs)/community/review/write';

const S = strings.community;
const R = strings.review;

export type LoungeKind = 'review' | 'feed' | 'expo';
/* 정본 my.jsx frame-008 · 010 · 012 — 화면마다 자기 제목(리얼후기 · 웨딩정보 · 박람회). */
const TITLE: Record<LoungeKind, string> = {
  review: S['tab.review'],
  /* 「웨딩피드」는 관리자·서버 쪽 이름이고 사용자 화면에는 쓰지 않는다. */
  feed: S['tab.feed'],
  expo: S['tab.expo'],
};
/** 정본 my.js `cats` — 전체 · 웨딩홀 · 스드메 · 본식 · 예물 · 신혼 · 예산(domain `WEDDING_FEED_CHIPS`). */
const CATEGORIES = LOUNGE_CATEGORIES;
type CategoryLabel = LoungeCategory;
type Loaded<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };
type LoungeReview = LoungeReviewListResponse['reviews'][number];

/**
 * 라운지 — docs/design/React_Native/my.jsx frame-008 · 010 · 012(리얼후기 · 웨딩정보 · 박람회).
 *
 * **정본대로 세그먼트 없는 하위 화면 셋이다**(각자 back 헤더 + 자기 제목). 주소는
 * `/community/review` · `/community/feed` · `/community/expo`이고, 저장된 `/community`
 * (`?tab=` 포함)는 `app/(tabs)/community/index.tsx`가 해당 화면으로 넘긴다.
 *
 * Root 탭이 아니다. 홈/MY에서 들어오는 하위 화면이고, 헤더 Back은 진입한 화면으로 돌아간다.
 *
 * **별점은 그린다. 숫자만 뺀다**(v3.28 2026-09-23 「후기 별점 UI를 되살린다」 ·
 * my.jsx frame-008 설명 「4.9 같은 평균 숫자 … 걷어냈고, 별점 5개는 3축 답변과 함께 남겼습니다」). `review.overall`(1~5)을
 * `<RatingStars showValue={false}>`로 그리고, 3축 답변 칩은 서버의 과거 후기 계약에
 * 정본 3축 값이 아직 전부 없으므로 실제로 의미가 대응되는 축만 정본 답변 칩으로
 * 바꿔 보여준다 — 이 둘은 서로 다른 값(overall vs. aspects)이라 함께 둔다.
 */
export function LoungeScreen({ kind: tab }: { kind: LoungeKind }) {
  const { state, refresh } = useSession();
  const params = useLocalSearchParams<{
    from?: string | string[];
    write?: string | string[];
    vendorId?: string | string[];
  }>();
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const write = Array.isArray(params.write) ? params.write[0] : params.write;
  const writeVendorId = Array.isArray(params.vendorId) ? params.vendorId[0] : params.vendorId;
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
  const communityReviewHref = `/community/review${from === 'my' ? '?from=my' : ''}`;
  const communityWriteHref = `${communityReviewHref}${from === 'my' ? '&' : '?'}write=review`;

  /** `keep` — 당겨서 새로 고침. 보이던 후기는 비우지 않고 실패는 토스트로만 알린다. */
  const loadReviews = useCallback((label: CategoryLabel, cursor?: string, keep?: boolean) => {
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
      if (keep !== true) setReviews({ status: 'loading' });
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
        else if (keep === true) notifyRefreshFailed();
        else setReviews({ status: 'error' });
      })
      .finally(() => {
        if (version !== reviewVersion.current) return;
        reviewLoadingMore.current = false;
        setReviewMoreLoading(false);
      });
  }, [isSignedIn]);

  /** `keep` — 당겨서 새로 고침. 보이던 목록은 그대로 두고 실패는 토스트로만 알린다. */
  const load = useCallback((keep?: boolean) => {
    const version = ++loadVersion.current;
    if (!isSignedIn) return;
    const kept = keep === true;
    const failed = (show: () => void) => () => {
      if (version !== loadVersion.current) return;
      if (kept) notifyRefreshFailed();
      else show();
    };

    /* 화면마다 자기 목록만 읽는다 — 셋이 이제 따로 열린다. */
    if (tab === 'review') {
      loadReviews(categoryRef.current, undefined, kept);
    } else if (tab === 'feed') {
      if (!kept) setFeed({ status: 'loading' });
      /* 수를 안 적으면 서버 기본값 8에서 잘려 관리자가 공개한 아홉째 글부터 안 보였다. */
      void getWeddingFeed(WEDDING_FEED_LOUNGE_LIMIT)
        .then((response) => { if (version === loadVersion.current) setFeed({ status: 'ready', value: response }); })
        .catch(failed(() => setFeed({ status: 'error' })));
    } else {
      if (!kept) setExpos({ status: 'loading' });
      void listExpos({ sort: 'date' })
        .then((response) => { if (version === loadVersion.current) setExpos({ status: 'ready', value: response.items }); })
        .catch(failed(() => setExpos({ status: 'error' })));
    }
  }, [isSignedIn, loadReviews, tab]);

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
  const pull = usePullRefresh(useCallback(() => load(true), [load]));

  if (state.status === 'error') return <FullScreenError kind={state.kind} onRetry={() => void refresh()} />;
  if (state.status === 'loading') return <DelayedLoadingView />;
  if (state.status === 'signedOut') return <Redirect href="/login" />;

  const hasCategoryChips = tab === 'review' || tab === 'feed';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <NavBar
          title={TITLE[tab]}
          onBack={() => router.replace(from === 'my' ? '/my' : '/')}
          right={
            tab === 'review'
              ? {
                  label: S.write,
                  brand: true,
                  onPress: () => router.push(communityWriteHref as never),
                }
              : undefined
          }
        />

        {hasCategoryChips ? (
          <CatChipBar
            items={CATEGORIES}
            selected={category}
            onSelect={(label) => {
              categoryRef.current = label;
              setCategory(label);
              if (tab === 'review') loadReviews(label);
            }}
          />
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={pull.refreshControl}
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
              vendorOrigin={chainOrigin('community', from === 'my' ? 'my' : null)}
            />
          ) : tab === 'feed' ? (
            <FeedList state={feed} category={category} from={from} onRetry={() => load()} />
          ) : (
            <ExpoList state={expos} onRetry={() => load()} />
          )}
        </ScrollView>
      </SafeAreaView>
      {write === 'review' ? (
        writeVendorId ? (
          <ReviewWriteSheet
            vendorId={writeVendorId}
            supportingText="라운지 후기에 머물러 작성해요."
            onClose={() => router.replace(communityReviewHref as never)}
            onSubmitted={() => {
              loadReviews(categoryRef.current);
              router.replace(communityReviewHref as never);
            }}
          />
        ) : (
          <LoungeReviewVendorSheet
            onClose={() => router.replace(communityReviewHref as never)}
            onChoose={(vendorId) =>
              router.replace(`${communityWriteHref}&vendorId=${encodeURIComponent(vendorId)}` as never)
            }
          />
        )
      ) : null}
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
  vendorOrigin,
}: {
  state: Loaded<LoungeReviewListResponse>;
  category: CategoryLabel;
  onRetry: () => void;
  moreLoading: boolean;
  moreError: boolean;
  onRetryMore: () => void;
  signedIn: boolean;
  /** 업체 상세의 `from` — 리얼후기(그리고 그 앞의 MY)로 돌아오게 한다. */
  vendorOrigin: string;
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

  const items = state.value.reviews.filter((review) => loungeVendorMatches(category, review.vendor.category));

  if (items.length === 0) {
    return (
      <Empty
        title={category === '전체' ? S['review.empty.title'] : `${category} 후기가 아직 없어요`}
        body={category === '전체' ? S['review.empty.body'] : '다른 업종의 후기를 먼저 둘러보세요'}
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
              /*
               * 후기 상세는 2026-09-25 삭제 — 그 업체 상세로 연다. 업체 상세는 검색 스택에 있으니
               * 출처(리얼후기 · 그 앞의 MY)를 넘긴다 — 없으면 Back이 검색 홈으로 간다.
               */
              onPress={() => router.push(`/search/${encodeURIComponent(review.vendor.id)}?from=${vendorOrigin}` as never)}
              style={({ pressed }) => [styles.reviewTap, pressed ? styles.pressed : null]}>
            <View style={styles.reviewHead}>
              <View style={[styles.reviewAvatar, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="f15" style={styles.bold}>
                  {review.mine ? '나' : review.roleLabel.slice(0, 1)}
                </ThemedText>
              </View>
              <View style={styles.reviewHeadText}>
                <View style={styles.reviewNameRow}>
                  <ThemedText type="f15" style={styles.bold}>
                    {who}
                  </ThemedText>
                  {verified ? (
                    <View style={[styles.verifyBadge, { backgroundColor: theme.positiveBackground }]}>
                      <ThemedText type="f11" style={[styles.bold, { color: theme.positive }]}>
                        {R.verifiedBadge}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                {/* 정본 revNameCol — 이름 줄 · 별 줄(14 · 사이 2) · 업체 · 시간 순서다. */}
                <StarRow value={review.overall} />
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

            <ThemedText type="f15" style={[styles.reviewBody, { color: CanonGray.gray700 }]}>
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
                accessibilityLabel={`도움돼요 ${helpful.count}`}
                style={({ pressed }) => [styles.reviewAction, pressed ? styles.pressed : null]}>
                {/* 정본 likeStyle — 하트 18 + 숫자 14/700 · 누른 뒤 코랄. */}
                <SeedIcon
                  name={helpful.mine ? 'heartFill' : 'heartRegular'}
                  size={18}
                  color={helpful.mine ? theme.tint : CanonGray.gray700}
                />
                <ThemedText
                  type="f14"
                  numeric
                  style={[styles.bold, { color: helpful.mine ? theme.tint : CanonGray.gray700 }]}>
                  {helpful.count}
                </ThemedText>
              </Pressable>
              {/* «댓글 N»은 후기 상세(댓글이 사는 곳) 삭제(2026-09-25)로 뺐다. */}
            </View>
          </View>
        );
      })}
      {moreLoading ? <DelayedLoader size={20} /> : null}
      {moreError ? <LoadFailed onRetry={onRetryMore} /> : null}
    </View>
  );
}

/** 정본 STARROW2 — 별 14 · 사이 2 · 채움 코랄 · 빈 별 #dcdee3. */
const STAR_PATH = 'M12 2.5l2.9 6 6.6.7-4.9 4.5 1.3 6.5L12 16.9l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.7Z';

function StarRow({ value }: { value: number }) {
  const theme = useTheme();
  const filled = Math.round(value);

  return (
    <View accessibilityRole="image" accessibilityLabel={`5점 만점에 ${value.toFixed(1)}점`} style={styles.starRow}>
      {Array.from({ length: 5 }, (_, index) => (
        <Svg key={index} width={14} height={14} viewBox="0 0 24 24">
          <Path d={STAR_PATH} fill={index < filled ? theme.tint : theme.track} />
        </Svg>
      ))}
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

  /* 정본 frame-008 `rev(...)` 답변 칩은 답만 적는다(「빨랐어요」 · 「기대 이상」 · 「명확했어요」) — 축 이름을 붙이지 않는다. */
  if (progress) answers.push(progressAnswer(progress.rating));
  if (result) answers.push(resultAnswer(result.rating));
  if (cost) answers.push(costAnswer(cost.rating));

  return answers;
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
  from,
  onRetry,
}: {
  state: Loaded<WeddingFeedListResponse>;
  category: CategoryLabel;
  /** 목록의 진입 출처(`?from=`) — 글 상세로 그대로 넘긴다. */
  from?: string;
  onRetry: () => void;
}) {
  const theme = useTheme();
  if (state.status === 'loading') return <DelayedLoader size={28} />;
  if (state.status === 'error') return <LoadFailed onRetry={onRetry} />;

  const items = state.value.items.filter((item) => loungeFeedMatches(category, item.categoryLabel));

  if (items.length === 0) return <Empty title={S['feed.empty.title']} body={S['feed.empty.body']} />;

  return (
    <View>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          /* 진입 출처를 상세에도 싣는다 — 상세 하단 「목록」이 같은 목록(같은 from)으로 돌아간다. */
          onPress={() => router.push(feedDetailHref(item.id, from) as never)}
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
                : { borderWidth: Border.hairline, borderColor: theme.border, backgroundColor: theme.background },
              pressed ? styles.pressed : null,
            ]}>
            <View style={styles.expoHead}>
              {/* 정본 thumbCell 64 · radius 8. */}
              <View style={[styles.expoThumb, { backgroundColor: theme.imagePlaceholder }]}>
                {expo.thumbnailUrl ? (
                  <Image source={{ uri: expo.thumbnailUrl }} style={styles.expoThumbImage} resizeMode="cover" />
                ) : null}
              </View>
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

/** 정본 expo(date) — 다가오는 박람회는 «9월 19일~20일», 끝난 박람회는 «8월 30일 종료». */
function expoDateRange(expo: ExpoItem): string {
  const start = ymd(expo.startsAt);
  const end = ymd(expo.endsAt);
  if (!start || !end) return `${expo.startsAt}~${expo.endsAt}`;
  if (expo.status === 'closed') return S['expo.closedDate'].replace('{date}', `${end.month}월 ${end.day}일`);
  const from = `${start.month}월 ${start.day}일`;
  if (start.month === end.month && start.day === end.day) return from;
  return start.month === end.month ? `${from}~${end.day}일` : `${from}~${end.month}월 ${end.day}일`;
}

function expoDday(expo: ExpoItem): string {
  /* 정본 dday «종료» — 날짜는 윗줄(날짜 칸)이 적는다. */
  if (expo.status === 'closed') return S['expo.closed'];
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
  /* 정본 scroll padding-top 16. */
  scrollContent: { paddingTop: Spacing.three, paddingBottom: Spacing.four },

  /* revCard: 위아래 18px, 바깥 좌우 24px. */
  reviewCard: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.cardPaddingCompactY,
    paddingBottom: Layout.cardPaddingCompactY,
    borderBottomWidth: Border.hairline,
    gap: Layout.inlineGap,
  },
  reviewTap: { gap: Layout.inlineGap },
  /* revImg: 너비 100% · 높이 240 · radius 10. */
  reviewImage: {
    width: '100%',
    height: 240,
    borderRadius: Radius.medium,
    backgroundColor: '#F7F8F9',
  },
  /* revFoot: gap 18px. 누르는 칸은 글자 높이 그대로(정본은 줄 높이만 차지한다). */
  reviewActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  reviewAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  /* badgeVerify — 3 8 · radius 4 · 11/700. */
  verifyBadge: { paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: Radius.badge },
  starRow: { flexDirection: 'row', gap: Spacing.half },
  /* revHead: gap 10px. */
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  /* revAvatar: 40×40(정본 — Layout 토큰에 40이 없어 px 그대로 둔다). */
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* revNameCol gap 3. */
  reviewHeadText: { flex: 1, minWidth: 0, gap: Layout.cardNameGap },
  /* revNameRow: gap 6px. */
  reviewNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  /* revAnswers: gap 6px. */
  reviewAnswers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  /* revChip: height 26 · padding 0 10px. */
  reviewChip: { height: 26, borderRadius: Radius.pill, paddingHorizontal: 10, justifyContent: 'center' },
  /* revText 15/24. */
  reviewBody: { lineHeight: LineHeight.lh24 },
  rebuttal: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },

  /* guideRow: 세로 16px, 바깥 좌우 24px. */
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
  /* expoCard(card): radius 10 · padding 16px 20px · gap 12. */
  expoCard: {
    borderRadius: Radius.medium,
    paddingVertical: Spacing.three,
    paddingHorizontal: Layout.cardPadding,
    gap: Layout.inlineGap,
  },
  expoHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Layout.inlineGap },
  expoCol: { flex: 1, minWidth: 0, gap: Spacing.one },
  expoThumb: { width: 64, height: 64, borderRadius: Spacing.two, overflow: 'hidden', flexShrink: 0 },
  expoThumbImage: { width: '100%', height: '100%' },
  empty: { paddingHorizontal: Layout.gutter, paddingTop: Layout.sectionGap, gap: Spacing.two, alignItems: 'center' },
  emptyAction: { marginTop: Spacing.two, alignSelf: 'stretch' },
});
