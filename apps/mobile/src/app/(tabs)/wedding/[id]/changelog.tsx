import type { Notification } from '@weddingpick/api-contract';
import { NOTIFICATION_KIND_LABEL } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
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
import { listNotifications, readAllNotifications } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { formatDateDot, formatTimeHm } from '@/features/common/format-date';


/**
 * WP-CPL-006: 커플 공유 변경 내역 화면.
 *
 * 커플 간 공유 일정·예산에 관련된 알림 이력을 날짜별로 묶어 보여준다.
 * 알림 API는 웨딩 ID로 필터하지 않아 사용자의 전체 알림을 보여준다 —
 * 커플용 변경 로그 전용 엔드포인트가 추가되면 교체한다.
 */
export default function ChangelogScreen() {
  useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  function load() {
    if (!isServerConfigured) return;
    listNotifications()
      .then((r) => {
        setNotifications(r.notifications);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }

  function retry() {
    setError(null);
    load();
  }

  useEffect(() => { load(); }, []);

  async function markAllRead() {
    if (marking) return;
    setMarking(true);
    try {
      await readAllNotifications();
      const r = await listNotifications();
      setNotifications(r.notifications);
    } catch {
      // 알림 읽음 실패는 조용히 — 목록은 그대로 보인다
    } finally {
      setMarking(false);
    }
  }

  if (!isServerConfigured) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.content}>
            <ThemedText type="t2">변경 내역</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              이 빌드는 서버에 붙어 있지 않아 내역을 불러올 수 없어요.
            </ThemedText>
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (error) {
    return <ErrorView message={error} onBack={retry} />;
  }

  if (notifications === null) {
    return <SkeletonView />;
  }

  // 날짜별 묶기
  type Group = { date: string; items: Notification[] };
  const grouped: Group[] = [];
  for (const n of notifications) {
    const date = formatDateDot(n.createdAt);
    const last = grouped[grouped.length - 1];
    if (last?.date === date) {
      last.items.push(n);
    } else {
      grouped.push({ date, items: [n] });
    }
  }

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="t2">변경 내역</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              커플이 함께 받은 알림과 변경 이력이에요.
            </ThemedText>
          </ThemedView>

          {notifications.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6" themeColor="textSecondary">
                아직 변경 내역이 없어요.
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              {unread > 0 ? (
                <ActionButton
                  label={marking ? '처리 중…' : `읽지 않은 ${unread}건 모두 읽음`}
                  disabled={marking}
                  onPress={() => void markAllRead()}
                />
              ) : null}

              {grouped.map(({ date, items }) => (
                <ThemedView key={date} style={styles.group}>
                  <ThemedText type="t7" themeColor="textAssistive">
                    {date}
                  </ThemedText>

                  {items.map((n) => (
                    <ThemedView
                      key={n.id}
                      type="backgroundElement"
                      style={[
                        styles.card,
                        !n.readAt && { borderLeftWidth: 3, borderLeftColor: theme.tint },
                      ]}
                    >
                      <View style={styles.cardHead}>
                        <ThemedText type="badge" themeColor="textAssistive">
                          {NOTIFICATION_KIND_LABEL[n.kind]}
                        </ThemedText>
                        <ThemedText type="badge" themeColor="textAssistive">
                          {formatTimeHm(n.createdAt)}
                        </ThemedText>
                      </View>
                      <ThemedText type="t5">{n.title}</ThemedText>
                      <ThemedText type="t6" themeColor="textSecondary">
                        {n.body}
                      </ThemedText>
                    </ThemedView>
                  ))}
                </ThemedView>
              ))}
            </>
          )}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
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
  header: {
    gap: Spacing.two,
  },
  group: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
