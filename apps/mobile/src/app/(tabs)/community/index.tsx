<<<<<<< HEAD
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Layout, MaxContentWidth, Spacing, ThemedText, ThemedView } from '@weddingpick/ui';

/**
 * 라운지 — Root 4번 탭(2026-09-14 대표 확정 · 라우트 `/community`).
 *
 * **지금은 자리만 있다.** 탭이 다섯으로 확정됐는데 이 라우트가 없으면 네 번째
 * 탭을 누를 때 앱이 멈춘다 — 그래서 네비게이션 쪽에서 빈 자리를 먼저 세웠다.
 * 목록 · 글 · 댓글이 붙는 본 화면은 화면 담당 세션 몫이고, 서버에도 아직 라운지
 * 경로가 없다(`packages/api-contract`에 항목 없음).
 *
 * 이 화면을 채울 때 이 파일을 덮어쓰면 된다. 문구는 `spec/strings.ko.json`
 * `lounge.*`에 있다.
 */
export default function LoungeScreen() {
=======
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  SegmentedTabs,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';
import { useSession } from '@/features/auth/use-session';
import { FullScreenError } from '@/features/errors/full-screen-error';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import strings from '../../../../../../spec/strings.ko.json';

const S = strings.community;

type Tab = 'review' | 'feed' | 'expo';

const TABS: { value: Tab; label: string }[] = [
  { value: 'review', label: S['tab.review'] },
  { value: 'feed', label: S['tab.feed'] },
  { value: 'expo', label: S['tab.expo'] },
];

/**
 * 라운지 · Figma `FlowScreens.tsx` `CommunityFeed`(B등급 — 구성만 참고, 수치·문구는 안 가져옴).
 * 3탭: 리얼후기 · 웨딩피드 · 박람회(`FeedContent`·`ExpoContent`).
 *
 * **서버 계약이 없다(`BACKEND_PENDING`).** 후기·피드 글을 보여줄 API가 없어 목록을
 * 지어내지 않고 빈 상태만 둔다. 박람회는 이미 있는 `WP-EXPO-001`(검색 세션 담당,
 * `/search/expo`)로 보낸다 — 같은 것을 두 번 만들지 않는다.
 */
export default function CommunityScreen() {
  const { state, refresh } = useSession();
  const [tab, setTab] = useState<Tab>('review');

  if (state.status === 'error') return <FullScreenError kind={state.kind} onRetry={() => void refresh()} />;
  if (state.status === 'loading') return <DelayedLoadingView />;
  if (state.status === 'signedOut') return <Redirect href="/login" />;

>>>>>>> origin/claude/rn-screens-plan
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
<<<<<<< HEAD
          <ThemedText type="t4">라운지</ThemedText>
        </View>

        <View style={styles.empty}>
          <ThemedText type="t5">이야기를 모으고 있어요</ThemedText>
          <ThemedText type="t6" themeColor="textSecondary" style={styles.emptyBody}>
            열리면 알려드릴게요
          </ThemedText>
        </View>
=======
          <ThemedText type="t4">{S.title}</ThemedText>
        </View>

        <View style={styles.tabsWrap}>
          <SegmentedTabs items={TABS} value={tab} onChange={(v) => setTab(v as Tab)} accessibilityLabel={S.title} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {tab === 'review' ? (
            <Empty title={S['review.empty.title']} body={S['review.empty.body']} />
          ) : tab === 'feed' ? (
            <Empty title={S['feed.empty.title']} body={S['feed.empty.body']} />
          ) : (
            <View style={styles.expoCard}>
              <ActionButton variant="secondary" size="large" label={S['expo.cta']} onPress={() => router.push('/search/expo')} />
            </View>
          )}
        </ScrollView>
>>>>>>> origin/claude/rn-screens-plan
      </SafeAreaView>
    </ThemedView>
  );
}

<<<<<<< HEAD
const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  /* 웨딩노트 홈과 같은 헤더 — 56 · 좌우 24 · 제목 20/27. */
  header: {
    minHeight: Layout.tabBar - Layout.tabBarPaddingTop,
    paddingHorizontal: Layout.gutter,
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  emptyBody: { textAlign: 'center' },
=======
/** 목록 한가운데 들어가는 빈 줄 — 헤더·탭은 그대로 두고 본문만 비운다(`wedding/index.tsx`의 `noSchedule`과 같은 자리). */
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <ThemedText type="t6" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText type="body" themeColor="textSecondary" style={styles.center}>
        {body}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  header: {
    height: Layout.navBar,
    justifyContent: 'center',
    paddingHorizontal: Layout.gutter,
  },
  tabsWrap: { paddingHorizontal: Layout.gutter, paddingBottom: Layout.rowPaddingY },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Layout.sectionGap },
  center: { textAlign: 'center' },
  empty: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.sectionGap,
    gap: Spacing.one,
    alignItems: 'center',
  },
  expoCard: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Layout.sectionGap,
  },
>>>>>>> origin/claude/rn-screens-plan
});
