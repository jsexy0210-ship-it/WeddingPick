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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
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
      </SafeAreaView>
    </ThemedView>
  );
}

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
});
