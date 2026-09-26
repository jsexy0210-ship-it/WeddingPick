import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';
import { Wheel, WheelGroup } from '@/features/onboarding/wheel';
import { ActionButton, Layout } from '@weddingpick/ui';

import {
  clampParts,
  dayItems,
  HOUR_ITEMS,
  joinDay,
  joinTime,
  MERIDIEM_ITEMS,
  MINUTE_ITEMS,
  monthItems,
  splitDay,
  splitTime,
  wheelBounds,
  yearItems,
  type DayParts,
  type Meridiem,
  type TimeParts,
} from './os-picker-field.shared';

/**
 * 디자인된 날짜 · 시간 선택 시트 — 로그인 이후 모든 날짜 · 시간 등록 · 수정이 여는 휠 시트
 * (2026-09-25 대표 지시 「디자인된 OS 날짜, 시간 선택기로 구현한다」). 네이티브 · 웹 모두 이 시트다.
 *
 *   ━━                                  그래버 40×4(공용 SheetPanel)
 *   날짜 선택                      ✕     공용 SheetHeader(타이틀 + 우측 X)
 *   ┌──────┬─────┬─────┐
 *   │2026년│ 8월 │ 11일│  ← 흐림      열 높이 240 · 항목 48 · 위아래 패딩 96
 *   │2027년│ 9월 │ 12일│  ← 밴드      가운데 48이 밴드(radius 10)
 *   │2028년│10월 │ 13일│  ← 흐림      멀어질수록 20/700 → 18 → 17 → 16
 *   └──────┴─────┴─────┘
 *   [            확인            ]
 *
 * 값: RN 정본 `home.js:701~714`(`wheelSheet` 간격 14 · `sheetHead` · `sheetClose` ·
 * `wheelWrap` 240 · `wheelBand` 48 · `wheelFadeTop/Bottom` 96 · `wheelItem` 네 단계) ·
 * `note.js:68~91` `dateWheels`(년 · 월 · 일 3열, 「2026년」 · 「7월」 · 「10일」 표기). 휠
 * 부품은 온보딩 · 지역 시트와 같은 `wheel.tsx`다 — 규격을 새로 적지 않는다.
 *
 * 시간 휠(오전/오후 · 시 · 분)과 시트 머리의 제목 · 하단 「확인」은 정본에 펼친 그림이 없어
 * `DESIGN_UNRESOLVED`다 — 공통 바텀시트 규칙(타이틀 + 우측 X · Primary CTA 1개)을 따른다.
 *
 * `BottomSheet`는 닫히면 children을 내린다 — 열 때마다 받은 값에서 새로 시작한다.
 */
export function DateWheelSheet({
  visible,
  title,
  value,
  min,
  max,
  onConfirm,
  onDismiss,
  today = new Date(),
}: {
  visible: boolean;
  title: string;
  /** `YYYY-MM-DD`. 없으면 오늘(범위 안으로 당겨서)에서 시작한다. */
  value: string | null;
  min?: string;
  max?: string;
  onConfirm: (day: string) => void;
  onDismiss: () => void;
  /** 시험이 오늘을 정할 수 있게 받는다. */
  today?: Date;
}) {
  return (
    <BottomSheet visible={visible} onRequestClose={onDismiss}>
      <DateBody title={title} value={value} min={min} max={max} today={today} onConfirm={onConfirm} onDismiss={onDismiss} />
    </BottomSheet>
  );
}

