import type { VendorSummary } from '@weddingpick/api-contract';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  FontSize,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { searchVendors } from '@/api/client';
import { isServerConfigured } from '@/api/config';

/**
 * WP-BIZ-002: 소속 확인 요청 진입.
 *
 * 업체를 이름으로 검색한 뒤 선택하면 해당 업체의 관계자 인증 화면으로 이동한다.
 * 실제 인증 처리는 `my/vendor-claims/[vendorId]`에서 한다.
 */
export default function BizClaimScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VendorSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isServerConfigured || query.trim().length < 2) {
      return;
    }

    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      searchVendors({ q: query.trim() })
        .then((r) => setResults(r.vendors))
        .catch((e: Error) => {
          setSearchError(e.message);
          setResults([]);
        })
        .finally(() => setSearching(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  function selectVendor(vendor: VendorSummary) {
    router.push(
      `/my/vendor-claims/${vendor.id}?vendorName=${encodeURIComponent(vendor.name)}` as never
    );
  }

  const field = {
    backgroundColor: theme.backgroundSelected,
    color: theme.text,
    borderRadius: Radius.input,
  };

  // query가 짧을 때는 이전 검색 결과를 표시하지 않는다.
  const displayResults = query.trim().length >= 2 ? results : [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedView style={styles.header}>
            <ThemedText type="t2">{`소속 업체를\n찾아주세요`}</ThemedText>
            <ThemedText type="t6" themeColor="textSecondary">
              업체 이름을 두 글자 이상 입력하면 결과가 나와요.
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.notice}>
            <ThemedText type="t6" themeColor="tint">
              담당자가 알려주신 정보로 연락해 확인해요. 확인 전에는 관계자로 표시되지
              않아요.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="t7" themeColor="textSecondary">
              업체 이름
            </ThemedText>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="예) 가온홀"
              placeholderTextColor={theme.textAssistive}
              style={[styles.input, field]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </ThemedView>

          {searching ? (
            <ThemedText type="t7" themeColor="textAssistive">
              검색 중…
            </ThemedText>
          ) : null}

          {searchError ? (
            <ThemedText type="t6" themeColor="negative">
              {searchError}
            </ThemedText>
          ) : null}

          {!isServerConfigured ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6" themeColor="textSecondary">
                이 빌드는 서버에 붙어 있지 않아 검색할 수 없어요.
              </ThemedText>
            </ThemedView>
          ) : null}

          {displayResults.length > 0 ? (
            <ThemedView style={styles.results}>
              {displayResults.map((vendor) => (
                <ThemedView
                  key={vendor.id}
                  type="backgroundElement"
                  style={styles.card}
                >
                  <ThemedView style={styles.vendorRow}>
                    <ThemedView style={styles.vendorInfo}>
                      <ThemedText type="t5">{vendor.name}</ThemedText>
                      <ThemedText type="t7" themeColor="textAssistive">
                        {vendor.region}
                      </ThemedText>
                    </ThemedView>
                    <ActionButton
                      variant="ghost"
                      label="선택"
                      onPress={() => selectVendor(vendor)}
                    />
                  </ThemedView>
                </ThemedView>
              ))}
            </ThemedView>
          ) : query.trim().length >= 2 && !searching ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="t6" themeColor="textSecondary">
                검색 결과가 없어요. 업체 이름을 다시 확인해주세요.
              </ThemedText>
            </ThemedView>
          ) : null}

          <ActionButton label="돌아가기" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
  notice: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: FontSize.t6,
    minHeight: Layout.rowMinHeight,
  },
  results: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vendorInfo: {
    flex: 1,
    gap: Spacing.half,
  },
});
