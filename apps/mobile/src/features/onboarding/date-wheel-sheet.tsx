import { dDay, formatDateDot } from '@weddingpick/domain';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  ActionButton,
  FontSize,
  Layout,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { BottomSheet, SHEET_PANEL } from '@/features/common/bottom-sheet';

import {
  dayOptions,
  firstSelectable,
  monthOptions,
  normalizeDate,
  splitIso,
  toIso,
  yearOptions,
  type PickedDate,
} from './calendar';
import { ddayLabel } from './flow';

/**
 * 예식일 선택 시트 — **휠 3열**(대표 지시 2026-09-11 · 2026-09-14 재확인).
 *
 *   예식일 선택                    ✕
 *   ──────────────────────────
 *        2026년      4월      15일
 *      ┃ 2027년 ┃  ┃ 5월 ┃  ┃ 16일 ┃   중앙 밴드 48
 *        2028년      6월      17일
 *   ──────────────────────────
 *   2027.05.16(토)              D-250
 *          [  이 날짜로 정하기  ]
 *
 * **연 · 월 · 일 세 휠을 한 화면에서 굴린다.** 달력 격자(`date-picker-sheet.tsx`
 * WP-APP-023 «연월 셀렉트 + 달력»)를 열지 않는다 — 그 파일은 지우지 않고 남겨둔다.
 * 이 자리는 2026-09 사이에 «휠 → 셀렉트 → 휠»로 두 번 뒤집혔고, 다시 뒤집힐 때
 * 없는 것을 새로 만들게 하지 않는다. 온보딩(`app/setup.tsx`)이 여는 것은 이쪽이다.
 *
 * **굴리는 즉시 아래 선택 결과와 D-day가 갱신된다.** 확인을 누를 때까지 기다리지
 * 않는다 — 멈춘 칸을 기다렸다 적으면 사용자는 자기가 무엇을 고르는 중인지 모른다.
 *
 * **월을 바꿔 없는 날짜가 되면 그 달 마지막 날로 당긴다**(`normalizeDate`). 1월
 * 31일에서 2월로 굴리면 2월 28일이다 — 오류를 띄우거나 선택을 비우지 않는다.
 * 당겨진 값은 일 휠이 그 자리로 스스로 미끄러져 화면과 값이 어긋나지 않는다.
 *
 * 연 범위는 올해부터 5년 뒤까지고 오늘 포함 과거는 목록에 두지 않는다 —
 * 고를 수 없는 칸을 옅게 그려 두는 대신 아예 굴러오지 않게 한다(`firstSelectable`).
 *
 * 거리별 글자는 토큰 단계로 옮겼다 — 시안의 20 · 18 · 17 · 16 중 17은 8단계
 * 타이포에 없다. 크기는 t4 · t5 · t6 · t6이고 멀어지는 느낌은 색이 맡는다
 * (`text` → `textAssistive` → `textDisabled` → `track`).
 */
