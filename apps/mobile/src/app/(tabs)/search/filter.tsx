import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@weddingpick/domain';
import { VENDOR_SORTS, type VendorSort } from '@weddingpick/api-contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionButton,
  FilterChip,
  Layout,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';

/**
 * 필터 패널. 핸드오프 WP-SRCH-005.
 * 시트형 — 검색 화면 위에 겹쳐 뜨며 뒤로 가면 닫힌다.
 * 결과 수는 API 연동 후 채운다.
 */

type FilterParams = {
  category?: string;
  region?: string;
  sort?: string;
  priceLow?: string;
  priceHigh?: string;
};

const SORT_LABEL: Record<VendorSort, string> = {
  data: '확인 많은순',
  price_low: '확인된 금액 낮은순',
  price_high: '확인된 금액 높은순',
  name: '이름순',
};

const PRICE_RANGES = [
  { label: '전체', low: null, high: null },
  { label: '100만원 미만', low: null, high: 100 },
  { label: '100~200만원', low: 100, high: 200 },
  { label: '200~300만원', low: 200, high: 300 },
  { label: '300~500만원', low: 300, high: 500 },
  { label: '500만원 이상', low: 500, high: null },
] as const;

const REGIONS = ['전체', '서울', '경기', '인천', '부산', '대구', '대전', '광주', '기타'];

export default function FilterScreen() {
  const params = useLocalSearchParams<FilterParams>();

  const [category, setCategory] = useState<VendorCategory | 'all'>(
    (params.category as VendorCategory) ?? 'all'
  );
  const [region, setRegion] = useState<string>(params.region ?? '전체');
  const [sort, setSort] = useState<VendorSort>((params.sort as VendorSort) ?? 'data');
  const [priceLow, setPriceLow] = useState<number | null>(
    params.priceLow ? Number(params.priceLow) : null
  );
  const [priceHigh, setPriceHigh] = useState<number | null>(
    params.priceHigh ? Number(params.priceHigh) : null
  );

  function reset() {
    setCategory('all');
    setRegion('전체');
    setSort('data');
    setPriceLow(null);
    setPriceHigh(null);
  }

  function apply() {
    router.back();
    // TODO: API 미구현 — 필터 값을 검색 화면으로 전달
    // router.setParams({ category, region, sort, priceLow, priceHigh });
  }

  function selectPriceRange(low: number | null, high: number | null) {
    setPriceLow(low);
    setPriceHigh(high);
  }

  const selectedRange = PRICE_RANGES.find(
    (r) => r.low === priceLow && r.high === priceHigh
  );

  const isDefault =
    category === 'all' &&
    region === '전체' &&
    sort === 'data' &&
    priceLow === null &&
    priceHigh === null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* 헤더 */}
          <ThemedView style={styles.header}>
            <ThemedText type="t2">필터</ThemedText>
          </ThemedView>

          {/* 업체 유형 */}
          <ThemedView style={styles.section}>
            <ThemedText type="t6" style={styles.sectionLabel}>
              업체 유형
            </ThemedText>
            <ThemedView style={styles.chipWrap}>
              <FilterChip
                label="전체"
                selected={category === 'all'}
                onPress={() => setCategory('all')}
                role="radio"
              />
              {VENDOR_CATEGORIES.map((c) => (
                <FilterChip
                  key={c}
                  label={VENDOR_CATEGORY_LABEL[c]}
                  selected={category === c}
                  onPress={() => setCategory(c)}
                  role="radio"
                />
              ))}
            </ThemedView>
          </ThemedView>

          {/* 지역 */}
          <ThemedView style={styles.section}>
            <ThemedText type="t6" style={styles.sectionLabel}>
              지역
            </ThemedText>
            <ThemedView style={styles.chipWrap}>
              {REGIONS.map((r) => (
                <FilterChip
                  key={r}
                  label={r}
                  selected={region === r}
                  onPress={() => setRegion(r)}
                  role="radio"
                />
              ))}
            </ThemedView>
          </ThemedView>

          {/* 가격구간 */}
          <ThemedView style={styles.section}>
            <ThemedText type="t6" style={styles.sectionLabel}>
              가격구간
            </ThemedText>
            <ThemedView style={styles.chipWrap}>
              {PRICE_RANGES.map((r) => (
                <FilterChip
                  key={r.label}
                  label={r.label}
                  selected={selectedRange?.label === r.label}
                  onPress={() => selectPriceRange(r.low ?? null, r.high ?? null)}
                  role="radio"
                />
              ))}
            </ThemedView>
          </ThemedView>

          {/* 정렬 */}
          <ThemedView style={styles.section}>
            <ThemedText type="t6" style={styles.sectionLabel}>
              정렬
            </ThemedText>
            <ThemedView style={styles.chipWrap}>
              {VENDOR_SORTS.map((s) => (
                <FilterChip
                  key={s}
                  label={SORT_LABEL[s]}
                  selected={sort === s}
                  onPress={() => setSort(s)}
                  role="radio"
                />
              ))}
            </ThemedView>
          </ThemedView>
        </ScrollView>

        {/* CTA */}
        <ThemedView style={styles.actions}>
          {!isDefault && (
            <ActionButton
              variant="secondary"
              size="large"
              label="초기화"
              onPress={reset}
            />
          )}
          <ThemedView style={styles.primaryAction}>
            <ActionButton
              variant="primary"
              size="xlarge"
              label="필터 적용"
              onPress={apply}
            />
          </ThemedView>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  header: { marginBottom: Spacing.one },
  section: { gap: Spacing.two },
  sectionLabel: { fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Layout.gutter,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryAction: { flex: 1 },
});
