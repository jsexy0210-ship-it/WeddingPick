import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, FieldButton } from '@/features/wedding/screen-kit';
import { formatDateDot } from '@/features/common/format-date';
import { Spacing, WeddingCalendar } from '@weddingpick/ui';

export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `YYYY-MM-DD` + `HH:MM`(로컬) → ISO. 둘 중 하나라도 없으면 null. */
export function combineDayTime(day: string | null, time: string): string | null {
  if (day === null || !TIME_PATTERN.test(time)) return null;

  const parsed = new Date(`${day}T${time}:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** ISO → `{ day: 'YYYY-MM-DD', time: 'HH:MM' }`(로컬). */
export function splitDayTime(iso: string): { day: string; time: string } {
  const value = new Date(iso);
  const day = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate()
  ).padStart(2, '0')}`;
  const time = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;

  return { day, time };
}

/**
 * «일시» 필드 — WP-OUR-006 · WP-OUR-005 수정. 필드 하나로 보이고, 누르면 아래에 달력(WP-APP-023
 * 연월 셀렉트 + 달력)과 시각 칸이 펼쳐진다. 표기는 전역 고정 `2027.05.16(토) 14:00`.
 */
export function DateTimeField({
  day,
  time,
  onChangeDay,
  onChangeTime,
  allowPast = false,
}: {
  day: string | null;
  time: string;
  onChangeDay: (day: string) => void;
  onChangeTime: (time: string) => void;
  allowPast?: boolean;
}) {
  const [open, setOpen] = useState(day === null);
  const timeValid = TIME_PATTERN.test(time);
  const value = day === null ? null : `${formatDateDot(day)}${timeValid ? ` ${time}` : ''}`;

  return (
    <View style={styles.wrap}>
      <FieldButton
        label="일시"
        value={value}
        placeholder="날짜와 시각을 골라주세요"
        open={open}
        onPress={() => setOpen((current) => !current)}
      />
      {open ? (
        <View style={styles.picker}>
          <WeddingCalendar value={day} onChange={onChangeDay} allowPast={allowPast} />
          <Field
            label="시각"
            value={time}
            onChangeText={onChangeTime}
            placeholder="14:00"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            hint={timeValid ? null : '14:00 형태로 적어주세요'}
            hintColor={timeValid ? 'textAssistive' : 'negative'}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  picker: { gap: Spacing.three },
});
