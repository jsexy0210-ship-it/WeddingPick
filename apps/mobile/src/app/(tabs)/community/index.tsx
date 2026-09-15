import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Border,
  Layout,
  LetterSpacing,
  MaxContentWidth,
  SegmentedTabs,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
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
  const theme = useTheme();
  const { state, refresh } = useSession();
  const [tab, setTab] = useState<Tab>('review');

  if (state.status === 'error') return <FullScreenError kind={state.kind} onRetry={() => void refresh()} />;
  if (state.status === 'loading') return <DelayedLoadingView />;
  if (state.status === 'signedOut') return <Redirect href="/login" />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/*
          피그마 `CommunityFeed`(2026-09-14 정본) 헤더: 56 · 제목 24/700 · 아래 선. 제목은 시안의
          「커뮤니티」가 아니라 탭 이름과 같은 「라운지」다(CLAUDE.md 탭 다섯 — 이름을 두 개로
          부르지 않는다). 그 아래 세 칸 탭은 `mx-5 mt-4`. 후기 · 피드 본문은 서버 계약이 없어
          빈 상태 그대로다(인수인계 §3-3).
        */}
        {/* 규격서 community.txt 「header 430×56 pad 0 20 0 20」 · 제목 «24/700 · lh 32 · ls -0.72px». */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <ThemedText type="f24" style={[styles.bold, styles.title]}>
            {S.title}
          </ThemedText>
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
  /* 피그마 `h-14 px-5 border-b` — 56 · 좌우 24 · 아래 선. */
  header: {
    height: Layout.navBar,
    justifyContent: 'center',
    paddingHorizontal: Layout.pageX,
    borderBottomWidth: Border.hairline,
  },
  bold: { fontWeight: 700 },
  title: { letterSpacing: LetterSpacing.n072 },
  /* 규격서 「nav 390×48 … mar 16 20 0 20」 — 위 16 · 좌우 20. */
  tabsWrap: { paddingHorizontal: Layout.pageX, paddingTop: Spacing.three, paddingBottom: Layout.rowPaddingY },
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
