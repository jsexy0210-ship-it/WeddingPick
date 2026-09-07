import { VENDOR_SORTS, type VendorSort } from '@weddingpick/api-contract';
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listVendorRegions } from '@/api/client';
import {
  ActionButton,
  ErrorView,
  FilterChip,
  Layout,
  LoadingView,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

/**
 * 필터 시트. WP-SRCH-005.
 *
 * 검색 결과 화면에서 열린다. 지역·가격구간·카테고리·정렬을 고른 뒤 "필터 적용"을
 * 누르면 검색 화면으로 돌아가면서 파라미터를 넘긴다.
 *
 * 가격구간은 슬라이더 대신 만원 단위 직접 입력으로 구현한다 — 웨딩 예산은 범위가
 * 넓어 고정 구간 칩이나 슬라이더보다 숫자 입력이 더 정확하다.
 */

/** 검색 화면이 인식하는 정렬 이름을 표시용 라벨로 바꾼다. */
const SORT_LABEL_OVERRIDE: Record<VendorSort, string> = {
  data: '확인된 정보 많은 순',
  price_low: '금액 낮은 순',
  price_high: '금액 높은 순',
  name: '이름 순',
};

/** 스타일 태그 목록. 화면에 보이는 예시 태그다. */
const STYLE_TAGS = [
  '모던',
  '클래식',
  '내추럴',
  '로맨틱',
  '유니크',
  '미니멀',
] as const;

type StyleTag = (typeof STYLE_TAGS)[number];

export default function FilterScreen() {
  const theme = useTheme();

  const raw = useLocalSearchParams<{
    region?: string;
    sort?: string;
    category?: string;
    priceMin?: string;
    priceMax?: string;
    styleTags?: string;
  }>();

  const [regions, setRegions] = useState<string[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* 현재 선택 상태 */
  const [region, setRegion] = useState<string | null>(raw.region ?? null);
  const [sort, setSort] = useState<VendorSort>((raw.sort as VendorSort) ?? 'data');
  const [category, setCategory] = useState<VendorCategory | null>(
    (raw.category as VendorCategory) ?? null
  );
  const [priceMin, setPriceMin] = useState(raw.priceMin ?? '');
  const [priceMax, setPriceMax] = useState(raw.priceMax ?? '');
  const [styleTags, setStyleTags] = useState<StyleTag[]>(
    raw.styleTags ? (raw.styleTags.split(',') as StyleTag[]) : []
  );

  useEffect(() => {
    listVendorRegions()
      .then((res) => setRegions(res.regions.map((r) => r.name)))
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setLoadingRegions(false));
  }, []);

  function toggleTag(tag: StyleTag) {
    setStyleTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function reset() {
    setRegion(null);
    setSort('data');
    setCategory(null);
    setPriceMin('');
    setPriceMax('');
    setStyleTags([]);
  }

  function apply() {
    const params: Record<string, string> = {};
    if (region) params.filterRegion = region;
    if (sort !== 'data') params.filterSort = sort;
    if (category) params.filterCategory = category;
    if (priceMin) params.filterPriceMin = priceMin;
    if (priceMax) params.filterPriceMax = priceMax;
    if (styleTags.length > 0) params.filterStyleTags = styleTags.join(',');

    /*
      검색 화면으로 돌아가면서 필터 파라미터를 함께 보낸다. 검색 화면이
      useLocalSearchParams 로 읽어간다.
    */
    router.navigate({ pathname: '/(tabs)/search', params });
  }

  if (error) {
    return <ErrorView message={error} onBack={() => router.back()} />;
  }

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundSelected },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="t4">필터</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="초기화"
            onPress={reset}
            hitSlop={12}>
            <ThemedText type="t7" themeColor="tint">
              초기화
            </ThemedText>
          </Pressable>
        </ThemedView>

        <ScrollView contentContainerStyle={styles.content}>
          {/* 지역 */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">지역</ThemedText>
            {loadingRegions ? (
              <LoadingView />
            ) : (
              <ThemedView style={styles.chips}>
                {regions.map((r) => (
                  <FilterChip
                    key={r}
                    label={r}
                    selected={region === r}
                    role="radio"
                    onPress={() => setRegion(region === r ? null : r)}
                  />
                ))}
              </ThemedView>
            )}
          </ThemedView>

          {/* 카테고리 */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">카테고리</ThemedText>
            <ThemedView style={styles.chips}>
              {VENDOR_CATEGORIES.map((cat) => (
                <FilterChip
                  key={cat}
                  label={VENDOR_CATEGORY_LABEL[cat]}
                  selected={category === cat}
                  role="radio"
                  onPress={() => setCategory(category === cat ? null : cat)}
                />
              ))}
            </ThemedView>
          </ThemedView>

          {/* 가격구간 */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">가격구간 (만원)</ThemedText>
            <ThemedView style={styles.priceRow}>
              <TextInput
                style={[inputStyle, styles.priceInput]}
                value={priceMin}
                onChangeText={(t) => setPriceMin(t.replace(/[^0-9]/g, '').slice(0, 5))}
                keyboardType="number-pad"
                placeholder="최소"
                placeholderTextColor={theme.textAssistive}
                accessibilityLabel="최소 가격 (만원)"
                maxLength={6}
              />
              <ThemedText type="t7" themeColor="textSecondary">
                ~
              </ThemedText>
              <TextInput
                style={[inputStyle, styles.priceInput]}
                value={priceMax}
                onChangeText={(t) => setPriceMax(t.replace(/[^0-9]/g, '').slice(0, 5))}
                keyboardType="number-pad"
                placeholder="최대"
                placeholderTextColor={theme.textAssistive}
                accessibilityLabel="최대 가격 (만원)"
                maxLength={6}
              />
            </ThemedView>
          </ThemedView>

          {/* 스타일 태그 */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">스타일</ThemedText>
            <ThemedView style={styles.chips}>
              {STYLE_TAGS.map((tag) => (
                <FilterChip
                  key={tag}
                  label={tag}
                  selected={styleTags.includes(tag)}
                  onPress={() => toggleTag(tag)}
                />
              ))}
            </ThemedView>
          </ThemedView>

          {/* 정렬 */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">정렬</ThemedText>
            <ThemedView style={styles.chips}>
              {VENDOR_SORTS.map((s) => (
                <FilterChip
                  key={s}
                  label={SORT_LABEL_OVERRIDE[s]}
                  selected={sort === s}
                  role="radio"
                  onPress={() => setSort(s)}
                />
              ))}
            </ThemedView>
          </ThemedView>
        </ScrollView>

        {/* Primary CTA */}
        <ThemedView style={styles.footer}>
          <ActionButton
            variant="primary"
            label="필터 적용"
            onPress={apply}
          />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  priceInput: {
    flex: 1,
    height: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
  },
  input: {
    height: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
  },
  footer: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.three,
    paddingTop: Spacing.two,
  },
});
