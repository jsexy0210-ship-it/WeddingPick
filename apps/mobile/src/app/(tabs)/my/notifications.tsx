import type { Notification } from '@weddingpick/api-contract';
import { NOTIFICATIONS_EMPTY, hasUnread } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  ErrorView,
  Layout,
  LoadingView,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { listNotifications, readAllNotifications, readNotification } from '@/api/client';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 알림을 눌렀을 때 어디로 가는가. 디자인 핸드오프 20번.
 *
 * **경로는 여기서 정한다.** 서버는 종류와 대상만 준다 — 화면 경로를 서버가 정해
 * 내려보내면 화면 이름을 바꿀 때 이미 보낸 알림이 전부 막다른 길이 된다.
 *
 * 갈 곳이 없는 종류(안내)는 아무 데도 가지 않는다. 억지로 홈으로 보내면 사용자는
 * 자기가 뭘 잘못 눌렀다고 생각한다.
 */
function go(notification: Notification): void {
  switch (notification.kind) {
    case 'partner':
      router.push('/wedding/partner');
      return;
    case 'inquiry':
      router.push('/my/contact');
      return;
    case 'rebuttal':
      router.push('/my/rebuttals');
      return;
    case 'verification':
      if (notification.targetId) router.push(`/capture/result/${notification.targetId}`);
      return;
    case 'notice':
  }
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    void listNotifications()
      .then((response) => {
        setLoadError(null);
        setNotifications(response.notifications);
        setUnread(response.unread);
      })
      .catch((caught: Error) =>
        setLoadError(caught.message ?? '알림을 불러오지 못했어요.')
      );
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 화면 진입 시 목록을 가져오는 정상적인 fetch-in-effect다. eslint-plugin-react-hooks 7.x가 이 패턴을 오탐지한다.
  useEffect(load, [load]);

  async function open(notification: Notification) {
    if (!notification.readAt) {
      /*
       * 먼저 화면에서 읽음으로 바꾼다. 서버 답을 기다리면 눌렀는데 아무 일도
       * 일어나지 않는 순간이 생긴다.
       */
      setNotifications(
        (current) =>
          current?.map((row) =>
            row.id === notification.id ? { ...row, readAt: new Date().toISOString() } : row
          ) ?? null
      );

      // 실패하면 다음에 열 때 다시 안 읽은 것으로 보인다. 그게 반대보다 낫다.
      await readNotification(notification.id)
        .then((summary) => setUnread(summary.unread))
        .catch(() => undefined);
    }

    go(notification);
  }

  async function readAll() {
    const before = notifications;

    setNotifications(
      (current) =>
        current?.map((row) => ({ ...row, readAt: row.readAt ?? new Date().toISOString() })) ?? null
    );
    setUnread(0);

    await readAllNotifications()
      .then((summary) => setUnread(summary.unread))
      .catch(() => {
        // 못 바꿨으면 되돌린다. 읽지 않은 것을 읽었다고 두는 편이 더 나쁘다.
        setNotifications(before);
        setUnread(before?.filter((row) => !row.readAt).length ?? 0);
      });
  }

  if (loadError) {
    return <ErrorView message={loadError} onBack={load} />;
  }

  if (notifications === null) {
    return <LoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.head}>
            <ThemedText type="t2">알림</ThemedText>
            {hasUnread({ unread, total: notifications?.length ?? 0 }) ? (
              <ActionButton label="모두 읽음" onPress={readAll} />
            ) : null}
          </ThemedView>

          {notifications.length === 0 ? (
            <ThemedText type="t6" themeColor="textSecondary">
              {NOTIFICATIONS_EMPTY}
            </ThemedText>
          ) : null}

          {notifications.map((notification) => {
            const read = notification.readAt !== null;

            return (
              <Pressable
                key={notification.id}
                accessibilityRole="button"
                onPress={() => open(notification)}
                style={[styles.row, { borderBottomColor: theme.line }]}>
                <ThemedView style={styles.rowHead}>
                  <ThemedText type="t7" themeColor={read ? 'textAssistive' : 'tint'}>
                    {notification.kindLabel}
                  </ThemedText>
                  {/* 읽으면 제목·본문이 회색이 된다. 핸드오프가 정한 표시다. */}
                  {read ? null : (
                    <ThemedText type="badge" themeColor="tint">
                      New
                    </ThemedText>
                  )}
                </ThemedView>
                <ThemedText type="t5" themeColor={read ? 'textAssistive' : 'text'}>
                  {notification.title}
                </ThemedText>
                <ThemedText type="t6" themeColor={read ? 'textAssistive' : 'textSecondary'}>
                  {notification.body}
                </ThemedText>
                <ThemedText type="t7" themeColor="textAssistive">
                  {formatDate(notification.createdAt)}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    minHeight: Layout.rowMinHeight,
    // 줄 사이가 비면 어디까지가 한 알림인지 흐려진다.
    borderBottomWidth: 1,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
