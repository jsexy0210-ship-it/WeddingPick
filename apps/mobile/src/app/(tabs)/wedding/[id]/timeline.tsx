import type { WeddingTask, WeddingTaskListResponse } from '@weddingpick/api-contract';
import { formatCount } from '@weddingpick/domain';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { listWeddingTasks } from '@/api/client';
import { formatMonthDayDot } from '@/features/common/format-date';
import { useDepthBack } from '@/features/navigation/depth-back';
import { ErrorView, Layout, Radius, Skeleton, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import { Hero, NavBar, Screen } from '@/features/wedding/screen-kit';

/** 핸드오프 08c #18b: 점 10 · 선 2 · 점↔글 14 · 행 아래 22. */
const DOT = 10;
const LINE = 2;

/**
 * 준비 타임라인. WP-OUR-012 · 핸드오프 08c-schedule-my #2.
 *
 *   nav    «준비 타임라인»
 *   hero   «준비 N개 중 M개를 끝냈어요»
 *   행     점(끝난 것은 coral) + 세로선 · 날짜 14/19 · 제목 18/24 700 · 내용 16/24
 *
 * 최근 것이 위다. 편집은 하지 않는다 — 읽기 전용 기록이다.
 */
export default function TimelineScreen() {
  const depthBack = useDepthBack();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [page, setPage] = useState<WeddingTaskListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listWeddingTasks(id)
      .then((result) => {
        setError(null);
        setPage(result);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useEffect(load, [load]);

  if (error) return <ErrorView message={error} onBack={depthBack} onRetry={load} />;
  if (!page) {
    return (
      <Screen>
        <NavBar title="준비 타임라인" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.loadingHero}>
            <Skeleton width="78%" height={30} />
            <Skeleton width="54%" height={16} />
          </View>
          <View style={styles.timeline}>
            {Array.from({ length: 4 }, (_, index) => (
              <View key={index} style={styles.item}>
                <View style={styles.spine}>
                  <Skeleton width={DOT} height={DOT} radius={Radius.pill} />
                  {index < 3 ? <View style={[styles.loadingLine, { backgroundColor: theme.border }]} /> : null}
                </View>
                <View style={styles.itemBody}>
                  <Skeleton width="28%" height={14} />
                  <Skeleton width="72%" height={18} />
                  <Skeleton width="52%" height={15} />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const sorted = [...page.tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;

    return b.dueDate.localeCompare(a.dueDate);
  });

  return (
    <Screen>
      <NavBar title="준비 타임라인" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero
          title={
            page.progress.total > 0
              ? `준비 ${formatCount(page.progress.total)}개 중 ${formatCount(page.progress.done)}개를 끝냈어요`
              : '아직 기록이 없어요'
          }
          sub={page.progress.total > 0 ? null : '결정하고 일정을 넣으면 여기 시간순으로 쌓여요'}
        />

        {sorted.length > 0 ? (
          <View style={styles.timeline}>
            {sorted.map((task, index) => (
              <TimelineItem key={task.id} task={task} isLast={index === sorted.length - 1} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function TimelineItem({ task, isLast }: { task: WeddingTask; isLast: boolean }) {
  const theme = useTheme();
  const key = task.state === 'done';
  const body = task.vendorLabel ? `${task.stateLabel} · ${task.vendorLabel}` : task.stateLabel;

  return (
    <View style={styles.item}>
      <View style={styles.spine}>
        <View style={[styles.dot, { backgroundColor: key ? theme.tint : theme.track }]} />
        {!isLast ? <View style={[styles.line, { backgroundColor: theme.border }]} /> : null}
      </View>
      <View style={styles.itemBody}>
        <ThemedText type="t7" themeColor="textAssistive" numeric>
          {task.dueDate ? formatMonthDayDot(task.dueDate) : '날짜 미정'}
        </ThemedText>
        <ThemedText type="t5">{task.label}</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          {body}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.two },
  loadingHero: { paddingHorizontal: Layout.gutter, paddingVertical: Layout.sectionGap, gap: Spacing.two },
  timeline: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.sectionGap },
  item: { flexDirection: 'row', gap: Layout.sectionHeadGap },
  spine: { width: Layout.iconTab, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: Radius.pill, marginTop: Spacing.one + Spacing.half },
  line: { width: LINE, flex: 1, marginTop: Spacing.one },
  loadingLine: { width: LINE, flex: 1, marginTop: Spacing.one },
  itemBody: { flex: 1, minWidth: 0, gap: 3, paddingBottom: Spacing.four - Spacing.half },
});
