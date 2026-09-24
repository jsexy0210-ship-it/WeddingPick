import type { Review, ReviewComment } from '@weddingpick/api-contract';
import type { ReportReason } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createReviewComment,
  deleteReviewComment,
  listReportReasons,
  listReviewComments,
  listVendorReviews,
  reportReviewComment,
  setReviewHelpful,
} from '@/api/client';
import {
  ActionButton,
  Border,
  FilterChip,
  Layout,
  LineHeight,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { DepthHeader } from '@/components/depth-header';
import { formatDateDot } from '@/features/common/format-date';
import { showResultToast } from '@/features/navigation/result-toast';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { useSession } from '@/features/auth/use-session';
import { Badge } from '@/features/wedding/screen-kit';

/**
 * 후기 상세 — 피그마 `VendorFlows.tsx` `ReviewDetailPage`(규격서 txt는 없다 — 2026-09-15 MASTER 「후기 상세도
 * 만든다」). 수는 피그마 소스의 Tailwind 값이다.
 *
 *   PageHeader "리얼 후기"  56 · pad 0 16 · 뒤로 40 · 14/700
 *   작성자 줄  flex · gap 12 · pad 20 · border-b 1
 *     span 40×40 r9999 bg #F7F8F9 · 14/700 첫 글자
 *     p 14/700 이름 + 배지 10/700 (BadgeCheck 12)      별 12 ×5 + 시각 10/400 #868B94 · mt 2
 *   img 320 (사진)
 *   div pad 20
 *     좋아요 24 + 수 14/700 · 댓글 20 + 수 14/700 · gap 16 · mb 16
 *     grid cols 4 · gap 8 · mb 20   div r12 bg #F7F8F9 pad 8 12 center   p 10/400 #868B94 · p 12/700 mt4 · 별 8 ×5 mt4
 *     p 본문 14/400 lh 28
 *     button 48 r16 primary 14/700 «이 업체 상담 예약하기» + CalendarDays 16 · mt 24
 *   댓글 section border-t · pad 20 …
 *
 * **피그마와 다르게 둔 것과 근거.** 사진 · 좋아요 · 댓글은 우리 계약(`reviewSchema`)에 없어 그리지 않는다 —
 * 없는 값을 지어내지 않는다. 항목별 별점 격자는 `aspects`가 있을 때만 그린다(피그마 4칸 → 있는 만큼).
 * 확인 배지는 피그마의 「계약 인증」(오용어)이 아니라 서버가 보내는 `verificationLabel`이다(용어 규칙).
 * 별은 SEED `IconReviewStarFill`(피그마 홈 카드와 같은 아이콘)로 그린다.
 */

const TITLE = '리얼 후기';
const CONSULT_CTA = '업체 상세에서 최종 Pick 확인하기';
const STARS = [1, 2, 3, 4, 5] as const;

export default function ReviewDetailScreen() {
  const theme = useTheme();
  const { state: session } = useSession();
  const { vendorId, reviewId } = useLocalSearchParams<{ vendorId: string; reviewId: string }>();
  const [review, setReview] = useState<Review | null | undefined>(undefined);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [interactionNotice, setInteractionNotice] = useState<string | null>(null);
  const [reportingComment, setReportingComment] = useState<string | null>(null);
  const [reasons, setReasons] = useState<{ value: ReportReason; label: string }[]>([]);

  useEffect(() => {
    if (!vendorId || !reviewId) return;
    /* 후기 하나를 주는 주소가 없다 — 목록에서 찾는다. 첫 장에 없으면 «찾을 수 없어요». */
    listVendorReviews(vendorId)
      .then((page) => setReview(page.reviews.find((item) => item.id === reviewId) ?? null))
      .catch(() => setReview(null));
  }, [vendorId, reviewId]);

  useEffect(() => {
    if (!reviewId) return;
    let active = true;
    void listReviewComments(reviewId)
      .then((page) => {
        if (active) setComments(page.comments);
      })
      .catch(() => {
        if (active) setInteractionNotice('댓글을 불러오지 못했어요.');
      });
    return () => {
      active = false;
    };
  }, [reviewId]);

  useEffect(() => {
    void listReportReasons()
      .then((loaded) => setReasons(loaded.reasons))
      .catch(() => setReasons([]));
  }, []);

  async function toggleHelpful() {
    if (!review || !reviewId) return;
    if (session.status !== 'signedIn') {
      router.push('/login');
      return;
    }
    setInteractionNotice(null);
    try {
      const helpful = await setReviewHelpful(reviewId, !review.helpful.mine);
      setReview((current) => (current ? { ...current, helpful } : current));
      showResultToast(helpful.mine ? '도움돼요를 눌렀어요' : '도움돼요를 취소했어요');
    } catch (caught) {
      setInteractionNotice(caught instanceof Error ? caught.message : '도움돼요를 반영하지 못했어요.');
    }
  }

  async function sendComment() {
    if (!reviewId || commentSending || !commentText.trim()) return;
    if (session.status !== 'signedIn') {
      router.push('/login');
      return;
    }
    setCommentSending(true);
    setInteractionNotice(null);
    try {
      const created = await createReviewComment(reviewId, { body: commentText.trim() });
      setComments((current) => [...current, created]);
      setReview((current) =>
        current
          ? {
              ...current,
              comments: {
                ...current.comments,
                count: current.comments.count + 1,
                items: [...current.comments.items, created].slice(0, 2),
              },
            }
          : current
      );
      setCommentText('');
      showResultToast('댓글을 남겼어요');
    } catch (caught) {
      setInteractionNotice(caught instanceof Error ? caught.message : '댓글을 남기지 못했어요.');
    } finally {
      setCommentSending(false);
    }
  }

  async function removeComment(commentId: string) {
    setInteractionNotice(null);
    try {
      await deleteReviewComment(commentId);
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      setReview((current) =>
        current
          ? {
              ...current,
              comments: {
                ...current.comments,
                count: Math.max(0, current.comments.count - 1),
                items: current.comments.items.filter((comment) => comment.id !== commentId),
              },
            }
          : current
      );
      showResultToast('댓글을 삭제했어요');
    } catch (caught) {
      setInteractionNotice(caught instanceof Error ? caught.message : '댓글을 지우지 못했어요.');
    }
  }

  async function reportComment(commentId: string, reason: ReportReason) {
    try {
      const received = await reportReviewComment(commentId, { reason });
      setReportingComment(null);
      setInteractionNotice(received.acknowledgement);
      showResultToast('신고를 접수했어요');
    } catch (caught) {
      setInteractionNotice(caught instanceof Error ? caught.message : '신고하지 못했어요.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <DepthHeader title={TITLE} />

        {review === undefined ? (
          <View style={styles.center}>
            <DelayedLoader size={40} />
          </View>
        ) : review === null ? (
          <View style={styles.center}>
            <ThemedText type="f14" themeColor="textAssistive">
              후기를 찾을 수 없어요
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {/* 작성자 줄 `flex items-center gap-3 border-b px-5 py-5`. */}
            <View style={[styles.author, { borderBottomColor: theme.border }]}>
              <ThemedView type="backgroundElement" style={styles.avatar}>
                <ThemedText type="f14" style={styles.bold}>
                  {review.roleLabel.slice(0, 1)}
                </ThemedText>
              </ThemedView>
              <View style={styles.authorText}>
                <View style={styles.nameRow}>
                  <ThemedText type="f14" style={styles.bold} numberOfLines={1}>
                    {review.roleLabel}
                  </ThemedText>
                  <Badge label={review.verificationLabel} tone={review.verification === 'reported' ? 'none' : 'ok'} />
                </View>
                <View style={styles.metaRow}>
                  <StarRow value={review.overall} size={Layout.iconMicro} />
                  <ThemedText type="f10" numeric themeColor="textAssistive">
                    {formatDateDot(review.createdAt)}
                  </ThemedText>
                </View>
              </View>
            </View>

            {review.media[0] ? (
              <Image
                source={{ uri: review.media[0].url }}
                style={styles.heroImage}
                resizeMode="cover"
                accessibilityLabel="후기 사진"
              />
            ) : null}

            <View style={styles.body}>
              <View style={styles.interactions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: review.helpful.mine }}
                  onPress={() => void toggleHelpful()}
                  style={({ pressed }) => [styles.interactionButton, pressed && styles.pressed]}>
                  <ThemedText
                    type="f14"
                    style={review.helpful.mine ? [styles.bold, { color: theme.tint }] : styles.bold}>
                    도움돼요 {review.helpful.count}
                  </ThemedText>
                </Pressable>
                <ThemedText type="f14" style={styles.bold}>
                  댓글 {review.comments.count}
                </ThemedText>
              </View>
              {/* 항목별 별점 `grid grid-cols-4 gap-2` — 있는 만큼. */}
              {review.aspects.length > 0 ? (
                <View style={styles.aspects}>
                  {review.aspects.map((aspect) => (
                    <ThemedView key={aspect.key} type="backgroundElement" style={styles.aspect}>
                      <ThemedText type="f10" themeColor="textAssistive" numberOfLines={1}>
                        {aspect.label}
                      </ThemedText>
                      <ThemedText type="f12" numeric style={[styles.bold, styles.aspectScore]}>
                        {aspect.rating}.0
                      </ThemedText>
                      <View style={styles.aspectStars}>
                        <StarRow value={aspect.rating} size={Spacing.two} />
                      </View>
                    </ThemedView>
                  ))}
                </View>
              ) : null}

              <ThemedText type="f14" style={styles.title}>
                {review.title}
              </ThemedText>
              {/* 본문 `text-sm leading-7` — 14 · 28. */}
              <ThemedText type="f14" style={styles.text}>
                {review.body}
              </ThemedText>
              {review.pros ? (
                <ThemedText type="f14" themeColor="textSecondary" style={styles.text}>
                  좋았던 점: {review.pros}
                </ThemedText>
              ) : null}
              {review.cons ? (
                <ThemedText type="f14" themeColor="textSecondary" style={styles.text}>
                  아쉬운 점: {review.cons}
                </ThemedText>
              ) : null}

              {review.rebuttal ? (
                <ThemedView type="backgroundElement" style={styles.rebuttal}>
                  <ThemedText type="f12" style={styles.bold}>
                    업체 답변 · {review.rebuttal.claimedRole}
                  </ThemedText>
                  <ThemedText type="f14" themeColor="textStrong" style={styles.text}>
                    {review.rebuttal.body}
                  </ThemedText>
                </ThemedView>
              ) : null}

              {/* `mt-6 h-12 rounded-2xl bg-primary text-sm font-bold` + CalendarDays 16. */}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/search/${vendorId}`)}
                style={({ pressed }) => [styles.cta, { backgroundColor: theme.tint }, pressed && styles.pressed]}>
                <ProductSymbol name="chevronRight" size={Layout.iconField} color={theme.onTint} />
                <ThemedText type="f14" themeColor="onTint" style={styles.bold}>
                  {CONSULT_CTA}
                </ThemedText>
              </Pressable>

              <View style={[styles.commentSection, { borderTopColor: theme.border }]}>
                <ThemedText type="f14" style={styles.bold}>댓글 {review.comments.count}</ThemedText>
                {comments.map((comment) => (
                  <View key={comment.id} style={styles.comment}>
                    <View style={styles.commentHead}>
                      <ThemedText type="f12" style={styles.bold}>
                        {comment.mine ? '내 댓글' : '회원'}
                      </ThemedText>
                      <ThemedText type="f10" numeric themeColor="textAssistive">
                        {formatDateDot(comment.createdAt)}
                      </ThemedText>
                    </View>
                    <ThemedText type="f13">{comment.body}</ThemedText>
                    {comment.mine ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void removeComment(comment.id)}
                        style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}>
                        <ThemedText type="f12" themeColor="textSecondary">삭제</ThemedText>
                      </Pressable>
                    ) : reportingComment === comment.id ? (
                      <View style={styles.reportReasons}>
                        {reasons.map((reason) => (
                          <FilterChip
                            key={reason.value}
                            label={reason.label}
                            selected={false}
                            role="radio"
                            onPress={() => void reportComment(comment.id, reason.value)}
                          />
                        ))}
                        <ActionButton label="그만두기" onPress={() => setReportingComment(null)} />
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        disabled={reasons.length === 0}
                        onPress={() => setReportingComment(comment.id)}
                        style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}>
                        <ThemedText type="f12" themeColor="textSecondary">신고</ThemedText>
                      </Pressable>
                    )}
                  </View>
                ))}

                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={1000}
                  editable={!commentSending}
                  placeholder="댓글을 남겨보세요"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.commentInput, { color: theme.text, borderColor: theme.border }]}
                  accessibilityLabel="후기 댓글"
                />
                <ActionButton
                  variant="primary"
                  label={commentSending ? '등록 중…' : '댓글 등록'}
                  disabled={commentSending || !commentText.trim()}
                  onPress={() => void sendComment()}
                />
                {interactionNotice ? (
                  <ThemedText type="f12" themeColor="textSecondary">{interactionNotice}</ThemedText>
                ) : null}
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

/** 별 다섯 — 채운 것은 SEED 별(피그마 `fill-amber-400`은 토큰에 없어 `cautionary` 색 — PR에 보고), 빈 것은 muted 20%. */
function StarRow({ value, size }: { value: number; size: number }) {
  const theme = useTheme();

  return (
    <View style={styles.stars} accessibilityLabel={`별점 ${value}점`}>
      {STARS.map((star) => (
        <View key={star} style={star <= value ? null : styles.starOff}>
          <SeedIcon name="reviewStarFill" size={size} color={star <= value ? theme.cautionary : theme.textAssistive} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: Spacing.four },
  /* `gap-3 px-5 py-5 border-b`. */
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    paddingHorizontal: Layout.pageX,
    paddingVertical: Layout.pageX,
    borderBottomWidth: Border.hairline,
  },
  /* `h-10 w-10 rounded-full`. */
  avatar: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorText: { flex: 1, minWidth: 0 },
  /* `gap-1.5`. */
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Layout.menuGroupGap },
  /* `mt-0.5 gap-2`. */
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.half },
  stars: { flexDirection: 'row', gap: Spacing.half },
  starOff: { opacity: 0.2 },
  /* `px-5 py-5`. */
  body: { paddingHorizontal: Layout.pageX, paddingVertical: Layout.pageX },
  /* `grid-cols-4 gap-2 mb-5`. */
  aspects: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Layout.listGap },
  /* `rounded-xl bg-secondary px-2 py-3 text-center`. */
  aspect: {
    flexGrow: 1,
    flexBasis: '22%',
    borderRadius: Radius.medium + Spacing.half,
    paddingHorizontal: Spacing.two,
    paddingVertical: Layout.inlineGap,
    alignItems: 'center',
  },
  aspectScore: { marginTop: Spacing.one },
  aspectStars: { marginTop: Spacing.one },
  title: { fontWeight: 700, marginBottom: Spacing.two },
  /* `text-sm leading-7`. */
  text: { lineHeight: LineHeight.lh28 },
  rebuttal: { marginTop: Spacing.three, padding: Spacing.three, borderRadius: Radius.cardLarge, gap: Spacing.one },
  /* `mt-6 h-12 rounded-2xl gap-2`. */
  cta: {
    marginTop: Spacing.four,
    height: Layout.controlLarge,
    borderRadius: Radius.cardLarge,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  bold: { fontWeight: 700 },
  heroImage: { width: '100%', aspectRatio: 1, backgroundColor: '#F7F8F9' },
  interactions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  interactionButton: { minHeight: Layout.touchTarget, justifyContent: 'center' },
  commentSection: { borderTopWidth: Border.hairline, paddingTop: Spacing.four, gap: Spacing.three },
  comment: { gap: Spacing.one },
  commentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  textAction: { minHeight: Layout.touchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  reportReasons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  commentInput: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: Radius.input,
    padding: Spacing.three,
    textAlignVertical: 'top',
  },
  pressed: { opacity: 0.8 },
});
