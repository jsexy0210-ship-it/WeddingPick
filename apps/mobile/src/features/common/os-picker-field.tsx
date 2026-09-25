import { useState } from 'react';
import { View } from 'react-native';

import { formatDateDot } from '@/features/common/format-date';
import { FieldButton } from '@/features/wedding/screen-kit';
import { ProductSymbol, useTheme } from '@weddingpick/ui';

import { acceptDay, TIME_PATTERN, type OsDateFieldProps, type OsTimeFieldProps } from './os-picker-field.shared';
import { DateWheelSheet, TimeWheelSheet } from './wheel-picker-sheet';

export type { OsDateFieldProps, OsTimeFieldProps } from './os-picker-field.shared';

/**
 * 날짜 필드 — 누르면 **디자인된 날짜 휠 시트**(년 · 월 · 일 3열)가 뜬다(2026-09-25 대표 지시
 * 「로그인 이후 날짜, 시간 등록 수정 등은 OS 피커로 변경한다」 · 「디자인된 OS 날짜, 시간
 * 선택기로 구현한다」). 시스템 선택기(`@react-native-community/datetimepicker` · 웹
 * `<input type="date">`)는 걷어냈다 — 네이티브 · 웹 모두 같은 시트다(`wheel-picker-sheet.tsx`).
 *
 * 겉모습은 폼 공용 `FieldButton`(라벨 + 값 칸)이고 값 표기는 전역 `2027.05.16(토)`이다.
 * 이름(`Os…Field`)과 props는 쓰는 화면을 다시 고치지 않도록 그대로 둔다.
 */
export function OsDateField({ label, value, placeholder, onChange, min, max, accent, testID }: OsDateFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View testID={testID}>
      <FieldButton
        label={label}
        value={value ? formatDateDot(value) : null}
        placeholder={placeholder}
        open={open}
        accent={accent}
        icon={<ProductSymbol name="calendar" size={20} color={accent ? theme.tint : theme.textAssistive} />}
        onPress={() => setOpen(true)}
      />
      <DateWheelSheet
        visible={open}
        title={`${label} ${S.pick}`}
        value={value}
        min={min}
        max={max}
        onConfirm={(day) => {
          setOpen(false);
          if (acceptDay(day, min, max)) onChange(day);
        }}
        onDismiss={() => setOpen(false)}
      />
    </View>
  );
}

/**
 * 시간 필드 — 누르면 **디자인된 시간 휠 시트**(오전/오후 · 시 · 분)가 뜬다(같은 지시).
 *
 * 값 표기는 24시간 `14:00` — 일정의 전역 표기 `2027.05.16(토) 14:00`와 같다.
 */
export function OsTimeField({ label, value, placeholder, onChange, testID }: OsTimeFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View testID={testID}>
      <FieldButton
        label={label}
        value={value}
        placeholder={placeholder}
        open={open}
        icon={<ProductSymbol name="clock" size={20} color={theme.textAssistive} />}
        onPress={() => setOpen(true)}
      />
      <TimeWheelSheet
        visible={open}
        title={`${label} ${S.pick}`}
        value={value}
        onConfirm={(time) => {
          setOpen(false);
          if (TIME_PATTERN.test(time)) onChange(time);
        }}
        onDismiss={() => setOpen(false)}
      />
    </View>
  );
}

const S = { pick: '선택' } as const;
