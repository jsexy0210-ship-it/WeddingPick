import type { WeddingInfoCategory, WeddingInfoDetail, WeddingInfoStage } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getWeddingInfo } from '@/api/client';
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

const STAGE_LABEL: Record<WeddingInfoStage, string> = {
  early: '초기 준비',
  mid: '중반 준비',
  late: '막바지 준비',
  all: '전체',
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
 * 본문·체크리스트·관련업체·Pick 연결.
 * 상태: 로딩 → 오류 / 상세 있음.
 */
export default function WeddingInfoDetailScreen() {
  const { infoId } = useLocalSearchParams<{ infoId: string }>();
  const [info, setInfo] = useState<WeddingInfoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!infoId) return;
    setError(null);
    setInfo(null);

    getWeddingInfo(infoId)
      .then(setInfo)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '웨딩 정보를 불러오지 못했어요');
      });
  }, [infoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (error) {
    return (
      <ErrorView
        title="웨딩 정보를 불러오지 못했어요"
        message={error}
        onRetry={load}
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
            <ThemedView style={styles.badges}>
              <ThemedText type="badge" themeColor="tint">
                {CATEGORY_LABEL[info.category]}
              </ThemedText>
              <ThemedText type="badge" themeColor="textSecondary">
                {STAGE_LABEL[info.stage]}
              </ThemedText>
            </ThemedView>
            <ThemedText type="t2">{info.title}</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              {info.publishedAt}
            </ThemedText>
          </ThemedView>

          {/* 본문 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t7">{info.body}</ThemedText>
          </ThemedView>

          {/* 체크리스트 — 항목이 있을 때만 표시 */}
          {info.checklist.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6" style={styles.sectionLabel}>체크리스트</ThemedText>
              {info.checklist.map((item) => (
                <ThemedView key={item.id} style={styles.checkItem}>
                  <ThemedText type="t7">{item.label}</ThemedText>
                </ThemedView>
              ))}
            </ThemedView>
          )}

          {/* 관련 업체로 이동 — 업체가 있을 때만 표시 */}
          {info.relatedVendors.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6" style={styles.sectionLabel}>관련 업체</ThemedText>
              <ThemedText type="t7" themeColor="textSecondary">
                이 정보와 관련된 업체를 검색에서 찾아보세요
              </ThemedText>
              <ActionButton
                label="업체 검색하러 가기"
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/search',
                    params: { vendorId: info.relatedVendors[0]!.id },
                  })
                }
              />
            </ThemedView>
          )}

          {/* Pick 연결 안내 */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="t6" style={styles.sectionLabel}>Pick과 연결하기</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              관련 업체를 Pick에 담아 비교해보세요
            </ThemedText>
            <ActionButton
              label="업체 검색하러 가기"
              onPress={() => router.push('/(tabs)/search')}
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
  badges: { flexDirection: 'row', gap: Spacing.one },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  sectionLabel: { fontWeight: '700' },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.half,
    minHeight: Layout.touchTarget,
  },
});
