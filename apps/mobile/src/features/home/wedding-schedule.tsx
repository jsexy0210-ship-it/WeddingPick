import { StyleSheet, View } from 'react-native';
import { CanonGray, FontSize, Layout, LineHeight, Radius, Spacing, ThemedText } from '@weddingpick/ui';

import strings from '../../../../../spec/strings.ko.json';
import { HomeDestinationLink } from './home-summary';
import type { ScheduleRow } from './schedule-view';
import { HOME_PAGE_X } from '@/features/home/home-layout';

const S = strings.home;

/**
 * 홈 「웨딩일정」. RN 정본 `docs/design/React_Native/home.jsx` frame-012 WP-HOME-001 `schedule`(날짜 있는 일정) ·
 * WP-HOME-002/003 `defaultSchedule`(번호 매긴 기본 다섯 줄). `rows`가 `dated`면
 * 앞쪽, `preset`이면 뒤쪽 모양으로 그린다 — 한 섹션에서 둘이 섞이지 않는다
 * (`scheduleRows`가 이미 갈라 준다).
 * 예식일이 있는 경우 사용자가 요청한 미완료 기한 최대 다섯 줄(D+N 포함)을 그린다.
 *
 * 개별 줄은 이동하지 않고, 미리보기 아래의 목적지 행으로 웨딩일정을 연다.
 */
export function UpcomingSchedule({
  rows, hasDate, onMore,
}: {
  rows: readonly ScheduleRow[];
  /** 날짜가 있는 일정(dated)인가 — 서브카피가 갈린다. */
  hasDate: boolean;
  onMore: () => void;
}) {
  if (rows.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={styles.headingCol}>
          <ThemedText type="f14" style={styles.bold}>{S['section.schedule']}</ThemedText>
          <ThemedText type="f12" themeColor="textAssistive" style={styles.sub}>
            {hasDate ? S['schedule.sub'] : S['schedule.subDefault']}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.wrap, { borderColor: CanonGray.gray200 }]}>
        {rows.map((row, index) => (
          <View
            key={row.id}
            style={[
              styles.row,
              index < rows.length - 1 ? { borderBottomWidth: 1, borderBottomColor: CanonGray.gray200 } : null,
            ]}>
            <View style={styles.dateCol}>
              {row.kind === 'dated' ? (
                <>
                  <ThemedText type="f11" themeColor="textAssistive" style={styles.month}>{row.month}</ThemedText>
                  {/* 정본 `dayStyle` 19/25/700 — 크기는 같은 19인 FontSize.noteDday를 쓴다. 줄 높이
                      25는 토큰이 없어 가장 가까운 lh24다(공용 토큰은 common 담당 — PR에 요청).
                      리터럴 fontSize를 직접 적지 않는다(apps/api/src/test/typography.test.ts). */}
                  <ThemedText
                    type="f18"
                    numeric
                    style={[styles.bold, styles.day]}
                    themeColor={row.near ? 'tint' : 'text'}>
                    {row.day}
                  </ThemedText>
                </>
              ) : (
                <View style={[styles.numBadge, { backgroundColor: CanonGray.gray100 }]}>
                  <ThemedText type="f12" style={styles.bold} themeColor="textAssistive">{row.num}</ThemedText>
                </View>
              )}
            </View>

            <View style={styles.titleCol}>
              <ThemedText type="f15" style={[styles.bold, styles.title]} numberOfLines={1}>{row.title}</ThemedText>
              <ThemedText type="f12" themeColor="textAssistive" style={styles.sub} numberOfLines={1}>{row.meta}</ThemedText>
            </View>

            {row.kind === 'dated' ? (
              <ThemedText type="f13" numeric style={styles.bold} themeColor={row.near ? 'tint' : 'textAssistive'}>
                {row.dday}
              </ThemedText>
            ) : null}
          </View>
        ))}
      </View>
      <HomeDestinationLink destination="웨딩노트" action="웨딩일정 보기" icon="calendarRegular" onPress={onMore} />
    </View>
  );
}

const styles = StyleSheet.create({
  /* home.jsx `hsec` — 헤더→본문 gap 12px 하나뿐(heading.marginBottom에 둔다). */
  /* `hsec` 좌우 20 — 홈 전용 여백(home-layout). */
  section: { paddingHorizontal: HOME_PAGE_X, marginBottom: 24 },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
    marginBottom: Layout.inlineGap,
  },
  headingCol: { flex: 1, minWidth: 0, gap: Spacing.half },
  /* home.js `secSub` · `schedMeta` 12/17. */
  sub: { lineHeight: LineHeight.lh17 },
  /* home.js `schedMonth` 11/15. */
  month: { lineHeight: LineHeight.lh15 },
  day: { fontSize: FontSize.noteDday, lineHeight: LineHeight.lh24 },
  /* home.js `schedTitle` 15/21 — 줄 높이 21 토큰은 t7Loose(값 21) 하나뿐이다. */
  title: { lineHeight: LineHeight.t7Loose },
  wrap: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  /* home.jsx `row`/`row2` — min-height 64 · padding 0 14px. 그대로 옮겼다. */
  row: { flexDirection: 'row', alignItems: 'center', gap: Layout.inlineGap, minHeight: 64, paddingHorizontal: 14 },
  dateCol: { width: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center', gap: 1 },
  /* home.jsx `numStyle` — 24×24 원. 기존 토큰 중 정확히 24인 값이 없어 그대로 적었다. */
  numBadge: { width: 24, height: 24, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  titleCol: { flex: 1, minWidth: 0, gap: Spacing.half },
  bold: { fontWeight: 700 },
});
