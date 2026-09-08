import { dDay, formatDateDot } from '@weddingpick/domain';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { ActionButton, Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import {
  WHEEL_HEIGHT,
  WHEEL_PAD,
  WHEEL_ROW,
  dayOptions,
  firstSelectable,
  monthOptions,
  normalizeWheelDate,
  splitIso,
  toIso,
  yearOptions,
  type WheelDate,
} from './calendar';
import { DateWheel } from './date-wheel';
import { ddayLabel } from './flow';

/**
 * 날짜 선택 시트(WP-APP-023). SPEC §13.6 «데이트피커 · 휠 3열».
 *
 *   예식일 선택                    ✕
 *        2026년      4월      15일
 *      ┃ 2027년 ┃  ┃ 5월 ┃  ┃ 16일 ┃   중앙 밴드 48
 *        2028년      6월      17일
 *   2027.05.16(토)              D-250
 *   [           확인           ]
 *
 * **달력 격자를 쓰지 않는다.** 연 · 월 · 일 세 휠을 한 화면에서 굴린다 — 휠 240 ·
 * 행 48 · 5행 · 컬럼 비율 1.1 : 1 : 1 · 중앙 밴드 top 96 height 48 radius 10 gray50 ·
 * 상하 96 흰색 페이드. 굴리는 즉시 아래 결과 줄과 D-day가 갱신되고 확인은 값을
 * 화면에 돌려줄 뿐이다.
 *
 * 월을 바꿔 없는 날짜가 되면 그 달 마지막 날로 당긴다(`normalizeWheelDate`).
 * 연 범위는 올해부터 5년 뒤, 오늘 포함 과거는 목록에 없다.
 *
 * 세 휠은 가로로 나란한 형제다 — 화면 ScrollView 안에 겹치지 않는다(§13.5.5).
 * 시트는 Modal이라 화면과 다른 컨테이너다.
 *
 * 페이드는 `react-native-svg` 그라데이션이다 — `expo-linear-gradient`가 의존성에
 * 없고, 반투명 View를 쌓으면 띠가 진다. CTA는 `width: 100%`(v3.21 «시트 CTA 크기»).
 */
export function DatePickerSheet({
  visible,
  value,
  onConfirm,
  onDismiss,
  today = new Date(),
}: {
  visible: boolean;
  /** 이미 고른 날. 시트는 그 날을 중앙에 두고 연다. */
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

        {/* 열 때마다 새로 마운트한다 — 지난번 굴려 놓고 닫은 흔적을 남기지 않는다. */}
        {visible ? <SheetBody value={value} today={today} onConfirm={onConfirm} onDismiss={onDismiss} /> : null}
      </View>
    </Modal>
  );
}

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

  const [picked, setPicked] = useState<WheelDate>(() => {
    const from = value ? splitIso(value) : null;

    /* 고른 날이 없으면 고를 수 있는 첫 날(내일)에서 시작한다 — 짐작으로 날을 정하지 않는다. */
    return normalizeWheelDate(from ?? first, first);
  });

  const years = yearOptions(today).filter((year) => year >= first.year);
  const months = monthOptions(picked.year, first);
  const days = dayOptions(picked.year, picked.month, first);
  const iso = toIso(picked.year, picked.month, picked.day);
  const remaining = dDay(iso, today);

  function roll(patch: Partial<WheelDate>) {
    setPicked((current) => normalizeWheelDate({ ...current, ...patch }, first));
  }

  return (
    <ThemedView style={[styles.sheet, { paddingBottom: SHEET_BOTTOM_PADDING + Math.max(insets.bottom, 0) }]}>
      <View style={styles.head}>
        <ThemedText type="t4">예식일 선택</ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onDismiss} style={styles.close}>
          <Svg width={Layout.iconTab} height={Layout.iconTab} viewBox="0 0 24 24" fill="none">
            <Path d="M6 6l12 12M18 6L6 18" stroke={theme.text} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <View style={styles.wheels}>
        {/* 중앙 밴드 — 휠 뒤(z 1), 페이드 앞이 아니라 뒤. 휠 자체는 투명이라 밴드가 비친다. */}
        <View style={[styles.band, { backgroundColor: theme.backgroundElement }]} />

        <DateWheel
          id="wheel-year"
          flex={YEAR_FLEX}
          items={years.map((year) => ({ key: year, label: `${year}년` }))}
          selected={Math.max(years.indexOf(picked.year), 0)}
          onChange={(index) => roll({ year: years[index] })}
        />
        <DateWheel
          id="wheel-month"
          flex={1}
          items={months.map((month) => ({ key: month, label: `${month}월` }))}
          selected={Math.max(months.indexOf(picked.month), 0)}
          onChange={(index) => roll({ month: months[index] })}
        />
        <DateWheel
          id="wheel-day"
          flex={1}
          items={days.map((day) => ({ key: day, label: `${day}일` }))}
          selected={Math.max(days.indexOf(picked.day), 0)}
          onChange={(index) => roll({ day: days[index] })}
        />

        <Fade edge="top" color={theme.background} />
        <Fade edge="bottom" color={theme.background} />
      </View>

      <View style={styles.picked}>
        <ThemedText type="t5" numeric>
          {formatDateDot(iso)}
        </ThemedText>
        <ThemedText type="t6" numeric themeColor="tint" style={styles.bold}>
          {ddayLabel(remaining.kind === 'upcoming' ? remaining.days : 0)}
        </ThemedText>
      </View>

      <View style={styles.cta}>
        <ActionButton variant="primary" size="xlarge" label="확인" onPress={() => onConfirm(iso)} />
      </View>
    </ThemedView>
  );
}

