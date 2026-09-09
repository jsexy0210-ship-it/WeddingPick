import type { Notification } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { listNotifications } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { formatDateDot } from '@/features/common/format-date';
import { ErrorView, SkeletonView, Spacing } from '@weddingpick/ui';
import { Hero, ListRow, NavBar, RowValue, Screen, Section, relativeTime } from '@/features/wedding/screen-kit';

const DAY_MS = 24 * 60 * 60 * 1000;

/** «오늘» · «이번 주» · 그 밖은 날짜 `2027.05.16(토)`. */
function groupLabel(iso: string, now: number): string {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const at = new Date(iso).getTime();

  if (at >= startOfToday.getTime()) return '오늘';
  if (at >= startOfToday.getTime() - 6 * DAY_MS) return '이번 주';

  return formatDateDot(iso);
}

/**
 * 변경 내역. WP-CPL-005 · 핸드오프 14-couple #5.
 *
 *   nav    «변경 내역»
 *   그룹    오늘 · 이번 주 · 날짜 — 라벨 14/19 700
 *   행     무엇 18/24 · 상세 14/19 · 시간 14/19
 *
 * 커플이 함께 받은 알림 이력을 시간순으로 본다. 알림 API는 웨딩 ID로 거르지 않아 전체
 * 알림이 보인다 — 변경 로그 전용 엔드포인트가 생기면 바꾼다. 시안의 «되돌리기»와 작성자
 * 아바타는 서버가 그 값을 주지 않아 넣지 않았다.
 */
export default function ChangelogScreen() {
  useLocalSearchParams<{ id: string }>();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  function load() {
    if (!isServerConfigured) return;
    listNotifications()
      .then((result) => {
        setNotifications(result.notifications);
        setError(null);
      })
      .catch((caught: Error) => setError(caught.message));
  }

  useEffect(() => {
    void Promise.resolve().then(() => setNow(Date.now()));
    load();
  }, []);

  if (!isServerConfigured) {
    return (
      <Screen>
        <NavBar title="변경 내역" />
        <Hero title="아직 내역을 불러올 수 없어요" sub="이 빌드는 서버에 붙어 있지 않아요." />
      </Screen>
    );
  }

  if (error) {
    return (
      <ErrorView
        message={error}
        onRetry={() => {
          setError(null);
          load();
        }}
        onBack={() => router.back()}
      />
    );
  }

  if (notifications === null || now === null) {
    return <SkeletonView />;
  }

  type Group = { label: string; items: Notification[] };
  const grouped: Group[] = [];

  for (const item of notifications) {
    const label = groupLabel(item.createdAt, now);
    const last = grouped[grouped.length - 1];

    if (last?.label === label) last.items.push(item);
    else grouped.push({ label, items: [item] });
  }

  return (
    <Screen>
      <NavBar title="변경 내역" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 ? (
          <Hero title="아직 바뀐 것이 없어요" sub="일정 · 지출 · 메모가 바뀌면 여기에 쌓여요" />
        ) : (
          grouped.map(({ label, items }) => (
            <Section key={label} label={label} style={styles.firstGroup}>
              {items.map((item) => (
                <ListRow
                  key={item.id}
                  title={item.title}
                  sub={item.body}
                  right={
                    <RowValue color="textAssistive" numeric={false}>
                      {relativeTime(item.createdAt, now)}
                    </RowValue>
                  }
                />
              ))}
            </Section>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: Spacing.two, paddingBottom: Spacing.six },
  firstGroup: {},
});
