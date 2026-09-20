/**
 * 웨딩노트 — WP-OUR-001.
 *
 * 피그마 `OurWedding.tsx`(2026-09-14 정본 · 최상위 규칙 1)대로 그린다. 제목 → 세 칸 탭
 * (캘린더 · 상담기록 · 예산현황) → 탭마다 패널 하나(radius 26 · 테두리 · 안쪽 20).
 * 추가 동작은 정본대로 헤더 우측 텍스트 액션에 둔다. 우하단 FAB는 쓰지 않는다. 그 앞에는 루트 시안의 D-Day 히어로 · 다음 일정 · 지출 상자 · 우리둘 카드가
 * 있었다 — 피그마가 그 자리를 이긴다. 예식 뒤 화면(`WeddingCompleteView`)은 피그마에
 * 없으므로 기존 정본 그대로다(최상위 규칙 3).
 *
 * **피그마를 그대로 옮기지 않은 것.**
 * - 영문 eyebrow(«OUR CALENDAR» 등)는 걷어낸다(인수인계 C-9).
 * - 일정의 완료 표시는 누르지 않는다 — `status`는 서버가 시각으로 계산한다
 *   (`weddingEventStatusSchema` 주석). 지난 일정이 «완료»다.
 * - 일정 · 지출의 추가와 일정 수정은 정본대로 **BottomSheet**에서 처리한다.
 *   딥링크 route는 유지하지만 부모 목록/상세를 배경으로 남기고 시트만 연다.
 * - 예산현황의 항목별 «집행 / 예산»은 서버가 항목별 예산을 주지 않는다(`buckets`는 집행
 *   금액과 비율뿐). 막대는 전체 지출 중 비율이고 오른쪽 수는 집행 금액이다. 항목별
 *   수정 · 삭제 단추도 그래서 없다.
 * - 상담기록은 목록만 여기 있고, 올리기 · 확인 · 저장은 기존 상담기록 화면이 한다.
 *   «AI 분석 중» 같은 말은 쓰지 않는다(용어 규칙).
 */
import { FullScreenError } from '@/features/errors/full-screen-error';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { confirmAlert } from '@/components/confirm-alert';
import type {
  ConsultationRecord,
  CurrentUser,
  ExpenseSummaryResponse,
  WeddingEvent,
} from '@weddingpick/api-contract';
import { TERMS, isBeforeWedding, lifecycle, manwon } from '@weddingpick/domain';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Border,
  Elevation,
  Layout,
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
  listWeddingEvents,
  removeWeddingEvent,
  setBudget,
} from '@/api/client';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';
import { useSession } from '@/features/auth/use-session';
import { WeddingCompleteView } from '@/features/wedding/complete-view';
import { eventTime } from '@/features/wedding/screen-kit';

type Tab = 'calendar' | 'consult' | 'budget';

/* 문구 — spec/strings.ko.json `ourWedding`. 피그마 `OurWedding.tsx`에서 왔다. */
const TABS: readonly { key: Tab; label: string }[] = [
  { key: 'calendar', label: '캘린더' },
  { key: 'consult', label: '상담기록' },
  { key: 'budget', label: '예산현황' },
];
const CALENDAR_HINT = '빈 날짜를 누르면 일정을 바로 추가해요';
const ADD_FOR_DAY = '이 날짜에 일정을 추가해요';
const DONE = '완료';
const PREV_MONTH = '이전 달';
const NEXT_MONTH = '다음 달';
const EDIT = '수정';
const DELETE = '삭제';
const DELETE_TITLE = '삭제할까요?';
const UNPAID = '미집행';
const CONSULT_EMPTY_TITLE = '녹음 파일을 올려주세요';
const CONSULT_EMPTY_BODY = '휴대폰 녹음앱에서 저장한 파일이면 돼요';
const CONSULT_SAVED = '저장됨';
const CONSULT_PENDING = '확인 필요';
const ADD_LABEL: Record<Tab, string> = { calendar: '추가', budget: '추가', consult: '녹음 올리기' };
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 진행바 값 — 피그마 `h-2`(8). 예산 정본은 원형 그래프를 쓰지 않는다. */
const BAR_HEIGHT = 8;
const EVENT_DOT = 4;

