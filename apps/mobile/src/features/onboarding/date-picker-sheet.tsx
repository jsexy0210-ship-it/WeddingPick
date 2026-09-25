import { dDay, formatDateDot } from '@weddingpick/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionButton, FontSize, Layout, LineHeight, Spacing, ThemedText } from '@weddingpick/ui';
import { BottomSheet, SheetHeader, SheetPanel } from '@/features/common/bottom-sheet';
import { OsDateField } from '@/features/common/os-picker-field';

import { firstSelectable, toIso, YEAR_SPAN } from './calendar';
import { ddayLabel } from './flow';

/**
 * 날짜 선택 시트 — 예식일(WP-AUTH-002)의 필드가 여는 시트. **날짜는 OS 날짜 선택기로 고른다.**
 *
 *   ━━                                  그래버 40×4(공용 SheetPanel)
 *   예식일 선택                    ✕     공용 SheetHeader(타이틀 + 우측 X)
 *   [ 2027.05.16(토)            📅 ]     OsDateField — 누르면 OS 날짜 선택기
 *   2027.05.16(토)                D-250
 *   [            확인            ]
 *
 * **2026-09-25 대표 지시로 휠 3열(WP-APP-023)을 걷어냈다** — 「바텀시트에서 날짜 선택 UX
 * 변경한다. OS 데이트피커」. 휠과 연 · 월 · 일 목록 계산(`wheel.tsx`의 날짜 쪽 · `calendar.ts`의
 * `yearOptions` 등)은 쓰는 곳이 없어져 지웠다. 없는 날짜(2월 31일)는 OS 선택기가 애초에
 * 내주지 않는다.
 *
 * **과거는 고를 수 없다** — 범위는 그대로다: 첫 날은 내일(`firstSelectable`), 마지막 날은
 * 올해부터 5년 뒤의 12월 31일(`YEAR_SPAN`). 선택기에 min · max로 걸고, 웹 데스크톱처럼
 * 칸에 직접 적을 수 있는 곳도 `OsDateField`가 범위 밖 값을 받지 않는다.
 *
 * 결과 줄(날짜 + D-day)은 휠 시절의 기존 보강이다 — RN 정본에 펼친 시트 그림이 없어
 * `DESIGN_UNRESOLVED`로 남기고 그대로 둔다.
 */
export function DatePickerSheet({
  visible,
  value,
  onConfirm,
  onDismiss,
  today = new Date(),
}: {
  visible: boolean;
  /** 이미 고른 날. 시트는 그 값을 든 채로 열린다. */
  value: string | null;
  onConfirm: (iso: string) => void;
  onDismiss: () => void;
  /** 테스트와 시안 재현이 오늘을 정할 수 있게 받는다. */
  today?: Date;
}) {
  return (
    /* BottomSheet는 닫히면 children을 통째로 내린다 — 열 때마다 새로 마운트되어 지난번 고르다 만 값이 남지 않는다. */
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
  const min = toIso(first.year, first.month, first.day);
  const max = toIso(today.getFullYear() + YEAR_SPAN - 1, 12, 31);

  /* 고른 날이 없으면 고를 수 있는 첫 날(내일)에서 시작한다 — 짐작으로 날을 정하지 않는다. */
  const [iso, setIso] = useState(() => (value && value >= min && value <= max ? value : min));
  const remaining = dDay(iso, today);

  return (
    <SheetPanel style={styles.sheet}>
      <SheetHeader title={S.title} onClose={onDismiss} />

      <OsDateField label={S.field} value={iso} placeholder={S.placeholder} min={min} max={max} onChange={setIso} />

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
  field: '예식일',
  placeholder: '날짜를 골라주세요',
  confirm: '확인',
} as const;

const styles = StyleSheet.create({
  /* RN 정본 home.js wheelSheet — 패딩/그래버는 SheetPanel, 요소 사이 14. */
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
