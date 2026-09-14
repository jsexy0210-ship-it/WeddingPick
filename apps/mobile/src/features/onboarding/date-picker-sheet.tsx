import { dDay, formatDateDot } from '@weddingpick/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  ActionButton,
  FontSize,
  Layout,
  LineHeight,
  Radius,
  Spacing,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';

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
 * 날짜 선택 시트(WP-APP-023) — **휠 3열**.
 *
 *   ━━                                  그래버 40×4(공용 SheetPanel)
 *   예식일 선택                    ✕     시안 sheetHead — 제목 20/27 · 닫기 32
 *   ┌─────┬─────┬─────┐
 *   │2026년│ 4월 │15일 │  ← 흐림      열 높이 240 · 항목 48 · 위아래 패딩 96
 *   │2027년│ 5월 │16일 │  ← 밴드      가운데 48이 밴드(radius 10 · gray50)
 *   │2028년│ 6월 │17일 │  ← 흐림      멀어질수록 작아지고 옅어진다
 *   └─────┴─────┴─────┘
 *   2027.05.16(토)                D-250
 *   [            확인            ]
 *
 * **2026-09-11 대표 지시로 달력에서 휠로 돌아왔다.** 그 전까지 이 자리는 연월
 * 셀렉트 + 달력이었다(v3.21 WP-APP-023). 루트 시안 `WP-APP-020`은 제목 · 설명이
 * 「연월 셀렉트」인데 그려진 3장은 휠이라 **한 파일 안에서 어긋나 있었다.** 그때
 * 제목 · 설명을 골랐는데 대표님이 고른 것은 그림 쪽이었다 — 「3중 휠 UX로 바꿨는데
 * 아직 배포가 안 된 거니?」. 루트 안에서 어긋나면 골라서 밀지 않고 대표님께 묻는다.
 *
 * 머리(제목 + 닫기)도 루트 시안 쪽이다. 옛 판(`current/20-onboarding-v2`)은 머리
 * 없이 그래버만 두었고, 둘이 다를 때는 루트가 이긴다(CLAUDE.md 2026-09-11).
 *
 * **날짜 규칙은 새로 쓰지 않는다.** `calendar.ts`가 이미 전부 갖고 있고 휠은 그것을
 * 그대로 지난다 — 연은 `yearOptions`, 월은 `monthOptions`, 일은 `dayOptions`,
 * 그리고 굴린 뒤 `normalizeDate`가 나머지를 목록 안으로 맞춘다. 그래서 시안 C의
 * 「월을 바꾸면 없는 날짜는 그 달 마지막 날로 당긴다」가 저절로 지켜진다(1월 31일
 * → 2월이면 28일, 윤년이면 29일). **과거는 목록에 아예 오르지 않는다** — 비활성으로
 * 그려 놓고 막는 것이 아니라 `first`(내일) 앞의 해 · 달 · 날을 빼고 만든다. 밴드에
 * 걸릴 수 없는 값은 고를 수도 없다.
 *
 * 굴리는 중에도 중앙 값이 곧바로 아래 결과 줄에 반영된다(시안 B). 그래서 스크롤이
 * 멈추기를 기다리지 않고 `onScroll`이 값을 올린다 — 멈춘 뒤에 바꾸면 손을 떼기
 * 전까지 무엇을 고르는 중인지 알 수 없다.
 *
 * 값은 전부 `spec/tokens.json` `component.dateWheel`이다(루트 시안 `wheelCol` ·
 * `wheelItem` · `wheelBand` · `wheelFadeTop` · `pickedRow` 실측).
 */
