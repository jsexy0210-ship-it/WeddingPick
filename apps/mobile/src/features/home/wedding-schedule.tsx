import { Pressable, StyleSheet, View } from 'react-native';
import { Layout, Radius, SeedIcon, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

import strings from '../../../../../spec/strings.ko.json';
import type { ScheduleRow } from './schedule-view';

const S = strings.home;

/**
 * 홈 「웨딩일정」. .dc.html WP-HOME-001 §11 `schedule`(날짜 있는 일정 최대 3건) ·
 * WP-HOME-002/003 `defaultSchedule`(번호 매긴 기본 다섯 줄). `rows`가 `dated`면
 * 앞쪽, `preset`이면 뒤쪽 모양으로 그린다 — 한 섹션에서 둘이 섞이지 않는다
 * (`scheduleRows`가 이미 갈라 준다).
 *
 * 개별 줄은 .dc.html에 `<a href>`가 없다 — 「자세히」만 누를 수 있다. 줄마다 탭
 * 진입점을 임의로 만들지 않는다(정본에 없는 진입점 추가 금지).
 */
export function UpcomingSchedule({
  rows, hasDate, onMore,
}: {
  rows: readonly ScheduleRow[];
  /** 날짜가 있는 일정(dated)인가 — 서브카피가 갈린다. */
  hasDate: boolean;
  onMore: () => void;
}) {
  const theme = useTheme();

  if (rows.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={styles.headingCol}>
          <ThemedText type="f14" style={styles.bold}>{S['section.schedule']}</ThemedText>
          <ThemedText type="f12" themeColor="textAssistive">
            {hasDate ? S['schedule.sub'] : S['schedule.subDefault']}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${S['section.schedule']} ${S.more}`}
          onPress={onMore}
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
          <ThemedText type="f13" themeColor="textAssistive">{S.more}</ThemedText>
          <SeedIcon name="chevronRightRegular" size={Layout.iconField} color={theme.textAssistive} />
        </Pressable>
      </View>

      <View style={[styles.wrap, { borderColor: theme.border }]}>
        {rows.map((row, index) => (
          <View
            key={row.id}
            style={[
              styles.row,
              index < rows.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : null,
            ]}>
            <View style={styles.dateCol}>
              {row.kind === 'dated' ? (
                <>
                  <ThemedText type="f11" themeColor="textAssistive">{row.month}</ThemedText>
                  <ThemedText
                    type="f14"
                    numeric
                    style={[styles.bold, styles.day]}
                    themeColor={row.near ? 'tint' : 'text'}>
                    {row.day}
                  </ThemedText>
                </>
              ) : (
                <View style={[styles.numBadge, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="f12" style={styles.bold} themeColor="textAssistive">{row.num}</ThemedText>
                </View>
              )}
            </View>

            <View style={styles.titleCol}>
              <ThemedText type="f15" style={styles.bold} numberOfLines={1}>{row.title}</ThemedText>
              <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1}>{row.meta}</ThemedText>
            </View>

            {row.kind === 'dated' ? (
              <ThemedText type="f13" numeric style={styles.bold} themeColor={row.near ? 'tint' : 'textAssistive'}>
                {row.dday}
              </ThemedText>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* .dc.html `hsec` — 헤더→본문 gap 12px 하나뿐(heading.marginBottom에 둔다). */
  section: { paddingHorizontal: Layout.gutter, marginBottom: Layout.sectionGap },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
    marginBottom: Layout.inlineGap,
  },
  headingCol: { flex: 1, minWidth: 0, gap: Spacing.half },
  more: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  wrap: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  /* .dc.html `row`/`row2` — min-height 64 · padding 0 14px. 그대로 옮겼다. */
  row: { flexDirection: 'row', alignItems: 'center', gap: Layout.inlineGap, minHeight: 64, paddingHorizontal: 14 },
  dateCol: { width: 44, flex: 0, alignItems: 'center', justifyContent: 'center', gap: 1 },
  day: { fontSize: 19, lineHeight: 25 },
  /* .dc.html `numStyle` — 24×24 원. 기존 토큰 중 정확히 24인 값이 없어 그대로 적었다. */
  numBadge: { width: 24, height: 24, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  titleCol: { flex: 1, minWidth: 0, gap: Spacing.half },
  bold: { fontWeight: 700 },
  pressed: { opacity: 0.8 },
});
