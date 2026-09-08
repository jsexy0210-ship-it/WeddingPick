import { dDay, formatDateDot, isSelectableWeddingDate } from '@weddingpick/domain';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ActionButton, Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import {
  MONTHS,
  WEEKDAY_LABELS,
  chunk,
  isPastMonth,
  monthGrid,
  splitIso,
  yearOptions,
} from './calendar';

/**
 * 날짜 선택 시트(WP-APP-023). SPEC §13.7 «날짜 선택 · 연월 셀렉트».
 *
 *   [2027년 ▾] [5월 ▾]     셀렉트 2개 · 52 · radius 10 · 열리면 코랄 1.5px
 *   일 월 화 수 목 금 토      요일 헤더 28
 *   달력 6주                  날짜 셀 40 · 선택일 코랄 원
 *   2027.05.16(토)   D-250
 *   [이 날짜로 정하기]         56 · width 100%
 *
 * **연 · 월은 셀렉트로 바로 고르고 일만 달력에서 찍는다.** 좌우 화살표로 월을
 * 넘기지 않는다 — 웨딩은 1~2년 뒤를 고르는데 화살표로는 탭이 12~24번 필요하다.
 * 연도를 누르면 4열 여섯 칸(올해부터 5년 뒤), 월은 4열 열두 칸이 달력 자리에
 * 펼쳐진다. 두 번 탭으로 어느 달이든 간다. 펼친 동안 CTA는 «확인»이다.
 *
 * 오늘 포함 과거는 고를 수 없다(domain `isSelectableWeddingDate`). 결혼식은 미래다.
 *
 * CTA는 `width: 100%`로 세로 컨테이너 안에서 늘지 않는다(v3.21 «시트 CTA 크기
 * 수정» — `flex:1.4` 금지). 높이는 토큰 ctaPrimary 52다(시안 56).
 */
export function DatePickerSheet({
  visible,
  value,
  onConfirm,
  onDismiss,
  today = new Date(),
}: {
  visible: boolean;
  /** 이미 고른 날. 시트는 그 달을 펼친 채 연다. */
  value: string | null;
  onConfirm: (iso: string) => void;
  onDismiss: () => void;
  /** 테스트와 시안 재현이 오늘을 정할 수 있게 받는다. */
  today?: Date;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="닫기" onPress={onDismiss} />

        {/* 열 때마다 새로 마운트한다 — 지난번 열어 놓고 취소한 흔적(펼친 연도 · 찍은 날)을 남기지 않는다. */}
        {visible ? <SheetBody value={value} today={today} onConfirm={onConfirm} /> : null}
      </View>
    </Modal>
  );
}