export function DateWheelSheet({
  visible,
  value,
  onConfirm,
  onDismiss,
  today = new Date(),
}: {
  visible: boolean;
  /** 이미 고른 날. 시트는 그 날에 휠을 맞춘 채 연다. */
  value: string | null;
  onConfirm: (iso: string) => void;
  onDismiss: () => void;
  /** 테스트와 시안 재현이 오늘을 정할 수 있게 받는다. */
  today?: Date;
}) {
  return (
    /* BottomSheet는 닫히면 children을 통째로 내린다 — 열 때마다 휠이 고른 날에서 다시 시작한다. */
    <BottomSheet visible={visible} onRequestClose={onDismiss}>
      <SheetBody value={value} today={today} onConfirm={onConfirm} onDismiss={onDismiss} />
    </BottomSheet>
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

  const [picked, setPicked] = useState<PickedDate>(() => {
    const from = value ? splitIso(value) : null;

    /* 고른 날이 없으면 고를 수 있는 첫 날(내일)에서 시작한다 — 짐작으로 날을 정하지 않는다. */
    return normalizeDate(from ?? first, first);
  });

  const years = yearOptions(today).filter((year) => year >= first.year);
  const months = monthOptions(picked.year, first);
  const days = dayOptions(picked.year, picked.month, first);
  const iso = toIso(picked.year, picked.month, picked.day);
  const remaining = dDay(iso, today);

  /* 어느 휠을 굴렸든 나머지를 목록 안으로 맞춘다 — 없는 달·없는 날을 만들지 않는다. */
  const change = (patch: Partial<PickedDate>) =>
    setPicked((current) => normalizeDate({ ...current, ...patch }, first));

  return (
    <ThemedView
      style={[
        SHEET_PANEL,
        styles.sheet,
        { paddingBottom: SHEET_BOTTOM_PADDING + Math.max(insets.bottom, 0) },
      ]}>
      <View style={styles.head}>
        <ThemedText type="t4">예식일 선택</ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onDismiss}
          style={styles.close}>
          <Svg width={Layout.iconTab} height={Layout.iconTab} viewBox="0 0 24 24" fill="none">
            <Path d="M6 6l12 12M18 6L6 18" stroke={theme.text} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <View style={styles.wheels}>
        {/*
          중앙 밴드는 휠 셋 뒤에 한 겹으로 깔린다 — 열마다 그리면 사이 간격에서
          끊겨 세 토막으로 보인다. 굴러가는 글자가 위에 오도록 뒤에 둔다.
         */}
        <View
          pointerEvents="none"
          style={[styles.band, { backgroundColor: theme.backgroundElement }]}
        />

        <Wheel
          accessibilityLabel="연도"
          flex={YEAR_COLUMN_FLEX}
          options={years}
          value={picked.year}
          format={(year) => `${year}년`}
          onChange={(year) => change({ year })}
        />
        <Wheel
          accessibilityLabel="월"
          flex={1}
          options={months}
          value={picked.month}
          format={(month) => `${month}월`}
          onChange={(month) => change({ month })}
        />
        <Wheel
          accessibilityLabel="일"
          flex={1}
          options={days}
          value={picked.day}
          format={(day) => `${day}일`}
          onChange={(day) => change({ day })}
        />
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
        <ActionButton variant="primary" size="xlarge" label={CONFIRM_CTA} onPress={() => onConfirm(iso)} />
      </View>
    </ThemedView>
  );
}

/**
 * 휠 한 열.
 *
 * 위아래 96(두 행)씩 비워 두면 첫 항목과 마지막 항목도 중앙 밴드에 설 수 있다.
 * `snapToInterval`이 행 높이에 물려 칸 사이에 멈추지 않는다.
 *
 * 굴리는 동안(`onScroll`)에도 값을 올려보낸다 — 멈출 때까지 기다리면 아래 D-day가
 * 뒤늦게 따라와서 무엇을 고르는 중인지 알 수 없다. 같은 칸에 머무는 동안에는
 * 올려보내지 않는다(`reported`).
 *
 * 밖에서 값이 바뀌면(달을 바꿔 일이 당겨진 경우) 그 자리로 스스로 미끄러진다 —
 * 화면에 31이 서 있는데 값은 28인 상태를 두지 않는다.
 */
