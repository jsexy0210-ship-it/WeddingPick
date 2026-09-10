import type {
  CurrentUser,
  ExpenseSummaryResponse,
  WeddingEventListResponse,
  WeddingTaskListResponse,
} from '@weddingpick/api-contract';
import { TERMS, isBeforeWedding, lifecycle, manwon } from '@weddingpick/domain';
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
import { ensureWedding, getCurrentUser, getExpenses, listWeddingEvents, listWeddingTasks } from '@/api/client';
import { readCurrentUserSnapshot } from '@/features/loading/current-user-snapshot';
import { useSession } from '@/features/auth/use-session';
import { WeddingCompleteView } from '@/features/wedding/complete-view';
import { Avatar, DateChip, RowValue, eventTime } from '@/features/wedding/screen-kit';

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

const EMPTY: WeddingData = { me: null, events: null, expenses: null, tasks: null };

/** 핸드오프 08c: 진행바 트랙 높이 6. `ProgressBar` 기본값(8)과 달라 여기서 준다. */
const TRACK_HEIGHT = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `spec/strings.ko.json` `ourWedding.*` · `common.cta.report`. */
const S = {
  title: TERMS.ourWedding,
  nextSchedule: '다음 일정',
  seeAll: '전체 보기',
  spend: '지출',
  report: 'Pick 인증하기',
  couple: '우리둘',
  inviteTitle: '함께 Pick하고 준비해요',
  invite: '초대하기',
  noSchedule: '다음 일정이 없어요',
} as const;

