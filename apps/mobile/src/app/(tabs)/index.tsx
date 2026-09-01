import type {
  CandidateListResponse,
  CurrentUser,
  ExpenseSummaryResponse,
  WeddingTaskListResponse,
} from '@weddingpick/api-contract';
import {
  COMPLETED_ACTIONS,
  EXPENSE_BUCKET_COLOR,
  topPriority,
  hasUnread,
  formatTaskDate,
  greeting,
  lifecycle,
  showsPreparationFirst,
  type ExpenseBucket,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getCurrentUser,
  getDataUnlock,
  getExpenses,
  getNotificationSummary,
  listCandidates,
  listWeddingTasks,
} from '@/api/client';
import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { HomeSkeleton } from '@/features/home/home-skeleton';
import { homePriorityItems } from '@/features/home/priority';
import {
  HOME_SECTIONS,
  isVisible,
  loadHomeLayout,
  type HomeLayout,
  type HomeSection,
} from '@/features/home/sections';
import { won } from '@/features/quotes/quote-result-view';

/**
 * 홈. 디자인 핸드오프 5번.
 *
 * **D-Day와 다음 일정은 고정이다.** 나머지 다섯 섹션은 순서를 바꾸고 숨길 수
 * 있다(홈 편집) — 오늘 무엇을 해야 하는지가 홈의 이유라, 그 둘까지 숨길 수 있게
 * 두면 홈이 빈 화면이 될 수 있다.
 *
 * **빈 상태에서 레이아웃을 바꾸지 않는다.** 핸드오프가 명시한 규칙이다 — 값만
 * 0이나 —로 두고 자리는 지킨다. 자료가 없다고 다른 화면으로 갈아끼우면, 자료가
 * 생겼을 때 사용자는 처음 보는 화면을 만나게 된다.
 */
type HomeData = {
  me: CurrentUser | null;
  tasks: WeddingTaskListResponse | null;
  expenses: ExpenseSummaryResponse | null;
  candidates: CandidateListResponse | null;
  /** 조건이 비슷한 사례를 이미 볼 수 있는가. 그러면 그걸 권하는 카드를 접는다. */
  deepData: boolean;
  /** 안 읽은 알림 수. 벨의 빨간 점이 이 값을 본다. */
  unread: number;
};

const EMPTY: HomeData = {
  me: null,
  tasks: null,
  expenses: null,
  candidates: null,
  deepData: false,
  unread: 0,
};

