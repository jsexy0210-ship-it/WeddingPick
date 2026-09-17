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

/**
 * 웨딩피드 글 상세. 2026-09-16 대표 지시 — 「A-23 당연히 쳐 만들어야지」.
 *
 * 그전까지 카드를 눌러도 갈 곳이 없었다. 목록(`../feed.tsx`)과 홈의 미리보기 두 장이
 * 전부 `/feed`로만 보냈고, 쌓아 둔 본문을 읽을 방법이 앱에 없었다.
 *
 * ## 그림의 출처 — 피그마 `FlowScreens.tsx` `FeedDetailPage`
 *
 * 처음에는 「피그마에 없는 화면」으로 보고 업체 상세의 규칙을 빌려 왔다.
 * `scripts/screenshot-figma.mjs`의 `ROUTES`에 글 상세가 없었기 때문이다.
 *
 * **틀렸다.** 피그마 저장소를 열어 보니 `routes.ts:23`에 `community/feed/:id`가
 * 멀쩡히 걸려 있었고, 그리는 것이 `FeedDetailPage`다. 빠져 있던 것은 피그마가
 * 아니라 **우리 캡처 목록**이었다 — 그래서 그 줄을 같이 더했다. 목록이 라우터보다
 * 짧으면 «없는 화면»과 «안 적어 둔 화면»이 똑같아 보인다.
 *
 * 그 화면에서 그대로 가져온 것:
 *
 *   좌우 여백          `Layout.gutter` — 피그마는 `px-5`(20)다. **숫자를 적지 않는다** —
 *                      2026-09-17 대표 지시로 정본이 24가 됐고(`spec/tokens.json`
 *                      `spacing.gutter.$note`), 이 화면은 토큰을 따라간다
 *   대표 이미지 208    `Layout.heroFeed` — `h-52`. **업체 상세의 288(`h-72`)이 아니다** —
 *                      읽는 화면이라 제목을 위로 끌어올린다
 *   그 이미지는 꽉 찬다  피그마의 히어로는 `px-5` **밖**이라 좌우 끝까지 가고 곡률이 없다.
 *                      업체 상세도 같다(`radius={0}` · 폭 100%)
 *   카테고리 배지      키 컬러 글자 + 옅은 키 컬러 면 — `bg-primary/10 text-primary`.
 *                      우리 `Badge kind="brand"`가 같은 조합이다
 *   제목 26            `t2` — `text-[26px]` bold
 *
 * 가져오지 않은 것과 그 이유:
 *
 *   글쓴이 · 읽는 시간 · 좋아요 · 공유   **우리에게 그 값이 없다.** 없는 값을 지어내지 않는다
 *   본문을 소제목 카드로 쪼갠 모양        본문은 한 덩어리로 들어온다(`body` 한 칸).
 *                                         쪼갤 근거가 없어 통짜로 둔다
 *   맨 아래 「RELATED」 관련 업체 카드    영문 eyebrow는 줄째 지운다(2026-09-15 대표 지시).
 *                                         그 단추의 「업체 탐색하기」도 금지어(`탐색`)다
 *   헤더에 카테고리를 한 번 더            **뒤로 가기 줄은 상세 화면끼리 같아야 한다** —
 *                                         한 화면만 다르면 그 화면이 고장 난 것으로 보인다
 *
 * **배지의 «모양»까지는 못 맞췄다.** 피그마는 `rounded-full`에 10px 글자인데 우리
 * `Badge`는 곡률 4에 14px이다(tokens.json `component.badge` · SPEC §12.3). 색 조합은
 * 같다. 이 자리 하나를 위해 알약 배지를 새로 만들면 같은 뜻의 배지가 앱에 두 모양으로
 * 생긴다 — 배지 규격을 통째로 바꿀 일이라 MASTER 판단으로 남긴다.
 *
 * **대표 이미지 위에 글을 얹지 않는다.** 업체 상세는 히어로 위에 흰 업체명을 얹는데,
 * 웨딩피드는 그림이 없는 글이 많아 그 자리가 기본 이미지로 채워진다 — 기본 이미지 위의
 * 흰 글자는 읽히지 않는다. 피그마도 그 자리에 글을 얹지 않는다.
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
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* 거터 밖이다 — 피그마의 히어로가 `px-5` 바깥이라 좌우 끝까지 간다. */}
          <ThemedView type="backgroundElement" style={styles.hero}>
            <CategoryImage uri={post.imageUri} />
          </ThemedView>

          <ThemedView style={styles.content}>
            <ThemedView style={styles.header}>
              {/*
                피그마의 «bg-primary/10 text-primary» 배지. 줄로 감싸지 않으면 배지가
                가로로 늘어나 글자만 왼쪽에 붙은 띠가 된다.
               */}
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
  /* 글 상세의 대표 이미지 — 피그마 `FeedDetailPage`의 `h-52` 208. 거터 밖이라 곡률이 없다. */
  hero: { width: '100%', height: Layout.heroFeed, overflow: 'hidden' },
  header: { gap: Spacing.one },
  badgeRow: { flexDirection: 'row' },
});
