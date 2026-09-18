import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackBar } from '@/components/back-bar';
import { getWeddingFeedScrapState, removeWeddingFeedScrap, saveWeddingFeedScrap } from '@/api/client';
import { CategoryImage } from '@/features/home/category-image';
import { getWeddingFeedDetail, type WeddingContentDetail } from '@/features/home/content';
import { formatDateDot } from '@/features/common/format-date';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import { useDepthBack } from '@/features/navigation/depth-back';
import { useSession } from '@/features/auth/use-session';
import {
  ActionButton,
  Badge,
  ErrorView,
  Layout,
  MaxContentWidth,
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
 */
export default function WeddingFeedDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const back = useDepthBack();
  const { state: sessionState } = useSession();
  const version = useRef(0);
  const [state, setState] = useState<DetailState>({ id, status: 'loading' });
  const [scrapSaved, setScrapSaved] = useState<boolean | null>(null);
  const [scrapBusy, setScrapBusy] = useState(false);

  const load = useCallback(() => {
    const requestVersion = ++version.current;
    if (!id.trim()) {
      setState({ id, status: 'error', message: S['detail.error'] });
      return;
    }
    setState({ id, status: 'loading' });
    void getWeddingFeedDetail(id)
      .then((post) => {
        if (requestVersion === version.current) setState({ id, status: 'ready', post });
      })
      .catch((error: unknown) => {
        if (requestVersion === version.current) {
          setState({ id, status: 'error', message: error instanceof Error ? error.message : S['detail.error'] });
        }
      });
  }, [id]);

  useEffect(() => {
    // 기존 상세 화면의 비동기 조회 시작 패턴을 유지한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return () => { version.current += 1; };
  }, [load]);

  useEffect(() => {
    if (sessionState.status !== 'signedIn' || !id.trim()) {
      setScrapSaved(null);
      return;
    }
    let active = true;
    void getWeddingFeedScrapState(id)
      .then(({ saved }) => { if (active) setScrapSaved(saved); })
      .catch(() => { if (active) setScrapSaved(null); });
    return () => { active = false; };
  }, [id, sessionState.status]);

  const toggleScrap = useCallback(() => {
    if (scrapSaved === null || scrapBusy) return;
    setScrapBusy(true);
    const operation = scrapSaved ? removeWeddingFeedScrap(id) : saveWeddingFeedScrap(id);
    void operation
      .then(({ saved }) => setScrapSaved(saved))
      .finally(() => setScrapBusy(false));
  }, [id, scrapBusy, scrapSaved]);

  // 주소가 바뀐 렌더에서 이전 글을 한 프레임도 표시하지 않는다.
  if (state.id !== id || state.status === 'loading') return <DelayedLoadingView />;

  if (state.status === 'error') {
    return (
      <ErrorView
        title={S['detail.error']}
        message={state.message}
        onRetry={load}
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
        <ScrollView contentContainerStyle={styles.scroll}>
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
            <ThemedText type="body" themeColor={post.body ? undefined : 'textSecondary'}>
              {post.body || S['detail.emptyBody']}
            </ThemedText>
            {sessionState.status === 'signedIn' && scrapSaved !== null ? (
              <ActionButton
                variant="secondary"
                label={scrapSaved ? '스크랩 해제' : '스크랩 저장'}
                disabled={scrapBusy}
                onPress={toggleScrap}
              />
            ) : null}
            <ActionButton label={S['detail.back']} onPress={back} />
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
});
