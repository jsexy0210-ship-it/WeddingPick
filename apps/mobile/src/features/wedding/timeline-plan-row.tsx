import { StyleSheet, View } from 'react-native';

import { daysUntil, formatDday } from '@weddingpick/domain';
import { Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import { ExpenseRowActions } from './expense-row-actions';
import { noteMonthDayWeekday } from './note-format';
import type { TimelinePlan } from './timeline-groups';

/**
 * 웨딩일정 타임라인의 할 일 한 줄 — `docs/design/React_Native/note.js` `tlItem(time, title, meta, 'next')`.
 *
 *   rail  `width:12px;gap:6px` · 점 9px · `margin-top:16px` · 코랄(P)
 *   card  `padding:14px 16px;border-radius:10px;gap:3px;background:SEC`
 *   time  12/700 MUTED — 할 일은 시간이 없어 「9.30(수)」처럼 요일까지만
 *   title 15/700 INK · meta 13 SUB
 *
 * 임시 날짜(`tentative`)는 메타 줄에 「예식일 기준 임시 날짜」(홈과 같은 문구)를 단다 — 모양은
 * 정본 'next' 줄 그대로다.
 *
 * 수정 · 삭제 CTA는 서버에 행이 있는 줄(`editable`)의 내용 아래에 둔다.
 */
export function TimelinePlanRow({
  plan,
  busy = false,
  onEdit,
  onDelete,
}: {
  plan: TimelinePlan;
  busy?: boolean;
  onEdit?: (plan: TimelinePlan) => void;
  onDelete?: (plan: TimelinePlan) => void;
}) {
  const theme = useTheme();
  const daysLeft = daysUntil(plan.date);
  const time = `${noteMonthDayWeekday(plan.date)}${daysLeft < 0 ? ` · ${formatDday(daysLeft)}` : ''}`;

  return (
    <View style={styles.row} testID={plan.tentative ? 'timeline-plan-tentative' : 'timeline-plan'}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: theme.tint }]} />
        <View style={[styles.line, { backgroundColor: theme.border }]} />
      </View>
      <View style={[styles.card, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={styles.text}
          accessible
          accessibilityLabel={[time, plan.title, plan.meta].filter((part) => part.length > 0).join(' · ')}>
          <ThemedText type="f12" themeColor="textAssistive" numeric style={styles.bold}>
            {time}
          </ThemedText>
          <ThemedText type="f15" numberOfLines={1} style={styles.bold}>
            {plan.title}
          </ThemedText>
          {plan.meta.length > 0 ? (
            <ThemedText type="f13" themeColor="textSecondary" numberOfLines={1}>
              {plan.meta}
            </ThemedText>
          ) : null}
        </View>
        {plan.editable && onEdit && onDelete ? (
          <View style={styles.actions}>
            <ExpenseRowActions
              label={plan.title}
              disabled={busy}
              testIDPrefix="timeline-row"
              onEdit={() => onEdit(plan)}
              onDelete={() => onDelete(plan)}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* 값은 웨딩노트 `timelineRow` · `timelineRail` · `timelineDot` · `eventRow`와 같다(note.js `tlRow` · `tlRail` · `tlItem`). */
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Layout.inlineGap, paddingBottom: Spacing.two },
  rail: { width: 12, alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: Radius.pill, marginTop: 16 },
  line: { flex: 1, width: 1, minHeight: 6 },
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: Spacing.two,
  },
  text: { flex: 1, minWidth: 0, gap: 3 },
  actions: { alignSelf: 'stretch' },
  bold: { fontWeight: 700 },
});
