import type {
  CurrentUser,
  ExpenseSummaryResponse,
  WeddingEventListResponse,
  WeddingInviteListResponse,
  WeddingTaskListResponse,
} from '@weddingpick/api-contract';
import { dDay, lifecycle, manwon } from '@weddingpick/domain';
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
  ensureWedding,
  getCurrentUser,
  getExpenses,
  getWeddingInvite,
  listWeddingEvents,
  listWeddingTasks,
} from '@/api/client';
import { useSession } from '@/features/auth/use-session';

/**
 * 배우자 상태 — 혼자 · 초대 보냄 · 배우자와 함께(v3.16). «미연결»이라는 이름을
 * 쓰지 않는다 — 혼자인 상태는 결핍이 아니다.
 */
type CoupleStatus = 'guest' | 'solo' | 'invited' | 'together';

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
 * 웨딩일정 홈 · WP-OUR-001 (v3.16).
 *
 * **혼자서도 전면 개방.** 배우자 연결을 전제로 기능을 잠그던 정책은 폐기했다.
 * D-day · 다음 일정 · 지출 · 준비현황 · 메모는 혼자든 둘이든 완전히 같다.
 * 두 상태는 같은 화면이고 다른 것은 둘뿐이다 — 헤더 아바타 1개/2개, 하단
 * «우리둘» 카드(초대하기 버튼 유무). 화면을 두 개 만들지 않는다.
 *
 * 배우자 초대는 보조 기능이라 진입점이 하단 카드 한 곳(과 MY · 배우자 연결
 * 관리)뿐이다. 혼자인 상태를 결핍으로 적지 않는다.
 */
