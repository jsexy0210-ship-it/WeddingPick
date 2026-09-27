import { StyleSheet, View } from 'react-native';

import { daysUntil, formatDday } from '@weddingpick/domain';
import { Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import { noteMonthDayWeekday } from './note-format';
import type { TimelinePlan } from './timeline-groups';
import { TimelineRowMenu } from './timeline-row-menu';

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
 * 수정 · 삭제는 서버에 행이 있는 줄(`editable`)의 더보기 안에 둔다.
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
  const overdue = daysLeft < 0;
  const time = noteMonthDayWeekday(plan.date);

  return (
    <View style={styles.row} testID={plan.tentative ? 'timeline-plan-tentative' : 'timeline-plan'}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: overdue ? theme.negative : theme.tint }]} />
        <View style={[styles.line, { backgroundColor: theme.border }]} />
      </View>
      <View style={[styles.card, { backgroundColor: overdue ? theme.background : theme.backgroundSelected }, overdue ? { borderWidth: 1, borderColor: theme.border } : null]}>
        <View style={styles.content}>
          <View style={styles.text} accessible accessibilityLabel={[overdue ? `${formatDday(daysLeft)}, 날짜가 지났어요` : '', time, plan.title, plan.meta].filter(Boolean).join(' · ')}>
            <View style={styles.dateRow}>
              {overdue ? (
                <View style={[styles.badge, { backgroundColor: theme.negativeBackground }]}>
                  <ThemedText type="f12" themeColor="negative" numeric style={styles.bold}>{formatDday(daysLeft)}</ThemedText>
                </View>
              ) : null}
              <ThemedText type="f12" themeColor="textAssistive" numeric style={styles.bold}>{time}</ThemedText>
            </View>
            <View style={styles.titleRow}>
              <ThemedText type="f15" numberOfLines={1} style={[styles.bold, styles.title]}>{plan.title}</ThemedText>
              {plan.meta.length > 0 ? (
                <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1} style={styles.meta}>{plan.meta}</ThemedText>
              ) : null}
            </View>
          </View>
          {plan.editable && onEdit && onDelete ? (
            <TimelineRowMenu label={plan.title} disabled={busy} onEdit={() => onEdit(plan)} onDelete={() => onDelete(plan)} />
          ) : null}
        </View>
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
    paddingVertical: 10,
  },
  content: { flexDirection: 'row', alignItems: 'flex-start' },
  text: { flex: 1, minWidth: 0, gap: 5 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  title: { flexShrink: 1 },
  meta: { flexShrink: 1, maxWidth: '45%' },
  bold: { fontWeight: 700 },
});
