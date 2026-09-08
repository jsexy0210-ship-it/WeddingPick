import type { WeddingTask, WeddingTaskListResponse } from '@weddingpick/api-contract';
import { TASK_STATE_LABEL, formatTaskDate } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listWeddingTasks } from '@/api/client';
import {
  ActionButton,
  EmptyView,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
  SkeletonView,
} from '@weddingpick/ui';

/**
 * 준비 타임라인. WP-OUR-012.
 *
 * 모든 태스크를 시간순으로 읽기 전용으로 본다.
 * 편집은 웨딩 스케줄(tasks.tsx)에서 한다.
 */
export default function TimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [page, setPage] = useState<WeddingTaskListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listWeddingTasks(id)
      .then((result) => {
        setError(null);
        setPage(result);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  if (error) return <ErrorView message={error} onBack={() => router.back()} />;
  if (!page) return <SkeletonView />;

  const sorted = [...page.tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t4">준비 타임라인</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              준비 {page.progress.done} / {page.progress.total} 완료
            </ThemedText>
          </ThemedView>

          {sorted.length === 0 ? (
            <EmptyView title="아직 준비 항목이 없어요." />
          ) : (
            <View style={styles.timeline}>
              {sorted.map((task, index) => (
                <TimelineItem
                  key={task.id}
                  task={task}
                  isLast={index === sorted.length - 1}
                />
              ))}
            </View>
          )}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function TimelineItem({ task, isLast }: { task: WeddingTask; isLast: boolean }) {
  const theme = useTheme();

  const dotColor =
    task.state === 'done'
      ? theme.tint
      : task.state === 'in_progress'
        ? theme.positive
        : theme.border;

  return (
    <View style={styles.item}>
      <View style={styles.spine}>
        <View style={[styles.dot, { backgroundColor: dotColor, borderColor: dotColor }]} />
        {!isLast && <View style={[styles.line, { backgroundColor: theme.border }]} />}
      </View>

      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.cardTop}>
          <ThemedText type="t5" style={styles.taskLabel}>
            {task.label}
          </ThemedText>
          <View
            style={[styles.stateBadge, { backgroundColor: dotColor + '22', borderColor: dotColor }]}>
            <ThemedText type="badge" style={{ color: dotColor }}>
              {TASK_STATE_LABEL[task.state]}
            </ThemedText>
          </View>
        </View>

        {task.dueDate ? (
          <ThemedText type="t7" themeColor="textSecondary">
            {formatTaskDate(task.dueDate)}
          </ThemedText>
        ) : null}

        {task.vendorLabel ? (
          <ThemedText type="t7" themeColor="textAssistive">
            {task.vendorLabel}
          </ThemedText>
        ) : null}

        {task.manualState ? (
          <ThemedText type="smallBold" themeColor="textAssistive">
            직접 지정
          </ThemedText>
        ) : null}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  header: { gap: Spacing.two },
  timeline: { gap: 0 },
  item: { flexDirection: 'row', gap: Spacing.two },
  spine: { alignItems: 'center', paddingTop: 14 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    zIndex: 1,
  },
  line: { width: 2, flex: 1, marginTop: 4 },
  card: {
    flex: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  taskLabel: { flex: 1 },
  stateBadge: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
});
