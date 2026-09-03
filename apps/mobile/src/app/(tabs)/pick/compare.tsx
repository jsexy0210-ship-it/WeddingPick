import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPickCandidates } from '@/api/client';
import {
  ActionButton,
  Layout,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { useEffect, useState } from 'react';

/**
 * 카테고리 후보 비교 시트. WP-PICK-003.
 *
 * 같은 카테고리의 후보 업체를 나란히 놓고 주요 지표를 비교한다.
 * 선택은 이 화면에서 하지 않는다 — 목록 화면으로 돌아가 Pick한다.
 */
export default function PickCompareScreen() {
  const theme = useTheme();
  const { category } = useLocalSearchParams<{ category: string }>();
  const vendorCategory = (category ?? '') as VendorCategory;

  const [candidates, setCandidates] = useState<{
    vendorId: string;
    vendorName: string;
    priceRange?: string;
    dataCount: number;
    highlights: string[];
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPickCandidates(vendorCategory)
      .then((res) => {
        if (cancelled) return;
        setCandidates((res as { candidates: typeof candidates }).candidates ?? []);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [vendorCategory]);

  const categoryLabel = VENDOR_CATEGORY_LABEL[vendorCategory] ?? vendorCategory;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Layout>
        <MaxContentWidth>
          <ThemedView style={styles.header}>
            <ThemedText type="title">{categoryLabel} 비교</ThemedText>
            <ThemedText type="body" style={styles.sub}>
              후보 업체를 나란히 놓았어요. 목록으로 돌아가 Pick하세요.
            </ThemedText>
          </ThemedView>

          {loading && (
            <ThemedView style={styles.centered}>
              <ActivityIndicator color={theme.colors.primary} />
            </ThemedView>
          )}

          {!loading && error && (
            <ThemedView style={styles.centered}>
              <ThemedText type="body" style={{ color: theme.colors.danger }}>{error}</ThemedText>
              <ActionButton label="다시 시도" onPress={() => setLoading(true)} />
            </ThemedView>
          )}

          {!loading && !error && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {candidates.map((c) => (
                <ThemedView key={c.vendorId} style={styles.card}>
                  <ThemedText type="bodyBold" numberOfLines={1}>{c.vendorName}</ThemedText>
                  {c.priceRange && (
                    <ThemedText type="small" style={styles.price}>{c.priceRange}</ThemedText>
                  )}
                  <ThemedText type="small" style={styles.meta}>
                    확인된 정보 {c.dataCount}건
                  </ThemedText>
                  {c.highlights.map((h, i) => (
                    <ThemedText key={i} type="small" style={styles.highlight}>• {h}</ThemedText>
                  ))}
                </ThemedView>
              ))}
              {candidates.length === 0 && (
                <ThemedText type="body" style={styles.empty}>비교할 후보가 없어요.</ThemedText>
              )}
            </ScrollView>
          )}

          <ThemedView style={styles.actions}>
            <ActionButton label="목록으로" onPress={() => router.back()} />
          </ThemedView>
        </MaxContentWidth>
      </Layout>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: Spacing.s6, paddingBottom: Spacing.s4 },
  sub: { marginTop: Spacing.s2, opacity: 0.7 },
  centered: { alignItems: 'center', paddingVertical: Spacing.s8, gap: Spacing.s4 },
  card: {
    width: 200,
    marginRight: Spacing.s4,
    padding: Spacing.s4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4e5ea',
  },
  price: { marginTop: Spacing.s2, opacity: 0.8 },
  meta: { marginTop: Spacing.s1, opacity: 0.6 },
  highlight: { marginTop: Spacing.s1, opacity: 0.7 },
  empty: { paddingVertical: Spacing.s8, opacity: 0.5 },
  actions: { paddingVertical: Spacing.s6, gap: Spacing.s3 },
});
