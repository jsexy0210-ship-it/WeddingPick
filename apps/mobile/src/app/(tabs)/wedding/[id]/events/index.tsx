import type { WeddingEvent, WeddingEventListResponse } from '@weddingpick/api-contract';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { listWeddingEvents } from '@/api/client';
import { ActionButton, ErrorView, Layout, SkeletonView, Spacing } from '@weddingpick/ui';
import {
  DateChip,
  Hero,
  ListRow,
  NavBar,
  RowValue,
  Screen,
  Section,
  eventTime,
} from '@/features/wedding/screen-kit';

const DAY_MS = 24 * 60 * 60 * 1000;

/** «오늘» · «D-11». 지난 일정은 라벨이 없다. */
function dDayLabel(startsAt: string, now: number): string {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDay = new Date(startsAt);
  startOfDay.setHours(0, 0, 0, 0);
  const diff = Math.round((startOfDay.getTime() - startOfToday.getTime()) / DAY_MS);

  return diff <= 0 ? '오늘' : `D-${diff}`;
}

function isSameMonth(iso: string, now: number): boolean {
  const a = new Date(iso);
  const b = new Date(now);

  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** 부제 — «14:00 · 라비드레스» · 자동 생성은 «자동 추가 · 업체». */
function subtitle(event: WeddingEvent): string {
  const place = event.location ?? event.vendorLabel;

  if (event.source === 'auto') return place ? `자동 추가 · ${place}` : '자동 추가';

  return place ? `${eventTime(event.startsAt)} · ${place}` : eventTime(event.startsAt);
}

/**
 * 일정 목록. WP-OUR-004 · 핸드오프 08-schedule-sub #1.
 *
 *   nav        «일정» · 오른쪽 «추가»(coral)
 *   hero       «이번 달에 N곳을 다녀와요» — 이번 달 일정이 없으면 «다가오는 일정이 N개 있어요»
 *   다가오는 일정  날짜칩 52 + 제목 18/24 + 시각·장소 14/19 + D-day 16/22
 *   지난 일정     회색 — 제목 disabled · 부제 «완료»
 *
 * 자동 생성 일정은 부제에 «자동 추가»를 달아 직접 넣은 것과 구분한다(screens.json rule).
 * 예정/완료는 서버가 `status`로 계산해 준다 — 화면이 다시 세지 않는다.
 */
export default function WeddingEventsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [page, setPage] = useState<WeddingEventListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** D-day 기준 시각. 렌더 중에는 Date.now()를 부르지 않는다. */
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    void Promise.resolve().then(() => setNow(Date.now()));
  }, []);

  const load = useCallback(() => {
    listWeddingEvents(id)
      .then(setPage)
      .catch((caught: Error) => setError(caught.message));
  }, [id]);

  /* 추가 · 수정 화면에서 돌아오면 다시 읽는다. */
  useFocusEffect(load);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!page || now === null) {
    return <SkeletonView />;
  }

  const upcoming = page.events
    .filter((event) => event.status === 'upcoming')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const done = page.events
    .filter((event) => event.status === 'done')
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const thisMonth = upcoming.filter((event) => isSameMonth(event.startsAt, now)).length;

  const heroTitle =
    thisMonth > 0
      ? `이번 달에 ${thisMonth}곳을 다녀와요`
      : upcoming.length > 0
        ? `다가오는 일정이 ${upcoming.length}개 있어요`
        : '아직 일정이 없어요';
  const heroSub =
    upcoming.length === 0 && done.length === 0
      ? '상견례 · 촬영 · 상담처럼 시간이 정해진 일을 넣어두세요'
      : null;

  const openAdd = () => router.push(`/wedding/${id}/events/new`);

  return (
    <Screen>
      <NavBar title="일정" right={{ label: '추가', brand: true, onPress: openAdd }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Hero title={heroTitle} sub={heroSub} />

        {upcoming.length > 0 ? (
          <Section title="다가오는 일정">
            {upcoming.map((event) => (
              <ListRow
                key={event.id}
                left={<DateChip date={event.startsAt} />}
                title={event.title}
                sub={subtitle(event)}
                subLines={1}
                right={<RowValue>{dDayLabel(event.startsAt, now)}</RowValue>}
                onPress={() => router.push(`/wedding/${id}/events/${event.id}`)}
              />
            ))}
          </Section>
        ) : null}

        {done.length > 0 ? (
          <Section label="지난 일정">
            {done.map((event) => (
              <ListRow
                key={event.id}
                left={<DateChip date={event.startsAt} />}
                title={event.title}
                titleColor="textDisabled"
                sub="완료"
                right={null}
                onPress={() => router.push(`/wedding/${id}/events/${event.id}`)}
              />
            ))}
          </Section>
        ) : null}

        {page.events.length === 0 ? (
          <View style={styles.emptyAction}>
            <ActionButton variant="ghost" size="large" label="일정 넣기" onPress={openAdd} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.two },
  emptyAction: { paddingHorizontal: Layout.gutter },
});
