import type {
  AppBootstrapResponse,
  CandidateListResponse,
  CurrentUser,
  WeddingTask,
} from '@weddingpick/api-contract';
import { daysUntil } from '@weddingpick/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAppBootstrap, listWeddingTasks } from '@/api/client';
import { RootTabHeader } from '@/components/root-tab-header';
import {
  ActionButton,
  ErrorView,
  Layout,
  LineHeight,
  MaxContentWidth,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';
import { listWeddingContent, type WeddingContentItem } from '@/features/home/content';
import { Hero } from '@/features/home/hero';
import { HomeBudget, MORE_CHEVRON, MyWeddingPrep } from '@/features/home/home-summary';
import { endHomeHandoff, useHomeHandoffActive } from '@/features/home/home-handoff';
import { HomeSkeleton } from '@/features/home/home-skeleton';
import { homePrepCards, homePrepSectionSub } from '@/features/home/prep-groups';
import { scheduleRows } from '@/features/home/schedule-view';
import { categoryStatuses, currentCategory } from '@/features/home/state';
import { UpcomingSchedule } from '@/features/home/wedding-schedule';
import { WeddingContent } from '@/features/home/wedding-content';
import strings from '../../../../../spec/strings.ko.json';

const S = strings.home;
const HOME_FEED_PREVIEW_COUNT = 2;

/**
 * 홈. WP-HOME-001~003.
 *
 * 화면 모양과 섹션 순서는 `docs/design/React_Native/home.jsx`가
 * 정본이다. 코랄 D-day
 * 히어로 → 「내 웨딩 준비」(4칸, 항상 4개) → 「웨딩일정」 → 예산현황 → 웨딩 준비 팁
 * 순서다. 옛 「추천」 섹션은 v3.29 핵심 메시지(추천 개념 삭제)를 어겨 뺐다 —
 * `/v1/recommendations/top3`·`getTop3`도 같은 정리에서 지웠다.
 */

type HomeData = {
  me: CurrentUser | null;
  candidates: CandidateListResponse | null;
  budget: AppBootstrapResponse['budget'];
  bracketAnswered: boolean;
  partnerInvitePending: boolean;
  /** 웨딩일정 — `GET /v1/weddings/:id/tasks`. 웨딩이 없으면(온보딩 전) 빈 배열. */
  tasks: readonly WeddingTask[];
  content: readonly WeddingContentItem[];
  /** 안 읽은 알림 수. 벨의 점이 이 값을 본다. */
};

const EMPTY: HomeData = {
  me: null,
  candidates: null,
  budget: null,
  bracketAnswered: false,
  partnerInvitePending: false,
  tasks: [],
  content: [],
};

export default function HomeScreen() {
  const theme = useTheme();
  const loadVersion = useRef(0);
  const bootLoadedOnce = useRef(false);
  const tasksLoadedOnce = useRef(false);
  const contentLoadedOnce = useRef(false);
  const [data, setData] = useState<HomeData>(EMPTY);
  const [bootError, setBootError] = useState(false);
  const [taskStatus, setTaskStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [contentStatus, setContentStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  /*
   * 한 번이라도 받아왔는가. **자료가 없는 것과 아직 모르는 것은 다르다** — 앞은
   * 시작 전 구간이고 뒤는 스켈레톤이다. 하나로 뭉치면 프로필을 못 불러온 사람에게
   * 영원히 스켈레톤이 돈다.
   */
  const [settled, setSettled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    const version = ++loadVersion.current;
    const current = () => version === loadVersion.current;
    setBootError(false);
    if (!tasksLoadedOnce.current) setTaskStatus('loading');
    if (!contentLoadedOnce.current) setContentStatus('loading');

    void listWeddingContent(HOME_FEED_PREVIEW_COUNT)
      .then((content) => {
        if (!current()) return;
        setData((previous) => ({ ...previous, content }));
        contentLoadedOnce.current = true;
        setContentStatus('ready');
      })
      .catch(() => {
        if (!current()) return;
        if (contentLoadedOnce.current) setToast(strings.journey.loadFailed);
        else setContentStatus('error');
      });

    /*
     * 회원 · 알림 · 담아둔 후보를 한 번에 받는다(GET /v1/app/bootstrap). 서버 안에서
     * 병렬로 모은 것이라 기기가 인터넷을 여러 번 왕복하지 않는다.
     */
    void getAppBootstrap()
      .then((boot) => {
        if (!current()) return;
        setData((previous) => ({
          ...previous,
          me: boot.member,
          candidates: boot.candidates,
          budget: boot.budget,
          bracketAnswered: boot.bracketAnswered,
          partnerInvitePending: boot.partnerInvitePending,
        }));
        bootLoadedOnce.current = true;

        /*
         * 웨딩일정 — 웨딩노트가 이미 쓰는 GET /v1/weddings/:id/tasks 그대로다(새 API를
         * 만들지 않는다). weddingId를 boot 응답이 알려준 뒤에야 부를 수 있어 여기 묶었다.
         * 웨딩이 아직 없으면(온보딩 전) 빈 목록 그대로 둔다 — 다가오는 일정이 없는 것과
         * 다르지 않게 보이면 안 되므로 taskStatus는 'ready'로 두고 섹션 자체를 안 그린다.
         */
        const weddingId = boot.member?.weddingId ?? null;
        if (weddingId === null) {
          tasksLoadedOnce.current = true;
          setTaskStatus('ready');
          return;
        }
        void listWeddingTasks(weddingId)
          .then((response) => {
            if (!current()) return;
            setData((previous) => ({ ...previous, tasks: response.tasks }));
            tasksLoadedOnce.current = true;
            setTaskStatus('ready');
          })
          .catch(() => {
            if (!current()) return;
            if (tasksLoadedOnce.current) setToast(strings.journey.loadFailed);
            else setTaskStatus('error');
          });
      })
      .catch(() => {
        if (!current()) return;
        if (bootLoadedOnce.current) setToast(strings.journey.loadFailed);
        else setBootError(true);
      })
      .finally(() => { if (current()) setSettled(true); });
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    return () => { loadVersion.current += 1; };
  }, [load]));

  /*
   * 온보딩에서 넘어왔으면 뿌리의 골격이 이 화면을 덮고 있다. 첫 자료를 그릴 수 있거나
   * 오류를 말해야 할 때 걷는다 — 그 전에 걷으면 같은 골격이 한 번 더 선다.
   */
  const firstPaintReady = bootError || (settled && taskStatus !== 'loading' && contentStatus !== 'loading');
  const handoffActive = useHomeHandoffActive();
  useEffect(() => {
    if (firstPaintReady && handoffActive) endHomeHandoff();
  }, [firstPaintReady, handoffActive]);

  if (bootError) return <ErrorView message={strings.journey.loadFailed} onRetry={load} />;

  // 첫 진입에는 흩어진 원형 로더 대신 홈 전체의 자리를 한 번만 잡는다.
  if (!settled || taskStatus === 'loading' || contentStatus === 'loading') {
    return <HomeSkeleton />;
  }

  const daysLeft = data.me?.weddingDate == null ? null : daysUntil(data.me.weddingDate);

  const statuses = categoryStatuses({
    candidates: data.candidates,
    preparedCategories: data.me?.preparedCategories ?? [],
  });
  const prepCards = homePrepCards({ statuses, venueName: venueName(data.candidates, data.me) });
  const current = currentCategory(statuses, data.candidates?.nextCategory ?? null);
  const currentLabel = current === null ? null : (statuses.find((row) => row.category === current)?.label ?? null);
  const prepSub = homePrepSectionSub({ cards: prepCards, currentLabel });

  const schedule = scheduleRows(data.tasks, new Date(), data.me?.weddingDate ?? null);
  const scheduleHasDate = schedule[0]?.kind === 'dated';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Hero
            me={data.me}
            daysLeft={daysLeft}
            venueName={venueName(data.candidates, data.me)}
            nothingDecided={prepCards.every((card) => card.state === 'todo')}
            showBudget={false}
            budget={data.budget}
            bracketAnswered={data.bracketAnswered}
            partnerInvitePending={data.partnerInvitePending}
            onPressDate={() => router.push('/my/wedding-settings')}
            onPressVenue={() => router.push('/search?category=hall')}
            onPressBudget={() =>
              router.push(
                data.me?.weddingId == null
                  ? '/my/wedding-settings'
                  : '/wedding?tab=budget' as never
              )
            }
            onPressPartner={() => router.push('/wedding/partner')}
          />

          <MyWeddingPrep
            cards={prepCards}
            sub={prepSub}
            onOpen={(card) => router.push(`/pick?group=${card.key}` as never)}
            onMore={() => router.push('/pick')}
          />

          {taskStatus === 'error' ? (
            <View style={styles.block}>
              <ThemedText type="f13" themeColor="textAssistive">{strings.journey.loadFailed}</ThemedText>
              <ActionButton variant="secondary" label={strings.common['cta.retry']} onPress={load} />
            </View>
          ) : (
            <UpcomingSchedule
              rows={schedule}
              hasDate={scheduleHasDate}
              onMore={() => router.push('/wedding')}
            />
          )}

          <HomeBudget
            budget={data.budget}
            onOpen={() => router.push(
              data.me?.weddingId == null
                ? '/my/wedding-settings'
                : '/wedding?tab=budget' as never
            )}
          />

          <View style={[styles.block, styles.lastBlock]}>
            {/* home.jsx frame-012 `secLast` — 제목 14/20 · 서브 12/17(`secSub`) · 우측 「자세히」. */}
            <View style={styles.sectionHead}>
              <View style={styles.sectionHeadCol}>
                <ThemedText type="f14" style={styles.bold}>웨딩 준비 팁</ThemedText>
                <ThemedText type="f12" themeColor="textAssistive" style={styles.sub}>{S['section.tipsSub']}</ThemedText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="웨딩 준비 팁 자세히"
                onPress={() => router.push('/community/feed' as never)}
                style={({ pressed }) => [styles.feedMore, pressed && styles.pressed]}>
                <ThemedText type="f13" themeColor="textAssistive" style={styles.bold}>{S.more}</ThemedText>
                <SeedIcon name="chevronRightRegular" size={MORE_CHEVRON} color={theme.textAssistive} />
              </Pressable>
            </View>
            {contentStatus === 'error' ? (
              <View>
                <ThemedText type="f13" themeColor="textAssistive">{strings.journey.loadFailed}</ThemedText>
                <ActionButton variant="secondary" label={strings.common['cta.retry']} onPress={load} />
              </View>
            ) : data.content.length === 0 ? (
              <ThemedText type="f13" themeColor="textAssistive">{strings.community['feed.empty.body']}</ThemedText>
            ) : (
              <WeddingContent
                items={data.content}
                onPressItem={(id) => router.push(`/feed/${encodeURIComponent(id)}`)}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </ThemedView>
  );
}

/* ---------------------------------------------------------------- 공통 조각 */

function Header() {
  const theme = useTheme();

  /*
    Root 5탭 공통 제목 줄(`RootTabHeader`)의 기준이 이 홈 헤더다 — home.jsx `header` · `wordmark`.
    React_Native/home.jsx WP-HOME-001~003 header `headIcons` — 아이콘 하나(벨)뿐이다(`iconBtn`
    40 원형 · `icoBell` notification 20 · ink). #535가 알림 화면과 함께 걷어냈던 것을
    2026-09-25 대표 지시(「홈 화면에 알림 아이콘 어디갔냐」)로 되살렸다. 정본 벨에는 안 읽음
    점이 없어 그리지 않는다.
  */
  return (
    <RootTabHeader
      title="웨딩픽"
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="알림"
          onPress={() => router.push('/my/notifications')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <SeedIcon name="notificationRegular" size={Layout.iconRow} color={theme.text} />
        </Pressable>
      }
    />
  );
}

/** 웨딩홀로 최종 결정한 업체 이름이 예식장 이름이다. */
function venueName(candidates: CandidateListResponse | null, me: CurrentUser | null): string | null {
  const hall = categoryStatuses({
    candidates,
    preparedCategories: me?.preparedCategories ?? [],
  }).find((row) => row.category === 'hall');

  return hall?.decidedName ?? null;
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },

  /* 정본 `iconBtn` — 40 원형. 줄 높이 · 여백 · 제목은 `RootTabHeader`가 갖는다. */
  iconButton: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { paddingBottom: Spacing.three },

  block: { paddingHorizontal: Layout.gutter, marginBottom: Layout.sectionGap },
  /* `secLast` — 마지막 섹션은 아래 여백이 없고 스크롤 끝 16(`hscroll`)만 남는다. */
  lastBlock: { marginBottom: 0 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: Spacing.two,
  },
  sectionHeadCol: { flex: 1, minWidth: 0, gap: Spacing.half },
  bold: { fontWeight: 700 },
  /* home.js `moreRow` — 13/700 · gap 2 · 꺾쇠 14. */
  feedMore: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half },
  sub: { lineHeight: LineHeight.lh17 },
  pressed: { opacity: 0.8 },
});