function DateBody({
  title,
  value,
  min,
  max,
  today,
  onConfirm,
  onDismiss,
}: {
  title: string;
  value: string | null;
  min?: string;
  max?: string;
  today: Date;
  onConfirm: (day: string) => void;
  onDismiss: () => void;
}) {
  const { first, last } = useMemo(() => wheelBounds(min, max, today), [min, max, today]);
  const [picked, setPicked] = useState<DayParts>(() =>
    clampParts(
      (value && splitDay(value)) || { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() },
      first,
      last
    )
  );

  const years = useMemo(() => yearItems(first, last), [first, last]);
  const months = useMemo(() => monthItems(picked.year, first, last), [picked.year, first, last]);
  const days = useMemo(() => dayItems(picked.year, picked.month, first, last), [picked.year, picked.month, first, last]);

  /* 굴린 값은 곧바로 넣지 않고 목록 안으로 맞춘다 — 1월 31일에서 2월로 굴리면 2월 28일. */
  function change(part: Partial<DayParts>) {
    setPicked((current) => clampParts({ ...current, ...part }, first, last));
  }

  return (
    <SheetPanel style={styles.sheet}>
      <SheetHeader title={title} onClose={onDismiss} />

      <WheelGroup>
        <Wheel
          numeric
          accessibilityLabel={S.year}
          flex={FLEX_YEAR}
          items={years}
          format={(year) => `${year}년`}
          value={picked.year}
          onChange={(year) => change({ year })}
        />
        <Wheel
          numeric
          accessibilityLabel={S.month}
          flex={1}
          items={months}
          format={(month) => `${month}월`}
          value={picked.month}
          onChange={(month) => change({ month })}
        />
        <Wheel
          numeric
          accessibilityLabel={S.day}
          flex={1}
          items={days}
          format={(day) => `${day}일`}
          value={picked.day}
          onChange={(day) => change({ day })}
        />
      </WheelGroup>

      <View style={styles.cta}>
        <ActionButton variant="primary" size="sheet" label={S.confirm} onPress={() => onConfirm(joinDay(picked))} />
      </View>
    </SheetPanel>
  );
}

/** 시간 휠 — 오전/오후 · 시 · 분 3열. 분 간격은 `MINUTE_STEP`(10분 · `DESIGN_UNRESOLVED`). */
export function TimeWheelSheet({
  visible,
  title,
  value,
  onConfirm,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  /** `HH:MM`(24시간). 없으면 14:00에서 시작한다. */
  value: string | null;
  onConfirm: (time: string) => void;
  onDismiss: () => void;
}) {
  return (
    <BottomSheet visible={visible} onRequestClose={onDismiss}>
      <TimeBody title={title} value={value} onConfirm={onConfirm} onDismiss={onDismiss} />
    </BottomSheet>
  );
}

function TimeBody({
  title,
  value,
  onConfirm,
  onDismiss,
}: {
  title: string;
  value: string | null;
  onConfirm: (time: string) => void;
  onDismiss: () => void;
}) {
  const [picked, setPicked] = useState<TimeParts>(() => splitTime(value) ?? splitTime(DEFAULT_TIME)!);

  return (
    <SheetPanel style={styles.sheet}>
      <SheetHeader title={title} onClose={onDismiss} />

      <WheelGroup>
        <Wheel<Meridiem>
          accessibilityLabel={S.meridiem}
          flex={1}
          items={MERIDIEM_ITEMS}
          format={(meridiem) => MERIDIEM_LABEL[meridiem]}
          value={picked.meridiem}
          onChange={(meridiem) => setPicked((current) => ({ ...current, meridiem }))}
        />
        <Wheel
          numeric
          accessibilityLabel={S.hour}
          flex={1}
          items={HOUR_ITEMS}
          format={(hour) => `${hour}시`}
          value={picked.hour}
          onChange={(hour) => setPicked((current) => ({ ...current, hour }))}
        />
        <Wheel
          numeric
          accessibilityLabel={S.minute}
          flex={1}
          items={MINUTE_ITEMS}
          format={(minute) => `${String(minute).padStart(2, '0')}분`}
          value={picked.minute}
          onChange={(minute) => setPicked((current) => ({ ...current, minute }))}
        />
      </WheelGroup>

      <View style={styles.cta}>
        <ActionButton variant="primary" size="sheet" label={S.confirm} onPress={() => onConfirm(joinTime(picked))} />
      </View>
    </SheetPanel>
  );
}

/** 1열 휠의 보기 하나 — 저장 값과 휠에 적는 글자. */
export type WheelOption<T extends string> = { value: T; label: string };

