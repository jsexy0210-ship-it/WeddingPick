import type { VendorSummary } from '@weddingpick/api-contract';
import { TERMS, VENDOR_CATEGORY_LABEL, regionLabel } from '@weddingpick/domain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ErrorView,
  Layout,
  MaxContentWidth,
  Radius,
  Skeleton,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';
import { searchVendors, listVendorRegions } from '@/api/client';
import { BackBar } from '@/components/back-bar';

/**
 * 자동완성 패널. 핸드오프 WP-SRCH-002.
 * 검색창 포커스 시 검색 화면 위에 겹쳐 뜬다.
 * 섹션: 최근 검색어 → 업체명 제안 → 지역명 제안 → "이 말로 검색"
 */

const RECENT_STORAGE_KEY = 'weddingpick.recent_searches';
const MAX_RECENT = 8;

async function loadRecent(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function saveRecent(query: string, prev: string[]): Promise<string[]> {
  const next = [query, ...prev.filter((q) => q !== query)].slice(0, MAX_RECENT);
  try {
    await AsyncStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 저장 실패는 조용히 무시
  }
  return next;
}

async function clearRecent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_STORAGE_KEY);
  } catch {
    // 조용히 무시
  }
}

type AutocompleteParams = {
  q?: string;
};

/** 스켈레톤 — 제안 행 4줄 */
function AutocompleteSkeleton() {
  return (
    <ThemedView style={styles.skeletonSection}>
      {[0, 1, 2, 3].map((i) => (
        <ThemedView key={i} style={styles.row}>
          <Skeleton height={17} width={`${50 + i * 10}%`} />
          <Skeleton height={14} width="20%" />
        </ThemedView>
      ))}
    </ThemedView>
  );
}

export default function AutocompleteScreen() {
  const { q = '' } = useLocalSearchParams<AutocompleteParams>();

  const [recent, setRecent] = useState<string[]>([]);
  const [vendorSuggestions, setVendorSuggestions] = useState<VendorSummary[]>([]);
  const [regionSuggestions, setRegionSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 최근 검색어 로드
  useEffect(() => {
    loadRecent().then(setRecent).catch(() => setRecent([]));
  }, []);

  // 검색어가 있으면 제안 조회
  const fetchSuggestions = useCallback((query: string) => {
    if (!query.trim()) {
      setVendorSuggestions([]);
      setRegionSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      searchVendors({ q: query }).catch(() => ({ vendors: [] as VendorSummary[] })),
      listVendorRegions().catch(() => ({ regions: [] as { name: string }[] })),
    ])
      .then(([vendorRes, regionRes]) => {
        const lower = query.toLowerCase();
        setVendorSuggestions(
          vendorRes.vendors
            .filter((v) => v.name.toLowerCase().includes(lower))
            .slice(0, 5)
        );
        setRegionSuggestions(
          regionRes.regions
            .map((r) => r.name)
            .filter((n) => n.toLowerCase().includes(lower))
            .slice(0, 3)
        );
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, fetchSuggestions]);

  async function selectQuery(query: string) {
    const updated = await saveRecent(query, recent);
    setRecent(updated);
    router.push({ pathname: '/(tabs)/search', params: { q: query } });
  }

  async function deleteRecent(query: string) {
    const updated = recent.filter((r) => r !== query);
    try {
      await AsyncStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // 조용히 무시
    }
    setRecent(updated);
  }

  async function clearAll() {
    await clearRecent();
    setRecent([]);
  }

  if (error) {
    return (
      <ErrorView
        title="제안을 불러오지 못했어요"
        onRetry={() => fetchSuggestions(q)}
        retryLabel="다시 시도"
        onBack={() => router.back()}
        backLabel="돌아가기"
      />
    );
  }

  const hasQuery = q.trim().length > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackBar />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* 로딩 */}
          {loading && hasQuery && <AutocompleteSkeleton />}

          {/* 업체명 제안 */}
          {!loading && hasQuery && vendorSuggestions.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText type="t7" themeColor="textAssistive" style={styles.sectionLabel}>
                업체
              </ThemedText>
              {vendorSuggestions.map((vendor) => (
                <Pressable
                  key={vendor.id}
                  accessibilityRole="button"
                  onPress={() => void selectQuery(vendor.name)}
                >
                  <ThemedView style={styles.row}>
                    <ThemedView style={styles.rowMain}>
                      <ThemedText type="t6" numberOfLines={1}>
                        {vendor.name}
                      </ThemedText>
                      <ThemedText type="t7" themeColor="textAssistive">
                        {VENDOR_CATEGORY_LABEL[vendor.category]} · {regionLabel(vendor.region)}
                      </ThemedText>
                    </ThemedView>
                    <ThemedText type="t7" themeColor="textAssistive">
                      {TERMS.verifiedData} {vendor.comparableQuoteCount}건
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          )}

          {/* 지역명 제안 */}
          {!loading && hasQuery && regionSuggestions.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText type="t7" themeColor="textAssistive" style={styles.sectionLabel}>
                지역
              </ThemedText>
              {regionSuggestions.map((region) => (
                <Pressable
                  key={region}
                  accessibilityRole="button"
                  onPress={() => void selectQuery(region)}
                >
                  <ThemedView style={styles.row}>
                    <ThemedText type="t6">{region}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          )}

          {/* "이 말로 검색" */}
          {hasQuery && (
            <Pressable
              accessibilityRole="button"
              onPress={() => void selectQuery(q)}
            >
              <ThemedView style={[styles.row, styles.keywordRow]}>
                <ThemedText type="t6">
                  <ThemedText type="t6" themeColor="tint">
                    {q}
                  </ThemedText>
                  {' '}(으)로 검색
                </ThemedText>
              </ThemedView>
            </Pressable>
          )}

          {/* 최근 검색어 — 검색어 없을 때만 */}
          {!hasQuery && (
            <ThemedView style={styles.section}>
              <ThemedView style={styles.sectionHeader}>
                <ThemedText type="t7" themeColor="textAssistive" style={styles.sectionLabel}>
                  최근 검색
                </ThemedText>
                {recent.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void clearAll()}
                  >
                    <ThemedText type="t7" themeColor="textAssistive">
                      전체 삭제
                    </ThemedText>
                  </Pressable>
                )}
              </ThemedView>

              {recent.length === 0 ? (
                <ThemedView style={styles.emptyRecent}>
                  <ThemedText type="t7" themeColor="textAssistive">
                    최근 검색어가 없어요
                  </ThemedText>
                </ThemedView>
              ) : (
                recent.map((query) => (
                  <ThemedView key={query} style={styles.recentRow}>
                    <Pressable
                      style={styles.recentQuery}
                      accessibilityRole="button"
                      onPress={() => void selectQuery(query)}
                    >
                      <ThemedText type="t6">{query}</ThemedText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${query} 삭제`}
                      onPress={() => void deleteRecent(query)}
                      hitSlop={12}
                    >
                      <ThemedText type="t7" themeColor="textAssistive">
                        삭제
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                ))
              )}
            </ThemedView>
          )}
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
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    gap: Spacing.one,
  },
  section: { gap: Spacing.one },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  sectionLabel: { marginBottom: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.rowMinHeight,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  rowMain: { flex: 1, gap: Spacing.half },
  keywordRow: {
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Layout.rowMinHeight,
    gap: Spacing.two,
  },
  recentQuery: { flex: 1, paddingVertical: Spacing.two },
  emptyRecent: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  skeletonSection: { gap: Spacing.two },
});
