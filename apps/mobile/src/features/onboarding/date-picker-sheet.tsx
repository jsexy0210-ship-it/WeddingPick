import { dDay, formatDateDot } from '@weddingpick/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ActionButton, Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';
import { BottomSheet, SHEET_PANEL } from '@/features/common/bottom-sheet';

import {
  CALENDAR_MUTED,
  CALENDAR_SATURDAY,
  CALENDAR_SUNDAY,
  MONTHS,
  WEEKDAYS,
  chunk,
  firstSelectable,
  isDaySelectable,
  isMonthSelectable,
  monthCells,
  normalizeDate,
  splitIso,
  toIso,
  yearOptions,
  type CalendarCell,
  type PickedDate,
} from './calendar';
import { ddayLabel } from './flow';

/**
 * 날짜 선택 시트(WP-APP-023). SPEC §13.7 «날짜 선택 · 연월 셀렉트».
 *
 *   예식일 선택                    ✕
 *   [2027년 ▾]  [5월 ▾]             셀렉트 2개 · 52
 *    일 월 화 수 목 금 토             요일 헤더 28
 *    25 26 27 28 29 30  1            날짜 셀 40 · 타월은 옅게
 *    …  16  …                        선택일 코랄 원 · 흰 700
 *   2027.05.16(토)              D-250
 *   [       이 날짜로 정하기       ]  width 100% · flex 0 0
 *
 * **연 · 월은 셀렉트로 바로 고르고 일만 달력에서 찍는다.** 좌우 화살표로 달을 넘기지
 * 않는다 — 웨딩은 1~2년 뒤를 고르는 경우가 많아 화살표로는 탭이 12~24번 필요하다.
 * 연도를 누르면 올해부터 5년 뒤까지 4열 격자, 월을 누르면 4열 12칸이 달력 자리에
 * 펼쳐진다. **두 번 탭으로 어느 달이든 간다.**
 *
 * 연 · 월을 바꿔 없는 날짜가 되면 그 달 마지막 날로 당긴다(`normalizeDate`). 오늘
 * 포함 과거와 첫 날 앞의 달은 비활성이다 — 목록에서 빼지 않고 옅게 그린다.
 *
 * 색은 `calendar.ts`의 상수다(일요일 · 토요일 · 타월 — tokens.json에 달력 항목이 없다).
 * CTA 높이는 토큰 size.ctaPrimary 52(시안 56)이고 `flexGrow 0 · flexShrink 0 · width 100%`
 * 라 세로 컨테이너에서 늘어나지 않는다.
 */
export function DatePickerSheet({
  visible,
  value,
  onConfirm,
  onDismiss,
  today = new Date(),
}: {
  visible: boolean;
  /** 이미 고른 날. 시트는 그 달을 펼치고 그 날을 켠 채 연다. */
  value: string | null;
  onConfirm: (iso: string) => void;
  onDismiss: () => void;
  /** 테스트와 시안 재현이 오늘을 정할 수 있게 받는다. */
  today?: Date;
}) {
  return (
    /* BottomSheet는 닫히면 children을 통째로 내린다 — 열 때마다 새로 마운트되어 지난번 펼쳐 놓고 닫은 격자가 남지 않는다. */
    <BottomSheet visible={visible} onRequestClose={onDismiss}>
      <SheetBody value={value} today={today} onConfirm={onConfirm} onDismiss={onDismiss} />
    </BottomSheet>
  );
}

type Expanded = 'year' | 'month' | null;