export function DatePickerSheet({
  visible,
  value,
  onConfirm,
  onDismiss,
  today = new Date(),
}: {
  visible: boolean;
  /** 이미 고른 날. 휠은 그 값에 맞춰 굴려진 채로 열린다. */
  value: string | null;
  onConfirm: (iso: string) => void;
  onDismiss: () => void;
  /** 테스트와 시안 재현이 오늘을 정할 수 있게 받는다. */
  today?: Date;
}) {
  return (
    /* BottomSheet는 닫히면 children을 통째로 내린다 — 열 때마다 새로 마운트되어 지난번 굴려 둔 자리가 남지 않는다. */
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
  const first = firstSelectable(today);

  const [picked, setPicked] = useState<PickedDate>(() => {
    const from = value ? splitIso(value) : null;

    /* 고른 날이 없으면 고를 수 있는 첫 날(내일)에서 시작한다 — 짐작으로 날을 정하지 않는다. */
    return normalizeDate(from ?? first, first);
  });

  /*
   * 세 휠의 목록. **과거는 여기서 이미 빠져 있다.** 목록에 없으면 밴드에 걸릴 수
   * 없고, 걸릴 수 없으면 고를 수도 없다 — 비활성으로 그려 놓고 누르면 막는 것보다
   * 확실하다.
   */
  const years = useMemo(
    () => yearOptions(today).filter((year) => year >= first.year),
    [today, first.year]
  );
  const months = useMemo(() => monthOptions(picked.year, first), [picked.year, first]);
  const days = useMemo(
    () => dayOptions(picked.year, picked.month, first),
    [picked.year, picked.month, first]
  );

  const iso = toIso(picked.year, picked.month, picked.day);
  const remaining = dDay(iso, today);

  /*
   * 굴린 값을 반영한다. **바로 `setPicked`하지 않고 `normalizeDate`를 지난다** —
   * 1월 31일에서 월을 2월로 굴리면 31일이 없다. 시안 C가 그 자리이고, 규칙은
   * `calendar.ts`가 이미 들고 있다.
   */
  function change(part: Partial<PickedDate>) {
    setPicked((current) => normalizeDate({ ...current, ...part }, first));
  }

  return (
    <SheetPanel style={styles.sheet}>
      <View style={styles.head}>
        <ThemedText type="t4" style={styles.bold}>
          {S.title}
        </ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel={S.close} onPress={onDismiss} style={styles.close}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.textAssistive} strokeWidth={2} strokeLinecap="round">
            <Path d="M6 6l12 12M18 6 6 18" />
          </Svg>
        </Pressable>
      </View>

      <View style={styles.wheels}>
        {/* 밴드가 열보다 뒤에 깔린다 — 형제 순서가 곧 z 순서다(밴드 → 열 → 페이드). 시안 wheelBand. */}
        <View style={[styles.band, { backgroundColor: theme.backgroundElement }]} />

        <Wheel
          accessibilityLabel={S.year}
          flex={FLEX_YEAR}
          items={years}
          format={(year) => `${year}년`}
          value={picked.year}
          onChange={(year) => change({ year })}
        />
        <Wheel
          accessibilityLabel={S.month}
          flex={FLEX_MONTH}
          items={months}
          format={(month) => `${month}월`}
          value={picked.month}
          onChange={(month) => change({ month })}
        />
        <Wheel
          accessibilityLabel={S.day}
          flex={FLEX_DAY}
          items={days}
          format={(day) => `${day}일`}
          value={picked.day}
          onChange={(day) => change({ day })}
        />

        {/* 위아래로 흐려지는 덮개. 눌리지 않게 둔다 — 휠은 그 아래에서 굴러간다. */}
        <Fade edge="top" />
        <Fade edge="bottom" />
      </View>

      <View style={styles.picked}>
        <ThemedText type="t5" numeric style={styles.bold}>
          {formatDateDot(iso)}
        </ThemedText>
        <ThemedText numeric themeColor="tint" style={[styles.bold, styles.dday]}>
          {ddayLabel(remaining.kind === 'upcoming' ? remaining.days : 0)}
        </ThemedText>
      </View>

      <View style={styles.cta}>
        <ActionButton variant="primary" size="sheet" label={S.confirm} onPress={() => onConfirm(iso)} />
      </View>
    </SheetPanel>
  );
}