const pad = (value: number) => String(value).padStart(2, '0');
const dayKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

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
  const [consults, setConsults] = useState<ConsultationRecord[] | null>(null);
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
        // 세 목록은 따로 도착한다 — 가장 느린 것이 나머지를 가리지 않게 각각 반영한다.
        void listWeddingEvents(weddingId).then((r) => { if (active) setEvents(r.events); }).catch(() => undefined);
        void getExpenses(weddingId).then((r) => { if (active) setExpenses(r); }).catch(() => undefined);
        void listConsultations(weddingId).then((r) => { if (active) setConsults(r.records); }).catch(() => undefined);
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

  const header = (
    <View style={styles.header}>
      <ThemedText type="f28" style={styles.bold}>
        {TERMS.ourWedding}
      </ThemedText>
      {!weddingOver && weddingId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ADD_LABEL[tab]}
          onPress={onAddAction}
          hitSlop={Spacing.two}
          style={({ pressed }) => (pressed ? styles.pressed : null)}>
          <ThemedText type="f15" themeColor="tint" style={styles.bold}>
            {ADD_LABEL[tab]}
          </ThemedText>
        </Pressable>
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

  function onAddAction() {
    if (!weddingId) return;
    if (tab === 'calendar') router.push(`/wedding/${weddingId}/events/new` as never);
    else if (tab === 'budget') router.push(`/wedding/${weddingId}/expenses/add` as never);
    else router.push(`/wedding/${weddingId}/consultations/upload` as never);
  }

  const budgetManwon = Number(budgetDraft.replace(/[^\d]/g, ''));
  const budgetAmount = budgetManwon * 10_000;
  const budgetReady = Number.isFinite(budgetManwon) && budgetManwon > 0;

  async function saveInitialBudget() {
    if (!weddingId || !budgetReady || budgetSaving) return;
    setBudgetSaving(true);
    try {
      await setBudget(weddingId, budgetAmount);
      const next = await getExpenses(weddingId);
      setExpenses(next);
      setBudgetOpen(false);
    } catch {
      setToast('예산을 등록하지 못했어요. 다시 시도해주세요.');
    } finally {
      setBudgetSaving(false);
    }
  }

  async function deleteEvent(event: WeddingEvent) {
    if (!weddingId) return;
    try {
      await removeWeddingEvent(weddingId, event.id);
      setEvents((prev) => (prev ? prev.filter((item) => item.id !== event.id) : prev));
    } catch {
      setToast('일정을 지우지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {header}

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 세 칸 탭 — 피그마 `grid grid-cols-3 rounded-2xl bg-secondary p-1`, 칸 `h-11 rounded-xl`. 켠 칸은 흰 면(그림자는 없다 — elevation.$rule). */}
          <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.backgroundElement }]}>
            {TABS.map((item) => {
              const selected = item.key === tab;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.label}
                  onPress={() => setTab(item.key)}
                  style={[styles.tab, selected ? [{ backgroundColor: theme.background }, Elevation.figmaCard] : null]}>
                  <ThemedText type="f14" style={[styles.bold, { color: selected ? theme.text : theme.textAssistive }]}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {tab === 'calendar' ? (
            <CalendarPanel
              events={events ?? []}
              onAdd={(date) =>
                weddingId ? router.push({ pathname: `/wedding/${weddingId}/events/new`, params: { date } } as never) : null
              }
              onEdit={(event) => (weddingId ? router.push(`/wedding/${weddingId}/events/${event.id}` as never) : null)}
              onDelete={(event) =>
                confirmAlert(DELETE_TITLE, `"${event.title}" 일정을 삭제합니다.`, [
                  { text: '취소', style: 'cancel' },
                  { text: '삭제하기', style: 'destructive', onPress: () => void deleteEvent(event) },
                ])
              }
            />
          ) : tab === 'budget' ? (
            <BudgetPanel expenses={expenses} />
          ) : (
            <ConsultPanel
              records={consults ?? []}
              onUpload={() =>
                weddingId ? router.push(`/wedding/${weddingId}/consultations/upload` as never) : null
              }
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
        dismissible={false}
        onRequestClose={() => undefined}
        testID="initial-budget-sheet">
        <SheetPanel style={styles.budgetSheet}>
          <ThemedText type="t3">예산을 먼저 등록해주세요</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            예산현황을 보려면 전체 예산이 필요해요. 등록한 뒤에는 언제든 바꿀 수 있어요.
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
            label={budgetSaving ? '등록하는 중…' : '예산 등록'}
            disabled={!budgetReady || budgetSaving}
            onPress={() => void saveInitialBudget()}
          />
        </SheetPanel>
      </BottomSheet>

      <Toast message={toast} onHidden={() => setToast(null)} />
    </ThemedView>
  );
}

/* ────────────────────────────────────────────
   캘린더 패널 — 달 제목 24/700 · ‹ 안내 › · 요일 · 날짜 격자(40 원) · 선 · 그날 일정
──────────────────────────────────────────── */
function CalendarPanel({
  events,
  onAdd,
  onEdit,
  onDelete,
}: {
  events: WeddingEvent[];
  onAdd: (date: string) => void;
  onEdit: (event: WeddingEvent) => void;
  onDelete: (event: WeddingEvent) => void;
}) {
  const theme = useTheme();
  const [today] = useState(() => new Date());
  const [cursor, setCursor] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }));
  const [selected, setSelected] = useState(() => dayKey(today));

  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay();
  const dayCount = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from<null>({ length: firstWeekday }).fill(null),
    ...Array.from({ length: dayCount }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));

  const keyOf = (day: number) => `${cursor.year}-${pad(cursor.month + 1)}-${pad(day)}`;
  const eventDays = new Set(events.map((event) => dayKey(new Date(event.startsAt))));
  const dayEvents = events
    .filter((event) => dayKey(new Date(event.startsAt)) === selected)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  function move(delta: number) {
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  /* 피그마 `selectDate`: 날짜를 고르고, 그날 일정이 없으면 바로 추가로 간다. */
  function selectDay(day: number) {
    const key = keyOf(day);
    setSelected(key);
    if (!eventDays.has(key)) onAdd(key);
  }

  return (
    <View style={[styles.panel, { backgroundColor: theme.background, borderColor: theme.border }]}>
      {/* 규격서: 달 «24/700 · lh 32». */}
      <ThemedText type="f24" style={styles.bold}>{`${cursor.year}년 ${cursor.month + 1}월`}</ThemedText>

      <View style={styles.monthNav}>
        <Pressable accessibilityRole="button" accessibilityLabel={PREV_MONTH} onPress={() => move(-1)} style={styles.navBtn}>
          <ProductSymbol name="chevronLeft" size={Layout.iconRow} color={theme.text} />
        </Pressable>
        {/* 규격서: «11/400 #868B94 · lh 17». */}
        <ThemedText type="f11" themeColor="textAssistive">
          {CALENDAR_HINT}
        </ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel={NEXT_MONTH} onPress={() => move(1)} style={styles.navBtn}>
          <ProductSymbol name="chevronRight" size={Layout.iconRow} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((label) => (
          <View key={label} style={styles.weekCell}>
            {/* 규격서: 요일 «10/600 #868B94 · lh 15». */}
            <ThemedText type="f10" themeColor="textAssistive" style={styles.semibold}>
              {label}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map((day, cellIndex) => {
              if (day === null) return <View key={`b${cellIndex}`} style={styles.dayCell} />;
              const key = keyOf(day);
              const isSelected = key === selected;
              const hasEvent = eventDays.has(key);
              return (
                <View key={key} style={styles.dayCell}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${cursor.month + 1}월 ${day}일`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => selectDay(day)}
                    style={[styles.dayCircle, isSelected ? { backgroundColor: theme.text } : null]}>
                    {/* 규격서: 날짜 «12/500 · lh 16». */}
                    <ThemedText type="f12" style={[styles.medium, { color: isSelected ? theme.onInk : theme.text }]}>
                      {day}
                    </ThemedText>
                    {hasEvent ? (
                      <View style={[styles.eventDot, { backgroundColor: isSelected ? theme.onInk : theme.text }]} />
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <View style={[styles.dayList, { borderTopColor: theme.border }]}>
        {dayEvents.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ADD_FOR_DAY}
            onPress={() => onAdd(selected)}
            style={[styles.addForDay, { borderColor: theme.border }]}>
            <ProductSymbol name="calendar" size={Layout.iconField} color={theme.textAssistive} />
            <ThemedText type="t7" themeColor="textAssistive">
              {ADD_FOR_DAY}
            </ThemedText>
          </Pressable>
        ) : (
          <View style={styles.eventList}>
            {dayEvents.map((event) => {
              const done = event.status === 'done';
              return (
                <View
                  key={event.id}
                  style={[styles.eventRow, { backgroundColor: done ? theme.backgroundSelected : theme.backgroundElement }]}>
                  {/* 완료 표시 — 서버가 시각으로 정한다. 누르는 자리가 아니다. */}
                  <View
                    style={[
                      styles.doneMark,
                      done
                        ? { backgroundColor: theme.text, borderColor: theme.text }
                        : { borderColor: theme.textAssistive, opacity: 0.4 },
                    ]}>
                    {done ? <ProductSymbol name="check" size={Layout.iconMicro} color={theme.onInk} /> : null}
                  </View>
                  {/* 규격서: 일정 «14/600 · lh 20» · 시각 «11/400 #868B94 · lh 17». */}
                  <ThemedText
                    type="f14"
                    numberOfLines={1}
                    themeColor={done ? 'textAssistive' : undefined}
                    style={[styles.semibold, styles.eventTitle, done ? styles.strike : null]}>
                    {event.title}
                  </ThemedText>
                  {done ? (
                    <View style={[styles.doneBadge, { backgroundColor: theme.backgroundSelected }]}>
                      <ThemedText type="micro" themeColor="textAssistive" style={styles.bold}>
                        {DONE}
                      </ThemedText>
                    </View>
                  ) : null}
                  <ThemedText type="f11" themeColor="textAssistive" numeric>
                    {eventTime(event.startsAt)}
                  </ThemedText>
                  <View style={styles.rowActions}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${event.title} ${EDIT}`} onPress={() => onEdit(event)} style={styles.rowActionBtn}>
                      <ProductSymbol name="edit" size={Layout.iconSmall} color={theme.textAssistive} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${event.title} ${DELETE}`} onPress={() => onDelete(event)} style={styles.rowActionBtn}>
                      <ProductSymbol name="trash" size={Layout.iconSmall} color={theme.textAssistive} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────
   예산현황 패널 — 총 사용액 · 총 예산 · 가로 진행바 8 · 잔여/사용률 · 항목별 막대
   04-wedding-note 정본은 원형 그래프를 쓰지 않는다.
──────────────────────────────────────────── */
function BudgetPanel({ expenses }: { expenses: ExpenseSummaryResponse | null }) {
  const theme = useTheme();
  const budget = expenses?.budget;
  const set = budget?.set === true ? budget : null;
  const total = set?.budget ?? 0;
  const spent = set?.spent ?? expenses?.paidTotal ?? 0;
  const percentage = total > 0 ? Math.round((spent / total) * 100) : 0;
  const progress = Math.max(0, Math.min(100, percentage));
  const buckets = expenses?.buckets ?? [];

  return (
    <View style={[styles.panel, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <ThemedText type="t6" style={styles.bold}>
        {TABS[2].label}
      </ThemedText>

      {set ? (
        <View style={styles.budgetSummary}>
          <View style={styles.budgetSummaryRow}>
            <ThemedText type="amount" numeric style={styles.bold}>
              {manwon(spent)}
            </ThemedText>
            <ThemedText type="t7" themeColor="textAssistive" numeric>
              {`예산 ${manwon(total)}`}
            </ThemedText>
          </View>
          <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.barFill, { width: `${progress}%`, backgroundColor: theme.tint }]} />
          </View>
          <ThemedText type="t7" themeColor="textAssistive" numeric style={styles.budgetSummaryNote}>
            {`${manwon(Math.max(set.remaining, 0))} 남았어요 · ${percentage}% 썼어요`}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.budgetSummary}>
          <ThemedText type="t6" style={styles.bold}>
            {budget?.set === false ? budget.note : '예산을 아직 정하지 않았어요'}
          </ThemedText>
          <ThemedText type="t7" themeColor="textAssistive" numeric>
            {`${manwon(spent)} 사용`}
          </ThemedText>
        </View>
      )}

      <View style={[styles.bucketList, { borderTopColor: theme.border }]}>
        {buckets.map((bucket) => {
          const pct = Math.min(100, Math.round(bucket.ratio * 100));
          return (
            <View key={bucket.bucket}>
              <View style={styles.bucketHead}>
                <ThemedText type="t7" numberOfLines={1} style={[styles.bold, styles.grow]}>
                  {bucket.label}
                </ThemedText>
                <ThemedText type="micro" themeColor="textAssistive" numeric style={styles.regular}>
                  {manwon(bucket.amount)}
                </ThemedText>
              </View>
              <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: theme.text }]} />
              </View>
              <View style={styles.bucketFoot}>
                <ThemedText type="micro" themeColor="textAssistive" numeric style={styles.regular}>
                  {bucket.amount > 0 ? `${manwon(bucket.amount)} 집행` : UNPAID}
                </ThemedText>
                <ThemedText type="micro" numeric style={styles.bold}>
                  {`${pct}%`}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>

      <View style={[styles.proofInvite, { borderTopColor: theme.border }]}>
        <View style={styles.grow}>
          <ThemedText type="f14" style={styles.bold}>
            등록한 지출을 Pick 인증해볼까요?
          </ThemedText>
          <ThemedText type="f12" themeColor="textAssistive">
            인증되면 실 제보에 반영돼요
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick 인증"
          onPress={() => router.push('/capture/payment/consent' as never)}
          style={({ pressed }) => [
            styles.proofButton,
            { backgroundColor: theme.tint },
            pressed ? styles.pressed : null,
          ]}>
          <ThemedText type="f13" style={[styles.bold, { color: theme.onTint }]}>
            Pick 인증
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────
   상담기록 패널 — 행: 업체 · 날짜 · 금액 / 상태. 비면 점선 상자.
──────────────────────────────────────────── */
function ConsultPanel({
  records,
  onUpload,
  onOpen,
}: {
  records: ConsultationRecord[];
  onUpload: () => void;
  onOpen: (record: ConsultationRecord) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.panel, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={styles.consultHead}>
        <ThemedText type="t6" style={styles.bold}>
          {records.length > 0 ? `상담 ${records.length}건` : TABS[1].label}
        </ThemedText>
        <ThemedText type="micro" themeColor="textAssistive" style={styles.regular}>
          정리된 내용은 예산에 반영해요
        </ThemedText>
      </View>

      {records.length > 0 ? (
        <View style={[styles.consultList, { borderTopColor: theme.border }]}>
          {records.map((record, index) => {
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
                style={[
                  styles.consultRow,
                  index < records.length - 1 ? { borderBottomWidth: Border.hairline, borderBottomColor: theme.border } : null,
                ]}>
                <View style={styles.grow}>
                  <ThemedText type="t7" numberOfLines={1} style={styles.bold}>
                    {record.vendorLabel ?? '업체 미확인'}
                  </ThemedText>
                  <ThemedText type="micro" themeColor="textAssistive" numeric style={[styles.regular, styles.consultMeta]}>
                    {meta}
                  </ThemedText>
                </View>
                <ThemedText
                  type="micro"
                  themeColor={saved ? undefined : 'textAssistive'}
                  style={saved ? styles.bold : styles.regular}>
                  {saved ? CONSULT_SAVED : CONSULT_PENDING}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={CONSULT_EMPTY_TITLE}
        onPress={onUpload}
        style={[styles.consultEmpty, { borderColor: theme.border }]}>
        <ProductSymbol name="mic" size={Layout.iconRow} color={theme.textAssistive} />
        <ThemedText type="t7" themeColor="textAssistive">
          {CONSULT_EMPTY_TITLE}
        </ThemedText>
        <ThemedText type="micro" themeColor="textAssistive" style={styles.regular}>
          {CONSULT_EMPTY_BODY}
        </ThemedText>
      </Pressable>
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
   스타일 — 값은 피그마 `OurWedding.tsx`(2026-09-14 정본). 12 · 14 · 20 · 36 · 40처럼
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
  /* 제목 `px-5 pb-5 pt-6` — 좌우는 정본 24 · 위 24 · 아래 20(같은 값의 listGap). 28은 스케일에 없어 t2(26)다. */
  /* 규격서 our-wedding.txt 「header 430×86 pad 24 20 20 20」 · 제목 «28/700 · lh 42». */
  header: {
    paddingHorizontal: Layout.pageX,
    paddingTop: Spacing.four,
    paddingBottom: Layout.listGap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
  },
  scroll: { flex: 1 },
  /* 우하단 FAB가 없으므로 탭바 앞의 일반 문서 여백만 둔다. */
  scrollContent: { paddingBottom: Spacing.four },

  bold: { fontWeight: 700 },
  regular: { fontWeight: 400 },
  /* 규격서의 굵기 600 · 500 — spec/tokens.json typography.$weights의 피그마 예외. */
  semibold: { fontWeight: 600 },
  medium: { fontWeight: 500 },
  grow: { flex: 1, minWidth: 0 },
  strike: { textDecorationLine: 'line-through' },
  pressed: { opacity: 0.6 },

  /* 탭 `mx-5 rounded-2xl p-1`, 칸 `h-11 rounded-xl`. */
  /* 규격서 「nav 390×52 pad 4 · mar 0 20 0 20 · bg #F7F8F9 · r16」, 칸 «127×44 · r22 · 14/700 · 켠 칸 흰 면 + shadow». */
  tabs: {
    marginHorizontal: Layout.pageX,
    borderRadius: Radius.cardLarge,
    padding: Spacing.one,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    height: Layout.touchTarget,
    borderRadius: Radius.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 패널 `mx-5 mt-4 rounded-[26px] border p-5`. */
  panel: {
    marginHorizontal: Layout.pageX,
    marginTop: Spacing.three,
    borderRadius: Radius.panel,
    borderWidth: Border.hairline,
    padding: Layout.cardPadding,
  },

  // ── 캘린더 ──
  /* `mt-4 flex items-center justify-between`, 단추 `h-9 w-9 rounded-full`. */
  monthNav: {
    marginTop: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: Layout.headerBack,
    height: Layout.headerBack,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 요일 `mt-4 grid grid-cols-7`. */
  weekRow: { marginTop: Spacing.three, flexDirection: 'row' },
  weekCell: { flex: 1, alignItems: 'center' },
  /* 날짜 `mt-2 grid grid-cols-7`, 칸 `h-10 w-10 rounded-full`. */
  grid: { marginTop: Spacing.two },
  gridRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center' },
  dayCircle: {
    width: Layout.controlMedium,
    height: Layout.controlMedium,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 일정 점 `absolute bottom-1.5 h-1 w-1` — 4 · 아래 6(같은 값의 menuGroupGap). */
  eventDot: {
    position: 'absolute',
    bottom: Layout.menuGroupGap,
    width: EVENT_DOT,
    height: EVENT_DOT,
    borderRadius: Radius.pill,
  },
  /* 그날 일정 `mt-5 border-t pt-4`. */
  dayList: {
    marginTop: Layout.listGap,
    paddingTop: Spacing.three,
    borderTopWidth: Border.hairline,
  },
  /* 빈 날 `rounded-2xl border border-dashed py-5 gap-2`. */
  addForDay: {
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    borderStyle: 'dashed',
    paddingVertical: Layout.listGap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  eventList: { gap: Spacing.two },
  /* 행 `rounded-2xl px-3.5 py-3 gap-3` — 좌우 14(같은 값의 chipPaddingX) · 상하 12 · 사이 12. */
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    borderRadius: Radius.cardLarge,
    paddingHorizontal: Layout.chipPaddingX,
    paddingVertical: Layout.inlineGap,
  },
  /* 완료 원 `h-6 w-6 rounded-full border-2` — 24(같은 값의 iconTab) · 테두리 2. */
  doneMark: {
    width: Layout.iconTab,
    height: Layout.iconTab,
    borderRadius: Radius.pill,
    borderWidth: Border.focus,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  eventTitle: { flex: 1, minWidth: 0 },
  /* «완료» `rounded-full px-2 py-0.5`. */
  doneBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  /* 수정 · 삭제 `h-8 w-8 rounded-xl`(32 · 같은 값의 avatarRow), 사이 2. */
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half },
  rowActionBtn: {
    width: Layout.avatarRow,
    height: Layout.avatarRow,
    borderRadius: Radius.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 예산현황 ──
  /* 정본 sumRow + track + sumNote. 원형 그래프를 쓰지 않는다. */
  budgetSummary: { marginTop: Spacing.three },
  budgetSummaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
    marginBottom: Spacing.three,
  },
  budgetSummaryNote: { marginTop: Spacing.two },
  /* 항목 `mt-6 space-y-5 border-t pt-5`. */
  bucketList: {
    marginTop: Spacing.four,
    paddingTop: Layout.listGap,
    borderTopWidth: Border.hairline,
    gap: Layout.listGap,
  },
  bucketHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.two },
  /* 막대 `h-2 rounded-full`. */
  bar: { height: BAR_HEIGHT, borderRadius: Radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: Radius.pill },
  /* `mt-1.5 flex justify-between`. */
  bucketFoot: { marginTop: Layout.menuGroupGap, flexDirection: 'row', justifyContent: 'space-between' },
  proofInvite: {
    marginTop: Layout.listGap,
    paddingTop: Layout.listGap,
    borderTopWidth: Border.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
  },
  proofButton: {
    height: 36,
    paddingHorizontal: Layout.chipPaddingX,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── 상담기록 ──
  consultHead: { gap: Spacing.half },
  /* 업로드 `mt-5 rounded-2xl border-dashed py-8 gap-2`. 기록이 있어도 정본대로 마지막에 둔다. */
  consultEmpty: {
    marginTop: Layout.listGap,
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    borderStyle: 'dashed',
    paddingVertical: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  /* 목록 `mt-1 border-t`, 행 `py-4 gap-3`. */
  consultList: { marginTop: Spacing.one, borderTopWidth: Border.hairline },
  consultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    paddingVertical: Spacing.three,
  },
  consultMeta: { marginTop: Spacing.half },
});
