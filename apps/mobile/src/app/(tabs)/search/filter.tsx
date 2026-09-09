import { VENDOR_SORTS, type VendorSort } from '@weddingpick/api-contract';
import {
  PREPARATION_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCurrentUser, listVendorRegions } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { loadToken } from '@/api/session';
import {
  ActionButton,
  ErrorView,
  FilterChip,
  Layout,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { readCurrentUserSnapshot } from '@/features/loading/current-user-snapshot';
import { SORT_LABEL } from '@/features/search/sort-sheet';

/**
 * 필터 시트. WP-SRCH-005.
 *
 * 검색 결과 화면에서 열린다. 지역·가격구간·카테고리·정렬을 고른 뒤 "필터 적용"을
 * 누르면 검색 화면으로 돌아가면서 파라미터를 넘긴다.
 *
 * **온보딩 값을 선택 상태로 넣지 않는다**(SPEC §13.7). 들어올 때 들고 오는 값은
 * 지금 검색에 걸려 있는 조건뿐이다. 내 지역은 맨 위 «내 조건으로 좁히기» 한 줄로
 * 제안만 하고, 누를 때만 지역 칩이 켜진다 — 자동 적용은 없다.
 *
 * 가격구간은 슬라이더 대신 만원 단위 직접 입력으로 구현한다 — 웨딩 예산은 범위가
 * 넓어 고정 구간 칩이나 슬라이더보다 숫자 입력이 더 정확하다.
 */

/** «내 조건으로 좁히기» 제안 한 줄의 라벨. */
const NARROW_TO_MINE = '내 조건으로 좁히기';

function isVendorCategory(value: string | undefined): value is VendorCategory {
  return value !== undefined && value in VENDOR_CATEGORY_LABEL;
}

function isVendorSort(value: string | undefined): value is VendorSort {
  return value !== undefined && (VENDOR_SORTS as readonly string[]).includes(value);
}

export default function FilterScreen() {
  const theme = useTheme();

  /* 지금 검색에 걸려 있는 조건. 온보딩 값이 아니다. */
  const raw = useLocalSearchParams<{
    region?: string;
    sort?: string;
    category?: string;
    priceMin?: string;
    priceMax?: string;
  }>();

  const [regions, setRegions] = useState<string[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * 내 준비 지역(온보딩). 제안 줄에만 쓴다 — 선택 상태로 넣지 않는다. 로그인 전이거나
   * 지역을 아직 안 정했으면 null이고 그때는 제안 줄도 없다.
   */
  const [myRegion, setMyRegion] = useState<string | null>(
    () => readCurrentUserSnapshot()?.region ?? null
  );

  /* 현재 선택 상태 */
  const [region, setRegion] = useState<string | null>(raw.region?.trim() || null);
  const [sort, setSort] = useState<VendorSort>(isVendorSort(raw.sort) ? raw.sort : 'data');
  const [category, setCategory] = useState<VendorCategory | null>(
    isVendorCategory(raw.category) ? raw.category : null
  );
  const [priceMin, setPriceMin] = useState(raw.priceMin ?? '');
  const [priceMax, setPriceMax] = useState(raw.priceMax ?? '');

  useEffect(() => {
    listVendorRegions()
      .then((res) => setRegions(res.regions.map((r) => r.name)))
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setLoadingRegions(false));
  }, []);

  useEffect(() => {
    if (!isServerConfigured) return;
    let alive = true;

    /* 로그인 전에는 «나»가 없다 — 부르지 않고 제안 줄도 두지 않는다. */
    loadToken()
      .then((token) => (token ? getCurrentUser() : null))
      .then((me) => {
        if (alive) setMyRegion(me?.region ?? null);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  function reset() {
    setRegion(null);
    setSort('data');
    setCategory(null);
    setPriceMin('');
    setPriceMax('');
  }

  function apply() {
    const params: Record<string, string> = {};
    if (region) params.region = region;
    if (sort !== 'data') params.sort = sort;
    if (category) params.category = category;
    if (priceMin) params.priceMin = priceMin;
    if (priceMax) params.priceMax = priceMax;

    /*
      검색 화면으로 돌아가면서 필터 파라미터를 함께 보낸다. 검색 화면이
      useLocalSearchParams 로 읽어 결과로 연다 — 사용자가 여기서 고른 값이다.
    */
    router.navigate({ pathname: '/(tabs)/search', params });
  }

  /* 내 지역이 있고 아직 안 걸려 있을 때만 제안한다. 서버 지역 목록에 있는 이름이어야 칩이 켜진다. */
  const suggestRegion =
    myRegion !== null && region !== myRegion && regions.includes(myRegion) ? myRegion : null;

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
          {/* 내 조건으로 좁히기 — 제안 한 줄. 누를 때만 지역 칩이 켜진다. */}
          {suggestRegion ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${NARROW_TO_MINE} ${suggestRegion}`}
              onPress={() => setRegion(suggestRegion)}
              style={[styles.suggestRow, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="t6" style={styles.suggestLabel} numberOfLines={1}>
                {NARROW_TO_MINE} · {suggestRegion}
              </ThemedText>
              <ProductSymbol
                name="chevronRight"
                size={Layout.iconInline}
                color={theme.textAssistive}
              />
            </Pressable>
          ) : null}

          {/* 지역 */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">지역</ThemedText>
            {loadingRegions ? (
              <DelayedLoader size={28} />
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
              {PREPARATION_CATEGORIES.map((cat) => (
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

          {/* 정렬 */}
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">정렬</ThemedText>
            <ThemedView style={styles.chips}>
              {VENDOR_SORTS.map((s) => (
                <FilterChip
                  key={s}
                  label={SORT_LABEL[s]}
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
  /* 제안 한 줄. 행 최소 높이 56 · radius 6 · 라벨 좌 · chevron 우. */
  suggestRow: {
    minHeight: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.three,
    paddingVertical: Layout.rowPaddingY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  suggestLabel: {
    flex: 1,
    minWidth: 0,
  },
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
    paddingHorizontal: Layout.fieldPaddingX,
  },
  input: {
    height: Layout.rowMinHeight,
    borderRadius: Radius.input,
    paddingHorizontal: Layout.fieldPaddingX,
  },
  footer: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.three,
    paddingTop: Spacing.two,
  },
});