export default function HomeScreen() {
  const theme = useTheme();
  const [layout, setLayout] = useState<HomeLayout | null>(null);
  const [data, setData] = useState<HomeData>(EMPTY);
  /*
   * 한 번이라도 받아왔는가. **자료가 없는 것과 아직 모르는 것은 다르다** —
   * 앞은 "일정을 등록해보세요"이고 뒤는 스켈레톤이다. 하나로 뭉치면 로그인 안 한
   * 사람에게 영원히 스켈레톤이 돈다.
   */
  const [settled, setSettled] = useState(false);

  const load = useCallback(() => {
    void loadHomeLayout().then(setLayout);

    /*
     * 하나가 실패해도 나머지는 보여준다. 로그인 안 한 사람은 넷 다 실패하는데,
     * 그때도 홈은 떠야 한다 — 게스트가 보는 화면이기도 하다.
     */
    void getCurrentUser()
      .then(async (me) => {
        setData((current) => ({ ...current, me }));

        /*
         * 알림은 웨딩이 없어도 온다 — 문의 답변처럼 웨딩과 상관없는 것이 있다.
         * 그래서 웨딩 자료보다 먼저, 따로 받는다.
         */
        const notifications = await getNotificationSummary().catch(() => null);

        setData((current) => ({ ...current, unread: notifications?.unread ?? 0 }));

        if (!me.weddingId) return;

        const [tasks, expenses, candidates, unlock] = await Promise.all([
          listWeddingTasks(me.weddingId).catch(() => null),
          getExpenses(me.weddingId).catch(() => null),
          listCandidates(me.weddingId).catch(() => null),
          getDataUnlock().catch(() => null),
        ]);

        setData((current) => ({
          ...current,
          tasks,
          expenses,
          candidates,
          deepData: unlock?.deepData ?? false,
        }));

      })
      .catch(() => setData(EMPTY))
      .finally(() => setSettled(true));
  }, []);

  useEffect(load, [load]);

  // 골격이 같은 스켈레톤을 덮는다. 자료가 왔을 때 화면이 튀지 않게 하려는 것이다.
  if (!settled) {
    return <HomeSkeleton />;
  }

  /*
   * 홈 대표 자리에 무엇을 둘지. 순서는 도메인이, 후보는 화면이 만든다 —
   * 못 재는 종류는 후보로 만들어지지 않아 여기 올라올 길이 없다.
   */
  const priority = topPriority(homePriorityItems(data));
  /*
   * 저장하지 않고 계산한다 — 아무 일도 없어도 시간이 지나면 바뀌는 값이다.
   *
   * v3.5의 일곱 단계를 쓴다. 예식이 지나도 앱이 할 말을 잃지 않는다.
   */
  const stage = lifecycle(data.me?.weddingDate ?? null);

  const sections: Record<HomeSection, React.ReactNode> = {
    quickMenu: (
      <ThemedView key="quickMenu" style={styles.section}>
        <ThemedView style={styles.quickRow}>
          <Quick label="지출내역" onPress={() => go(data.me, 'expenses')} />
          <Quick label="업체비교" onPress={() => router.push('/search')} />
          <Quick label="웨딩 스케줄" onPress={() => go(data.me, 'tasks')} />
          <Quick label="방문노트" onPress={() => go(data.me, 'visit-notes')} />
        </ThemedView>
      </ThemedView>
    ),

    tasks: (
      <ThemedView key="tasks" style={styles.section}>
        <ThemedView style={styles.sectionHead}>
          <ThemedText type="t4">웨딩 스케줄</ThemedText>
          <ActionButton label="전체보기" onPress={() => go(data.me, 'tasks')} />
        </ThemedView>

        {/* 자료가 없어도 자리는 지킨다. 값만 0으로 둔다. */}
        <ThemedText type="t7" themeColor="textSecondary">
          준비 {data.tasks?.progress.done ?? 0} / {data.tasks?.progress.total ?? 0} 완료
        </ThemedText>

        <View style={[styles.track, { backgroundColor: theme.track }]}>
          <View
            style={{
              flex: data.tasks?.progress.done ?? 0,
              backgroundColor: theme.tint,
            }}
          />
          <View
            style={{
              flex: Math.max(
                0,
                (data.tasks?.progress.total ?? 1) - (data.tasks?.progress.done ?? 0)
              ),
            }}
          />
        </View>

        {(data.tasks?.tasks ?? []).slice(0, 4).map((task) => (
          <ThemedView key={task.id} style={styles.taskRow}>
            <ThemedText type="t7" themeColor="textAssistive" style={styles.taskDate}>
              {task.dueDate ? formatTaskDate(task.dueDate) : '미정'}
            </ThemedText>
            <ThemedText type="t6" style={styles.grow}>
              {task.label}
            </ThemedText>
            <ThemedText type="badge" themeColor={task.state === 'done' ? 'positive' : 'tint'}>
              {task.stateLabel}
            </ThemedText>
          </ThemedView>
        ))}
      </ThemedView>
    ),

    expenses: (
      <ThemedView key="expenses" style={styles.section}>
        <ThemedText type="t7" themeColor="textSecondary">
          지금까지 결제한 금액
        </ThemedText>
        <ThemedText type="amount" numeric>
          {won(data.expenses?.paidTotal ?? 0)}
        </ThemedText>

        <View style={styles.bar}>
          {(data.expenses?.buckets ?? []).map((bucket) => (
            <View
              key={bucket.bucket}
              style={{
                flex: bucket.ratio,
                backgroundColor: theme[EXPENSE_BUCKET_COLOR[bucket.bucket as ExpenseBucket].bar],
              }}
            />
          ))}
          {/* 빈 상태도 막대가 있다. 회색 한 칸으로 둔다. */}
          {!data.expenses || data.expenses.paidTotal === 0 ? (
            <View style={{ flex: 1, backgroundColor: theme.chartMuted }} />
          ) : null}
        </View>

        <ThemedView style={styles.legendRow}>
          {(data.expenses?.buckets ?? []).map((bucket) => (
            <ThemedView key={bucket.bucket} style={styles.legendItem}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      theme[EXPENSE_BUCKET_COLOR[bucket.bucket as ExpenseBucket].bar],
                  },
                ]}
              />
              <ThemedText type="t7" themeColor="textSecondary">
                {bucket.label}
              </ThemedText>
              <ThemedText type="t7" numeric>
                {won(bucket.amount)}
              </ThemedText>
            </ThemedView>
          ))}
        </ThemedView>

        <ThemedView style={styles.cardRow}>
          <ThemedView type="backgroundElement" style={[styles.card, styles.grow]}>
            <ThemedText type="t7" themeColor="textSecondary">
              다음 결제
            </ThemedText>
            <ThemedText type="t5" numeric>
              {/* 없으면 0원이 아니라 —다. 0원은 "낼 것이 없다"로 읽힌다. */}
              {data.expenses && data.expenses.scheduledTotal > 0
                ? won(data.expenses.scheduledTotal)
                : '—'}
            </ThemedText>
          </ThemedView>
          <ThemedView type="backgroundElement" style={[styles.card, styles.grow]}>
            <ThemedText type="t7" themeColor="textSecondary">
              잔여 예산
            </ThemedText>
            <ThemedText type="t5" numeric>
              {data.expenses?.budget.set ? won(data.expenses.budget.remaining) : '—'}
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    ),

    candidates: (
      <ThemedView key="candidates" style={styles.section}>
        <ThemedView style={styles.sectionHead}>
          <ThemedText type="t4">Pick한 곳</ThemedText>
          <ActionButton label="비교하기" onPress={() => go(data.me, 'candidates')} />
        </ThemedView>

        {(data.candidates?.total ?? 0) === 0 ? (
          <ThemedText type="t7" themeColor="textSecondary">
            아직 담아둔 곳이 없어요
          </ThemedText>
        ) : (
          (data.candidates?.groups ?? []).flatMap((group) =>
            group.candidates.slice(0, 3).map((candidate) => (
              <ThemedView key={candidate.id} style={styles.taskRow}>
                <ThemedText type="t6" style={styles.grow}>
                  {candidate.vendorName}
                </ThemedText>
                <ThemedText type="t7" themeColor="textAssistive">
                  {group.categoryLabel}
                </ThemedText>
              </ThemedView>
            ))
          )
        )}
      </ThemedView>
    ),

    unlock: (
      <ThemedView key="unlock" style={[styles.unlock, { backgroundColor: theme.tint }]}>
        <ThemedText type="t4" style={styles.onTint}>
          결제 금액, 얼마나 차이 날까요?
        </ThemedText>
        <ThemedText type="t7" style={styles.onTint}>
          Pick 인증을 마치시면 조건이 비슷한 사례를 함께 보실 수 있어요
        </ThemedText>
        <ActionButton label="제보하기" onPress={() => router.push('/capture')} />
      </ThemedView>
    ),
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* 벨. 안 읽은 것이 있으면 점이 뜬다 — 판단은 도메인 함수 하나가 한다. */}
          <ThemedView style={styles.bellRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                hasUnread({ unread: data.unread, total: data.unread })
                  ? `알림 ${data.unread}건`
                  : '알림'
              }
              onPress={() => router.push('/my/notifications')}
              style={styles.bell}>
              <ThemedText type="t4">🔔</ThemedText>
              {hasUnread({ unread: data.unread, total: data.unread }) ? (
                <View style={[styles.bellDot, { backgroundColor: theme.negative }]} />
              ) : null}
            </Pressable>
          </ThemedView>

          {/*
            고정 1 — Hero.

            상태 문구 한 줄 + 제목 두 줄. v3.1 §3이 정한 모양이고, v3.4가 상태
            문구를 남은 기간에 따라 바꾸라고 정했다 — 300일 남은 사람에게
            `두근두근`은 아무 뜻도 없다.

            예식이 지나도 이 자리를 비우지 않는다(v3.5 §4). 다만 지난 날을 세는
            카운터로 두지 않는다 — `stage.note`가 단계에 맞는 말을 들고 온다.
          */}
          <ThemedView style={styles.headline}>
            {data.me?.weddingDate ? (
              <>
                <ThemedText type="t7" themeColor="tint">
                  {stage.mood}
                </ThemedText>
                <ThemedText type="t2">{greeting(data.me.displayName)}</ThemedText>
                <ThemedText type="t2">{stage.note}</ThemedText>
              </>
            ) : (
              <>
                <ThemedText type="t2">웨딩픽에</ThemedText>
                <ThemedText type="t2">오신 것을 환영해요</ThemedText>
              </>
            )}
          </ThemedView>

          {/*
            고정 2 — 지금 할 일. Priority Engine이 고른 하나(v3.10 §3).

            여러 개를 늘어놓지 않는다. 홈에서 무엇부터 할지 정해주는 것이 이 자리의
            일이라, 세 장을 나란히 두면 정해주지 않은 것과 같아진다.

            예식이 끝났으면 그 자리에 마무리할 것을 둔다. **계정을 제한하지
            않는다**(원문 34번) — 아래 섹션은 그대로 뜨고, 여기 있는 것은 막는
            목록이 아니라 권하는 목록이다.
          */}
          {!showsPreparationFirst(stage.stage) ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              {COMPLETED_ACTIONS.map((action) => (
                <ThemedView key={action.key} type="backgroundElement" style={styles.completedRow}>
                  <ThemedText type="t5">{action.title}</ThemedText>
                  <ThemedText type="t7" themeColor="textSecondary">
                    {action.description}
                  </ThemedText>
                </ThemedView>
              ))}
            </ThemedView>
          ) : (
            <ThemedView type="backgroundElement" style={styles.card}>
              {priority ? (
                <>
                  <ThemedText type="t7" themeColor="tint">
                    지금 할 일
                  </ThemedText>
                  <ThemedText type="t5">{priority.title}</ThemedText>
                  {priority.detail ? (
                    <ThemedText type="t7" themeColor="textSecondary">
                      {priority.detail}
                    </ThemedText>
                  ) : null}
                  <ActionButton
                    label={priority.actionLabel}
                    onPress={() => router.push(priority.action as never)}
                  />
                </>
              ) : (
                <ThemedText type="t6" themeColor="textSecondary">
                  일정을 등록해보세요
                </ThemedText>
              )}
            </ThemedView>
          )}

          {/*
            가격 TOP3 섹션은 홈에 두지 않는다(홈 C-1). 오늘의 Pick과 경쟁하는
            자리라, 둘을 나란히 두면 홈이 무엇을 권하는 화면인지 흐려진다.
            TOP3 성격의 탐색은 검색 탭에 있다.
          */}

          {(layout?.order ?? HOME_SECTIONS)
            .filter((section) => (layout ? isVisible(layout, section) : true))
            /*
             * 이미 볼 수 있는 사람에게 "등록하시면 보실 수 있어요"라고 하지 않는다.
             * 숨기기와 다른 일이다 — 숨기기는 사용자가 정하고, 이건 사실이 정한다.
             */
            .filter((section) => section !== 'unlock' || !data.deepData)
            .map((section) => sections[section])}

          <ActionButton label="홈 편집" onPress={() => router.push('/home-edit')} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** 웨딩이 없으면 우리웨딩 탭으로 보낸다 — 거기서 만들어준다. */
function go(me: CurrentUser | null, section: string) {
  router.push(me?.weddingId ? `/wedding/${me.weddingId}/${section}` : '/wedding');
}

function Quick({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <ThemedView style={styles.quick}>
      <ActionButton label={label} onPress={onPress} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  completedRow: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  bellRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  bell: {
    minWidth: Layout.touchTarget,
    minHeight: Layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 개수를 적지 않는다. 핸드오프가 점 하나로 정했다 — 세는 것이 목적이 아니다. */
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  headline: { gap: 0 },
  section: { gap: Spacing.two },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  quick: { flexGrow: 1, minWidth: 140 },
  track: { flexDirection: 'row', height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  bar: { flexDirection: 'row', height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  legendRow: { gap: Spacing.one },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: Radius.pill },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: Layout.rowMinHeight,
  },
  taskDate: { width: 56 },
  grow: { flex: 1 },
  cardRow: { flexDirection: 'row', gap: Spacing.two },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  unlock: { borderRadius: Radius.card, padding: Layout.gutter, gap: Spacing.two },
  onTint: { color: '#ffffff' },
});