export default function WeddingScreen() {
  const theme = useTheme();
  const { state } = useSession();
  const [data, setData] = useState<WeddingData>(EMPTY);
  const [loading, setLoading] = useState(true);
  /** D-day 계산용 기준 시각. 렌더 중에는 Date.now()를 부르지 않는다 — 마운트 후 한 번 정한다. */
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    void Promise.resolve().then(() => setNow(Date.now()));
  }, []);

  const isSignedIn = state.status === 'signedIn';

  const load = useCallback(() => {
    if (!isSignedIn) {
      void Promise.resolve().then(() => {
        setData(EMPTY);
        setLoading(false);
      });
      return;
    }

    void Promise.resolve().then(() => setLoading(true));
    void getCurrentUser()
      .then(async (first) => {
        /*
         * 웨딩이 아직 없으면 만든다 — 혼자서도 전면 개방이라 여기서 막을 이유가
         * 없다. 온보딩이 지역을 받으며 이미 만들어 두므로 거의 오지 않는 길이다.
         */
        const me = first.weddingId ? first : await ensureWedding().then(() => getCurrentUser());

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
  }, [isSignedIn]);

  useEffect(load, [load]);

  const coupleStatus: CoupleStatus = (() => {
    if (state.status === 'signedOut') return 'guest';
    if (!data.me) return 'guest';
    if (data.me.spouseLinked) return 'together';
    if (data.invite?.invite) return 'invited';
    return 'solo';
  })();

  const myName = data.me?.displayName ?? null;
  const partnerName = data.me?.partnerDisplayName ?? null;
  const initial = myName?.slice(0, 1) ?? '나';
  const partnerInitial = partnerName?.slice(0, 1) ?? '배';

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
  const stage = lifecycle(weddingDate);
  const taskProgress = data.tasks?.progress;
  const progressRatio =
    taskProgress && taskProgress.total > 0 ? taskProgress.done / taskProgress.total : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* 헤더 */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <ThemedText type="t4">웨딩일정</ThemedText>
          {/* 아바타 — 혼자면 1개, 배우자와 함께면 2개 겹침. 이것 말고 두 상태의 차이는 하단 카드뿐이다. */}
          {coupleStatus !== 'guest' && (
            <View style={styles.avatarRow}>
              <View style={[styles.avatarSm, { backgroundColor: theme.tintSubtle }]}>
                <ThemedText type="badge" themeColor="tint">
                  {initial}
                </ThemedText>
              </View>
              {coupleStatus === 'together' ? (
                <View
                  style={[
                    styles.avatarSm,
                    styles.avatarSmOverlap,
                    { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <ThemedText type="badge" themeColor="textSecondary">
                    {partnerInitial}
                  </ThemedText>
                </View>
              ) : null}
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
              <ThemedText type="body" themeColor="textSecondary">
                일정 · 지출 · 준비현황을 한곳에서 볼 수 있어요
              </ThemedText>
              <ActionButton
                variant="primary"
                label="로그인 · 가입하기"
                onPress={() => router.push('/login')}
              />
            </View>
          )}

          {/* ── 로그인했으면 전부 열린다 — 혼자든 배우자와 함께든 같은 화면 ── */}
          {coupleStatus !== 'guest' && (
            <>
              {/* D-Day 히어로 — 배경 상자 없이 글과 진행바만(목업). */}
              <View style={styles.hero}>
                {loading && !weddingDate ? (
                  <>
                    <Skeleton width="60%" height={35} />
                    <Skeleton width="40%" height={35} style={{ marginTop: 4 }} />
                  </>
                ) : dDayResult ? (
                  /* 홈 히어로와 같은 문구 — 남은 기간별 상태는 `lifecycle`이 한 곳에서 정한다. */
                  <ThemedText type="t2">
                    {stage.mood}
                    {'\n'}
                    {stage.note}
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
                      const diffDays =
                        now === null ? null : Math.ceil((d.getTime() - now) / (1000 * 60 * 60 * 24));
                      const dDayLabel =
                        diffDays === null ? null : diffDays <= 0 ? 'D-day' : `D-${diffDays}`;
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
                            {dDayLabel !== null ? (
                              <ThemedText type="t6" themeColor="textAssistive" numeric>
                                {dDayLabel}
                              </ThemedText>
                            ) : null}
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
                    {/* 지출은 Pick 인증에서 온다 — 제보 진입 4곳 중 하나(웨딩일정 지출). */}
                    <ActionButton label="Pick 인증하기" onPress={() => router.push('/capture' as never)} />
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
                <View style={styles.sectionHead}>
                  <ThemedText type="t4">준비현황</ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      data.me?.weddingId
                        ? router.push(`/wedding/${data.me.weddingId}/decided` as never)
                        : null
                    }>
                    <ThemedText type="t7" themeColor="textAssistive">
                      결정한 업체
                    </ThemedText>
                  </Pressable>
                </View>

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

              {/* 메모 — WP-OUR-011 진입점. 목록은 여기서 보여주지 않는다. */}
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <ThemedText type="t4">메모</ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      data.me?.weddingId
                        ? router.push(`/wedding/${data.me.weddingId}/notes` as never)
                        : null
                    }>
                    <ThemedText type="t7" themeColor="textAssistive">
                      전체 보기
                    </ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* 밴드 */}
              <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />

              {/*
                우리둘 — 배우자 초대의 유일한 진입점(MY 배우자 연결 관리 말고는).
                혼자면 초대하기 버튼, 함께면 문장만. 기능을 잠그거나 흐리게 하지 않는다.
              */}
              <View style={styles.section}>
                <View style={[styles.coupleCard, { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.coupleText}>
                    <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
                      우리둘
                    </ThemedText>
                    {coupleStatus === 'together' ? (
                      <ThemedText type="t5">
                        {myName ?? '나'}님과 {partnerName ?? '배우자'}님이{'\n'}함께 준비하고 있어요
                      </ThemedText>
                    ) : (
                      <ThemedText type="t5">함께 Pick하고 준비해요</ThemedText>
                    )}
                    {coupleStatus === 'invited' ? (
                      <ThemedText type="t7" themeColor="textAssistive">
                        초대를 보냈어요 · 수락하면 바로 같이 볼 수 있어요
                      </ThemedText>
                    ) : null}
                  </View>
                  {coupleStatus !== 'together' ? (
                    <ActionButton
                      label={coupleStatus === 'invited' ? '초대 관리' : '초대하기'}
                      onPress={() => router.push('/wedding/partner')}
                    />
                  ) : null}
                </View>
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
  /* 목업: padding 12 24 26 · 배경 없음. */
  hero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  /* 우리둘 카드 — radius 10 · padding 20 · 요소 사이 14. */
  coupleCard: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Spacing.three,
  },
  coupleText: {
    gap: Spacing.one,
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
