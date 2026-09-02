import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Layout, Radius, Spacing } from './theme';
import { useTheme } from './use-theme';

/**
 * 예식일 캘린더. 디자인 핸드오프 3번.
 *
 * **오늘 포함 과거는 고를 수 없다** — 결혼식은 미래이기 때문이다. 일요일은 붉게,
 * 토요일은 파랗게. 오늘은 테두리로 표시하되 고를 수는 없다.
 *
 * `allowPast=true`이면 제한을 뒤집는다 — 방문노트처럼 지난 날을 골라야 할 때 쓴다.
 */
export type WeddingCalendarProps = {
  /** 'YYYY-MM-DD' 또는 아직 안 고름. */
  value: string | null;
  onChange: (value: string) => void;
  /** 테스트가 오늘을 정할 수 있게 받는다. */
  today?: Date;
  /** true이면 과거 날짜도 고를 수 있다. 기본값은 false(미래만). */
  allowPast?: boolean;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const pad = (value: number) => String(value).padStart(2, '0');

const iso = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

/** 그 달의 1일이 무슨 요일인지, 며칠까지인지. */
function monthShape(year: number, month: number) {
  return {
    firstWeekday: new Date(year, month, 1).getDay(),
    dayCount: new Date(year, month + 1, 0).getDate(),
  };
}

export function WeddingCalendar({ value, onChange, today = new Date(), allowPast = false }: WeddingCalendarProps) {
  const theme = useTheme();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [cursor, setCursor] = useState(() => {
    if (value) {
      const [year, month] = value.split('-').map(Number);

      return { year: year!, month: month! - 1 };
    }

    return { year: today.getFullYear(), month: today.getMonth() };
  });

  const { firstWeekday, dayCount } = monthShape(cursor.year, cursor.month);
  /** 42칸. 앞의 빈 칸은 null. 달마다 높이가 달라지면 시트가 들썩인다. */
  const cells = [
    ...Array.from<null>({ length: firstWeekday }).fill(null),
    ...Array.from({ length: dayCount }, (_, index) => index + 1),
  ];

  while (cells.length < 42) cells.push(null);

  // allowPast이면 제한 없음. 아니면 이번 달에서는 이전 달로 갈 수 없다.
  const atCurrentMonth =
    !allowPast &&
    cursor.year === today.getFullYear() && cursor.month === today.getMonth();

  function move(delta: number) {
    const next = new Date(cursor.year, cursor.month + delta, 1);

    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  }

  return (
    <ThemedView style={styles.root}>
      <ThemedView style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          disabled={atCurrentMonth}
          hitSlop={Spacing.two}
          onPress={() => move(-1)}>
          <ThemedText type="t4" themeColor={atCurrentMonth ? 'textDisabled' : 'text'}>
            ‹
          </ThemedText>
        </Pressable>

        <ThemedText type="t5">
          {cursor.year}년 {cursor.month + 1}월
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          hitSlop={Spacing.two}
          onPress={() => move(1)}>
          <ThemedText type="t4">›</ThemedText>
        </Pressable>
      </ThemedView>

      <View style={styles.week}>
        {WEEKDAYS.map((label, index) => (
          <ThemedText
            key={label}
            type="t7"
            style={styles.cell}
            themeColor={index === 0 ? 'negative' : index === 6 ? 'tint' : 'textAssistive'}>
            {label}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} style={styles.cell} />;
          }

          const date = iso(cursor.year, cursor.month, day);
          const asDate = new Date(cursor.year, cursor.month, day);
          const selectable = allowPast
            ? asDate.getTime() <= startOfToday.getTime()
            : asDate.getTime() > startOfToday.getTime();
          const isToday = asDate.getTime() === startOfToday.getTime();
          const selected = value === date;
          const weekday = index % 7;

          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={`${cursor.month + 1}월 ${day}일`}
              accessibilityState={{ selected, disabled: !selectable }}
              disabled={!selectable}
              style={styles.cell}
              onPress={() => onChange(date)}>
              <View
                style={[
                  styles.day,
                  selected && { backgroundColor: theme.tint },
                  // 오늘은 테두리로 표시한다. 고를 수는 없다.
                  !selected && isToday && { borderWidth: 1.5, borderColor: theme.tint },
                ]}>
                <ThemedText
                  type="t6"
                  style={selected ? styles.selectedLabel : undefined}
                  themeColor={
                    selected
                      ? undefined
                      : !selectable
                        ? 'track'
                        : weekday === 0
                          ? 'negative'
                          : weekday === 6
                            ? 'tint'
                            : 'text'
                  }>
                  {day}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  week: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    height: Layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedLabel: { color: '#ffffff', fontWeight: 700 },
});