function SheetBody({
  value,
  today,
  onConfirm,
  onDismiss,
}: {
  value: string | null;
  today: Date;
  onConfirm: (iso: string) => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const first = firstSelectable(today);

  const [picked, setPicked] = useState<PickedDate>(() => {
    const from = value ? splitIso(value) : null;

    /* 고른 날이 없으면 고를 수 있는 첫 날(내일)에서 시작한다 — 짐작으로 날을 정하지 않는다. */
    return normalizeDate(from ?? first, first);
  });
  const [expanded, setExpanded] = useState<Expanded>(null);

  const years = yearOptions(today).filter((year) => year >= first.year);
  const iso = toIso(picked.year, picked.month, picked.day);
  const remaining = dDay(iso, today);

  function pickYear(year: number) {
    setPicked((current) => normalizeDate({ ...current, year }, first));
    setExpanded(null);
  }

  function pickMonth(month: number) {
    setPicked((current) => normalizeDate({ ...current, month }, first));
    setExpanded(null);
  }

  function pickDay(cell: CalendarCell) {
    setPicked({ year: cell.year, month: cell.month, day: cell.day });
  }

  return (
    <ThemedView style={[SHEET_PANEL, styles.sheet, { paddingBottom: SHEET_BOTTOM_PADDING + Math.max(insets.bottom, 0) }]}>
      <View style={styles.head}>
        <ThemedText type="t4">예식일 선택</ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onDismiss} style={styles.close}>
          <Svg width={Layout.iconTab} height={Layout.iconTab} viewBox="0 0 24 24" fill="none">
            <Path d="M6 6l12 12M18 6L6 18" stroke={theme.text} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <View style={styles.selects}>
        <Select
          label={`${picked.year}년`}
          accessibilityLabel="연도 선택"
          open={expanded === 'year'}
          onPress={() => setExpanded((current) => (current === 'year' ? null : 'year'))}
        />
        <Select
          label={`${picked.month}월`}
          accessibilityLabel="월 선택"
          open={expanded === 'month'}
          onPress={() => setExpanded((current) => (current === 'month' ? null : 'month'))}
        />
      </View>

      {expanded === 'year' ? (
        <OptionGrid
          options={years.map((year) => ({ key: year, label: `${year}년`, disabled: false }))}
          selected={picked.year}
          onPick={pickYear}
        />
      ) : expanded === 'month' ? (
        <OptionGrid
          options={MONTHS.map((month) => ({
            key: month,
            label: `${month}월`,
            disabled: !isMonthSelectable(picked.year, month, first),
          }))}
          selected={picked.month}
          onPick={pickMonth}
        />
      ) : (
        <Calendar picked={picked} first={first} onPick={pickDay} />
      )}

      <View style={styles.picked}>
        <ThemedText type="t5" numeric>
          {formatDateDot(iso)}
        </ThemedText>
        <ThemedText type="t6" numeric themeColor="tint" style={styles.bold}>
          {ddayLabel(remaining.kind === 'upcoming' ? remaining.days : 0)}
        </ThemedText>
      </View>

      <View style={styles.cta}>
        <ActionButton variant="primary" size="xlarge" label={CONFIRM_CTA} onPress={() => onConfirm(iso)} />
      </View>
    </ThemedView>
  );
}

