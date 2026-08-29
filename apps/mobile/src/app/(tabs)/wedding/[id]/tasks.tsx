import type { WeddingTaskListResponse } from '@weddingpick/api-contract';
import { TASK_STATES, TASK_STATE_LABEL, formatTaskDate } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listWeddingTasks, removeWeddingTask, updateWeddingTask } from '@/api/client';
import {
  ActionButton,
  FilterChip,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  WeddingCalendar,
  useTheme,
} from '@weddingpick/ui';

/**
 * 웨딩 스케줄. 디자인 핸드오프 15번.
 *
 * 처음 열면 서버가 기본 열넷을 깔아준다 — 처음 결혼을 준비하는 사람은 **무엇을
 * 해야 하는지부터 모른다.** 빈 목록을 주고 채우라고 하면 그 목록은 영영 비어 있다.
 *
 * 상태는 날짜로 자동 판정하되 **사용자가 정한 값이 이긴다.** 그때는 "직접 지정"을
 * 적어, 이 값이 날짜를 안 따라간다는 것을 보이게 한다.
 */
export default function WeddingTasksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [page, setPage] = useState<WeddingTaskListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 수정 중인 일정. 닫으면 버린다. */
  const [editing, setEditing] = useState<WeddingTaskListResponse['tasks'][number] | null>(null);
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const [draftVendor, setDraftVendor] = useState('');

  const load = useCallback(() => {
    listWeddingTasks(id)
      .then(setPage)
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useEffect(load, [load]);

  if (error) {
    return (
      <Frame>
        <ThemedText type="t4">불러오지 못했습니다</ThemedText>
        <ThemedText type="t7" themeColor="textSecondary">
          {error}
        </ThemedText>
        <ActionButton label="돌아가기" onPress={() => router.back()} />
      </Frame>
    );
  }

  if (!page) {
    return (
      <Frame>
        <ActivityIndicator color={theme.tint} />
      </Frame>
    );
  }

  async function save(state?: 'auto' | (typeof TASK_STATES)[number]) {
    if (!editing) return;

    try {
      await updateWeddingTask(id, editing.id, {
        dueDate: draftDate,
        vendorLabel: draftVendor.trim() === '' ? null : draftVendor.trim(),
        // 'auto'는 직접 지정을 그만둔다는 뜻이다. 지우는 것과 다르다.
        ...(state ? { state: state === 'auto' ? null : state } : {}),
      });

      setEditing(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '고치지 못했습니다.');
    }
  }

  async function remove(taskId: string) {
    try {
      await removeWeddingTask(id, taskId);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '지우지 못했습니다.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="t2">웨딩 스케줄</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              준비 {page.progress.done} / {page.progress.total} 완료
            </ThemedText>
          </ThemedView>

          {page.tasks.map((task) => (
            <ThemedView key={task.id} type="backgroundElement" style={styles.row}>
              <ThemedView style={styles.rowMain}>
                <ThemedText type="t5">{task.label}</ThemedText>
                <ThemedText type="t7" themeColor="textSecondary">
                  {task.dueDate ? formatTaskDate(task.dueDate) : '날짜 미정'}
                  {task.vendorLabel ? ` · ${task.vendorLabel}` : ''}
                </ThemedText>
                <ThemedText
                  type="badge"
                  themeColor={task.state === 'done' ? 'positive' : 'tint'}>
                  {task.stateLabel}
                  {/* 이 값은 날짜가 바뀌어도 안 따라간다는 것을 보이게 한다. */}
                  {task.manualState ? ' · 직접 지정' : ''}
                </ThemedText>
              </ThemedView>

              <ActionButton
                label="고치기"
                onPress={() => {
                  setEditing(task);
                  setDraftDate(task.dueDate);
                  setDraftVendor(task.vendorLabel ?? '');
                }}
              />
              <ActionButton label="빼기" onPress={() => void remove(task.id)} />
            </ThemedView>
          ))}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>

      <Modal visible={editing !== null} transparent animationType="slide">
        <ThemedView style={[styles.scrim, { backgroundColor: theme.scrim }]}>
          <ScrollView contentContainerStyle={styles.sheet}>
            <ThemedText type="t4">{editing?.label}</ThemedText>

            <ThemedText type="t7" themeColor="textSecondary">
              업체
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.backgroundSelected },
              ]}
              value={draftVendor}
              onChangeText={setDraftVendor}
              placeholder="예: 스튜디오 이로"
              placeholderTextColor={theme.textAssistive}
              accessibilityLabel="업체"
            />

            <ThemedText type="t7" themeColor="textSecondary">
              날짜
            </ThemedText>
            {/* 일정은 지난 날도 고를 수 있어야 한다 — 이미 한 일을 적는 자리다. */}
            <WeddingCalendar
              value={draftDate}
              onChange={setDraftDate}
              today={new Date(1970, 0, 1)}
            />

            <ThemedText type="t7" themeColor="textSecondary">
              상태
            </ThemedText>
            <ThemedView style={styles.chips}>
              <FilterChip
                label="날짜에 맡기기"
                selected={editing?.manualState === false}
                role="radio"
                onPress={() => void save('auto')}
              />
              {TASK_STATES.map((state) => (
                <FilterChip
                  key={state}
                  label={TASK_STATE_LABEL[state]}
                  selected={editing?.manualState === true && editing.state === state}
                  role="radio"
                  onPress={() => void save(state)}
                />
              ))}
            </ThemedView>

            <ThemedView style={styles.sheetActions}>
              <ActionButton label="취소" onPress={() => setEditing(null)} />
              <ActionButton variant="primary" label="완료" onPress={() => void save()} />
            </ThemedView>
          </ScrollView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.content}>{children}</ThemedView>
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
  row: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
    minHeight: Layout.rowMinHeight,
  },
  rowMain: { gap: Spacing.half },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    padding: Layout.gutter,
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  sheetActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  input: {
    height: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
  },
});
