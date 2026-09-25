import { dDay, formatDateDot } from '@weddingpick/domain';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionButton, FontSize, Layout, LineHeight, Spacing, ThemedText } from '@weddingpick/ui';
import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';

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
import { Wheel, WheelGroup } from './wheel';

/**
 * 온보딩 예식일 선택 시트 — 예식일(WP-AUTH-002)의 필드가 여는 휠 시트. **휠 3열**.
 *
 * **온보딩(`app/setup.tsx`) 전용이다.** 2026-09-25 대표 지시 「온보딩에서 예식일 선택 UX
 * 원복한다. 로그인 이후 날짜, 시간 등록 수정 등은 OS 피커로 변경한다」로 #539 이전 모습을
 * 되살렸다. 로그인 이후(MY 웨딩 설정 등)의 날짜 · 시간은 공용 `wheel-picker-sheet.tsx`를 쓴다.
 *
 *   ━━                                  그래버 40×4(공용 SheetPanel)
 *   예식일 선택                    ✕     공용 SheetHeader(타이틀 + 우측 X)
 *   ┌─────┬─────┬─────┐
 *   │2026년│ 4월 │15일 │  ← 흐림      열 높이 240 · 항목 48 · 위아래 패딩 96
 *   │2027년│ 5월 │16일 │  ← 밴드      가운데 48이 밴드(radius 10 · gray50)
 *   │2028년│ 6월 │17일 │  ← 흐림      멀어질수록 작아지고 옅어진다
 *   └─────┴─────┴─────┘
 *   2027.05.16(토)                D-250
 *   [            확인            ]
 *
 * **2026-09-23 정정 — 옛 화면번호 `WP-APP-023`(v3.18~v3.21 체계, 지금 정본에 없다)과
 * 「루트 시안」·`current/20-onboarding-v2` 경로를 근거로 적고 있었다.** v3.29 정본
 * `docs/design/React_Native/home.jsx`에는 예식일(WP-AUTH-002)이 필드 +
 * D-day + 「아직 정하지 않았어요」 칩만 그려져 있고 시트가 펼쳐진 그림은 없다 — 머리
 * (`sheetHead` 20/27 제목 · 36 닫기)와 휠 그림(`wheelWrap` · `wheelBand` · 페이드)은
 * 같은 부품을 쓰는 지역 시트(WP-AUTH-003)의 `wheelSheet` 값으로 맞춘다(공용 컴포넌트
 * `wheel.tsx`). 결과 줄(`picked` — 날짜 + D-day)은 RN 정본 home.jsx에 그려진 화면이
 * 아니라 이 시트 자체의 기존 UX 보강이라 `DESIGN_UNRESOLVED`로 남기고 그대로 둔다 —
 * 지우면 굴리는 중 무엇을 고르는지 확인할 길이 없어지는 실제 회귀라 임의로 걷어내지
 * 않는다(CLAUDE.md 「애매하면 만들지 않고 DESIGN_UNRESOLVED로 남긴다」는 «새로 만드는
 * 것»이 대상이고, 이미 있는 기존 보강을 정본에 없다는 이유만으로 지우는 것과는 다르다
 * — 그런 삭제는 공용 컴포넌트인지부터 먼저 확인해야 한다는 규칙에 따라 이번 PR
 * 범위에서 판단을 보류한다).
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
export function OnboardingDatePickerSheet({
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
      <SheetHeader title={S.title} closeLabel={S.close} onClose={onDismiss} />

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
          flex={FLEX_MONTH}
          items={months}
          format={(month) => `${month}월`}
          value={picked.month}
          onChange={(month) => change({ month })}
        />
        <Wheel
          numeric
          accessibilityLabel={S.day}
          flex={FLEX_DAY}
          items={days}
          format={(day) => `${day}일`}
          value={picked.day}
          onChange={(day) => change({ day })}
        />
      </WheelGroup>

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

const S = {
  title: '예식일 선택',
  close: '닫기',
  year: '연도',
  month: '월',
  day: '일',
  confirm: '확인',
} as const;

/* 휠 규격(칸 48 · 높이 240 · 덮개 · 네 단계)은 `wheel.tsx`가 들고 있다. */
/** 연 열이 조금 넓다 — 「2027년」이 「5월」 · 「16일」보다 길다. */
const FLEX_YEAR = 1.1;
const FLEX_MONTH = 1;
const FLEX_DAY = 1;

const styles = StyleSheet.create({
  /* RN 정본 home.jsx WP-AUTH-003 wheelSheet — 패딩/그래버는 SheetPanel, 요소 사이 14. */
  sheet: { gap: Layout.sectionHeadGap },
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
