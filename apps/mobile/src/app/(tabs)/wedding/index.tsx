import type {
  CurrentUser,
  ExpenseSummaryResponse,
  WeddingEventListResponse,
  WeddingInviteListResponse,
  WeddingTaskListResponse,
} from '@weddingpick/api-contract';
import { dDay, manwon } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  ProgressBar,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import {
  getCurrentUser,
  getExpenses,
  getWeddingInvite,
  listWeddingEvents,
  listWeddingTasks,
} from '@/api/client';
import { useSession } from '@/features/auth/use-session';

type CoupleStatus = 'guest' | 'no-wedding' | 'unlinked' | 'pending' | 'linked';

type WeddingData = {
  me: CurrentUser | null;
  events: WeddingEventListResponse | null;
  expenses: ExpenseSummaryResponse | null;
  tasks: WeddingTaskListResponse | null;
  invite: WeddingInviteListResponse | null;
};

const EMPTY: WeddingData = {
  me: null,
  events: null,
  expenses: null,
  tasks: null,
  invite: null,
};

/**
 * 우리웨딩 홈 · WP-OUR-001.
 *
 * 커플 연결 상태에 따라 세 화면이 된다.
 * - 비로그인: 로그인 CTA
 * - 미연결: 배우자 초대 CTA
 * - 초대 대기: 수락 대기 안내
 * - 연결됨: D-day 히어로 · 일정 · 지출 · 준비현황
 *
 * 비회원에게 개인화 영역(이름 · D-day · 진행률)을 보이지 않는다.
 */
