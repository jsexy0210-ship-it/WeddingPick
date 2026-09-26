import type { Notification } from '@weddingpick/api-contract';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { listNotifications } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { useDepthBack } from '@/features/navigation/depth-back';
import { notifyRefreshFailed, usePullRefresh } from '@/features/refresh/use-pull-refresh';
import { noteMonthDayTime } from '@/features/wedding/note-format';
import { Border, ErrorView, Layout, SkeletonView, Spacing, ThemedText, useTheme } from '@weddingpick/ui';
import { Hero, NavBar, Screen } from '@/features/wedding/screen-kit';

/**
 * 변경내역. WP-CPL-005 · `docs/design/React_Native/note.jsx` frame-009.
 *
 *   nav    «변경내역» · 좌측 X 닫기(공통 풀팝업)
 *   sec    `padding:0 24px 20px;gap:12px` — 묶음 머리 없이 한 줄씩
 *   행     `chRow` — `margin:0 20px;padding:14px 0`, 아래 선. 무엇 15 · 시각 12 «9.20 14:02»
 *
 * 커플이 함께 받은 알림 이력을 시간순으로 본다. 알림 API는 웨딩 ID로 거르지 않아 전체
 * 알림이 보인다 — 변경 로그 전용 엔드포인트가 생기면 바꾼다. 정본의 «누가»(`chWho`
 * 13/700 코랄)와 «되돌리기»는 서버가 그 값을 주지 않아 넣지 않았다 — `DESIGN_UNRESOLVED`.
 * 정본에 없는 «오늘 · 이번 주» 묶음 머리와 상세 한 줄은 지웠다.
 */
export default function ChangelogScreen() {
  const depthBack = useDepthBack();
  useLocalSearchParams<{ id: string }>();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** `keep` — 당겨서 새로 고침. 보이던 내역은 두고 실패는 토스트로만 알린다. */
  const load = useCallback((keep?: boolean) => {
    if (!isServerConfigured) return;
    listNotifications()
      .then((result) => {
        setNotifications(result.notifications);
        setError(null);
      })
      .catch((caught: Error) => {
        if (keep === true) notifyRefreshFailed();
        else setError(caught.message);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  const pull = usePullRefresh(useCallback(() => load(true), [load]));

  if (!isServerConfigured) {
    return (
      <Screen>
        <NavBar title="변경내역" variant="close" />
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
        onBack={depthBack}
      />
    );
  }

  if (notifications === null) {
    return <SkeletonView />;
  }

  return (
    <Screen>
      <NavBar title="변경내역" variant="close" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={pull.refreshControl}>
        {notifications.length === 0 ? (
          <Hero title="아직 바뀐 것이 없어요" sub="일정 · 지출 · 메모가 바뀌면 여기에 쌓여요" />
        ) : (
          <View style={styles.sec}>
            {notifications.map((item) => (
              <ChangeRow key={item.id} item={item} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function ChangeRow({ item }: { item: Notification }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <ThemedText type="f15" style={styles.what}>
        {item.title}
      </ThemedText>
      <ThemedText type="f12" themeColor="textAssistive" numeric>
        {noteMonthDayTime(item.createdAt)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  /* 프레임 끝 `height:24px` 빈 칸. */
  content: { paddingBottom: Spacing.four },
  sec: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.listGap, gap: Layout.inlineGap },
  /* `chRow` — `align-items:flex-start;justify-content:space-between;gap:12px`. */
  row: {
    marginHorizontal: Layout.cardPadding,
    paddingVertical: 14,
    borderBottomWidth: Border.hairline,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
  },
  what: { flex: 1, minWidth: 0 },
});
