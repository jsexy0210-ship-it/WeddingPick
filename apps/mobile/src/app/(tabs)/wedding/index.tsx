import type {
  CurrentUser,
  ExpenseSummaryResponse,
  WeddingEventListResponse,
  WeddingTaskListResponse,
} from '@weddingpick/api-contract';
import { lifecycle, manwon } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  LineHeight,
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
  listWeddingEvents,
  listWeddingTasks,
} from '@/api/client';
import { useSession } from '@/features/auth/use-session';
import { formatMonthDayDot, formatTimeHm } from '@/features/common/format-date';

/**
 * 배우자 상태 — 혼자 · 배우자와 함께(v3.16). «미연결»이라는 이름을 쓰지 않는다 —
 * 혼자인 상태는 결핍이 아니다. 핸드오프 08c(18a · 18a2)가 정한 상태는 이 둘뿐이라
 * 초대를 보낸 뒤도 화면은 «혼자»와 같다.
 */
type CoupleStatus = 'solo' | 'together';

type WeddingData = {
  me: CurrentUser | null;
  events: WeddingEventListResponse | null;
  expenses: ExpenseSummaryResponse | null;
  tasks: WeddingTaskListResponse | null;
};

const EMPTY: WeddingData = {
  me: null,
  events: null,
  expenses: null,
  tasks: null,
};

/** 핸드오프 08c: 진행바 트랙 높이 6. `ProgressBar` 기본값(8)과 달라 여기서 준다. */
const TRACK_HEIGHT = 6;

/**
 * 핸드오프 08c의 폭 값 중 토큰이 없는 것. spec/tokens.json에 토큰이 생기면
 * 그쪽으로 옮긴다 — 화면 하나가 정한 값이 아니라 시안이 정한 값이다.
 */
const DATE_COL_WIDTH = 72; // `05.16(토)` 한 줄이 들어가는 폭
const AVATAR_SIZE = 26;

/**
 * 웨딩일정 홈 · WP-OUR-001 (v3.16 · 핸드오프 08c 18a/18a2).
 *
 * **혼자서도 전면 개방.** 배우자 연결을 전제로 기능을 잠그던 정책은 폐기했다.
 * D-day · 다음 일정 · 지출은 혼자든 둘이든 완전히 같다.
 * 두 상태는 같은 화면이고 다른 것은 둘뿐이다 — 헤더 아바타 1개/2개, 하단
 * «우리둘» 카드(초대하기 버튼 유무). 화면을 두 개 만들지 않는다.
 *
 * **준비 현황은 여기 없다(v3.22 SPEC 13.9).** WP-OUR-002 웨딩일정 준비현황은
 * 폐기했고 홈 4칸 요약 + WP-HOME-009 전체 보기 두 곳뿐이다. 웨딩일정은 결정한
 * 뒤의 관리(일정 · 지출 · 메모)만 맡는다. 히어로 진행률만 할 일 진행도를 빌려 쓴다.
 *
 * 배우자 초대는 보조 기능이라 진입점이 하단 카드 한 곳(과 MY · 배우자 연결
 * 관리)뿐이다. 혼자인 상태를 결핍으로 적지 않는다.
 */