/** 연 · 월 셀렉트 — 높이 52 · radius 10 · 열리면 코랄 1.5px. */
function Select({
  label,
  accessibilityLabel,
  open,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  open: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={[
        styles.select,
        { backgroundColor: theme.background, borderColor: open ? theme.tint : theme.border },
      ]}>
      <ThemedText type="t6" numeric style={styles.bold}>
        {label}
      </ThemedText>
      <Svg
        width={Layout.iconInline}
        height={Layout.iconInline}
        viewBox="0 0 24 24"
        fill="none"
        style={open ? styles.chevronOpen : undefined}>
        <Path
          d="M6 9l6 6 6-6"
          stroke={open ? theme.tint : theme.textAssistive}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

type GridOption = { key: number; label: string; disabled: boolean };

/** 연도 · 월 펼침 — 4열 · 셀 44. 마지막 줄이 모자라면 빈 칸으로 채워 폭을 맞춘다. */
function OptionGrid({
  options,
  selected,
  onPick,
}: {
  options: readonly GridOption[];
  selected: number;
  onPick: (key: number) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {chunk(options, GRID_COLUMNS).map((row) => (
        <View key={row.map((option) => option.key).join('-')} style={styles.gridRow}>
          {row.map((option) => {
            const active = option.key === selected;

            return (
              <Pressable
                key={option.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled: option.disabled }}
                accessibilityLabel={option.label}
                disabled={option.disabled}
                onPress={() => onPick(option.key)}
                style={[styles.gridCell, active && { backgroundColor: theme.tintSubtle }]}>
                <ThemedText
                  type="t6"
                  numeric
                  style={[
                    active && [styles.bold, { color: theme.tint }],
                    option.disabled && { color: CALENDAR_MUTED },
                  ]}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
          {Array.from({ length: GRID_COLUMNS - row.length }, (_, index) => (
            <View key={`pad-${index}`} style={styles.gridCell} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** 요일 헤더 28 + 날짜 셀 40 × 6주. 일요일 · 토요일 색, 타월과 과거는 옅게 비활성. */
function Calendar({
  picked,
  first,
  onPick,
}: {
  picked: PickedDate;
  first: PickedDate;
  onPick: (cell: CalendarCell) => void;
}) {
  const theme = useTheme();
  const selectedIso = toIso(picked.year, picked.month, picked.day);
  const cells = monthCells(picked.year, picked.month);

  return (
    <View style={styles.calendar}>
      <View style={styles.week}>
        {WEEKDAYS.map((weekday, index) => (
          <View key={weekday} style={styles.weekdayCell}>
            <ThemedText
              type="t7"
              themeColor="textAssistive"
              style={[index === 0 && { color: CALENDAR_SUNDAY }, index === 6 && { color: CALENDAR_SATURDAY }]}>
              {weekday}
            </ThemedText>
          </View>
        ))}
      </View>

      {chunk(cells, WEEKDAYS.length).map((row) => (
        <View key={row[0]!.iso} style={styles.week}>
          {row.map((cell) => {
            const selectable = cell.inMonth && isDaySelectable(cell, first);
            const active = cell.iso === selectedIso;
            const color = !selectable
              ? CALENDAR_MUTED
              : cell.weekday === 0
                ? CALENDAR_SUNDAY
                : cell.weekday === 6
                  ? CALENDAR_SATURDAY
                  : theme.text;

            return (
              <Pressable
                key={cell.iso}
                accessibilityRole="button"
                accessibilityLabel={formatDateDot(cell.iso)}
                accessibilityState={{ selected: active, disabled: !selectable }}
                disabled={!selectable}
                onPress={() => onPick(cell)}
                style={styles.dayCell}>
                <View style={[styles.day, active && { backgroundColor: theme.tint }]}>
                  <ThemedText
                    type="t6"
                    numeric
                    style={[{ color }, active && [styles.bold, { color: theme.onTint }]]}>
                    {cell.day}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const CONFIRM_CTA = '이 날짜로 정하기';
/** spec/tokens.json safeArea.formula.sheetBottomPadding의 고정항. */
const SHEET_BOTTOM_PADDING = 28;
/* 시안 고정값 — 시트 헤더 최소 32 · 닫기 버튼 32 · 셀렉트 좌우 16. */
const HEAD_MIN_HEIGHT = 32;
const CLOSE_SIZE = 32;
/* WP-APP-023 고정값 — 연 · 월 펼침 4열 · 셀 44(Layout.touchTarget) · 요일 헤더 28 · 날짜 셀 40. */
const GRID_COLUMNS = 4;
const WEEKDAY_HEADER = 28;
const DAY_CELL = 40;

const styles = StyleSheet.create({
  /* 시안 sheet — radius 20(SHEET_PANEL) · 상 12 · 좌우 24 · 하 28 · 사이 16. */
  sheet: {
    paddingTop: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
    gap: Spacing.three,
  },
  head: {
    minHeight: HEAD_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.rowPaddingY,
  },
  close: { width: CLOSE_SIZE, height: CLOSE_SIZE, alignItems: 'center', justifyContent: 'center' },
  selects: { flexDirection: 'row', gap: Spacing.two },
  /* 셀렉트 — 높이 52(Layout.field) · radius 10 · 테두리 1.5(열리면 코랄). */
  select: {
    flex: 1,
    minWidth: 0,
    height: Layout.field,
    borderRadius: Radius.medium,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  /* 연도 · 월 펼침 — 4열 · 셀 44 · 사이 8. */
  grid: { gap: Spacing.two },
  gridRow: { flexDirection: 'row', gap: Spacing.two },
  gridCell: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    height: Layout.touchTarget,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendar: { gap: Spacing.half },
  week: { flexDirection: 'row' },
  weekdayCell: { flex: 1, flexBasis: 0, minWidth: 0, height: WEEKDAY_HEADER, alignItems: 'center', justifyContent: 'center' },
  dayCell: { flex: 1, flexBasis: 0, minWidth: 0, height: DAY_CELL, alignItems: 'center', justifyContent: 'center' },
  /* 선택일의 코랄 원 — 셀과 같은 40. */
  day: { width: DAY_CELL, height: DAY_CELL, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  /* 시안 pickedRow — 결과 줄 · baseline 정렬 · 좌우 2. */
  picked: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Layout.rowPaddingY,
    paddingHorizontal: Spacing.half,
  },
  /* width 100% · flex 0 0 — 세로 컨테이너에서 늘어나지 않는다(SPEC §13.7). */
  cta: { width: '100%', flexGrow: 0, flexShrink: 0 },
  bold: { fontWeight: 700 },
});
