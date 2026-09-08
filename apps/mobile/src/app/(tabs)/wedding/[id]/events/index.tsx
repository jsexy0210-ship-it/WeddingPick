import type { WeddingEvent, WeddingEventListResponse } from '@weddingpick/api-contract';
import { formatEventDateTime } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listWeddingEvents } from '@/api/client';
import {
  ActionButton,
  ErrorView,
  Fab,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  SkeletonView,
} from '@weddingpick/ui';

const SOURCE_LABEL: Record<WeddingEvent['source'], string> = {
  manual: '직접 추가',
  auto: '자동 생성',
};

function isToday(isoDateTime: string): boolean {
  const value = new Date(isoDateTime);
  const now = new Date();

  return (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  );
}

/**
 * 일정 목록. 핸드오프 WP-OUR-004.
 *
 * 웨딩 스케줄(체크리스트, tasks.tsx)과 다른 화면이다 — 여기는 일시·장소가 있는
 * 캘린더 이벤트다. 예정/완료는 서버가 계산해서 준다(status 필드) — 화면이
 * 다시 세지 않는다.
 */
export default function WeddingEventsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [page, setPage] = useState<WeddingEventListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listWeddingEvents(id)
      .then(setPage)
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  useEffect(load, [load]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!page) {
    return <SkeletonView />;
  }

  const today = page.events.filter((event) => event.status === 'upcoming' && isToday(event.startsAt));
  const upcoming = page.events.filter(
    (event) => event.status === 'upcoming' && !isToday(event.startsAt)
  );
  const done = page.events.filter((event) => event.status === 'done');

  function Row({ event }: { event: WeddingEvent }) {
    return (
      <Pressable onPress={() => router.push(`/wedding/${id}/events/${event.id}`)}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="t5">{event.title}</ThemedText>
          <ThemedText type="t7" themeColor="textSecondary">
            {formatEventDateTime(event.startsAt)}
            {event.location ? ` · ${event.location}` : ''}
          </ThemedText>
          <ThemedText type="badge" themeColor="tint">
            {SOURCE_LABEL[event.source]}
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="t2">일정</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              전체 {page.events.length}개
            </ThemedText>
          </ThemedView>

          {page.events.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t7" themeColor="textSecondary">
                아직 등록된 일정이 없어요. 상견례, 촬영, 계약 미팅처럼 시간이 정해진
                일을 적어두세요.
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              {today.length > 0 ? (
                <ThemedView style={styles.group}>
                  <ThemedText type="t6">오늘 일정</ThemedText>
                  {today.map((event) => (
                    <Row key={event.id} event={event} />
                  ))}
                </ThemedView>
              ) : null}

              <ThemedView style={styles.group}>
                <ThemedText type="t6">예정된 일정</ThemedText>
                {upcoming.length === 0 && today.length === 0 ? (
                  <ThemedText type="t7" themeColor="textSecondary">
                    다가오는 일정이 없어요.
                  </ThemedText>
                ) : (
                  upcoming.map((event) => <Row key={event.id} event={event} />)
                )}
              </ThemedView>

              {done.length > 0 ? (
                <ThemedView style={styles.group}>
                  <ThemedText type="t6">지난 일정</ThemedText>
                  {done.map((event) => (
                    <Row key={event.id} event={event} />
                  ))}
                </ThemedView>
              ) : null}
            </>
          )}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>

      <Fab label="일정 더하기" glyph="✎" onPress={() => router.push(`/wedding/${id}/events/new`)} />
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
  section: { gap: Spacing.one },
  group: { gap: Spacing.two },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
});