function Wheel<T extends number>({
  options,
  value,
  onChange,
  format,
  flex,
  accessibilityLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  format: (value: T) => string;
  flex: number;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const scroll = useRef<ScrollView>(null);
  const index = Math.max(0, options.indexOf(value));
  /** 이 휠이 마지막으로 올려보냈거나 맞춰 세운 칸. 같은 값을 되풀이해 올리지 않는다. */
  const reported = useRef(index);
  const [offset, setOffset] = useState(index * ROW_HEIGHT);
  /** 첫 자리를 한 번만 맞춘다 — 그 뒤로는 손가락과 `index` 효과가 정한다. */
  const placed = useRef(false);

  useEffect(() => {
    if (reported.current === index) return;

    reported.current = index;
    scroll.current?.scrollTo({ y: index * ROW_HEIGHT, animated: true });
  }, [index]);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = event.nativeEvent.contentOffset.y;

    setOffset(y);

    const next = Math.min(Math.max(Math.round(y / ROW_HEIGHT), 0), options.length - 1);

    if (next === reported.current) return;

    reported.current = next;
    onChange(options[next]!);
  }

  /* 중앙에서 몇 칸 떨어져 있는가 — 굴리는 중에는 소수로 흐른다. */
  const center = offset / ROW_HEIGHT;

  return (
    <ScrollView
      ref={scroll}
      accessibilityLabel={accessibilityLabel}
      style={{ flex }}
      contentContainerStyle={styles.wheelContent}
      /*
       * 여는 순간 고른 날에 서 있어야 한다. `contentOffset`은 iOS만 읽으므로
       * 안드로이드·웹은 자리를 잡자마자 한 번 옮겨 둔다 — 두 곳 다 애니메이션
       * 없이 놓는다. 휠이 0에서 시작했다가 미끄러져 오면 무엇이 골라진 것인지
       * 알 수 없다.
       */
      contentOffset={{ x: 0, y: index * ROW_HEIGHT }}
      onLayout={() => {
        if (placed.current) return;

        placed.current = true;
        scroll.current?.scrollTo({ y: index * ROW_HEIGHT, animated: false });
      }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ROW_HEIGHT}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={handleScroll}>
      {options.map((option, position) => {
        const step = distanceStep(Math.abs(position - center));

        return (
          <View key={option} style={styles.row}>
            <ThemedText
              numeric
              numberOfLines={1}
              style={[
                styles.rowText,
                { fontSize: STEP_FONT_SIZE[step], color: theme[STEP_COLOR[step]] },
                step === 0 ? styles.bold : null,
              ]}>
              {format(option)}
            </ThemedText>
          </View>
        );
      })}
    </ScrollView>
  );
}

/** 중앙에서의 거리를 0 · 1 · 2 · 3 네 단으로 접는다. 반 칸 앞에서 바뀐다. */
function distanceStep(distance: number): 0 | 1 | 2 | 3 {
  if (distance < 0.5) return 0;
  if (distance < 1.5) return 1;
  if (distance < 2.5) return 2;

  return 3;
}

const CONFIRM_CTA = '이 날짜로 정하기';
/** spec/tokens.json safeArea.formula.sheetBottomPadding의 고정항. */
const SHEET_BOTTOM_PADDING = 28;
/* 시안 고정값 — 시트 헤더 최소 32 · 닫기 버튼 32. `date-picker-sheet.tsx`와 같다. */
const HEAD_MIN_HEIGHT = 32;
const CLOSE_SIZE = 32;
/*
 * 휠 규격(SPEC «데이트피커 · 휠 3열»). 8단계 타이포·간격 토큰에 없는 값이라
 * 여기 이름 붙여 둔다 — 달력 색을 `calendar.ts`에 둔 것과 같은 이유다.
 *
 *   행 48 · 5행 노출 → 휠 240 · 중앙 밴드 top 96 · height 48 · 상하 패딩 96
 *   컬럼 비율 연 1.1 : 월 1 : 일 1
 */
const ROW_HEIGHT = 48;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const WHEEL_PADDING = ROW_HEIGHT * 2;
const YEAR_COLUMN_FLEX = 1.1;

/**
 * 거리별 글자 크기. 시안은 20 · 18 · 17 · 16인데 17은 토큰에 없다 — 2단과 3단을
 * 같은 t6로 두고 멀어지는 느낌은 색이 맡는다.
 */
const STEP_FONT_SIZE = [FontSize.t4, FontSize.t5, FontSize.t6, FontSize.t6] as const;
/** 거리별 색. SEED gray 램프를 따라 한 칸씩 옅어진다. */
const STEP_COLOR = ['text', 'textAssistive', 'textDisabled', 'track'] as const;

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
  wheels: {
    height: WHEEL_HEIGHT,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  /* 중앙 밴드 — 휠 셋에 걸쳐 한 줄. 위에서 두 행 아래, 높이 한 행. */
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WHEEL_PADDING,
    height: ROW_HEIGHT,
    borderRadius: Radius.medium,
  },
  /* 첫·마지막 항목도 중앙 밴드에 설 수 있게 위아래를 두 행만큼 비운다. */
  wheelContent: { paddingVertical: WHEEL_PADDING },
  row: { height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  rowText: { textAlign: 'center' },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cta: { flexGrow: 0, flexShrink: 0 },
  bold: { fontWeight: 700 },
});
