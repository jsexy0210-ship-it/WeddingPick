import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackBar } from '@/components/back-bar';
import { CategoryImage } from '@/features/home/category-image';
import { getWeddingFeedDetail, type WeddingContentDetail } from '@/features/home/content';
import { formatDateDot } from '@/features/common/format-date';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';
import {
  ActionButton,
  ErrorView,
  Layout,
  LetterSpacing,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';
import strings from '../../../../../../../spec/strings.ko.json';

const S = strings.weddingFeed;

/**
 * 웨딩피드 글 상세. 2026-09-16 대표 지시 — 「A-23 당연히 쳐 만들어야지」.
 *
 * 그전까지 카드를 눌러도 갈 곳이 없었다. 목록(`../feed.tsx`)과 홈의 미리보기 두 장이
 * 전부 `/feed`로만 보냈고, 쌓아 둔 본문을 읽을 방법이 앱에 없었다.
 *
 * ## 피그마에 이 화면이 없다 — 규칙으로 그린다
 *
 * 피그마 저장소의 화면은 열둘이고(`scripts/screenshot-figma.mjs` `ROUTES`) 웨딩피드 글
 * 상세는 거기 없다. **임의로 만들지 않는다**(CLAUDE.md 최상위 규칙 3) — 피그마가 다른
 * 상세 화면에 이미 쓴 규칙을 그대로 가져온다.
 *
 *   좌우 20            `Layout.gutter` — 피그마 전 화면 공통
 *   대표 이미지 288    `Layout.heroVendor` — 피그마 `VendorFlows.tsx` `h-72`. 상세 화면의
 *                      대표 이미지 규격이고, 이 화면도 상세 화면이다
 *   곡률 16            `Radius.cardLarge` — 피그마 `rounded-2xl`의 실효값. 웨딩피드 카드가
 *                      쓰는 것과 같다
 *   카테고리 줄        10/700 · ls 0.25 · 흐린 글자 — 규격서 `home.txt`의 카드 첫 줄 그대로.
 *                      **카드와 같은 모양이라야** 눌러 들어온 자리가 그 카드임을 안다
 *
 * **대표 이미지 위에 글을 얹지 않는다.** 업체 상세는 히어로 위에 흰 업체명을 얹는데,
 * 웨딩피드는 그림이 없는 글이 많아 그 자리가 기본 이미지로 채워진다 — 기본 이미지 위의
 * 흰 글자는 읽히지 않는다. 글은 그림 아래 둔다.
 *
 * **배지는 원래 카테고리명 그대로다**(2026-09-16 대표 지시 — 「기존 카테고리명을 배지로
 * 유지하면 됩니다」). 탭 이름(「업체·서비스」)으로 바꾸지 않는다.
 */
export default function WeddingFeedDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<WeddingContentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    setPost(null);

    getWeddingFeedDetail(id)
      .then(setPost)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : S['detail.error']));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (error) {
    return (
      <ErrorView
        title={S['detail.error']}
        message={error}
        onRetry={load}
        onBack={() => router.back()}
        backLabel={S['detail.back']}
      />
    );
  }

  /*
   * 상세 하나를 읽어오는 자리라 로더다 — 목록이 아니라서 뼈대를 그리지 않는다
   * (`packages/ui` `LoadingView` 주석). 700ms 전에는 빈 화면이고, 로더는 원형 하나뿐이다.
   */
  if (!post) return <DelayedLoadingView />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView type="backgroundElement" style={styles.hero}>
            <CategoryImage uri={post.imageUri} />
          </ThemedView>

          <ThemedView style={styles.header}>
            {/* 카드 첫 줄과 같은 모양 — 규격서 home.txt «10/700 · ls 0.25px». */}
            <ThemedText type="f10" themeColor="textAssistive" style={styles.category}>
              {post.categoryLabel}
            </ThemedText>
            <ThemedText type="t2">{post.title}</ThemedText>
            {post.publishedAt ? (
              <ThemedText type="t7" themeColor="textSecondary">
                {formatDateDot(post.publishedAt)}
              </ThemedText>
            ) : null}
          </ThemedView>

          {/* 한 줄 요약. 카드에서 보던 그 줄이라 본문보다 먼저 온다. */}
          {post.summary ? (
            <ThemedText type="body" themeColor="textSecondary">
              {post.summary}
            </ThemedText>
          ) : null}

          {/*
            본문이 빈 글도 공개될 수 있다(계약의 기본값이 빈 글자다). 그때 아무것도
            안 그리면 화면이 고장 난 것으로 읽힌다 — 비어 있다고 말한다.
           */}
          <ThemedText type="body" themeColor={post.body ? undefined : 'textSecondary'}>
            {post.body || S['detail.emptyBody']}
          </ThemedText>

          <ActionButton label={S['detail.back']} onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  /* 상세 화면의 대표 이미지 — 피그마 `h-72` 288 · `rounded-2xl` 16. */
  hero: {
    width: '100%',
    height: Layout.heroVendor,
    borderRadius: Radius.cardLarge,
    overflow: 'hidden',
  },
  header: { gap: Spacing.one },
  /* 규격서 «10/700 · ls 0.25px» — 카드의 카테고리 줄과 같은 값이다. */
  category: { fontWeight: 700, letterSpacing: LetterSpacing.p025 },
});