function SheetBody({
  value,
  today,
  onConfirm,
}: {
  value: string | null;
  today: Date;
  onConfirm: (iso: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [cursor, setCursor] = useState(() => {
    const from = value ? splitIso(value) : null;

    return from ? { year: from.year, month: from.month } : { year: today.getFullYear(), month: today.getMonth() + 1 };
  });
  const [picked, setPicked] = useState<string | null>(value);
  const [open, setOpen] = useState<'year' | 'month' | null>(null);

  const { year, month } = cursor;
  const cells = monthGrid(year, month);
  const days = picked ? dDay(picked, today) : null;

  return (
    <ThemedView style={[styles.sheet, { paddingBottom: SHEET_BOTTOM_PADDING + Math.max(insets.bottom, 0) }]}>
      <View style={[styles.grabber, { backgroundColor: theme.border }]} />

      <View style={styles.selects}>
        <Select label={`${year}년`} open={open === 'year'} onPress={() => setOpen(open === 'year' ? null : 'year')} />
        <Select label={`${month}월`} open={open === 'month'} onPress={() => setOpen(open === 'month' ? null : 'month')} />
      </View>

      {open === 'year' ? (
        <OptionGrid
          options={yearOptions(today).map((item) => ({ key: item, label: `${item}년`, disabled: false }))}
          selected={year}
          onSelect={(next) => {
            setCursor({ year: next, month });
            setOpen(null);
          }}
        />
      ) : null}

      {open === 'month' ? (
        <OptionGrid
          options={MONTHS.map((item) => ({ key: item, label: `${item}월`, disabled: isPastMonth(year, item, today) }))}
          selected={month}
          onSelect={(next) => {
            setCursor({ year, month: next });
            setOpen(null);
          }}
        />
      ) : null}

      {open === null ? (
        <View style={styles.calendar}>
          <View style={styles.week}>
            {WEEKDAY_LABELS.map((label, index) => (
              <View key={label} style={styles.weekCell}>
                <ThemedText
                  type="t7"
                  style={[
                    styles.bold,
                    { color: index === 0 ? SUNDAY : index === 6 ? SATURDAY : theme.textAssistive },
                  ]}>
                  {label}
                </ThemedText>
              </View>
            ))}
          </View>

          {chunk(cells, 7).map((row) => (
            <View key={row[0]!.iso} style={styles.week}>
              {row.map((cell) => {
                const selectable = cell.inMonth && isSelectableWeddingDate(cell.iso, today);
                const selected = picked === cell.iso;
                const color = selected
                  ? theme.onTint
                  : !selectable
                    ? theme.track
                    : cell.weekday === 0
                      ? SUNDAY
                      : cell.weekday === 6
                        ? SATURDAY
                        : theme.text;

                return (
                  <Pressable
                    key={cell.iso}
                    accessibilityRole="button"
                    accessibilityLabel={`${month}월 ${cell.day}일`}
                    accessibilityState={{ selected, disabled: !selectable }}
                    disabled={!selectable}
                    onPress={() => setPicked(cell.iso)}
                    style={styles.dayCell}>
                    <View style={[styles.day, selected && { backgroundColor: theme.tint }]}>
                      <ThemedText type="t6" numeric style={[{ color }, selected && styles.bold]}>
                        {cell.day}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}

      {open === null && picked && days ? (
        <View style={styles.picked}>
          <ThemedText type="t5" numeric>
            {formatDateDot(picked)}
          </ThemedText>
          {days.kind === 'upcoming' ? (
            <ThemedText type="t6" numeric themeColor="tint" style={styles.bold}>
              {`D-${days.days}`}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      <View style={styles.cta}>
        {open !== null ? (
          <ActionButton variant="primary" size="xlarge" label="확인" onPress={() => setOpen(null)} />
        ) : (
          <ActionButton
            variant="primary"
            size="xlarge"
            label="이 날짜로 정하기"
            disabled={picked === null}
            onPress={() => picked && onConfirm(picked)}
          />
        )}
      </View>
    </ThemedView>
  );
}

/** 연 · 월 셀렉트 — 시안 `selBox`: 52 · 좌우 16 · radius 10 · 열리면 흰 바탕에 코랄 1.5px. */
function Select({ label, open, onPress }: { label: string; open: boolean; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.select,
        open
          ? { backgroundColor: theme.background, borderColor: theme.tint }
          : { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
      ]}>
      <ThemedText type="t5" numeric>
        {label}
      </ThemedText>
      <Svg width={Layout.iconInline} height={Layout.iconInline} viewBox="0 0 24 24" fill="none">
        <Path d="m6 9.5 6 6 6-6" stroke={theme.textSecondary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

/** 연도·월 펼침 — 시안 `optCell`: 4열 · 44 · radius 8 · 켜지면 코랄/흰. */
function OptionGrid({
  options,
  selected,
  onSelect,
}: {
  options: readonly { key: number; label: string; disabled: boolean }[];
  selected: number;
  onSelect: (key: number) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.options}>
      {chunk(options, OPTION_COLUMNS).map((row) => (
        <View key={row[0]!.key} style={styles.optionRow}>
          {row.map((option) => {
            const on = option.key === selected;

            return (
              <Pressable
                key={option.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled: option.disabled }}
                accessibilityLabel={option.label}
                disabled={option.disabled}
                onPress={() => onSelect(option.key)}
                style={[styles.option, { backgroundColor: on ? theme.tint : theme.backgroundElement }]}>
                <ThemedText
                  type="t6"
                  numeric
                  themeColor={on ? 'onTint' : option.disabled ? 'textDisabled' : 'textSecondary'}
                  style={styles.bold}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
          {row.length < OPTION_COLUMNS
            ? Array.from({ length: OPTION_COLUMNS - row.length }, (_, index) => (
                <View key={`spacer-${index}`} style={styles.optionSpacer} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

/*
 * 달력 요일 색. SPEC §13.7 «일요일 #E8735F · 토요일 #5B8DEF» — 테마 토큰에 없는
 * 값이라 여기 이름 붙여 둔다(2026-09-08 오더: 시트 파일의 명명 상수로 둔다).
 * 타월 #DCDEE3는 토큰 `track`과 같은 값이라 토큰을 쓴다.
 */
const SUNDAY = '#E8735F';
const SATURDAY = '#5B8DEF';

/** spec/tokens.json safeArea.formula.sheetBottomPadding의 고정항. */
const SHEET_BOTTOM_PADDING = 28;
/* 시안 고정값 — 그래버 40×4 · 옵션 4열 · 셀 44 · 요일 헤더 28 · 날짜 셀 40. */
const GRABBER_WIDTH = 40;
const OPTION_COLUMNS = 4;
const OPTION_HEIGHT = 44;
const WEEKDAY_HEIGHT = 28;
const DAY_CELL = 40;

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  /* 시안 sheet — radius 20 · 상 12 · 좌우 24 · 하 28 · 사이 16. */
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingTop: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
    gap: Spacing.three,
  },
  grabber: { width: GRABBER_WIDTH, height: 4, borderRadius: Radius.pill, alignSelf: 'center' },
  selects: { flexDirection: 'row', gap: Spacing.two },
  select: {
    flex: 1,
    minWidth: 0,
    height: Layout.field,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  options: { gap: Spacing.two },
  optionRow: { flexDirection: 'row', gap: Spacing.two },
  option: {
    flex: 1,
    height: OPTION_HEIGHT,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSpacer: { flex: 1 },
  calendar: { gap: Spacing.two },
  week: { flexDirection: 'row', gap: Spacing.half },
  weekCell: { flex: 1, height: WEEKDAY_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  dayCell: { flex: 1, height: DAY_CELL, alignItems: 'center', justifyContent: 'center' },
  day: {
    width: DAY_CELL,
    height: DAY_CELL,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picked: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Layout.rowPaddingY,
    paddingHorizontal: Spacing.half,
  },
  cta: { width: '100%' },
  bold: { fontWeight: 700 },
});