/**
 * 휠 한 열.
 *
 * 스크롤 위치를 값으로 읽는다 — `snapToInterval`이 한 칸(48)마다 멈추므로 중앙에
 * 걸린 것은 `offset / 48`번째다. 위아래 패딩 96이 첫 항목을 밴드 자리로 내려 준다.
 *
 * `value`가 밖에서 바뀌면(월을 굴려 일이 당겨졌을 때) 그 자리로 되돌린다. **사람이
 * 굴리는 중에는 건드리지 않는다** — 손 밑에서 목록이 움직이면 고르던 것을 놓친다.
 */
function Wheel<T extends number>({
  accessibilityLabel,
  flex,
  items,
  format,
  value,
  onChange,
}: {
  accessibilityLabel: string;
  flex: number;
  items: readonly T[];
  format: (item: T) => string;
  value: T;
  onChange: (item: T) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const dragging = useRef(false);
  /* 첫 배치를 했는가. 안드로이드는 `contentOffset`을 무시하므로 한 번은 직접 굴려 준다. */
  const placed = useRef(false);
  const index = Math.max(items.indexOf(value), 0);
  const [centered, setCentered] = useState(index);

  useEffect(() => {
    if (placed.current && (dragging.current || centered === index)) return;

    placed.current = true;
    setCentered(index);
    ref.current?.scrollTo({ y: index * ITEM, animated: false });
  }, [index, centered]);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.min(Math.max(Math.round(event.nativeEvent.contentOffset.y / ITEM), 0), items.length - 1);
    const item = items[next];

    if (item === undefined || next === centered) return;

    setCentered(next);
    /* 멈추기를 기다리지 않는다 — 굴리는 중에도 아래 결과가 따라 움직인다(시안 B). */
    if (item !== value) onChange(item);
  }

  return (
    <ScrollView
      ref={ref}
      accessibilityLabel={accessibilityLabel}
      style={[styles.wheel, { flex }]}
      contentContainerStyle={styles.wheelContent}
      contentOffset={{ x: 0, y: index * ITEM }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={onScroll}
      onScrollBeginDrag={() => {
        dragging.current = true;
      }}
      onScrollEndDrag={() => {
        dragging.current = false;
      }}
      onMomentumScrollEnd={() => {
        dragging.current = false;
      }}>
      {items.map((item, at) => (
        <WheelItem key={item} label={format(item)} distance={Math.abs(at - centered)} />
      ))}
    </ScrollView>
  );
}

/** 항목 하나. 중앙에서 멀어질수록 작아지고 옅어진다 — 시안 `wheelItem`의 네 단계. */
function WheelItem({ label, distance }: { label: string; distance: number }) {
  const theme = useTheme();
  const step = Math.min(distance, STEP_COLOR.length - 1);

  return (
    <View style={styles.item}>
      <ThemedText numeric style={[STEP_TEXT[step] ?? styles.far, { color: theme[STEP_COLOR[step] ?? 'text'] }]}>
        {label}
      </ThemedText>
    </View>
  );
}

/**
 * 위아래 덮개 — 시안 `wheelFadeTop` «#fff 30% → 투명» · `wheelFadeBottom` «투명 → #fff 70%».
 *
 * **React Native에는 그라데이션이 없다.** 이 한 자리를 위해 `expo-linear-gradient`를
 * 새로 들이는 대신 96을 네 칸(24)으로 끊어 흉내 낸다. 칸마다의 불투명도는 원래
 * 기울기를 그 칸 가운데에서 읽은 값이다 — 끊긴 자리가 보이지 않을 만큼은 촘촘하고,
 * 라이브러리 하나를 더 싣지는 않는다.
 */
function Fade({ edge }: { edge: 'top' | 'bottom' }) {
  const theme = useTheme();
  const steps = edge === 'top' ? FADE_STEPS : [...FADE_STEPS].reverse();

  return (
    <View pointerEvents="none" style={[styles.fade, edge === 'top' ? styles.fadeTop : styles.fadeBottom]}>
      {steps.map((opacity, at) => (
        <View key={at} style={[styles.fadeStep, { backgroundColor: theme.background, opacity }]} />
      ))}
    </View>
  );
}

const S = {
  title: '예식일 선택',
  close: '닫기',
  year: '연도',
  month: '월',
  day: '일',
  confirm: '확인',
} as const;

/*
 * 시안 `wheelCol` · `wheelItem` · `wheelBand` · `wheelFadeTop` 실측 —
 * spec/tokens.json `component.dateWheel`. 이 시트 밖에서 쓰지 않아 여기 둔다.
 */
/** 휠 한 칸. 밴드 높이와 같다. */
const ITEM = 48;
/** 열 높이. 위아래 패딩 96을 빼면 가운데 48이 남고 그것이 밴드다(240 - 96*2 = 48). */
const HEIGHT = 240;
const PAD = (HEIGHT - ITEM) / 2;
/** 연 열이 조금 넓다 — 「2027년」이 「5월」 · 「16일」보다 길다. */
const FLEX_YEAR = 1.1;
const FLEX_MONTH = 1;
const FLEX_DAY = 1;
/** 덮개 한 겹의 불투명도. 위는 이 순서, 아래는 뒤집어 쓴다. */
const FADE_STEPS = [1, 0.89, 0.54, 0.18] as const;

/** 중앙에서 0 · 1 · 2 · 3칸 밖. 크기와 색이 네 단계로 줄어든다. */
const STEP_COLOR = ['text', 'textAssistive', 'dateWheelTwo', 'dateWheelFar'] as const;

const styles = StyleSheet.create({
  /* 시안 sheet — 패딩 · 둥글기 · 그래버는 SheetPanel. 요소 사이만 16(공용 20보다 좁다). */
  sheet: { gap: Spacing.three },
  /* 시안 sheetHead — 제목과 닫기를 양끝으로. */
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.rowPaddingY,
    minHeight: Layout.sheetClose,
  },
  close: {
    width: Layout.sheetClose,
    height: Layout.sheetClose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 시안 wheelWrap — 세 열이 나란히 굴러가고 밖으로 나간 항목은 잘린다. */
  wheels: { flexDirection: 'row', height: HEIGHT, overflow: 'hidden' },
  /* 시안 wheelBand — 가운데 한 칸. 열보다 뒤에 깔린다. */
  band: { position: 'absolute', left: 0, right: 0, top: PAD, height: ITEM, borderRadius: Radius.medium },
  wheel: { minWidth: 0, height: HEIGHT },
  /* 위아래 패딩이 첫 · 끝 항목을 밴드 자리까지 데려온다. */
  wheelContent: { paddingVertical: PAD },
  item: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
  near: { fontSize: FontSize.t4, lineHeight: LineHeight.t4, fontWeight: 700 },
  one: { fontSize: FontSize.t5, lineHeight: LineHeight.t5 },
  two: { fontSize: FontSize.dateWheel, lineHeight: LineHeight.dateWheel },
  far: { fontSize: FontSize.t6, lineHeight: LineHeight.t6 },
  fade: { position: 'absolute', left: 0, right: 0, height: PAD },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
  fadeStep: { flex: 1 },
  /* 시안 pickedRow — 결과 줄 · baseline 정렬 · 좌우 2. */
  picked: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Layout.rowPaddingY,
    paddingHorizontal: Spacing.half,
  },
  /* 시안 pickedDday 15/22/700 — t 사다리에 없는 값이라 이 시트에서만 쓴다. */
  dday: { fontSize: FontSize.dateWheelDday, lineHeight: LineHeight.dateWheelDday },
  /* width 100% · flex 0 0 — 세로 컨테이너에서 늘어나지 않는다(SPEC §13.7). */
  cta: { width: '100%', flexGrow: 0, flexShrink: 0 },
  bold: { fontWeight: 700 },
});

const STEP_TEXT = [styles.near, styles.one, styles.two, styles.far] as const;
