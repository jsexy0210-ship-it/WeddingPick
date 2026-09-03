import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Radius,
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

/**
 * 웨딩 정보 상세. 핸드오프 WP-EXPO-004.
 * 본문·관련업체·체크리스트·Pick 연결.
 */
export default function WeddingInfoDetailScreen() {
  // TODO: API 미구현 — infoId로 웨딩 정보 상세 조회
  const { infoId: _infoId } = useLocalSearchParams<{ infoId: string }>();
  const info = null as WeddingInfoDetail | null;

  if (!info) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.centerContent}>
            {/* TODO: API 미구현 — infoId로 웨딩 정보 조회 */}
            <ThemedText type="t7" themeColor="textSecondary">
              웨딩 정보를 불러올 수 없습니다.
            </ThemedText>
            <ActionButton label="돌아가기" onPress={() => router.back()} />
          </ThemedView>
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
              <ThemedText type="t6">체크리스트</ThemedText>
              {info.checklist.map((item) => (
                <ThemedView key={item.id} style={styles.checkItem}>
                  <ThemedText type="t7" themeColor={item.done ? 'textSecondary' : undefined}>
                    {item.done ? '✓' : '○'} {item.label}
                  </ThemedText>
                </ThemedView>
              ))}
            </ThemedView>
          )}

          {/* 관련 업체 */}
          {info.relatedVendors.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6">관련 업체</ThemedText>
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
            <ThemedText type="t6">Pick과 연결하기</ThemedText>
            <ThemedText type="t7" themeColor="textSecondary">
              관련 업체를 Pick에 추가해 비교·상담 요청까지 이어갈 수 있어요.
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
  centerContent: {
    flex: 1,
    padding: Layout.gutter,
    gap: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: { gap: Spacing.one },
  card: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.one },
  checkItem: { paddingVertical: 2 },
});
