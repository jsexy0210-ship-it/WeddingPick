/**
 * 웨딩노트 — v3.29.1 `docs/design/React_Native/note.jsx` WP-NOTE-001/004/006.
 * 일정 · 상담 · 예산 세 탭과 헤더 추가 액션을 둔다.
 * 항목별 예산은 API buckets에 없으므로 항목별 수정·삭제는 연결하지 않는다.
 * 예식 뒤 화면은 별도 WeddingCompleteView가 맡는다.
 * 일정 탭의 «할 일» 섹션과 그 추가 시트는 뺐다(2026-09-25 대표 지시 — 정본 note.jsx에는 있다).
 * 할 일 서버 API · DB는 그대로 둔다.
 */
import { FullScreenError } from '@/features/errors/full-screen-error';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import type {
  ConsultationRecord,
  CurrentUser,
  ExpenseSummaryResponse,
  WeddingEvent,
} from '@weddingpick/api-contract';
import {
  PREPARATION_CATEGORIES,
  TERMS,
  budgetView,
  daysUntil,
  isBeforeWedding,
  lifecycle,
  manwon,
} from '@weddingpick/domain';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Border,
  DonutChart,
  FontSize,
  Layout,
  LetterSpacing,
  LineHeight,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';
import {
  ensureWedding,
  getCurrentUser,
  getExpenses,
  listConsultations,
  listDecisions,
  listWeddingEvents,
  setBudget,
} from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { formatDateDot } from '@/features/common/format-date';
import { noteMonthDayWeekdayTime } from '@/features/wedding/note-format';
import { useSession } from '@/features/auth/use-session';
import { WeddingCompleteView } from '@/features/wedding/complete-view';
import { buildUpcomingTimelineGroups, type TimelineItem } from '@/features/wedding/timeline-groups';

type Tab = 'calendar' | 'consult' | 'budget';

/* v3.29 웨딩노트 탭. */
const TABS: readonly { key: Tab; label: string }[] = [
  { key: 'calendar', label: '웨딩일정' },
  { key: 'consult', label: '상담기록' },
  { key: 'budget', label: '예산현황' },
];
/* note.js `bd()` — 항목별 막대 아래 왼쪽 줄. */
const UNPAID = '아직 안 냈어요';
/* note.js `spendGoRow` — 예산 카드 맨 아래에서 지출 목록(WP-OUR-014b)으로 간다. */
const SPEND_LINK = '지출내역';
const CONSULT_EMPTY_TITLE = '녹음 파일을 올려주세요';
const CONSULT_EMPTY_BODY = '휴대폰 녹음앱에서 저장한 파일이면 돼요';
const CONSULT_SAVED = '저장됨';
/* note.js `consults` — 정리가 끝났고 아직 저장하지 않은 기록. */
const CONSULT_DONE = '정리 완료';
/* 헤더 우측 액션 — React_Native/note.jsx headAdd «일정 추가 · 상담 추가 · 예산 추가». */
const ADD_LABEL: Record<Tab, string> = { calendar: '일정 추가', budget: '예산 추가', consult: '상담 추가' };
const DECIDED_LINK = '예약현황';
const PAST_EVENTS_SHOW = '보기';
const PAST_EVENTS_HIDE = '접기';

const BAR_HEIGHT = 6;

function parseTab(value: string | undefined): Tab | null {
  return value === 'calendar' || value === 'consult' || value === 'budget' ? value : null;
}

