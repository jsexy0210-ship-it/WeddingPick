import { formatTaskDate } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getExpenses, listCandidates, listVisitNotes, listWeddingTasks } from '@/api/client';
import {
  ActionButton,
  ErrorView,
  Layout,
  LoadingView,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';
import { won } from '@/features/quotes/quote-result-view';

type TimelineKind = 'pick' | 'task' | 'expense' | 'visit';

type TimelineEntry = {
  id: string;
  date: string;
  kind: TimelineKind;
  title: string;
  detail: string | null;
};

const KIND_LABEL: Record<TimelineKind, string> = {
  pick: 'Pick',
  task: '준비 완료',
  expense: '지출',
  visit: '방문',
};

/**
 * 준비 타임라인. 핸드오프 IA WP-OUR-012.
 *
 * **새 서버 자리를 만들지 않는다.** Pick·일정·지출·방문노트는 이미 각자 화면이
 * 있고 각자 날짜를 들고 있다 — 이 화면은 그 넷을 한 줄로 모아 시간순으로 보여줄
 * 뿐이다.
 *
 * **최종결정은 넣지 않는다.** `decideCategoryRequestSchema`는 결정한 시각을
 * 남기지 않는다 — 언제 정했는지 모르는 일을 시간순 목록에 끼워 넣으면 순서
 * 자체가 거짓말이 된다. 결정한 곳은 담아둔 곳 화면에서 계속 볼 수 있다.
 */
export default function WeddingTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entries, setEntries] = useState<readonly TimelineEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([listWeddingTasks(id), getExpenses(id), listVisitNotes(id), listCandidates(id)])
      .then(([tasks, expenses, notes, candidates]) => {
        const pickEntries: TimelineEntry[] = candidates.groups.flatMap((group) =>
          group.candidates.map((candidate) => ({
            id: `pick-${candidate.id}`,
            date: candidate.addedAt.slice(0, 10),
            kind: 'pick' as const,
            title: `${candidate.vendorName} Pick`,
            detail: group.categoryLabel,
          }))
        );

        const taskEntries: TimelineEntry[] = tasks.tasks
          .filter((task) => task.state === 'done' && task.dueDate !== null)
          .map((task) => ({
            id: `task-${task.id}`,
            date: task.dueDate as string,
            kind: 'task' as const,
            title: task.label,
            detail: task.vendorLabel,
          }));

        const expenseEntries: TimelineEntry[] = expenses.expenses
          .filter((expense) => expense.status === 'paid' && expense.spentOn !== null)
          .map((expense) => ({
            id: `expense-${expense.id}`,
            date: expense.spentOn as string,
            kind: 'expense' as const,
            title: expense.label,
            detail: won(expense.amount),
          }));

        const visitEntries: TimelineEntry[] = notes.notes.map((note) => ({
          id: `visit-${note.id}`,
          date: note.visitedOn,
          kind: 'visit' as const,
          title: note.vendorLabel,
          detail: note.quotedAmount !== null ? `제안 ${won(note.quotedAmount)}` : null,
        }));

        setEntries(
          [...pickEntries, ...taskEntries, ...expenseEntries, ...visitEntries].sort((a, b) =>
            b.date.localeCompare(a.date)
          )
        );
      })
      .catch((caught: Error) => setError(caught.message || '기록을 불러오지 못했어요.'));
  }, [id]);

  useEffect(load, [load]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (entries === null) {
    return <LoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="t2">준비 타임라인</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              Pick·준비·지출·방문 기록을 시간순으로 모았어요
            </ThemedText>
          </ThemedView>

          {entries.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">
                아직 쌓인 기록이 없어요. Pick하거나 일정을 마치면 여기 쌓여요.
              </ThemedText>
            </ThemedView>
          ) : (
            entries.map((entry) => (
              <ThemedView key={entry.id} type="backgroundElement" style={styles.row}>
                <ThemedView style={styles.rowHead}>
                  <ThemedText type="badge" themeColor="tint">
                    {KIND_LABEL[entry.kind]}
                  </ThemedText>
                  <ThemedText type="t7" themeColor="textAssistive">
                    {formatTaskDate(entry.date)}
                  </ThemedText>
                </ThemedView>
                <ThemedText type="t5">{entry.title}</ThemedText>
                {entry.detail ? (
                  <ThemedText type="t7" themeColor="textSecondary">
                    {entry.detail}
                  </ThemedText>
                ) : null}
              </ThemedView>
            ))
          )}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  section: { gap: Spacing.one, marginBottom: Spacing.two },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  row: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.half,
    minHeight: Layout.rowMinHeight,
  },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
