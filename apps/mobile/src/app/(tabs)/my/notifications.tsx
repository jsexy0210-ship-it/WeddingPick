import type { Notification } from '@weddingpick/api-contract';
import { NOTIFICATIONS_EMPTY, hasUnread } from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ErrorView, Layout, Radius, Spacing, ThemedText, Toast, readWebInteractionState, useTheme } from '@weddingpick/ui';
import { listNotifications, readAllNotifications, readNotification } from '@/api/client';
import { formatDateDot } from '@/features/common/format-date';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import strings from '../../../../../../spec/strings.ko.json';
import { EmptyBox, NavAction, Section, SubScreen } from '@/features/settings/my-kit';

const S = {
  title: '알림',
  readAll: '모두 읽음',
  fresh: 'New',
} as const;

/**
 * 알림을 눌렀을 때 어디로 가는가. **경로는 여기서 정한다.** 서버는 종류와 대상만 준다 — 화면 경로를
 * 서버가 정해 내려보내면 화면 이름을 바꿀 때 이미 보낸 알림이 전부 막다른 길이 된다.
 * 갈 곳이 없는 종류(안내)는 아무 데도 가지 않는다.
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

/** 알림 목록. 행 min 56 · 상하 12 · 아래 선 1. 읽으면 제목·본문이 회색이 된다. */
export default function NotificationsScreen() {
  const theme = useTheme();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const reading = useRef(new Set<string>());
  const readingAll = useRef(false);
  const [readBusy, setReadBusy] = useState(false);

  const load = useCallback(() => {
    void listNotifications()
      .then((response) => {
        setLoadError(null);
        setNotifications(response.notifications);
        setUnread(response.unread);
      })
      .catch((caught: Error) => setLoadError(caught.message ?? '알림을 불러오지 못했어요'));
  }, []);

  useEffect(load, [load]);

  function open(notification: Notification) {
    // 읽음 저장이 느리거나 실패해도 사용자가 누른 내용은 바로 연다.
    go(notification);
    if (notification.readAt || reading.current.has(notification.id) || readingAll.current) return;
    reading.current.add(notification.id);
    setReadBusy(true);
    setNotifications((current) => current?.map((row) =>
      row.id === notification.id ? { ...row, readAt: new Date().toISOString() } : row
    ) ?? null);
    setUnread((current) => Math.max(0, current - 1));
    void readNotification(notification.id)
      .catch(() => {
        setNotifications((current) => current?.map((row) =>
          row.id === notification.id ? { ...row, readAt: notification.readAt } : row
        ) ?? null);
        setUnread((current) => current + 1);
        setToast(strings.journey.readFailed);
      })
      .finally(() => {
        reading.current.delete(notification.id);
        setReadBusy(reading.current.size > 0);
      });
  }

  async function readAll() {
    if (readingAll.current || reading.current.size > 0) return;
    const before = notifications;
    const beforeUnread = unread;
    readingAll.current = true;
    setReadBusy(true);
    setNotifications((current) => current?.map((row) =>
      ({ ...row, readAt: row.readAt ?? new Date().toISOString() })
    ) ?? null);
    setUnread(0);
    await readAllNotifications()
      .then((summary) => setUnread(summary.unread))
      .catch(() => {
        setNotifications(before);
        // 목록 바깥의 오래된 미확인 알림도 있으므로 서버에서 받은 개수를 보존한다.
        setUnread(beforeUnread);
        setToast(strings.journey.readFailed);
      })
      .finally(() => {
        readingAll.current = false;
        setReadBusy(false);
      });
  }

  if (loadError) return <ErrorView message={loadError} onRetry={load} />;
  if (notifications === null) return <DelayedLoadingView />;

  return (
    <SubScreen
      title={S.title}
      contentStyle={{ paddingTop: Layout.rowPaddingY }}
      right={
        hasUnread({ unread, total: notifications.length }) ? (
          <NavAction label={S.readAll} disabled={readBusy} onPress={() => void readAll()} />
        ) : undefined
      }>
      <Section>
        {notifications.length === 0 ? (
          <EmptyBox>{NOTIFICATIONS_EMPTY}</EmptyBox>
        ) : (
          <View style={styles.rows}>
            {notifications.map((notification) => {
              const read = notification.readAt !== null;
              return (
                <View key={notification.id}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void open(notification)}
                    style={(state) => {
                      const { hovered, pressed } = readWebInteractionState(state);
                      return [styles.row, hovered || pressed ? { backgroundColor: theme.backgroundElement } : null];
                    }}>
                    <View style={styles.rowHead}>
                      {/* 시안 dot — 8×8 · 위 8 · 안 읽음만 코랄, 읽음은 같은 자리를 비운다(12-closing.dc.html L366). */}
                      <View style={[styles.dot, read ? null : { backgroundColor: theme.tint }]} />
                      <ThemedText type="t7" themeColor={read ? 'textAssistive' : 'tint'} style={styles.bold}>
                        {notification.kindLabel}
                      </ThemedText>
                    </View>
                    <ThemedText type="t5" themeColor={read ? 'textAssistive' : 'text'}>
                      {notification.title}
                    </ThemedText>
                    {/* 시안 t14w — 알림 본문은 14/21이다(L427). 16/24는 제목과 무게가 비슷해져 줄이 구분되지 않는다. */}
                    <ThemedText type="note" themeColor="textAssistive">
                      {notification.body}
                    </ThemedText>
                    <ThemedText type="t7" themeColor="textAssistive" numeric>
                      {formatDateDot(notification.createdAt)}
                    </ThemedText>
                  </Pressable>
                  <View style={[styles.hr, { backgroundColor: theme.border }]} />
                </View>
              );
            })}
          </View>
        )}
      </Section>
      <Toast message={toast} onHidden={() => setToast(null)} />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  rows: { gap: Spacing.half },
  row: {
    gap: Spacing.one,
    minHeight: Layout.rowMinHeight,
    /* 시안 noti 행 — padding:14px 0(L63). */
    paddingVertical: Layout.rowPaddingYWithMeta,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Layout.iconTextGap },
  dot: { width: 8, height: 8, borderRadius: Radius.pill, backgroundColor: 'transparent' },
  bold: { fontWeight: '700' },
  hr: { height: 1 },
});