/**
 * 1열 휠 시트 — 날짜 · 시간이 아닌 값 하나를 고른다(2026-09-26 대표 지시 「내 웨딩설정은
 * 모든 항목이 휠 바텀시트 · 날짜 외에는 1열 휠」).
 *
 *   ━━
 *   준비 현황 선택                 ✕
 *   ┌───────────────────────────┐
 *   │     아직 시작 전이에요     │  ← 흐림
 *   │          웨딩홀           │  ← 밴드
 *   │          스드메           │  ← 흐림
 *   └───────────────────────────┘
 *   [            확인            ]
 *
 * 규격은 날짜 휠과 같다 — RN 정본 `home.js:701~714` `wheelSheet`(간격 14) · `wheelWrap` 240 ·
 * `wheelBand` 48 · `sheetDock` 「확인」 ctaFull. 열만 하나(`wheelCol` flex 1)다. 휠 부품은
 * 온보딩과 같은 `wheel.tsx`다.
 *
 * `value`가 보기에 없으면(아직 안 골랐거나 옛 값) 첫 보기에서 시작한다 — 짐작으로 정하지
 * 않는다(지역 시트와 같다). 「확인」을 눌러야 저장된다 — 굴리기만 하고 닫으면 그대로다.
 */
export function OptionWheelSheet<T extends string>({
  visible,
  title,
  accessibilityLabel,
  options,
  value,
  onConfirm,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  /** 휠 열의 이름(스크린 리더). */
  accessibilityLabel: string;
  options: readonly WheelOption<T>[];
  value: T | null;
  onConfirm: (value: T) => void;
  onDismiss: () => void;
}) {
  return (
    <BottomSheet visible={visible} onRequestClose={onDismiss}>
      <OptionBody
        title={title}
        accessibilityLabel={accessibilityLabel}
        options={options}
        value={value}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />
    </BottomSheet>
  );
}

function OptionBody<T extends string>({
  title,
  accessibilityLabel,
  options,
  value,
  onConfirm,
  onDismiss,
}: {
  title: string;
  accessibilityLabel: string;
  options: readonly WheelOption<T>[];
  value: T | null;
  onConfirm: (value: T) => void;
  onDismiss: () => void;
}) {
  const values = useMemo(() => options.map((option) => option.value), [options]);
  const labels = useMemo(() => new Map(options.map((option) => [option.value, option.label])), [options]);
  const [picked, setPicked] = useState<T | null>(() =>
    value !== null && values.includes(value) ? value : (values[0] ?? null)
  );

  return (
    <SheetPanel style={styles.sheet}>
      <SheetHeader title={title} onClose={onDismiss} />

      {picked !== null ? (
        <WheelGroup>
          <Wheel<T>
            accessibilityLabel={accessibilityLabel}
            flex={1}
            items={values}
            format={(item) => labels.get(item) ?? item}
            value={picked}
            onChange={setPicked}
          />
        </WheelGroup>
      ) : null}

      <View style={styles.cta}>
        <ActionButton
          variant="primary"
          size="sheet"
          label={S.confirm}
          disabled={picked === null}
          onPress={() => {
            if (picked !== null) onConfirm(picked);
          }}
        />
      </View>
    </SheetPanel>
  );
}

/** 시간을 아직 안 골랐을 때 휠이 가리키는 자리 — 일정 폼의 기본 시각과 같다. */
const DEFAULT_TIME = '14:00';

const MERIDIEM_LABEL: Record<Meridiem, string> = { am: '오전', pm: '오후' };

const S = {
  year: '연도',
  month: '월',
  day: '일',
  meridiem: '오전 오후',
  hour: '시',
  minute: '분',
  confirm: '확인',
} as const;

/** 연 열이 조금 넓다 — 「2027년」이 「5월」 · 「16일」보다 길다(tokens `component.dateWheel.flexYear`). */
const FLEX_YEAR = 1.1;

const styles = StyleSheet.create({
  /* RN 정본 home.js wheelSheet — 패딩/그래버는 SheetPanel, 요소 사이 14. */
  sheet: { gap: Layout.sectionHeadGap },
  /* width 100% · flex 0 0 — 세로 컨테이너에서 늘어나지 않는다(SPEC §13.7). */
  cta: { width: '100%', flexGrow: 0, flexShrink: 0 },
});
