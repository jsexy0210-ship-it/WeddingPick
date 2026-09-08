import type { ReviewListResponse } from '@weddingpick/api-contract';
import { TERMS, type ReportReason } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listReportReasons, listVendorReviews, reportReview } from '@/api/client';
import { formatDateDot } from '@/features/common/format-date';
import {
  ActionButton,
  FilterChip,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
  ListSkeleton,
} from '@weddingpick/ui';

/**
 * 업체의 후기.
 *
 * 이용점수와 글을 한 화면에 두되 섞지 않는다 — 점수에는 확인된 후기만 들어가고,
 * 글은 미인증도 보인다. 그 차이를 각 글의 확인 표시가 말한다.
 */
export default function VendorReviewsScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const theme = useTheme();
  const [page, setPage] = useState<ReviewListResponse | null>(null);
  const [more, setMore] = useState<ReviewListResponse['reviews']>([]);
  const [error, setError] = useState<string | null>(null);

  /** 신고할 후기. 열려 있으면 사유를 고른다. */
  const [reporting, setReporting] = useState<string | null>(null);
  const [reasons, setReasons] = useState<{ value: ReportReason; label: string }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    listVendorReviews(vendorId)
      .then((loaded) => {
        setPage(loaded);
        setMore([]);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [vendorId]);

  useEffect(load, [load]);

  useEffect(() => {
    listReportReasons()
      .then((loaded) => setReasons(loaded.reasons))
      // 사유 목록을 못 받아도 후기는 보여준다. 신고 단추만 조용히 비활성된다.
      .catch(() => setReasons([]));
  }, []);

  if (error) {
    return (
      <Frame>
        <ThemedText type="subtitle">불러오지 못했어요</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
        <ActionButton label="돌아가기" onPress={() => router.back()} />
      </Frame>
    );
  }

  if (!page) {
    return (
      <Frame>
        <ListSkeleton />
      </Frame>
    );
  }

  // 더 불러온 쪽은 뒤에 잇고, 다음 커서는 마지막으로 받은 것을 쓴다.
  const reviews = [...page.reviews, ...more];

  async function send(reviewId: string, reason: ReportReason) {
    try {
      const received = await reportReview(reviewId, { reason });

      setReporting(null);
      setNotice(received.acknowledgement);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : '신고하지 못했어요.');
    }
  }

  async function loadMore(cursor: string) {
    try {
      const next = await listVendorReviews(vendorId, cursor);

      setMore((current) => [...current, ...next.reviews]);
      setPage((current) => (current ? { ...current, nextCursor: next.nextCursor } : current));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '더 불러오지 못했어요.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle">{TERMS.experience}</ThemedText>

            <ThemedView type="backgroundElement" style={styles.card}>
              {page.usageScore.available ? (
                <>
                  <ThemedText type="subtitle">{page.usageScore.average.toFixed(1)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    확인된 후기 {page.usageScore.count}건
                  </ThemedText>
                  {page.usageScore.aspects.map((aspect) => (
                    <ThemedText key={aspect.key} type="small" themeColor="textSecondary">
                      {aspect.label} {aspect.average.toFixed(1)}
                    </ThemedText>
                  ))}

                  {/*
                    체크리스트는 이용 점수와 다른 배열로 온다. 4.2점과 78%는 다른 것을
                    재는 숫자라 같은 막대로 그리지 않는다. 실 제보가 모자라면 숫자
                    대신 "수집 중"이다 — 흐린 숫자도 숫자다.
                  */}
                  {page.usageScore.checklist.map((item) => (
                    <ThemedText
                      key={item.key}
                      type="small"
                      themeColor={item.needsAttention ? 'cautionary' : 'textSecondary'}>
                      {item.label}{' '}
                      {item.collecting ? '수집 중' : `${item.percent}% · ${item.answered}명 답함`}
                    </ThemedText>
                  ))}
                  {page.usageScore.caption ? (
                    <ThemedText type="small" themeColor="textAssistive">
                      {page.usageScore.caption}
                    </ThemedText>
                  ) : null}
                </>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {page.usageScore.reason}
                </ThemedText>
              )}
            </ThemedView>

            {/* 가격 비교의 단서와 같은 자리다. 글만 그리고 이 말을 빠뜨리지 않는다. */}
            <ThemedText type="small" themeColor="textSecondary">
              {page.caveat}
            </ThemedText>
          </ThemedView>

          {notice ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {notice}
              </ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView style={styles.section}>
            <ActionButton
              variant="primary"
              label="후기 쓰기"
              hint="이용하신 경험을 다음 분에게 남겨주세요"
              onPress={() => router.push(`/search/${vendorId}/write-review`)}
            />
          </ThemedView>

          <ThemedView style={styles.section}>
            {reviews.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  아직 후기가 없어요. 첫 후기를 남겨주시면 다음 분에게 도움이 돼요.
                </ThemedText>
              </ThemedView>
            ) : (
              reviews.map((review) => (
                <ThemedView key={review.id} type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold">{review.title}</ThemedText>
                  <ThemedText type="small" numeric themeColor="textSecondary">
                    {review.overall.toFixed(1)} · {review.roleLabel} · {review.verificationLabel}
                  </ThemedText>
                  <ThemedText type="small">{review.body}</ThemedText>

                  {review.pros ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      좋았던 점: {review.pros}
                    </ThemedText>
                  ) : null}
                  {review.cons ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      아쉬운 점: {review.cons}
                    </ThemedText>
                  ) : null}

                  {review.aspects.map((aspect) => (
                    <ThemedText key={aspect.key} type="small" numeric themeColor="textSecondary">
                      {aspect.label} {aspect.rating.toFixed(1)}
                    </ThemedText>
                  ))}

                  <ThemedText type="small" themeColor="textAssistive">
                    {formatDateDot(review.createdAt)}
                  </ThemedText>

                  {/*
                    * 업체 반론. 사람이 게시를 결정한 것만 온다 — 후기를 가리는
                    * 대신 옆에 말을 더한다. 읽는 사람이 양쪽을 다 본다.
                    */}
                  {review.rebuttal ? (
                    <View style={[styles.rebuttal, { borderLeftColor: theme.tint }]}>
                      <ThemedText type="t7" themeColor="tint">
                        업체 반론 · {review.rebuttal.claimedRole}
                      </ThemedText>
                      <ThemedText type="small">{review.rebuttal.body}</ThemedText>
                    </View>
                  ) : null}

                  {reporting === review.id ? (
                    <View style={styles.chips}>
                      {reasons.map((reason) => (
                        <FilterChip
                          key={reason.value}
                          label={reason.label}
                          selected={false}
                          role="radio"
                          onPress={() => void send(review.id, reason.value)}
                        />
                      ))}
                      <ActionButton label="그만두기" onPress={() => setReporting(null)} />
                    </View>
                  ) : review.mine ? (
                    <ActionButton
                      label="내 후기 고치기"
                      onPress={() =>
                        router.push(
                          `/search/${vendorId}/edit-review?reviewId=${review.id}&overall=${review.overall}&title=${encodeURIComponent(review.title)}&body=${encodeURIComponent(review.body)}&pros=${encodeURIComponent(review.pros ?? '')}&cons=${encodeURIComponent(review.cons ?? '')}`
                        )
                      }
                    />
                  ) : (
                    <>
                      <ActionButton
                        label="신고하기"
                        hint="신고만으로 글이 내려가지는 않아요"
                        disabled={reasons.length === 0}
                        onPress={() => {
                          setNotice(null);
                          setReporting(review.id);
                        }}
                      />
                      {/*
                        * 반론은 어느 후기에 대한 답인지가 있어야 성립한다. 그래서
                        * 등록은 MY가 아니라 후기 옆에서 시작한다 — MY의 메뉴는
                        * 낸 것을 보러 가는 길이다.
                        */}
                      {review.rebuttal ? null : (
                        <ActionButton
                          label="업체 반론 등록"
                          hint="업체 관계자만 등록해주세요. 확인 후 표시돼요"
                          onPress={() => router.push(`/my/rebuttals/${review.id}`)}
                        />
                      )}
                    </>
                  )}
                </ThemedView>
              ))
            )}
          </ThemedView>

          {page.nextCursor ? (
            <ActionButton label="더 보기" onPress={() => void loadMore(page.nextCursor!)} />
          ) : null}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>{children}</ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  /** 후기 아래 세로선 블록. 핸드오프가 정한 모양이다. */
  rebuttal: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    gap: Spacing.one,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