export default function WeddingScreen({
  initialTab,
  suppressBudgetPrompt = false,
}: {
  initialTab?: Tab;
  suppressBudgetPrompt?: boolean;
} = {}) {
  const theme = useTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { state, refresh } = useSession();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [events, setEvents] = useState<WeddingEvent[] | null>(null);
  const [expenses, setExpenses] = useState<ExpenseSummaryResponse | null>(null);
  const [expensesError, setExpensesError] = useState(false);
  const [consults, setConsults] = useState<ConsultationRecord[] | null>(null);
  const [decidedCount, setDecidedCount] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab ?? parseTab(params.tab) ?? 'calendar');
  const [toast, setToast] = useState<string | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [budgetSaving, setBudgetSaving] = useState(false);
  const budgetPrompted = useRef(false);

  const isSignedIn = state.status === 'signedIn';

  const load = useCallback(() => {
    if (!isSignedIn) return;
    let active = true;
    void getCurrentUser()
      .then(async (first) => {
        const current = first.weddingId ? first : await ensureWedding().then(() => getCurrentUser());
        if (!active) return;
        setMe(current);
        if (!current.weddingId) return;
        const weddingId = current.weddingId;
        // 다섯 목록은 따로 도착한다 — 가장 느린 것이 나머지를 가리지 않게 각각 반영한다.
        void listWeddingEvents(weddingId).then((r) => { if (active) setEvents(r.events); }).catch(() => undefined);
        void getExpenses(weddingId)
          .then((r) => {
            if (!active) return;
            setExpenses(r);
            setExpensesError(false);
          })
          .catch(() => {
            if (active) setExpensesError(true);
          });
        void listConsultations(weddingId).then((r) => { if (active) setConsults(r.records); }).catch(() => undefined);
        void listDecisions(weddingId).then((r) => { if (active) setDecidedCount(r.decisions.length); }).catch(() => undefined);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [isSignedIn]);

  /* 일정 · 지출 화면에서 돌아오면 목록이 바뀌어 있다 — 화면에 올 때마다 다시 읽는다. */
  useFocusEffect(load);

  useEffect(() => {
    if (initialTab !== undefined) return;
    const requested = parseTab(params.tab);
    if (!requested) return;
    const timer = setTimeout(() => setTab(requested), 0);
    return () => clearTimeout(timer);
  }, [initialTab, params.tab]);

  useEffect(() => {
    if (
      suppressBudgetPrompt ||
      tab !== 'budget' ||
      !expenses ||
      expenses.budget.set ||
      budgetPrompted.current
    ) return;
    budgetPrompted.current = true;
    const timer = setTimeout(() => {
      setBudgetDraft('');
      setBudgetOpen(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [expenses, suppressBudgetPrompt, tab]);

  if (state.status === 'error') return <FullScreenError kind={state.kind} onRetry={() => void refresh()} />;
  if (state.status === 'loading') return <DelayedLoadingView />;
  if (state.status === 'signedOut') return <Redirect href="/login" />;

  const weddingId = me?.weddingId ?? null;
  const stage = lifecycle(me?.weddingDate ?? null);
  const weddingOver =
    weddingId !== null && me?.weddingDate != null && !isBeforeWedding(stage.stage) && stage.stage !== 'wedding_day';
  const headerAddLabel = ADD_LABEL[tab];

  const header = (
    <View style={styles.header}>
      <ThemedText type="f26" style={[styles.bold, styles.rootTitle]}>
        {TERMS.ourWedding}
      </ThemedText>
      {!weddingOver && weddingId ? (
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={headerAddLabel}
            onPress={onAddAction}
            hitSlop={Spacing.two}
            style={({ pressed }) => (pressed ? styles.pressed : null)}>
            <ThemedText type="f15" themeColor="tint" style={styles.bold}>
              {headerAddLabel}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

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

  /*
   * WP-EMPTY-NOTE(`common.js` escreens) — 일정 · 예산 · 상담기록이 모두 비어 있고 예식일도
   * 아직 없을 때. 세 탭을 나열하지 않고 «예식일 확인하기» 하나만 크게 둔다. 예식일을
   * 정하면 이 조건이 풀려 평소 화면으로 돌아온다.
   */
  const firstVisit =
    weddingId !== null &&
    me?.weddingDate == null &&
    events !== null &&
    events.length === 0 &&
    consults !== null &&
    consults.length === 0 &&
    expenses !== null &&
    expenses.expenses.length === 0;

  if (firstVisit && expenses) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <EmptyNoteView expenses={expenses} onConfirmDate={() => router.push('/my/wedding-settings' as never)} />
        </SafeAreaView>
        <Toast message={toast} onHidden={() => setToast(null)} />
      </ThemedView>
    );
  }

  function onAddAction() {
    if (!weddingId) return;
    if (tab === 'calendar') {
      router.push(`/wedding/${weddingId}/events/new` as never);
    } else if (tab === 'budget') router.push(`/wedding/${weddingId}/expenses/add` as never);
    else router.push(`/wedding/${weddingId}/consultations/upload` as never);
  }

  const budgetManwon = Number(budgetDraft.replace(/[^\d]/g, ''));
  const budgetAmount = budgetManwon * 10_000;
  const budgetReady = Number.isFinite(budgetManwon) && budgetManwon > 0;
  const budgetIsSet = expenses?.budget.set === true;

  function openBudgetEditor() {
    if (!expenses || !expenses.budget.set) return;
    setBudgetDraft(
      String(Math.round(expenses.budget.budget / 10_000)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    );
    setBudgetOpen(true);
  }

  function retryExpenses() {
    if (!weddingId) return;
    setExpensesError(false);
    setExpenses(null);
    void getExpenses(weddingId)
      .then(setExpenses)
      .catch(() => setExpensesError(true));
  }

  async function saveBudget() {
    if (!weddingId || !budgetReady || budgetSaving) return;
    const editing = budgetIsSet;
    setBudgetSaving(true);
    try {
      await setBudget(weddingId, budgetAmount);
      setExpenses((current) =>
        current
          ? {
              ...current,
              budget: budgetView({ budget: budgetAmount, spent: current.paidTotal }),
            }
          : current
      );
      setBudgetOpen(false);
      setToast(editing ? '총예산을 바꿨어요' : '총예산을 등록했어요');
    } catch {
      setToast(
        editing
          ? '총예산을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.'
          : '총예산을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setBudgetSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {header}

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 세 칸 탭 — React_Native/note.jsx tabNav/seg(WP-NOTE-001): 밑줄형, 배경 없음. */}
          <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: theme.border }]}>
            {TABS.map((item) => {
              const selected = item.key === tab;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.label}
                  onPress={() => setTab(item.key)}
                  style={[styles.tab, selected ? [styles.tabActive, { borderBottomColor: theme.text }] : null]}>
                  <ThemedText type="t6" style={[styles.bold, { color: selected ? theme.text : theme.textAssistive }]}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {tab === 'calendar' ? (
            <CalendarPanel
              events={events ?? []}
              weddingDate={me?.weddingDate ?? null}
              decidedCount={decidedCount}
              onOpenDecided={() => (weddingId ? router.push(`/wedding/${weddingId}/decided` as never) : null)}
            />
          ) : tab === 'budget' ? (
            <BudgetPanel
              expenses={expenses}
              error={expensesError}
              onEditBudget={openBudgetEditor}
              onRetry={retryExpenses}
              onOpenSpend={() =>
                weddingId ? router.push(`/wedding/${weddingId}/expenses/list` as never) : null
              }
            />
          ) : (
            <ConsultPanel
              records={consults ?? []}
              onOpen={(record) =>
                weddingId
                  ? router.push(`/wedding/${weddingId}/consultations/${record.id}` as never)
                  : null
              }
            />
          )}
        </ScrollView>

      </SafeAreaView>

      <BottomSheet
        visible={budgetOpen}
        dismissible={budgetIsSet && !budgetSaving}
        onRequestClose={() => setBudgetOpen(false)}
        testID="initial-budget-sheet">
        <SheetPanel style={styles.budgetSheet}>
          <ThemedText type="t3">
            {budgetIsSet ? '총예산을 바꿔볼까요?' : '총예산을 정해볼까요?'}
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            {budgetIsSet
              ? '바꾼 예산으로 남은 금액과 사용률을 다시 계산해요.'
              : '총예산을 입력하면 남은 금액과 사용률을 함께 보여드려요.'}
          </ThemedText>
          <View style={[styles.budgetInputWrap, { borderColor: theme.fieldBorder }]}>
            <TextInput
              value={budgetDraft}
              onChangeText={(text) =>
                setBudgetDraft(
                  text
                    .replace(/[^0-9]/g, '')
                    .slice(0, 8)
                    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                )
              }
              keyboardType="number-pad"
              editable={!budgetSaving}
              placeholder="예: 5,000"
              placeholderTextColor={theme.textDisabled}
              accessibilityLabel="전체 예산 만원 단위"
              style={[styles.budgetInput, { color: theme.text }]}
            />
            <ThemedText type="t6" themeColor="textSecondary">만원</ThemedText>
          </View>
          <ActionButton
            variant="primary"
            size="xlarge"
            label={budgetSaving ? '저장하는 중…' : budgetIsSet ? '변경 내용 저장' : '총예산 등록'}
            disabled={!budgetReady || budgetSaving}
            onPress={() => void saveBudget()}
          />
        </SheetPanel>
      </BottomSheet>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </ThemedView>
  );
}

/* ────────────────────────────────────────────
   웨딩노트 · 처음 — `docs/design/React_Native/common.jsx` frame-011 WP-EMPTY-NOTE
   (`common.js` escreens). nav 56 · 제목 26/700 왼쪽 · 탭 없음.
   섹션 `padding:0 20px 24px;gap:12px`, 머리 18/700.
──────────────────────────────────────────── */
function EmptyNoteView({
  expenses,
  onConfirmDate,
}: {
  expenses: ExpenseSummaryResponse;
  onConfirmDate: () => void;
}) {
  const theme = useTheme();
  const rows = [
    ...(expenses.budget.set ? [{ k: '총예산', v: manwon(expenses.budget.budget) }] : []),
    { k: '쓴 금액', v: manwon(expenses.paidTotal) },
  ];

  return (
    <>
      <View style={[styles.emptyNav, { borderBottomColor: theme.border }]}>
        <ThemedText type="f26" style={[styles.bold, styles.grow]}>
          {TERMS.ourWedding}
        </ThemedText>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.emptySection}>
          <ThemedText type="f18" style={styles.bold}>일정</ThemedText>
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="f16" style={[styles.bold, styles.center]}>
              예식일만 넣어두면 나머지는 알려드려요
            </ThemedText>
            <ThemedText type="f13" themeColor="textAssistive" style={styles.center}>
              준비 순서를 차례대로 챙겨드려요
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="예식일 확인하기"
              onPress={onConfirmDate}
              style={({ pressed }) => [styles.emptyCta, { backgroundColor: theme.tint }, pressed ? styles.pressed : null]}>
              <ThemedText type="f15" themeColor="onTint" style={styles.bold}>
                예식일 확인하기
              </ThemedText>
            </Pressable>
          </View>
        </View>
        <View style={styles.emptySection}>
          <ThemedText type="f18" style={styles.bold}>예산</ThemedText>
          <View>
            {rows.map((row) => (
              <View key={row.k} style={[styles.emptyDataRow, { borderBottomColor: theme.border }]}>
                <ThemedText type="f15" themeColor="textSecondary">{row.k}</ThemedText>
                <ThemedText type="f15" numeric style={styles.bold}>{row.v}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

/* ────────────────────────────────────────────
   캘린더 패널 — React_Native/note.jsx WP-NOTE-001.
   월 격자를 폐기하고 예식일까지 주 단위 흐름으로 바꿨다: D-day 카드 → 지난 일정
   접은 줄 → 이번 주 · 다음 주 · 달 단위 타임라인. 할 일 체크리스트는 뺐다(2026-09-25 대표 지시).
──────────────────────────────────────────── */
function CalendarPanel({
  events,
  weddingDate,
  decidedCount,
  onOpenDecided,
}: {
  events: WeddingEvent[];
  weddingDate: string | null;
  decidedCount: number | null;
  onOpenDecided: () => void;
}) {
  const theme = useTheme();
  const [now] = useState(() => new Date());
  const [showPast, setShowPast] = useState(false);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const past = events
    .filter((event) => new Date(event.startsAt) < today)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const upcomingGroups = buildUpcomingTimelineGroups(events, weddingDate, now);

  const days = weddingDate !== null ? daysUntil(weddingDate, now) : null;
  const ddayText = days === null ? null : days > 0 ? `D-${days}` : days === 0 ? 'D-DAY' : `D+${-days}`;
  return (
    <View style={styles.calendarStack}>
      {weddingDate !== null ? (
        <View style={[styles.ddayCard, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.ddayTop}>
            <ThemedText type="f18" numeric style={[styles.bold, styles.ddayValue]}>
              {formatDateDot(weddingDate)}
            </ThemedText>
            <ThemedText type="f18" themeColor="tint" numeric style={[styles.bold, styles.ddayValue]}>
              {ddayText}
            </ThemedText>
          </View>
          <ThemedText type="f13" themeColor="textSecondary" numeric>
            {days !== null && days > 0
              ? `남은 ${Math.max(1, Math.ceil(days / 7))}주`
              : '예식이 곧이에요'}
          </ThemedText>
          {decidedCount !== null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={DECIDED_LINK}
              onPress={onOpenDecided}
              hitSlop={Spacing.two}
              style={[styles.decidedLinkRow, { borderTopColor: theme.border }]}>
              <ThemedText type="f14" numeric style={styles.bold}>
                {`${DECIDED_LINK} ${decidedCount}/${PREPARATION_CATEGORIES.length}`}
              </ThemedText>
              <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textAssistive} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {past.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showPast ? PAST_EVENTS_HIDE : PAST_EVENTS_SHOW}
          onPress={() => setShowPast((prev) => !prev)}
          style={[styles.pastRow, { borderBottomColor: theme.border }]}>
          <ThemedText type="f14" themeColor="textAssistive" numeric>
            {`지난 일정 ${past.length}건`}
          </ThemedText>
          <ThemedText type="f14" themeColor="textSecondary" style={styles.bold}>
            {showPast ? PAST_EVENTS_HIDE : PAST_EVENTS_SHOW}
          </ThemedText>
        </Pressable>
      ) : null}

      {showPast && past.length > 0 ? <TimelineGroupView title="지난 일정" range="" items={past.map((event) => ({ event, kind: 'event' as const }))} dimmed /> : null}

      {upcomingGroups.map((group) => (
        <TimelineGroupView key={group.title} {...group} />
      ))}

    </View>
  );
}

function TimelineGroupView({
  title,
  range,
  items,
  dimmed = false,
}: {
  title: string;
  range: string;
  items: TimelineItem[];
  dimmed?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.timelineGroup}>
      <View style={styles.timelineGroupHead}>
        <ThemedText type="f15" style={styles.bold}>
          {title}
        </ThemedText>
        {range.length > 0 ? (
          <ThemedText type="f13" themeColor="textAssistive" numeric>
            {range}
          </ThemedText>
        ) : null}
      </View>
      {items.map((item) => {
        if (item.kind === 'wedding') {
          return (
            <View key="wedding-day" style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, styles.weddingDot, { backgroundColor: theme.tint }]} />
                <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
              </View>
              <View style={[styles.eventRow, styles.weddingRow, { borderColor: theme.tint, backgroundColor: theme.background }]}>
                <ThemedText type="f12" themeColor="tint" numeric style={styles.bold}>
                  {formatDateDot(item.date)}
                </ThemedText>
                <ThemedText type="f15" style={styles.bold}>
                  예식일
                </ThemedText>
              </View>
            </View>
          );
        }

        const event = item.event;
        const done = dimmed || event.status === 'done';
        return (
          <View key={event.id} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, { backgroundColor: done ? theme.track : theme.tint }]} />
              <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
            </View>
            {/* 일정 상세(WP-OUR-005)는 2026-09-25 삭제 — 행은 보기만 한다. */}
            <View style={[styles.eventRow, { backgroundColor: done ? theme.backgroundElement : theme.backgroundSelected }]}>
              <ThemedText type="f12" themeColor="textAssistive" numeric style={styles.bold}>
                {noteMonthDayWeekdayTime(event.startsAt)}
              </ThemedText>
              <ThemedText
                type="f15"
                numberOfLines={1}
                themeColor={done ? 'textAssistive' : undefined}
                style={[styles.bold, done ? styles.strike : null]}>
                {event.title}
              </ThemedText>
              {event.memo ? (
                <ThemedText type="f13" themeColor="textSecondary" numberOfLines={1}>
                  {event.memo}
                </ThemedText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ────────────────────────────────────────────
   예산현황 패널 — 총 사용률은 도넛, 항목별 진행은 막대.
──────────────────────────────────────────── */
function BudgetPanel({
  expenses,
  error,
  onEditBudget,
  onRetry,
  onOpenSpend,
}: {
  expenses: ExpenseSummaryResponse | null;
  error: boolean;
  onEditBudget: () => void;
  onRetry: () => void;
  onOpenSpend: () => void;
}) {
  const theme = useTheme();

  if (!expenses) {
    return (
      <View style={[styles.panel, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <ThemedText type="t6" style={styles.bold}>
          {TABS[2].label}
        </ThemedText>
        <View style={styles.budgetSummary}>
          <ThemedText type="t6" themeColor={error ? 'negative' : 'textSecondary'}>
            {error ? '예산을 불러오지 못했어요' : '예산을 불러오는 중이에요'}
          </ThemedText>
          {error ? (
            <ActionButton label="다시 불러오기" onPress={onRetry} />
          ) : null}
        </View>
      </View>
    );
  }

  const budget = expenses?.budget;
  const set = budget?.set === true ? budget : null;
  const total = set?.budget ?? 0;
  const spent = set?.spent ?? expenses?.paidTotal ?? 0;
  const percentage = total > 0 ? Math.round((spent / total) * 100) : 0;
  const progress = Math.max(0, Math.min(100, percentage));
  const buckets = expenses?.buckets ?? [];

  return (
    <View style={[styles.panel, { backgroundColor: theme.background, borderColor: theme.border }]}>
      {set ? (
        <View style={styles.budgetSummary}>
          <View style={styles.budgetSummaryRow}>
            <DonutChart
              size={88}
              holeSize={64}
              slices={[
                { key: 'used', value: progress, color: theme.tint },
                { key: 'remaining', value: 100 - progress, color: theme.backgroundSelected },
              ]}>
              <ThemedText type="f16" numeric style={styles.bold}>{`${percentage}%`}</ThemedText>
            </DonutChart>
            <View style={styles.budgetSummaryCol}>
              <ThemedText type="f30" numeric style={[styles.bold, styles.sumBig]}>
                {manwon(spent)}
              </ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel="총예산 수정" onPress={onEditBudget}>
                <View style={styles.budgetEditRow}>
                  <ThemedText type="f14" themeColor="textAssistive" numeric>
                    {`예산 ${manwon(total)}`}
                  </ThemedText>
                  <ProductSymbol name="edit" size={14} color={theme.textAssistive} />
                </View>
              </Pressable>
              <ThemedText type="f13" themeColor="textAssistive" numeric style={styles.budgetSummaryNote}>
                {`${manwon(Math.max(set.remaining, 0))} 남았어요`}
              </ThemedText>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.budgetSummary}>
          <ThemedText type="t6" style={styles.bold}>{TABS[2].label}</ThemedText>
          <ThemedText type="t6" style={styles.bold}>
            {budget?.set === false ? budget.note : '예산을 아직 정하지 않았어요'}
          </ThemedText>
          <ThemedText type="t7" themeColor="textAssistive" numeric>
            {`${manwon(spent)} 사용`}
          </ThemedText>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      {buckets.map((bucket) => {
        const pct = Math.min(100, Math.round(bucket.ratio * 100));
        const full = pct >= 100;
        return (
          <View key={bucket.bucket} style={styles.bucketRow}>
            <View style={styles.bucketHead}>
              <ThemedText type="f15" numberOfLines={1} style={[styles.bold, styles.grow]}>
                {bucket.label}
              </ThemedText>
              <ThemedText type="f13" themeColor="textAssistive" numeric>
                {manwon(bucket.amount)}
              </ThemedText>
            </View>
            <View style={[styles.bar, { backgroundColor: theme.backgroundSelected }]}>
              {/* 정본 `bd()` — 다 쓴(100%) 항목만 코랄, 나머지는 옅은 코랄(`#ffb3ab` → 차트 2계열 토큰). */}
              <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: full ? theme.tint : theme.chartSeries2 }]} />
            </View>
            <View style={styles.bucketFoot}>
              <ThemedText type="f12" themeColor="textAssistive" numeric>
                {bucket.amount > 0 ? `${manwon(bucket.amount)} 냈어요` : UNPAID}
              </ThemedText>
              <ThemedText type="f12" themeColor={full ? 'tint' : 'textAssistive'} numeric style={styles.bold}>
                {`${pct}%`}
              </ThemedText>
            </View>
          </View>
        );
      })}

      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={SPEND_LINK}
        onPress={onOpenSpend}
        style={({ pressed }) => [styles.spendLink, pressed ? styles.pressed : null]}>
        <ThemedText type="f14" style={styles.bold}>
          {SPEND_LINK}
        </ThemedText>
        <ProductSymbol name="chevronRight" size={Layout.iconInline} color={theme.textAssistive} />
      </Pressable>

    </View>
  );
}

/* ────────────────────────────────────────────
   상담기록 패널 — 행: 업체 · 날짜 · 금액 / 상태. 비면 점선 상자.
──────────────────────────────────────────── */
function ConsultPanel({
  records,
  onOpen,
}: {
  records: ConsultationRecord[];
  onOpen: (record: ConsultationRecord) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.panel, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={styles.consultHead}>
        <ThemedText type="f20" style={styles.bold}>
          {records.length > 0 ? `상담 ${records.length}건` : TABS[1].label}
        </ThemedText>
        <ThemedText type="f13" themeColor="textAssistive">
          정리된 내용은 예산에 반영해요
        </ThemedText>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {records.length > 0 ? (
        <View>
          {records.map((record) => {
            const amount = consultAmount(record);
            const date = new Date(record.createdAt);
            const meta = `${date.getMonth() + 1}월 ${date.getDate()}일${amount !== null ? ` · ${manwon(amount)}` : ''}`;
            const saved = record.confirmedAt !== null;
            return (
              <Pressable
                key={record.id}
                accessibilityRole="button"
                accessibilityLabel={`${record.vendorLabel ?? '업체 미확인'} 상담기록`}
                onPress={() => onOpen(record)}
                style={[styles.consultRow, { borderBottomColor: theme.backgroundSelected }]}>
                <View style={styles.grow}>
                  <ThemedText type="f15" numberOfLines={1} style={styles.bold}>
                    {record.vendorLabel ?? '업체 미확인'}
                  </ThemedText>
                  <ThemedText type="f12" themeColor="textAssistive" numeric style={styles.consultMeta}>
                    {meta}
                  </ThemedText>
                </View>
                <ThemedText
                  type="f13"
                  themeColor={saved ? undefined : 'textAssistive'}
                  style={saved ? styles.bold : null}>
                  {saved ? CONSULT_SAVED : CONSULT_DONE}
                </ThemedText>
                <ProductSymbol name="chevronRight" size={Layout.iconField} color={theme.textDisabled} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* 빈 상태 — note.js `uploadBox`. 등록 진입점은 헤더 «상담 추가» 하나뿐이라 누를 수 없는 안내다. */}
      {records.length === 0 ? (
        <View style={[styles.consultEmpty, { borderColor: theme.track }]}>
          <ProductSymbol name="mic" size={22} color={theme.textAssistive} />
          <ThemedText type="f15" style={styles.bold}>
            {CONSULT_EMPTY_TITLE}
          </ThemedText>
          <ThemedText type="f13" themeColor="textAssistive" style={styles.center}>
            {CONSULT_EMPTY_BODY}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

/** 상담기록의 총 제시금액 — 최종 금액이 있으면 그것, 없으면 견적 총액(상담기록 화면과 같은 순서). */
function consultAmount(record: ConsultationRecord): number | null {
  for (const key of ['finalAmount', 'quotedTotal']) {
    const raw = record.common[key];
    if (raw && typeof raw === 'object' && typeof (raw as { value?: unknown }).value === 'number') {
      return (raw as { value: number }).value;
    }
  }
  return null;
}

/* ────────────────────────────────────────────
   스타일 — 값은 `docs/design/React_Native/note.js`(2026-09-24 정본). 12 · 14 · 20 · 36 · 40처럼
   사다리에 없는 값은 같은 값의 기존 토큰을 주석과 함께 쓴다(저장소 관례).
──────────────────────────────────────────── */
const styles = StyleSheet.create({
  budgetSheet: { flexShrink: 1 },
  budgetInputWrap: {
    height: Layout.field,
    borderRadius: Radius.input,
    borderWidth: 1,
    paddingHorizontal: Layout.fieldPaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  budgetInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    paddingVertical: 0,
  },
  container: { flex: 1 },
  safeArea: { flex: 1 },
  /*
   * Root 1Depth 제목 — 홈 · 검색 · Pick · MY와 같은 56 · 좌우 24 · 26/700
   * (`root-header-contract.test.ts`). DESIGN_UNRESOLVED: note.js `head`는
   * `padding:20px 24px 16px;align-items:baseline`(높이 71)이라 공통 계약과 다르다.
   */
  header: {
    height: Layout.navBar,
    paddingHorizontal: Layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
  },
  /* 헤더에는 현재 탭의 추가 행동 하나만 둔다. */
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Layout.inlineGap },
  scroll: { flex: 1 },
  /* note.jsx 세 탭 프레임 끝의 `height:40px` 빈 칸. 40은 같은 값의 `LineHeight.lh40`. */
  scrollContent: { paddingBottom: LineHeight.lh40 },

  bold: { fontWeight: 700 },
  /* note.js `h1` — 26/35/700. 35는 같은 값의 `LineHeight.t2`. */
  rootTitle: { lineHeight: LineHeight.t2, letterSpacing: LetterSpacing.n065 },
  regular: { fontWeight: 400 },
  /* 규격서의 굵기 600 · 500 — spec/tokens.json typography.$weights의 피그마 예외. */
  semibold: { fontWeight: 600 },
  medium: { fontWeight: 500 },
  grow: { flex: 1, minWidth: 0 },
  strike: { textDecorationLine: 'line-through' },
  pressed: { opacity: 0.6 },

  /*
   * v3.29.1 정본 `React_Native/note.jsx` `tabNav`/`seg()`(WP-NOTE-001) —
   * `flex:0 0 auto;gap:0;padding:0 20px;box-shadow:inset 0 -1px 0 BORDER;margin-bottom:16px`,
   * 칸 `flex:1;height:48px;font:16/700`. 활성 칸은 배경이 아니라
   * `box-shadow:inset 0 -2px 0 INK`(하단 밑줄)로 표시하고 비활성은 회색 글자다.
   * 예전 규격서의 회색 필 세그먼트(둥근 흰 활성 칸)는 정본에 없다 — 지웠다.
   */
  tabs: {
    paddingHorizontal: Layout.cardPadding,
    marginBottom: Spacing.three,
    borderBottomWidth: Border.hairline,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    height: Layout.tabEmphasized,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    marginBottom: -Border.hairline,
  },

  /* WP-NOTE-004/006 카드: 좌우 24 · 안쪽 20 · radius 10. */
  panel: {
    marginHorizontal: Layout.pageX,
    borderRadius: Radius.medium,
    borderWidth: Border.hairline,
    padding: Layout.cardPadding,
  },

  // ── 웨딩노트 · 처음(WP-EMPTY-NOTE) ──
  /* common.js `navBar` — `flex:0 0 56px;padding:0 16px;box-shadow:inset 0 -1px 0 BORDER`, back 없는 루트라 제목 왼쪽 26/700. */
  emptyNav: {
    height: Layout.navBar,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: Border.hairline,
    flexDirection: 'row',
    alignItems: 'center',
  },
  /* `wrapStyle` — `padding:0 20px 24px;gap:12px`. */
  emptySection: { paddingHorizontal: Layout.cardPadding, paddingBottom: Spacing.four, gap: Layout.inlineGap },
  /* `emptyCard` — `border-radius:12px;background:REC;padding:32px 20px;gap:6px`, 가운데 정렬. */
  emptyCard: {
    borderRadius: 12,
    paddingVertical: Spacing.five,
    paddingHorizontal: Layout.cardPadding,
    alignItems: 'center',
    gap: Layout.menuGroupGap,
  },
  /* `empt().ctaStyle` — `margin-top:12px;height:44px;padding:0 18px;border-radius:8px;background:P`. */
  emptyCta: {
    marginTop: Layout.inlineGap,
    height: Layout.touchTarget,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* `dataRow` — `min-height:52px;box-shadow:inset 0 -1px 0 BORDER`, 양끝 정렬. */
  emptyDataRow: {
    minHeight: Layout.field,
    borderBottomWidth: Border.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
  },

  // ── 캘린더 — v3.29 주 단위 흐름 ──
  calendarStack: { gap: 0 },
  /* WP-NOTE-001 D-day: margin 4px 24px 0 · padding 18px 20px · radius 12. */
  ddayCard: {
    marginHorizontal: Layout.pageX,
    marginTop: Spacing.one,
    paddingVertical: Layout.cardPaddingCompactY,
    paddingHorizontal: Layout.cardPadding,
    borderRadius: 12,
    gap: 5,
  },
  /* D-day 카드 위 줄 — 날짜 · D-N 양끝 정렬. */
  ddayTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Layout.inlineGap },
  ddayValue: { fontSize: FontSize.noteDday },
  /* note.js `decidedLinkRow` «예약현황 4/12» — `margin-top:10px;padding-top:10px`, 선 위 · 양끝 정렬. */
  decidedLinkRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: Border.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  /* WP-NOTE-001 지난 일정: 좌우 24 · 최소 46 · 아래 구분선. */
  pastRow: {
    marginHorizontal: Layout.pageX,
    minHeight: 46,
    borderBottomWidth: Border.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineGroup: { marginHorizontal: Layout.pageX },
  timelineGroupHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two, paddingTop: 18, paddingBottom: 10 },
  /* note.js `tlRow` — `gap:12px;padding-bottom:8px`. */
  timelineRow: { flexDirection: 'row', gap: Layout.inlineGap, paddingBottom: Spacing.two },
  timelineRail: { width: 12, alignItems: 'center', gap: 6 },
  timelineDot: { width: 9, height: 9, borderRadius: Radius.pill, marginTop: 16 },
  weddingDot: { width: 12, height: 12 },
  timelineLine: { flex: 1, width: 1, minHeight: 6 },
  eventRow: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 3,
  },
  /* note.js `tlItem(…'wed')` — `box-shadow:inset 0 0 0 1.5px P`. */
  weddingRow: { borderWidth: 1.5 },

  // ── 예산현황 ──
  budgetSummary: {},
  budgetSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  budgetSummaryCol: { flex: 1, minWidth: 0, gap: Spacing.one },
  /* note.js `sumBig` 30/40/700. 40은 같은 값의 `LineHeight.lh40`. */
  sumBig: { lineHeight: LineHeight.lh40 },
  /* note.js `sumRightBtn` — `gap:5px`. */
  budgetEditRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  budgetSummaryNote: { marginTop: Spacing.two },
  /* note.js `divider` — `margin:20px 0;height:1px;background:BORDER`. */
  divider: { marginVertical: Layout.listGap, height: Border.hairline },
  /* note.js `bRow` — `flex-direction:column;gap:6px;padding-bottom:16px`. */
  bucketRow: { gap: Layout.menuGroupGap, paddingBottom: Spacing.three },
  /* note.js `bTop` — `gap:8px`. */
  bucketHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  /* note.js `trackSm` — 6px · pill · SEC. */
  bar: { height: BAR_HEIGHT, borderRadius: Radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: Radius.pill },
  /* note.js `bFoot` — `align-items:baseline;justify-content:space-between`. */
  bucketFoot: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  /* note.js `spendGoRow` — 최소 높이 44 · 양끝 정렬 · 14/700. 선은 위 `divider`. */
  spendLink: {
    minHeight: Layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
  },

  // ── 상담기록 ──
  /* note.js `cListHead` — `gap:3px`. */
  consultHead: { gap: 3 },
  center: { textAlign: 'center' },
  /* note.js `uploadBox` — `margin-top:8px;padding:28px 20px;border-radius:10px;border:1px dashed #dcdee3;gap:6px`. */
  consultEmpty: {
    marginTop: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: Border.hairline,
    borderStyle: 'dashed',
    paddingVertical: 28,
    paddingHorizontal: Layout.cardPadding,
    alignItems: 'center',
    gap: Layout.menuGroupGap,
  },
  /* note.js `cRow` — `gap:12px;min-height:60px;padding:14px 0;border-bottom:1px solid SEC`(마지막 행 포함). */
  consultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    minHeight: 60,
    paddingVertical: 14,
    borderBottomWidth: Border.hairline,
  },
  consultMeta: { marginTop: 3 },
});
