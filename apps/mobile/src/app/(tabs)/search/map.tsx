import type { VendorSummary } from '@weddingpick/api-contract';
import type { VendorCategory } from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  ErrorView,
  FontSize,
  Layout,
  LoadingView,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { VendorMap } from '@/features/search/vendor-map';
import { searchVendors } from '@/api/client';

/**
 * 지도 결과. 핸드오프 WP-SRCH-007.
 * 검색 화면과 같은 조건을 지도 위에서 본다.
 * react-native-maps — 웹에서는 VendorMap이 안내 메시지를 보여준다.
 */

type MapParams = {
  q?: string;
  category?: string;
  region?: string;
};

export default function MapScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<MapParams>();

  const [query, setQuery] = useState(params.q ?? '');
  const [vendors, setVendors] = useState<VendorSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (q: string, category?: string, region?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await searchVendors({
        q: q || undefined,
        category: category as VendorCategory | undefined,
        region: region || undefined,
      });
      setVendors(res.vendors);
    } catch {
      setError('업체를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(params.q ?? '', params.category, params.region);
  }, [load, params.q, params.category, params.region]);

  function retry() {
    setError(null);
    void load(query, params.category, params.region);
  }

  if (error && vendors === null) {
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* 검색바 */}
        <ThemedView style={[styles.searchBar, { borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void load(query, params.category, params.region)}
            placeholder="업체나 지역을 검색해보세요"
            placeholderTextColor={theme.textAssistive}
            returnKeyType="search"
            accessibilityLabel="업체 검색"
          />
          <Pressable
            onPress={() => router.push('/search/filter')}
            accessibilityRole="button"
            accessibilityLabel="필터 열기"
            style={styles.filterBtn}
          >
            <ThemedText type="t7" themeColor="tint">
              필터
            </ThemedText>
          </Pressable>
        </ThemedView>

        {/* 지도 또는 로딩 */}
        {vendors === null && !error ? (
          <LoadingView />
        ) : (
          <VendorMap
            vendors={vendors ?? []}
            loading={loading}
            onRefresh={() => void load(query, params.category, params.region)}
          />
        )}

        {/* 돌아가기 */}
        <ThemedView style={styles.backRow}>
          <ActionButton
            variant="secondary"
            size="large"
            label="목록으로"
            onPress={() => router.back()}
          />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Layout.gutter,
    marginVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
    height: Layout.controlLarge,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: FontSize.t7,
    lineHeight: Platform.OS === 'ios' ? 0 : 19,
    padding: 0,
  },
  filterBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    minHeight: Layout.touchTarget,
    justifyContent: 'center',
  },
  backRow: {
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.two,
  },
});
