import type { WeddingTimelineEvent } from '@weddingpick/api-contract';
import { VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getWeddingTimeline } from '@/api/client';
import { won } from '@/features/quotes/quote-result-view';
import {
  ActionButton,
  EmptyView,
  ErrorView,
  LoadingView,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

function formatAt(iso: string): string {
  const date = new Date(iso);

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function describe(event: WeddingTimelineEvent): { title: string; detail: string } {
  switch (event.kind) {
    case 'pick':
      return { title: `${event.vendorName}을 Pick했어요`, detail: VENDOR_CATEGORY_LABEL[event.category] };
    case 'decision':
      return {
        title: `${VENDOR_CATEGORY_LABEL[event.category]}을(를) ${event.vendorName}(으)로 정했어요`,
        detail: '최종 결정',
      };
    case 'expense':
      return { title: event.label, detail: won(event.amount) };
    case 'task':
      return { title: `${event.label} 일정을 추가했어요`, detail: '웨딩 스케줄' };
  }
}

/**
 * WP-OUR-012 준비 타임라인.
 *
 * "완료 기록"은 이 화면에 없다 — 서버가 그 값을 안 준다(웨딩 스케줄이 완료
 * 시각을 저장하지 않는다, `apps/api/src/routes/wedding-timeline.ts` 참조).
 * 없는 것을 있는 척 채우지 않는다.
 */
export default function WeddingTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [events, setEvents] = useState<WeddingTimelineEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getWeddingTimeline(id)
      .then((response) => setEvents(response.events))
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (events === null) {
    return <LoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="t2">준비 타임라인</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              Pick·최종결정·지출·일정을 한 곳에서 시간순으로 봐요.
            </ThemedText>
          </ThemedView>

          {events.length === 0 ? (
            <EmptyView title="아직 기록이 없어요" description="Pick하거나 지출을 남기면 여기 쌓여요" />
          ) : (
            <ThemedView style={styles.list}>
              {events.map((event, index) => {
                const { title, detail } = describe(event);

                return (
                  <ThemedView key={index} style={styles.row}>
                    <ThemedText type="t7" themeColor="textAssistive" style={styles.date}>
                      {formatAt(event.at)}
                    </ThemedText>
                    <ThemedView type="backgroundElement" style={styles.card}>
                      <ThemedText type="t5">{title}</ThemedText>
                      <ThemedText type="t7" themeColor="textSecondary">
                        {detail}
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                );
              })}
            </ThemedView>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: { gap: Spacing.one },
  list: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  date: { width: 48, paddingTop: Spacing.three },
  card: { flex: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.half },
});
