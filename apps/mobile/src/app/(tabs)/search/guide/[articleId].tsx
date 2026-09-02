import type { GuideArticleDetail } from '@weddingpick/api-contract';
import { LIFECYCLE_STAGE_LABEL, VENDOR_CATEGORY_LABEL } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGuideArticle } from '@/api/client';
import {
  ActionButton,
  ErrorView,
  LoadingView,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

/**
 * WP-EXPO-004 웨딩 정보 상세.
 *
 * "관련 체크리스트"는 이번 화면에 없다 — 준비단계 태그(`stage`)와 웨딩 체크리스트
 * 항목을 잇는 매핑이 아직 없어서, 억지로 이으면 아무 근거 없는 연결이 된다.
 * "Pick 연결"은 카테고리로 검색 결과를 좁혀 보내는 것으로 대신한다 — 이 글이
 * 특정 업체를 추천하는 것은 아니라서, 업체 하나를 짚어 보내는 것은 과장이다.
 */
export default function GuideArticleDetailScreen() {
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const [article, setArticle] = useState<GuideArticleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGuideArticle(articleId)
      .then(setArticle)
      .catch((caught: Error) => setError(caught.message));
  }, [articleId]);

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  if (!article) {
    return <LoadingView />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.section}>
            <ThemedText type="t2">{article.title}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {[
                article.stage ? LIFECYCLE_STAGE_LABEL[article.stage] : null,
                article.relatedCategory ? VENDOR_CATEGORY_LABEL[article.relatedCategory] : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          </ThemedView>

          <ThemedText type="t6">{article.body}</ThemedText>

          <ThemedText type="t7" themeColor="textAssistive">
            {new Date(article.lastVerifiedAt).toLocaleDateString('ko-KR')} 기준으로 확인한 정보예요
          </ThemedText>

          <ThemedView style={styles.section}>
            {article.relatedCategory ? (
              <ActionButton
                variant="primary"
                label={`${VENDOR_CATEGORY_LABEL[article.relatedCategory]} 둘러보기`}
                onPress={() => router.push(`/search?category=${article.relatedCategory}`)}
              />
            ) : null}
            <ActionButton label="목록으로 돌아가기" onPress={() => router.back()} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: { gap: Spacing.two },
});