/**
 * 웨딩일정 홈 · WP-OUR-001 (핸드오프 08c 18a/18a2).
 *
 *   header   56 · «웨딩일정» 20/27 · 오른쪽 아바타 26(혼자 1 · 함께 2 겹침)
 *   hero     padding 12 24 26 · «두근두근 / 140일 남았어요» 26/35 · 진행바 6 + «10/20»
 *   다음 일정  «전체 보기» · 날짜칩 52 + 제목 18/24 + 시각·장소 14/19 + D-day 16/22 · 최대 2행
 *   밴드 16
 *   지출     제목 20/27 · 카드(총액 32 · 예산 · 진행바 · 업종 3행 · «Pick 인증하기» 48) — 카드를 누르면 지출 요약
 *   밴드 16
 *   우리둘   카드 «우리둘» 14/19 + «함께 Pick하고 준비해요» 18/24 + «초대하기» 48 — 함께면 문장만
 *
 * **혼자서도 전면 개방.** 두 상태는 같은 화면이고 다른 것은 둘뿐이다 — 헤더 아바타 1개/2개,
 * 하단 «우리둘» 카드(초대하기 유무). 화면을 두 개 만들지 않는다.
 *
 * **준비 현황은 여기 없다(v3.22 SPEC 13.9).** WP-OUR-002는 폐기했고 홈 4칸 + WP-HOME-009
 * 두 곳뿐이다. 웨딩일정은 결정한 뒤의 관리(일정 · 지출 · 메모)만 맡는다.
 *
 * **예식일이 지나면 예식 완료(WP-OUR-013) 본문을 그대로 보여준다.** 준비 알림은 멈추고
 * 기록은 남는다.
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
    let active = true;
    const stop = () => { active = false; };
    if (!isSignedIn) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setData(EMPTY);
        setLoading(false);
      });
      return stop;
    }

    // 회원 확인과 목록 요청은 병렬로 시작하고, 확인된 웨딩의 답만 화면에 반영한다.
    const lists = (weddingId: string) => ({
      events: listWeddingEvents(weddingId).catch(() => null),
      expenses: getExpenses(weddingId).catch(() => null),
      tasks: listWeddingTasks(weddingId).catch(() => null),
    });
    const known = readCurrentUserSnapshot();
    const early = known?.weddingId ? lists(known.weddingId) : null;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (known) setData((prev) => ({ ...prev, me: prev.me ?? known }));
      setLoading(true);
    });

    void getCurrentUser()
      .then(async (first) => {
        if (!active) return;
        const me = first.weddingId ? first : await ensureWedding().then(() => getCurrentUser());
        if (!active) return;
        setData((prev) => prev.me?.weddingId === me.weddingId ? { ...prev, me } : { ...EMPTY, me });
        if (!me.weddingId) {
          setLoading(false);
          return;
        }
        const pending = early && known?.weddingId === me.weddingId ? early : lists(me.weddingId);
        // 가장 느린 지출 응답이 일정과 준비 현황까지 가리지 않도록 각각 반영한다.
        await Promise.all([
          pending.events.then((events) => { if (active) setData((prev) => ({ ...prev, events })); }),
          pending.expenses.then((expenses) => { if (active) setData((prev) => ({ ...prev, expenses })); }),
          pending.tasks.then((tasks) => { if (active) setData((prev) => ({ ...prev, tasks })); }),
        ]);
        if (active) setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setData(EMPTY);
        setLoading(false);
      });
    return stop;
  }, [isSignedIn]);

  useEffect(load, [load]);

  const coupleStatus: CoupleStatus = data.me?.spouseLinked ? 'together' : 'solo';
  const myName = data.me?.displayName ?? null;
  const partnerName = data.me?.partnerDisplayName ?? null;
  const initial = (myName ?? '나').slice(0, 1);
  const partnerInitial = (partnerName ?? TERMS.spouse).slice(0, 1);

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
  const progressRatio = taskProgress && taskProgress.total > 0 ? taskProgress.done / taskProgress.total : 0;
  const weddingId = data.me?.weddingId ?? null;
  const weddingOver = weddingId !== null && data.me?.weddingDate != null && !isBeforeWedding(stage.stage) && stage.stage !== 'wedding_day';

  const header = (
    <View style={styles.header}>
      <ThemedText type="t4">{S.title}</ThemedText>
      {data.me ? (
        <View style={styles.avatarRow}>
          <Avatar initial={initial} tone="me" size={26} />
          {coupleStatus === 'together' ? (
            <View style={styles.avatarOverlap}>
              <Avatar initial={partnerInitial} tone="partner" size={26} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  /* 예식 완료 — WP-OUR-001 «예식 완료» 상태는 WP-OUR-013 본문이다. */
  if (weddingOver && weddingId) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {header}
          <WeddingCompleteView weddingId={weddingId} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {header}

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
              <ThemedText type="t4">{S.nextSchedule}</ThemedText>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => (weddingId ? router.push(`/wedding/${weddingId}/events` as never) : null)}>
                <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
                  {S.seeAll}
                </ThemedText>
              </Pressable>
            </View>

            {loading && !data.events ? (
              <View style={styles.list}>
                <Skeleton height={Layout.rowMinHeight} />
                <Skeleton height={Layout.rowMinHeight} />
              </View>
            ) : upcomingEvents.length === 0 ? (
              <ThemedText type="t6" themeColor="textAssistive">
                {S.noSchedule}
              </ThemedText>
            ) : (
              <View style={styles.list}>
                {upcomingEvents.map((event) => {
                  const startOfToday = now === null ? null : new Date(now);
                  startOfToday?.setHours(0, 0, 0, 0);
                  const startOfDay = new Date(event.startsAt);
                  startOfDay.setHours(0, 0, 0, 0);
                  const diffDays =
                    startOfToday === null ? null : Math.round((startOfDay.getTime() - startOfToday.getTime()) / DAY_MS);
                  const dDayLabel = diffDays === null ? null : diffDays <= 0 ? '오늘' : `D-${diffDays}`;
                  const place = event.location ?? event.vendorLabel;
                  const subText = place ? `${eventTime(event.startsAt)} · ${place}` : eventTime(event.startsAt);

                  return (
                    <Pressable
                      key={event.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${event.title} · ${subText}`}
                      onPress={() => router.push(`/wedding/${weddingId}/events/${event.id}` as never)}>
                      <View style={styles.scheduleRow}>
                        <DateChip date={event.startsAt} />
                        <View style={styles.rowContent}>
                          <ThemedText type="t5" numberOfLines={1}>
                            {event.title}
                          </ThemedText>
                          <ThemedText type="t7" themeColor="textAssistive" numeric numberOfLines={1}>
                            {subText}
                          </ThemedText>
                        </View>
                        {dDayLabel !== null ? <RowValue>{dDayLabel}</RowValue> : null}
                      </View>
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />

          {/* 지출 — 총액 · 예산 · 진행바 · 항목 · Pick 인증하기가 전부 한 상자 안. 상자를 누르면 지출 요약(WP-OUR-008). */}
          <View style={styles.section}>
            <ThemedText type="t4">{S.spend}</ThemedText>

            {loading && !data.expenses ? (
              <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
                <Skeleton width="50%" height={LineHeight.amount} />
                <Skeleton height={TRACK_HEIGHT} />
              </View>
            ) : data.expenses ? (
              <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${S.spend} ${S.seeAll}`}
                  onPress={() => (weddingId ? router.push(`/wedding/${weddingId}/expenses` as never) : null)}
                  style={({ pressed }) => [styles.statBody, pressed && styles.pressed]}>
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
                  <ProgressBar value={data.expenses.budget.spent / data.expenses.budget.budget} height={TRACK_HEIGHT} />
                ) : null}

                {topBuckets.length > 0 ? (
                  <View style={styles.list}>
                    {topBuckets.map((bucket) => (
                      <View key={bucket.bucket}>
                        <View style={styles.spendRow}>
                          <ThemedText type="t6" themeColor="textSecondary" numberOfLines={1} style={styles.grow}>
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
                </Pressable>

                {/* 지출 입력과 Pick 인증은 한 화면이다(v3.22 SPEC 13.10 · WP-OUR-014). 자료가 없어도 지출은 저장된다. */}
                <ActionButton
                  variant="ghost"
                  size="large"
                  label={S.report}
                  onPress={() =>
                    weddingId ? router.push(`/wedding/${weddingId}/expenses/add` as never) : router.push('/capture' as never)
                  }
                />
              </View>
            ) : null}
          </View>

          <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />

          {/* 우리둘 — 배우자 초대의 유일한 진입점(MY 배우자 연결 관리 말고는). 혼자면 초대하기, 함께면 문장만. */}
          <View style={styles.coupleSection}>
            <View style={[styles.coupleCard, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.coupleText}>
                <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
                  {S.couple}
                </ThemedText>
                {coupleStatus === 'together' ? (
                  <ThemedText type="t5">
                    {myName ?? '나'}님과 {partnerName ?? TERMS.spouse}님이{'\n'}함께 준비하고 있어요
                  </ThemedText>
                ) : (
                  <ThemedText type="t5">{S.inviteTitle}</ThemedText>
                )}
              </View>
              {coupleStatus === 'solo' ? (
                <ActionButton variant="ghost" size="large" label={S.invite} onPress={() => router.push('/wedding/partner')} />
              ) : null}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  /* 목업 08c: 56 · padding 0 24 · 테두리 없음. */
  header: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  /* 목업: gap 6 + margin-left -10 → 겹침 4. */
  avatarOverlap: { marginLeft: -Spacing.one },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.two },
  /* 목업: padding 12 24 26 · gap 12 · 배경 없음. */
  hero: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.rowPaddingY,
    paddingBottom: Spacing.four + Spacing.half,
    gap: Layout.rowPaddingY,
  },
  /* 목업: 트랙과 «10/20» 사이 10. */
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Layout.cardGap },
  progressTrack: { flex: 1 },
  /* 목업: padding 0 24 28 · 제목→내용 12. */
  section: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap, gap: Layout.rowPaddingY },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Layout.rowPaddingY },
  /* 목업: 행 사이 2. */
  list: { gap: Spacing.half },
  /* 목업: gap 14 · min-height 56 · padding 8 0. */
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.sectionHeadGap,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Spacing.two,
  },
  rowContent: { flex: 1, minWidth: 0, gap: Spacing.half },
  grow: { flex: 1, minWidth: 0 },
  divider: { height: 1 },
  band: { height: Layout.sectionBand, marginBottom: Layout.sectionGap },
  /* 목업: radius 10 · padding 20 · 요소 사이 12. */
  statBox: { borderRadius: Radius.medium, padding: Layout.cardPadding, gap: Layout.rowPaddingY },
  statBody: { gap: Layout.rowPaddingY },
  spendHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Layout.rowPaddingY },
  /* 목업: min-height 44 · padding 6 0. */
  spendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.touchTarget,
    paddingVertical: Spacing.one + Spacing.half,
    gap: Spacing.two,
  },
  bold: { fontWeight: 700 },
  pressed: { opacity: 0.9 },
  /* 목업: 마지막 섹션은 카드만 — 제목 없이 padding 0 24 28. */
  coupleSection: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
  /* 우리둘 카드 — radius 10 · padding 20 · 요소 사이 14. */
  coupleCard: { borderRadius: Radius.medium, padding: Layout.cardPadding, gap: Layout.sectionHeadGap },
  /* 목업: «우리둘»과 문장 사이 6. */
  coupleText: { gap: Spacing.one + Spacing.half },
});
