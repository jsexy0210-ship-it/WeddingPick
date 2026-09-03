import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

// TODO: API 미구현 — GET /v1/wedding-info/:infoId (웨딩 정보 상세)
type WeddingInfoCategory =
  | 'planning'
  | 'venue'
  | 'dress'
  | 'photo'
  | 'beauty'
  | 'catering'
  | 'honeymoon';

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

type RelatedVendor = {
  id: string;
  name: string;
  category: string;
};

type WeddingInfoDetail = {
  id: string;
  title: string;
  category: WeddingInfoCategory;
  publishedAt: string;
  body: string;
  checklist: ChecklistItem[];
  relatedVendors: RelatedVendor[];
};

const CATEGORY_LABEL: Record<WeddingInfoCategory, string> = {
  planning: '전체 계획',
  venue: '예식장',
  dress: '드레스',
  photo: '촬영',
  beauty: '뷰티',
  catering: '케이터링',
  honeymoon: '허니문',
};

/** 스켈레톤 — 웨딩 정보 상세 페이지 뼈대. */
function WeddingInfoDetailSkeleton() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Skeleton height={14} width="20%" />
      <Skeleton height={35} width="75%" />
      <Skeleton height={14} width="25%" />
      <ThemedView type="backgroundElement" style={styles.card}>
        <Skeleton height={16} width="40%" />
        <Skeleton height={14} width="90%" />
        <Skeleton height={14} width="80%" />
        <Skeleton height={14} width="85%" />
      </ThemedView>
      <ThemedView type="backgroundElement" style={styles.card}>
        <Skeleton height={16} width="30%" />
        <Skeleton height={14} width="70%" />
        <Skeleton height={14} width="60%" />
      </ThemedView>
    </ScrollView>
  );
}

/**
 * 웨딩 정보 상세. 핸드오프 WP-EXPO-004.
 * 본문·관련업체·체크리스트·Pick 연결.
 * 상태: 로딩 → 오류 / 상세 있음.
 */
export default function WeddingInfoDetailScreen() {
  const { infoId } = useLocalSearchParams<{ infoId: string }>();
  const [info, setInfo] = useState<WeddingInfoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: API 미구현 — GET /v1/wedding-info/:infoId
    void infoId;
    setError('웨딩 정보를 아직 가져올 수 없어요');
  }, [infoId]);

  function retry() {
    setError(null);
    setInfo(null);
    // TODO: API 미구현 — 재시도 시 API 호출
    setError('웨딩 정보를 아직 가져올 수 없어요');
  }

  if (error) {
    return (
      <ErrorView
        title={error}
        onRetry={retry}
        retryLabel="다시 시도"
        onBack={() => router.back()}
        backLabel="돌아가기"
      />
    );
  }

  if (!info) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <WeddingInfoDetailSkeleton />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* 헤더 */}
          <ThemedView style={styles.header}>
            <ThemedText type="badge" themeColor="tint">
              {CATEGORY_LABEL[info.category]}
            </ThemedText>
            <ThemedText type="t2">{info.title}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {info.publishedAt}
            </ThemedText>
          </ThemedView>

          {/* 본문 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t7">{info.body}</ThemedText>
          </ThemedView>

          {/* 체크리스트 */}
          {info.checklist.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6" style={styles.sectionLabel}>체크리스트</ThemedText>
              {info.checklist.map((item) => (
                <ThemedView key={item.id} style={styles.checkItem}>
                  <ThemedText
                    type="t7"
                    themeColor={item.done ? 'textAssistive' : undefined}
                    style={item.done ? styles.checkDone : undefined}
                  >
                    {item.label}
                  </ThemedText>
                  <ThemedText type="t7" themeColor={item.done ? 'tint' : 'textAssistive'}>
                    {item.done ? '완료' : '미완료'}
                  </ThemedText>
                </ThemedView>
              ))}
            </ThemedView>
          )}

          {/* 관련 업체 */}
          {info.relatedVendors.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6" style={styles.sectionLabel}>관련 업체</ThemedText>
              {info.relatedVendors.map((vendor) => (
                <ActionButton
                  key={vendor.id}
                  label={`${vendor.name} · ${vendor.category}`}
                  onPress={() => router.push(`/search/${vendor.id}`)}
                />
              ))}
            </ThemedView>
          )}

          {/* Pick 연결 안내 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t6" style={styles.sectionLabel}>Pick과 연결하기</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              관련 업체를 Pick에 담아 비교해보세요
            </ThemedText>
            {/* TODO: API 미구현 — Pick 연결 흐름 (검색 화면으로 이동) */}
            <ActionButton
              label="업체 검색하러 가기"
              onPress={() => router.push('/search')}
            />
          </ThemedView>

          <ActionButton label="돌아가기" onPress={() => router.back()} />
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
    gap: Spacing.two,
  },
  header: { gap: Spacing.one },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  sectionLabel: { fontWeight: '700' },
  checkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.half,
    minHeight: Layout.touchTarget,
  },
  checkDone: { textDecorationLine: 'line-through' },
});
