import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackBar } from '@/components/back-bar';
import { feedListHref } from '@/features/community/feed-href';
import { CategoryImage } from '@/features/home/category-image';
import { getWeddingFeedDetail, type WeddingContentDetail } from '@/features/home/content';
import { formatDateDot } from '@/features/common/format-date';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { dismissToOrReplace, useDepthBack } from '@/features/navigation/depth-back';
import { notifyRefreshFailed, usePullRefresh } from '@/features/refresh/use-pull-refresh';
import {
  ActionButton,
  Badge,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';
import strings from '../../../../../../../spec/strings.ko.json';

const S = strings.weddingFeed;

type DetailState =
  | { id: string; status: 'loading' }
  | { id: string; status: 'error'; message: string }
  | { id: string; status: 'ready'; post: WeddingContentDetail };

/**
 * #271의 공개 글 상세를 라운지와 연결한다. 기존 시각 배치는 보존한다.
 * 새 디자인의 수치/모양 검수는 docs/design/만 기준으로 하며, 구형 피그마 출처를
 * 최신 정본으로 승격하지 않는다. 화면에 없는 저자·좋아요·읽는 시간은 만들지 않는다.
 *
 * **2026-09-26 대표 지시 두 가지.**
 * - 「스크랩 저장 · 해제」 버튼을 지웠다. 모아 보는 화면(`/my/scraps`)이 #535에서 이미 지워져
 *   저장한 글을 볼 자리가 없었다. 서버 API(`/v1/me/scraps/:postId`)는 그대로 두었다 — 나중에
 *   걷어낼 후보다. 정본 WP-LNG-004(my.jsx:512~)는 스크랩을 헤더 우상단 아이콘으로 그린다 —
 *   대표 지시가 이겨 두지 않는다.
 * - 하단 「돌아가기」를 「목록」으로 바꿨다. 웨딩정보 목록(`/community/feed`)으로 가고 진입
 *   출처(`?from=my` 등)를 그대로 싣는다 — 목록의 Back이 원래 자리로 돌아간다. 목록이 스택에
 *   있으면 거기까지 접고, 없으면 이 화면을 목록으로 갈아끼운다(`dismissToOrReplace` — 기록이
 *   쌓이지 않는다). 정본 WP-LNG-004에는 하단 단추가 없다(`DESIGN_UNRESOLVED`). 헤더 Back은 그대로다.
 */
export default function WeddingFeedDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; from?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const back = useDepthBack();
  const version = useRef(0);
  const [state, setState] = useState<DetailState>({ id, status: 'loading' });

  /** `keep` — 당겨서 새로 고침. 보이던 글은 그대로 두고 실패는 토스트로만 알린다. */
  const load = useCallback((keep?: boolean) => {
    const requestVersion = ++version.current;
    if (!id.trim()) {
      setState({ id, status: 'error', message: S['detail.error'] });
      return;
    }
    if (keep !== true) setState({ id, status: 'loading' });
    void getWeddingFeedDetail(id)
      .then((post) => {
        if (requestVersion === version.current) setState({ id, status: 'ready', post });
      })
      .catch((error: unknown) => {
        if (requestVersion !== version.current) return;
        if (keep === true) notifyRefreshFailed();
        else setState({ id, status: 'error', message: error instanceof Error ? error.message : S['detail.error'] });
      });
  }, [id]);
  const pull = usePullRefresh(useCallback(() => load(true), [load]));

  useEffect(() => {
    // 기존 상세 화면의 비동기 조회 시작 패턴을 유지한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return () => { version.current += 1; };
  }, [load]);

  // 주소가 바뀐 렌더에서 이전 글을 한 프레임도 표시하지 않는다.
  if (state.id !== id || state.status === 'loading') return <DelayedLoadingView />;

  if (state.status === 'error') {
    return (
      <ErrorView
        title={S['detail.error']}
        message={state.message}
        onRetry={() => load()}
        onBack={back}
        backLabel={S['detail.back']}
      />
    );
  }

  const post = state.post;
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar />
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={pull.refreshControl}>
          <ThemedView type="backgroundElement" style={styles.hero}>
            <CategoryImage uri={post.imageUri} />
          </ThemedView>
          <ThemedView style={styles.content}>
            <ThemedView style={styles.header}>
              <ThemedView style={styles.badgeRow}>
                <Badge kind="brand">{post.categoryLabel}</Badge>
              </ThemedView>
              <ThemedText type="t2">{post.title}</ThemedText>
              {post.publishedAt ? (
                <ThemedText type="t7" themeColor="textSecondary">
                  {formatDateDot(post.publishedAt)}
                </ThemedText>
              ) : null}
            </ThemedView>
            {post.summary ? (
              <ThemedText type="body" themeColor="textSecondary">
                {post.summary}
              </ThemedText>
            ) : null}
            {post.bodyImageUri ? (
              <Image source={{ uri: post.bodyImageUri }} style={styles.bodyImage} resizeMode="cover" />
            ) : null}
            <ThemedText type="body" themeColor={post.body ? undefined : 'textSecondary'}>
              {post.body || S['detail.emptyBody']}
            </ThemedText>
            <ActionButton label={S['detail.list']} onPress={() => dismissToOrReplace(feedListHref(from))} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  scroll: { paddingBottom: Spacing.four },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  hero: { width: '100%', height: Layout.heroFeed, overflow: 'hidden' },
  header: { gap: Spacing.one },
  badgeRow: { flexDirection: 'row' },
  bodyImage: { width: '100%', height: 220, borderRadius: Radius.control },
});