/**
 * 상하 96 흰색 페이드(SPEC «페이드 · 상하 96px · 흰색 그라데이션 · z-index 3»).
 * 시안 `wheelFadeTop` — 위 30%까지 불투명, 아래 30%부터 불투명. 터치는 통과한다.
 */
function Fade({ edge, color }: { edge: 'top' | 'bottom'; color: string }) {
  const id = `wheelFade-${edge}`;
  /* 위는 30%까지 불투명 → 투명, 아래는 그 거울. */
  const stops =
    edge === 'top'
      ? [
          { offset: FADE_SOLID, opacity: 1 },
          { offset: 1, opacity: 0 },
        ]
      : [
          { offset: 0, opacity: 0 },
          { offset: 1 - FADE_SOLID, opacity: 1 },
        ];

  return (
    <Svg
      width="100%"
      height={WHEEL_PAD}
      style={[styles.fade, edge === 'top' ? styles.fadeTop : styles.fadeBottom]}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {stops.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={color} stopOpacity={stop.opacity} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** 컬럼 비율 — 연 1.1 : 월 1 : 일 1(SPEC §13.6). */
const YEAR_FLEX = 1.1;
/** 시안 페이드 — `linear-gradient(#fff 30%, transparent)`의 30%. */
const FADE_SOLID = 0.3;
/** spec/tokens.json safeArea.formula.sheetBottomPadding의 고정항. */
const SHEET_BOTTOM_PADDING = 28;
/* 시안 고정값 — 시트 헤더 최소 32 · 닫기 버튼 32. */
const HEAD_MIN_HEIGHT = 32;
const CLOSE_SIZE = 32;

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
  head: {
    minHeight: HEAD_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.rowPaddingY,
  },
  close: { width: CLOSE_SIZE, height: CLOSE_SIZE, alignItems: 'center', justifyContent: 'center' },
  /* 시안 wheelWrap — 휠 240 · 세 열 나란히 · 밖으로 나가는 항목은 자른다. */
  wheels: { position: 'relative', flexDirection: 'row', height: WHEEL_HEIGHT, overflow: 'hidden' },
  /* 시안 wheelBand — top 96 · height 48 · radius 10 · gray50 · z 1. */
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WHEEL_PAD,
    height: WHEEL_ROW,
    borderRadius: Radius.medium,
    zIndex: 1,
  },
  /* 터치는 통과한다 — 페이드 아래의 휠이 받는다. */
  fade: { position: 'absolute', left: 0, right: 0, zIndex: 3, pointerEvents: 'none' },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
  /* 시안 pickedRow — 결과 줄 · baseline 정렬 · 좌우 2. */
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
