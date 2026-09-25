import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { formatDateDot } from '@/features/common/format-date';
import { FieldButton } from '@/features/wedding/screen-kit';
import { ProductSymbol, useTheme } from '@weddingpick/ui';

import {
  acceptDay,
  dateOfDay,
  dateOfTime,
  dayOf,
  initialDate,
  timeOf,
  type OsDateFieldProps,
  type OsTimeFieldProps,
} from './os-picker-field.shared';

export type { OsDateFieldProps, OsTimeFieldProps } from './os-picker-field.shared';

/**
 * 날짜 필드 — 누르면 **OS 기본 날짜 선택기**가 뜬다(2026-09-25 대표 지시 「바텀시트에서
 * 날짜 선택 UX 변경한다. OS 데이트피커」). 휠 3열(WP-APP-023)과 앱이 그리던 달력을 대신한다.
 *
 *   Android  시스템 날짜 대화상자(`DateTimePickerAndroid.open`)
 *   iOS      필드 아래에 시스템 달력(`display="inline"`)이 펼쳐진다
 *   웹       `os-picker-field.web.tsx` — 브라우저 `<input type="date">`
 *
 * 겉모습은 폼 공용 `FieldButton`(라벨 + 값 칸)이고 값 표기는 전역 `2027.05.16(토)`이다.
 */
export function OsDateField({ label, value, placeholder, onChange, min, max, accent, testID }: OsDateFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const minimumDate = dateOfDay(min) ?? undefined;
  const maximumDate = dateOfDay(max) ?? undefined;

  /* `onValueChange`는 고른 값에만 온다 — 취소 · 바깥 탭은 `onDismiss`로 가고 값은 그대로다. */
  function commit(_event: unknown, date: Date) {
    const day = dayOf(date);
    if (acceptDay(day, min, max)) onChange(day);
  }

  function press() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initialDate(value, min, max),
        mode: 'date',
        minimumDate,
        maximumDate,
        onValueChange: commit,
      });
      return;
    }

    setOpen((current) => !current);
  }

  return (
    <View testID={testID}>
      <FieldButton
        label={label}
        value={value ? formatDateDot(value) : null}
        placeholder={placeholder}
        open={open}
        accent={accent}
        icon={<ProductSymbol name="calendar" size={20} color={accent ? theme.tint : theme.textAssistive} />}
        onPress={press}
      />
      {open ? (
        <DateTimePicker
          value={initialDate(value, min, max)}
          mode="date"
          display="inline"
          locale="ko-KR"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={theme.tint}
          onValueChange={commit}
          style={styles.inline}
        />
      ) : null}
    </View>
  );
}

/**
 * 시간 필드 — 누르면 **OS 기본 시간 선택기**가 뜬다(같은 지시 「시간 선택 타임피커 넣는다」).
 *
 *   Android  시스템 시간 대화상자
 *   iOS      필드 아래에 시스템 휠(`display="spinner"`)
 *   웹       `<input type="time">`
 *
 * 값 표기는 24시간 `14:00` — 일정의 전역 표기 `2027.05.16(토) 14:00`와 같다.
 */
export function OsTimeField({ label, value, placeholder, onChange, testID }: OsTimeFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = dateOfTime(value) ?? dateOfTime('14:00')!;

  function commit(_event: unknown, date: Date) {
    onChange(timeOf(date));
  }

  function press() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: current, mode: 'time', is24Hour: true, onValueChange: commit });
      return;
    }

    setOpen((was) => !was);
  }

  return (
    <View testID={testID}>
      <FieldButton
        label={label}
        value={value}
        placeholder={placeholder}
        open={open}
        icon={<ProductSymbol name="clock" size={20} color={theme.textAssistive} />}
        onPress={press}
      />
      {open ? (
        <DateTimePicker
          value={current}
          mode="time"
          display="spinner"
          locale="ko-KR"
          onValueChange={commit}
          style={styles.inline}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { alignSelf: 'stretch' },
});