export default function WeddingScreen() {
  const theme = useTheme();
  const { state } = useSession();
  const [data, setData] = useState<WeddingData>(EMPTY);
  const [loading, setLoading] = useState(true);
  /** 일정 D-day 계산용 기준 시각. 렌더 중에는 Date.now()를 부르지 않는다 — 마운트 후 한 번 정한다. */
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

        const [events, expenses, tasks] = await Promise.allSettled([
          listWeddingEvents(weddingId),
          getExpenses(weddingId),
          listWeddingTasks(weddingId),
        ]);

        setData((prev) => ({
          ...prev,
          events: events.status === 'fulfilled' ? events.value : null,
          expenses: expenses.status === 'fulfilled' ? expenses.value : null,
          tasks: tasks.status === 'fulfilled' ? tasks.value : null,
        }));
        setLoading(false);
      })
      .catch(() => {
        setData(EMPTY);
        setLoading(false);
      });
  }, [isSignedIn]);

  useEffect(load, [load]);

  const coupleStatus: CoupleStatus = data.me?.spouseLinked ? 'together' : 'solo';

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
  const topBuckets = (data.expenses?.buckets ?? []).filter((b) => b.amount > 0).slice(0, 3);

  /* 홈 히어로와 같은 문구 — 남은 기간별 상태는 `lifecycle`이 한 곳에서 정한다. 예식일이 없어도 답한다. */
  const stage = lifecycle(data.me?.weddingDate ?? null);
  const taskProgress = data.tasks?.progress;
  const progressRatio =
    taskProgress && taskProgress.total > 0 ? taskProgress.done / taskProgress.total : 0;

  const weddingId = data.me?.weddingId ?? null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* 헤더 — 목업: 56 · 좌우 24 · 제목 20/27 · 오른쪽 아바타(혼자 1 · 함께 2 겹침) · 테두리 없음. */}
        <View style={styles.header}>
          <ThemedText type="t4">웨딩일정</ThemedText>
          {data.me ? (
            <View style={styles.avatarRow}>
              <View style={[styles.avatar, { backgroundColor: theme.tintSubtle }]}>
                <ThemedText type="t7" themeColor="tint" style={styles.bold}>
                  {initial}
                </ThemedText>
              </View>
              {coupleStatus === 'together' ? (
                <View
                  style={[
                    styles.avatar,
                    styles.avatarOverlap,
                    { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <ThemedText type="t7" themeColor="textSecondary" style={styles.bold}>
                    {partnerInitial}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* D-Day 히어로 — 배경 상자 없이 글(26/35)과 진행바만. */}
          <View style={styles.hero}>
            {loading && !data.me ? (
              <>
                <Skeleton width="60%" height={LineHeight.t2} />
                <Skeleton width="40%" height={LineHeight.t2} style={{ marginTop: Spacing.one }} />
              </>
            ) : (
              <ThemedText type="t2">
                {stage.mood}
                {'\n'}
                {stage.note}
              </ThemedText>
            )}
            {taskProgress && taskProgress.total > 0 ? (
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <ProgressBar value={progressRatio} height={TRACK_HEIGHT} />
                </View>
                <ThemedText type="t7" themeColor="textAssistive" numeric style={styles.bold}>
                  {taskProgress.done}/{taskProgress.total}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {/* 다음 일정 */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <ThemedText type="t4">다음 일정</ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  weddingId ? router.push(`/wedding/${weddingId}/events` as never) : null
                }>
                <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
                  전체 보기
                </ThemedText>
              </Pressable>
            </View>

            {loading && upcomingEvents.length === 0 ? (
              <View style={styles.list}>
                <Skeleton height={Layout.rowMinHeight} />
                <Skeleton height={Layout.rowMinHeight} />
              </View>
            ) : upcomingEvents.length === 0 ? (
              <ThemedText type="t6" themeColor="textAssistive">
                다음 일정이 없어요
              </ThemedText>
            ) : (
              <View style={styles.list}>
                {upcomingEvents.map((event) => {
                  const d = new Date(event.startsAt);
                  const diffDays =
                    now === null ? null : Math.ceil((d.getTime() - now) / (1000 * 60 * 60 * 24));
                  const dDayLabel =
                    diffDays === null ? null : diffDays <= 0 ? 'D-day' : `D-${diffDays}`;
                  const timeStr = formatTimeHm(d);
                  const subText = event.location ? `${timeStr} · ${event.location}` : timeStr;

                  return (
                    <View key={event.id}>
                      <View style={styles.scheduleRow}>
                        <View style={styles.dateCol}>
                          <ThemedText type="t6" themeColor="textAssistive" numeric>
                            {formatMonthDayDot(d)}
                          </ThemedText>
                        </View>
                        <View style={styles.rowContent}>
                          <ThemedText type="t5" numberOfLines={1}>
                            {event.title}
                          </ThemedText>
                          <ThemedText
                            type="t7"
                            themeColor="textAssistive"
                            numeric
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
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* 밴드 */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />

          {/* 지출 — 총액 · 예산 · 진행바 · 항목 · Pick 인증하기가 전부 한 상자 안이다. */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <ThemedText type="t4">지출</ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  weddingId ? router.push(`/wedding/${weddingId}/expenses` as never) : null
                }>
                <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
                  전체 보기
                </ThemedText>
              </Pressable>
            </View>

            {loading && !data.expenses ? (
              <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
                <Skeleton width="50%" height={LineHeight.amount} />
                <Skeleton height={TRACK_HEIGHT} />
              </View>
            ) : data.expenses ? (
              <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.spendHead}>
                  <ThemedText type="amount" numeric>
                    {manwon(data.expenses.paidTotal)}
                  </ThemedText>
                  {data.expenses.budget.set ? (
                    <ThemedText type="t7" themeColor="textAssistive" numeric>
                      예산 {manwon(data.expenses.budget.budget)}
                    </ThemedText>
                  ) : null}
                </View>
                {data.expenses.budget.set ? (
                  <ProgressBar
                    value={data.expenses.budget.spent / data.expenses.budget.budget}
                    height={TRACK_HEIGHT}
                  />
                ) : null}

                {topBuckets.length > 0 ? (
                  <View style={styles.list}>
                    {topBuckets.map((bucket) => (
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
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      </View>
                    ))}
                  </View>
                ) : null}

                {/*
                  지출 입력과 Pick 인증은 한 화면이다(v3.22 SPEC 13.10 · WP-OUR-014).
                  제보 진입 4곳 중 하나(웨딩일정 지출) — 자료가 없어도 지출은 저장된다.
                */}
                <ActionButton
                  variant="ghost"
                  size="large"
                  label="Pick 인증하기"
                  onPress={() =>
                    weddingId
                      ? router.push(`/wedding/${weddingId}/expenses/add` as never)
                      : router.push('/capture' as never)
                  }
                />
              </View>
            ) : null}
          </View>

          {/* 밴드 */}
          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />

          {/*
            우리둘 — 배우자 초대의 유일한 진입점(MY 배우자 연결 관리 말고는).
            혼자면 초대하기 버튼, 함께면 문장만. 기능을 잠그거나 흐리게 하지 않는다.
          */}
          <View style={styles.coupleSection}>
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
              </View>
              {coupleStatus === 'solo' ? (
                <ActionButton
                  variant="ghost"
                  size="large"
                  label="초대하기"
                  onPress={() => router.push('/wedding/partner')}
                />
              ) : null}
            </View>
          </View>
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
  /* 목업 08c: 56 · padding 0 24 · 테두리 없음. */
  header: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 목업: gap 6 + margin-left -10 → 겹침 4. */
  avatarOverlap: {
    marginLeft: -Spacing.one,
  },
  scroll: {
    flex: 1,
  },
  /* 탭 바가 absolute라 홈과 같은 하단 여백을 둔다. */
  scrollContent: {
    paddingBottom: Spacing.six,
  },
  /* 목업: padding 12 24 26 · gap 12 · 배경 없음. */
  hero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Spacing.four,
    gap: Layout.sectionHeadGap,
  },
  /* 목업: 트랙과 «10/20» 사이 10. */
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.cardGap,
  },
  progressTrack: {
    flex: 1,
  },
  /* 목업: padding 0 24 28 · 제목→내용 12. */
  section: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionGap,
    gap: Layout.sectionHeadGap,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.rowPaddingY,
  },
  /* 목업: 행 사이 2. */
  list: {
    gap: Spacing.half,
  },
  /* 목업: gap 14 · min-height 56 · padding 8 0. */
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Spacing.two,
  },
  dateCol: {
    width: DATE_COL_WIDTH,
    flexShrink: 0,
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
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
  /* 목업: radius 10 · padding 20 · 요소 사이 12. */
  statBox: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Layout.cardGap,
  },
  spendHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Layout.rowPaddingY,
  },
  /* 목업: min-height 44 · padding 6 0. */
  spendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.touchTarget,
    paddingVertical: Spacing.one,
    gap: Spacing.two,
  },
  bold: {
    fontWeight: '700',
  },
  /* 목업: 마지막 섹션은 카드만 — 제목 없이 padding 0 24 28. */
  coupleSection: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.sectionGap,
  },
  /* 우리둘 카드 — radius 10 · padding 20 · 요소 사이 14. */
  coupleCard: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Layout.sectionHeadGap,
  },
  /* 목업: «우리둘»과 문장 사이 6. */
  coupleText: {
    gap: Spacing.one,
  },
});