export default function WeddingScreen() {
  const theme = useTheme();
  const { state } = useSession();
  const [data, setData] = useState<WeddingData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void getCurrentUser()
      .then(async (me) => {
        setData((prev) => ({ ...prev, me }));

        if (!me.weddingId) {
          setLoading(false);
          return;
        }

        const weddingId = me.weddingId;

        const [events, expenses, tasks, invite] = await Promise.allSettled([
          listWeddingEvents(weddingId),
          getExpenses(weddingId),
          listWeddingTasks(weddingId),
          getWeddingInvite(weddingId),
        ]);

        setData((prev) => ({
          ...prev,
          events: events.status === 'fulfilled' ? events.value : null,
          expenses: expenses.status === 'fulfilled' ? expenses.value : null,
          tasks: tasks.status === 'fulfilled' ? tasks.value : null,
          invite: invite.status === 'fulfilled' ? invite.value : null,
        }));
        setLoading(false);
      })
      .catch(() => {
        setData(EMPTY);
        setLoading(false);
      });
  }, []);

  useEffect(load, [load]);

  const coupleStatus: CoupleStatus = (() => {
    if (state.status === 'signedOut') return 'guest';
    if (!data.me) return 'guest';
    if (!data.me.weddingId) return 'no-wedding';
    if (data.me.spouseLinked) return 'linked';
    if (data.invite?.invite) return 'pending';
    return 'unlinked';
  })();

  const initial = data.me?.displayName?.slice(0, 1) ?? '나';

  // 다음 일정: upcoming 상태만 startsAt 순으로 최대 2개
  const upcomingEvents = (data.events?.events ?? [])
    .filter((e) => e.status === 'upcoming')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 2);

  // 지출 버킷: 금액 있는 것만 최대 3개
  const topBuckets = (data.expenses?.buckets ?? [])
    .filter((b) => b.amount > 0)
    .slice(0, 3);

  // 준비현황: 할 일 목록 최대 6개
  const prepTasks = (data.tasks?.tasks ?? []).slice(0, 6);

  const weddingDate = data.me?.weddingDate ?? null;
  const dDayResult = weddingDate ? dDay(weddingDate) : null;
  const taskProgress = data.tasks?.progress;
  const progressRatio =
    taskProgress && taskProgress.total > 0 ? taskProgress.done / taskProgress.total : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* 헤더 */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <ThemedText type="t4">우리웨딩</ThemedText>
          {coupleStatus === 'linked' && (
            <View style={styles.avatarRow}>
              <View style={[styles.avatarSm, { backgroundColor: theme.tintSubtle }]}>
                <ThemedText type="badge" themeColor="tint">
                  {initial}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.avatarSm,
                  styles.avatarSmOverlap,
                  { backgroundColor: theme.backgroundSelected },
                ]}>
                <ThemedText type="badge" themeColor="textSecondary">
                  배
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* ── 비로그인 ── */}
          {coupleStatus === 'guest' && (
            <View style={styles.emptyBlock}>
              <ThemedText type="t2">로그인 후{'\n'}이용할 수 있어요</ThemedText>
              <ThemedText type="t6" themeColor="textSecondary" style={styles.bodyText}>
                우리웨딩은 로그인한 커플을 위한 공간이에요
              </ThemedText>
              <ActionButton
                variant="primary"
                label="로그인 · 가입하기"
                onPress={() => router.push('/login')}
              />
            </View>
          )}

          {/* ── 웨딩 없음 또는 미연결 ── */}
          {(coupleStatus === 'no-wedding' || coupleStatus === 'unlinked') && (
            <View style={styles.emptyBlock}>
              <ThemedText type="t2">배우자와{'\n'}함께 준비해요</ThemedText>
              <ThemedText type="t6" themeColor="textSecondary" style={styles.bodyText}>
                Pick한 곳 · 일정 · 지출을 함께 볼 수 있어요
              </ThemedText>
              <ActionButton
                variant="primary"
                label="배우자 초대하기"
                onPress={() => router.push('/wedding/partner')}
              />
            </View>
          )}

          {/* ── 초대 대기 ── */}
          {coupleStatus === 'pending' && (
            <View style={styles.emptyBlock}>
              <ThemedText type="t2">배우자 수락{'\n'}대기 중</ThemedText>
              <ThemedText type="t6" themeColor="textSecondary" style={styles.bodyText}>
                초대 링크를 전달했나요? 수락하면 바로 연결돼요
              </ThemedText>
              <ActionButton
                label="초대 취소"
                onPress={() => router.push('/wedding/partner')}
              />
            </View>
          )}

          {/* ── 연결됨 ── */}
          {coupleStatus === 'linked' && (
            <>
              {/* D-Day 히어로 */}
              <View
                style={[
                  styles.hero,
                  { backgroundColor: theme.backgroundElement },
                ]}>
                {loading && !weddingDate ? (
                  <>
                    <Skeleton width="60%" height={35} />
                    <Skeleton width="40%" height={35} style={{ marginTop: 4 }} />
                  </>
                ) : dDayResult ? (
                  <ThemedText type="t2">
                    {dDayResult.kind === 'upcoming'
                      ? `두근두근\n${dDayResult.days}일 남았어요`
                      : dDayResult.kind === 'today'
                        ? '오늘이 예식일이에요'
                        : `예식이 ${dDayResult.days}일 지났어요`}
                  </ThemedText>
                ) : (
                  <ThemedText type="t2" themeColor="textAssistive">
                    예식일을 등록해주세요
                  </ThemedText>
                )}
                {taskProgress && taskProgress.total > 0 && (
                  <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                      <ProgressBar value={progressRatio} height={6} />
                    </View>
                    <ThemedText type="t7" themeColor="textAssistive" numeric>
                      {taskProgress.done}/{taskProgress.total}
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* 다음 일정 */}
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <ThemedText type="t4">다음 일정</ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      data.me?.weddingId
                        ? router.push(
                            `/wedding/${data.me.weddingId}/events` as never
                          )
                        : null
                    }>
                    <ThemedText type="t7" themeColor="textAssistive">
                      전체 보기
                    </ThemedText>
                  </Pressable>
                </View>

                {loading && upcomingEvents.length === 0 ? (
                  <View style={styles.skeletonRows}>
                    <Skeleton height={Layout.rowMinHeight} />
                    <Skeleton height={Layout.rowMinHeight} />
                  </View>
                ) : upcomingEvents.length === 0 ? (
                  <ThemedText type="t6" themeColor="textAssistive">
                    다음 일정이 없어요
                  </ThemedText>
                ) : (
                  <View>
                    {upcomingEvents.map((event, idx) => {
                      const d = new Date(event.startsAt);
                      const month = d.getMonth() + 1;
                      const day = d.getDate();
                      const diffDays = Math.ceil(
                        (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      );
                      const dDayLabel = diffDays <= 0 ? 'D-day' : `D-${diffDays}`;
                      const timeStr = d.toLocaleTimeString('ko-KR', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      });
                      const subText = event.location
                        ? `${timeStr} · ${event.location}`
                        : timeStr;

                      return (
                        <View key={event.id}>
                          <View style={styles.scheduleRow}>
                            <View style={styles.dateCol}>
                              <ThemedText type="t7" themeColor="textAssistive">
                                {month}월
                              </ThemedText>
                              <ThemedText type="t4" numeric>
                                {day}
                              </ThemedText>
                            </View>
                            <View style={styles.rowContent}>
                              <ThemedText type="t5" numberOfLines={1}>
                                {event.title}
                              </ThemedText>
                              <ThemedText
                                type="t7"
                                themeColor="textAssistive"
                                numberOfLines={1}>
                                {subText}
                              </ThemedText>
                            </View>
                            <ThemedText type="t6" themeColor="textAssistive" numeric>
                              {dDayLabel}
                            </ThemedText>
                          </View>
                          {idx < upcomingEvents.length - 1 && (
                            <View
                              style={[
                                styles.divider,
                                { backgroundColor: theme.border },
                              ]}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* 밴드 */}
              <View
                style={[
                  styles.band,
                  { backgroundColor: theme.backgroundSelected },
                ]}
              />

              {/* 지출 */}
              <View style={styles.section}>
                <ThemedText type="t4">지출</ThemedText>

                {loading && !data.expenses ? (
                  <View
                    style={[
                      styles.statBox,
                      { backgroundColor: theme.backgroundElement },
                    ]}>
                    <Skeleton width="50%" height={43} />
                    <Skeleton height={6} style={{ marginTop: 8 }} />
                  </View>
                ) : data.expenses ? (
                  <>
                    <View
                      style={[
                        styles.statBox,
                        { backgroundColor: theme.backgroundElement },
                      ]}>
                      <View style={styles.spendHead}>
                        <ThemedText type="amount" themeColor="tint" numeric>
                          {manwon(data.expenses.paidTotal)}
                        </ThemedText>
                        {data.expenses.budget.set && (
                          <ThemedText type="t7" themeColor="textAssistive">
                            예산 {manwon(data.expenses.budget.budget)}
                          </ThemedText>
                        )}
                      </View>
                      {data.expenses.budget.set && (
                        <ProgressBar
                          value={
                            data.expenses.budget.spent /
                            data.expenses.budget.budget
                          }
                          height={6}
                        />
                      )}
                    </View>

                    {topBuckets.length > 0 && (
                      <View>
                        {topBuckets.map((bucket, idx) => (
                          <View key={bucket.bucket}>
                            <View style={styles.spendRow}>
                              <ThemedText
                                type="t6"
                                themeColor="textSecondary"
                                numberOfLines={1}
                                style={styles.grow}>
                                {bucket.label}
                              </ThemedText>
                              <ThemedText type="t6" numeric style={styles.bold}>
                                {manwon(bucket.amount)}
                              </ThemedText>
                            </View>
                            {idx < topBuckets.length - 1 && (
                              <View
                                style={[
                                  styles.divider,
                                  { backgroundColor: theme.border },
                                ]}
                              />
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                ) : null}
              </View>

              {/* 밴드 */}
              <View
                style={[
                  styles.band,
                  { backgroundColor: theme.backgroundSelected },
                ]}
              />

              {/* 준비현황 */}
              <View style={styles.section}>
                <ThemedText type="t4">준비현황</ThemedText>

                {loading && prepTasks.length === 0 ? (
                  <View style={styles.skeletonRows}>
                    <Skeleton height={Layout.rowMinHeight} />
                    <Skeleton height={Layout.rowMinHeight} />
                    <Skeleton height={Layout.rowMinHeight} />
                  </View>
                ) : prepTasks.length === 0 ? (
                  <ThemedText type="t6" themeColor="textAssistive">
                    웨딩 스케줄이 없어요
                  </ThemedText>
                ) : (
                  <View>
                    {prepTasks.map((task, idx) => {
                      const isDone = task.state === 'done';
                      const isInProgress = task.state === 'in_progress';
                      const badgeBg = isDone
                        ? theme.positiveBackground
                        : isInProgress
                          ? theme.tintSubtle
                          : theme.backgroundSelected;
                      const badgeColor = isDone
                        ? theme.positive
                        : isInProgress
                          ? theme.tint
                          : theme.textAssistive;
                      const badgeLabel = isDone
                        ? '결정됨'
                        : isInProgress
                          ? '좁히는 중'
                          : '시작 전';

                      return (
                        <View key={task.id}>
                          <View style={styles.prepRow}>
                            <ThemedText
                              type="t6"
                              numberOfLines={1}
                              style={[
                                styles.prepLabel,
                                { color: theme.textSecondary },
                              ]}>
                              {task.label}
                            </ThemedText>
                            <ThemedText
                              type="t6"
                              numberOfLines={1}
                              style={styles.grow}>
                              {task.vendorLabel ?? ''}
                            </ThemedText>
                            <View
                              style={[
                                styles.badge,
                                { backgroundColor: badgeBg },
                              ]}>
                              <ThemedText
                                type="badge"
                                style={{ color: badgeColor }}>
                                {badgeLabel}
                              </ThemedText>
                            </View>
                          </View>
                          {idx < prepTasks.length - 1 && (
                            <View
                              style={[
                                styles.divider,
                                { backgroundColor: theme.border },
                              ]}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
    borderBottomWidth: 1,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarSm: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmOverlap: {
    marginLeft: -10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.six,
  },
  emptyBlock: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  bodyText: {
    lineHeight: 24,
  },
  hero: {
    marginHorizontal: Layout.gutter,
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
    borderRadius: Radius.medium,
    padding: Layout.gutter,
    gap: Spacing.two,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  progressTrack: {
    flex: 1,
  },
  section: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionGap,
    gap: Spacing.two,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Spacing.two,
  },
  dateCol: {
    width: 48,
    flexShrink: 0,
    alignItems: 'center',
    gap: 2,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    height: 1,
  },
  band: {
    height: Layout.sectionBand,
    marginBottom: Layout.sectionGap,
  },
  statBox: {
    borderRadius: Radius.medium,
    padding: Layout.gutter,
    gap: Spacing.two,
  },
  spendHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  spendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.rowMinHeight,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  bold: {
    fontWeight: '700',
  },
  prepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Spacing.two,
  },
  prepLabel: {
    width: 76,
    flexShrink: 0,
  },
  badge: {
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    flexShrink: 0,
  },
  skeletonRows: {
    gap: Spacing.two,
  },
});
