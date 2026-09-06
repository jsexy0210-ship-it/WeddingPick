import {
  VENDOR_SORTS,
  VENDOR_SORT_LABEL,
  type Top3Response,
  type VendorSort,
  type SponsoredCard,
  type VendorSummary,
} from '@weddingpick/api-contract';
import {
  MAX_COMPARED_VENDORS,
  NOT_ENOUGH_DATA,
  rangeLabel,
  STILL_COLLECTING,
  type VendorCategory,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTop3, listVendorRegions, searchVendors } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import { VendorMap } from '@/features/search/vendor-map';
import {
  ActionButton,
  Colors,
  FilterChip,
  FontSize,
  Layout,
  LineHeight,
  MaxContentWidth,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  VendorImage,
  useTheme,
} from '@weddingpick/ui';

/** 검색은 자주 쓰는 분류부터 보여준다. 사업계획서 6번의 확장 순서와 같다. */
const CATEGORY_ORDER: VendorCategory[] = [...VENDOR_CATEGORIES];

/** 글자를 칠 때마다 서버를 부르지 않는다. */
const DEBOUNCE_MS = 350;

type Filters = {
  q: string;
  category: VendorCategory | null;
  region: string | null;
  sort: VendorSort;
};

/**
 * 화면 상태.
 *
 * - `home`: 검색어 없음 — 카테고리·최근·많이 확인된 곳.
 * - `results`: 검색어 제출됨 — 필터바·결과 카드.
 */
type ViewState = 'home' | 'results';

export default function SearchScreen() {
  const theme = useTheme();
  const [filters, setFilters] = useState<Filters>({
    q: '',
    category: null,
    region: null,
    sort: 'data',
  });
  const [viewState, setViewState] = useState<ViewState>('home');
  /** 입력 칸에 포커스가 있는가. 자동완성을 띄울 조건이다. */
  const [inputFocused, setInputFocused] = useState(false);

  const [vendors, setVendors] = useState<VendorSummary[] | null>(isServerConfigured ? null : []);
  /*
   * 광고 자리. **결과 배열과 따로 둔다**(v2.0 E-1).
   */
  const [sponsored, setSponsored] = useState<SponsoredCard[]>([]);
  const [regions, setRegions] = useState<{ name: string; count: number }[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  /** 견줄 업체. 고른 순서를 지킨다. */
  const [picked, setPicked] = useState<string[]>([]);
  const [pickedCategory, setPickedCategory] = useState<VendorCategory | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [top3, setTop3] = useState<Top3Response | null>(null);
  /** 목록 · 지도. */
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  /**
   * 최근 검색. 제출한 검색어를 기억한다.
   * 영구 보존은 다음 단계(AsyncStorage)에서 한다.
   */
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const requestId = useRef(0);

  const trimmedQ = filters.q.trim();

  const suggestions = useMemo(() => {
    if (!inputFocused || trimmedQ.length === 0) return [];
    const lower = trimmedQ.toLowerCase();
    return (vendors ?? []).filter((v) => v.name.toLowerCase().includes(lower)).slice(0, 5);
  }, [inputFocused, trimmedQ, vendors]);

  useEffect(() => {
    if (!isServerConfigured) return;

    getTop3({
      region: filters.region ?? undefined,
      category: filters.category ?? undefined,
    })
      .then(setTop3)
      .catch(() => setTop3(null));
  }, [filters.region, filters.category]);

  useEffect(() => {
    if (!isServerConfigured) return;

    listVendorRegions()
      .then((response) =>
        response.regions.map((region) => ({ name: region.name, count: region.vendorCount }))
      )
      .then(setRegions)
      .catch(() => undefined);
  }, []);

  const runSearch = useCallback(() => {
    const id = (requestId.current += 1);

    searchVendors({
      q: filters.q.trim() || undefined,
      region: filters.region ?? undefined,
      category: filters.category ?? undefined,
      sort: filters.sort,
    })
      .then((response) => {
        if (id !== requestId.current) return;
        setVendors(response.vendors);
        setSponsored(response.sponsored);
        setTotal(response.total);
        setNextCursor(response.nextCursor);
        setError(null);
      })
      .catch((caught: Error) => {
        if (id !== requestId.current) return;
        setVendors([]);
        setError(caught.message);
      });
  }, [filters]);

  useEffect(() => {
    if (!isServerConfigured) return;
    if (viewState !== 'results') return;

    const timer = setTimeout(runSearch, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters, viewState, runSearch]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    try {
      const response = await searchVendors({
        q: filters.q.trim() || undefined,
        region: filters.region ?? undefined,
        cursor: nextCursor,
        category: filters.category ?? undefined,
        sort: filters.sort,
      });
      setVendors((current) => [...(current ?? []), ...response.vendors]);
      setNextCursor(response.nextCursor);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [filters, nextCursor, loadingMore]);

  function toggle<K extends 'category' | 'region'>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: current[key] === value ? null : value }));
  }

  /**
   * 검색 제출. 홈 → 결과 전환.
   */
  function submitSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;

    // 최근 검색에 추가 (중복 제거, 최신 우선, 최대 10개)
    setRecentSearches((prev) => [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 10));
    setFilters((current) => ({ ...current, q: trimmed }));
    setViewState('results');
    setInputFocused(false);
  }

  function goHome() {
    setViewState('home');
    setFilters((current) => ({ ...current, q: '' }));
    setInputFocused(false);
  }

  /**
   * 비교함에 담기.
   * 업종이 섞이면 담지 않는다.
   */
  function togglePicked(vendor: VendorSummary) {
    if (picked.includes(vendor.id)) {
      const left = picked.filter((id) => id !== vendor.id);
      setPicked(left);
      if (left.length === 0) setPickedCategory(null);
      return;
    }

    if (pickedCategory !== null && pickedCategory !== vendor.category) {
      setToast(`${VENDOR_CATEGORY_LABEL[pickedCategory]}끼리만 비교할 수 있어요`);
      return;
    }

    if (picked.length >= MAX_COMPARED_VENDORS) {
      setToast(`한 번에 ${MAX_COMPARED_VENDORS}곳까지 담을 수 있어요`);
      return;
    }

    setPicked([...picked, vendor.id]);
    setPickedCategory(vendor.category);
  }

  // ─── 홈 화면 ──────────────────────────────────────────────────────────────

  function renderHome() {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.homeContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* 카테고리 그리드 — 2열 */}
        <View style={styles.homeSection}>
          <ThemedText type="t4">카테고리</ThemedText>
          <View style={styles.categoryGrid}>
            {CATEGORY_ORDER.map((category) => (
              <Pressable
                key={category}
                accessibilityRole="button"
                style={[styles.categoryCell, { backgroundColor: theme.backgroundElement }]}
                onPress={() => {
                  setFilters((current) => ({ ...current, category }));
                  setViewState('results');
                }}>
                <ThemedText type="t5">{VENDOR_CATEGORY_LABEL[category]}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 최근 검색 */}
        {recentSearches.length > 0 ? (
          <>
            <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
            <View style={styles.homeSection}>
              <View style={styles.sectionRow}>
                <ThemedText type="t4">최근 검색</ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setRecentSearches([])}>
                  <ThemedText type="t7" themeColor="textAssistive">전체 삭제</ThemedText>
                </Pressable>
              </View>
              <View style={styles.chipRow}>
                {recentSearches.map((term) => (
                  <Pressable
                    key={term}
                    accessibilityRole="button"
                    onPress={() => submitSearch(term)}
                    style={[styles.recentChip, { borderColor: theme.border }]}>
                    <ThemedText type="t6">{term}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : null}

        {/* 많이 확인된 곳 */}
        {top3 && top3.items.length > 0 ? (
          <>
            <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
            <View style={styles.homeSection}>
              <ThemedText type="t4">많이 확인된 곳</ThemedText>
              {top3.items.map((item, idx) => (
                <View key={item.vendorId}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} 자세히 보기`}
                    onPress={() =>
                      router.push({
                        pathname: '/search/[vendorId]',
                        params: { vendorId: item.vendorId, reasons: item.reasons.join(',') },
                      })
                    }>
                    <View style={styles.trendRow}>
                      <ThemedText type="t6" themeColor="textAssistive" style={styles.rankNo}>
                        {idx + 1}
                      </ThemedText>
                      <View style={styles.trendBody}>
                        <ThemedText type="t5" numberOfLines={1}>{item.name}</ThemedText>
                        <View style={styles.trendMeta}>
                          {item.paidPrice.stage !== 'collecting' ? (
                            <ThemedText type="t6" numeric numberOfLines={1}>
                              {rangeLabel(item.paidPrice.low, item.paidPrice.high)}
                            </ThemedText>
                          ) : null}
                          <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
                            {item.confirmedCount > 0
                              ? `확인된 정보 ${item.confirmedCount}건`
                              : STILL_COLLECTING}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                  {idx < top3.items.length - 1 ? (
                    <View style={[styles.divider, { backgroundColor: theme.line }]} />
                  ) : null}
                </View>
              ))}
              {top3.note ? (
                <ThemedText type="t7" themeColor="textAssistive">{top3.note}</ThemedText>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    );
  }

  // ─── 자동완성 ─────────────────────────────────────────────────────────────

  function renderSuggestions() {
    if (suggestions.length === 0) return null;

    return (
      <ThemedView
        type="backgroundElement"
        style={[styles.suggestions, { borderColor: theme.border }]}>
        {suggestions.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => {
              setInputFocused(false);
              router.push(`/search/${item.id}`);
            }}>
            <ThemedView type="backgroundElement" style={styles.suggestionRow}>
              <ThemedText type="t6">{item.name}</ThemedText>
              <ThemedText type="t7" themeColor="textAssistive">
                {VENDOR_CATEGORY_LABEL[item.category]} · {item.region}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </ThemedView>
    );
  }

  // ─── 결과 화면 ────────────────────────────────────────────────────────────

  /** 결과 카드 한 장. WP-SRCH-004 스펙. */
  function renderVendorCard(item: VendorSummary) {
    const chosen = picked.includes(item.id);
    const paidPrice = item.paidPrice;
    const isCollecting = paidPrice.stage === 'collecting';
    const isLimited = paidPrice.stage === 'limited';

    return (
      <View style={styles.resultCard}>
        {/* 대표 이미지 — 업체 제공 이미지가 없으면 카테고리 기본 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name} 자세히 보기`}
          onPress={() => router.push(`/search/${item.id}`)}>
          <View style={styles.cardImageWrap}>
            <VendorImage
              category={vendorImageCategory(item.category)}
              width={undefined}
              height={CARD_IMAGE_HEIGHT}
              radius={Radius.medium}
            />
          </View>
        </Pressable>

        {/* 업체명 ↔ 금액구간 */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/search/${item.id}`)}>
          <View style={styles.cardNameRow}>
            <ThemedText type="t4" numberOfLines={1} style={styles.cardName}>
              {item.name}
            </ThemedText>
            {paidPrice.stage !== 'collecting' ? (
              <ThemedText type="t6" numeric style={styles.cardPrice}>
                {rangeLabel(paidPrice.low, paidPrice.high)}
              </ThemedText>
            ) : (
              <ThemedText type="t7" themeColor="textAssistive">
                {STILL_COLLECTING}
              </ThemedText>
            )}
          </View>

          {/* 확인된 정보 · 지역 */}
          <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1} style={styles.cardMeta}>
            {isCollecting
              ? `${STILL_COLLECTING} · ${item.region}`
              : isLimited
                ? `${NOT_ENOUGH_DATA} · ${paidPrice.count}건 · ${item.region}`
                : `확인된 정보 ${paidPrice.count}건 · ${item.region}`}
          </ThemedText>
        </Pressable>

        {/* Pick 버튼 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={chosen ? `${item.name} 비교에서 빼기` : `${item.name} 비교에 담기`}
          style={[
            styles.pickBtn,
            chosen
              ? { backgroundColor: theme.tint }
              : { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
          ]}
          onPress={() => togglePicked(item)}>
          <ThemedText
            type="t6"
            style={chosen ? styles.pickBtnTextOn : undefined}
            themeColor={chosen ? undefined : 'text'}>
            {chosen ? 'Pick했어요' : 'Pick하기'}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  function renderResults() {
    return (
      <>
        {/* 필터바 — sticky, 가로 스크롤 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.filterBar, { backgroundColor: theme.background }]}
          contentContainerStyle={styles.filterBarContent}>
          {CATEGORY_ORDER.map((category) => (
            <FilterChip
              key={category}
              label={VENDOR_CATEGORY_LABEL[category]}
              selected={filters.category === category}
              onPress={() => toggle('category', category)}
            />
          ))}
          {regions.map((region) => (
            <FilterChip
              key={region.name}
              label={`${region.name} ${region.count}곳`}
              selected={filters.region === region.name}
              onPress={() => toggle('region', region.name)}
            />
          ))}
        </ScrollView>

        {/* 결과 수 + 정렬 */}
        <View style={[styles.sortRow, { backgroundColor: theme.background }]}>
          <ThemedText type="t7" themeColor="textAssistive">
            {filters.category ? `${VENDOR_CATEGORY_LABEL[filters.category]} ` : ''}
            {total}곳
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.sortChips}>
              {VENDOR_SORTS.filter((sort) => sort !== 'name').map((sort) => (
                <FilterChip
                  key={sort}
                  role="radio"
                  label={VENDOR_SORT_LABEL[sort]}
                  selected={filters.sort === sort}
                  onPress={() => setFilters((current) => ({ ...current, sort }))}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        {/* 결과 목록 */}
        {vendors === null ? (
          <ActivityIndicator color={theme.tint} style={styles.spinner} />
        ) : viewMode === 'map' ? (
          <VendorMap vendors={vendors} loading={false} onRefresh={runSearch} />
        ) : (
          <FlatList
            data={vendors}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.resultList}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <>
                {/* 광고 — 자연 결과와 별도 배열. 선 하나로 분리 표시. */}
                {sponsored.length > 0 ? (
                  <View style={styles.sponsoredBlock}>
                    {sponsored.map((ad) => (
                      <Pressable
                        key={ad.vendorId}
                        accessibilityRole="button"
                        accessibilityLabel={`${ad.label} ${ad.name} 자세히 보기`}
                        onPress={() => router.push(`/search/${ad.vendorId}`)}>
                        <View
                          style={[
                            styles.adCard,
                            {
                              backgroundColor: theme.backgroundElement,
                              borderColor: theme.border,
                            },
                          ]}>
                          <ThemedText type="badge" themeColor="textAssistive">
                            {ad.label}
                          </ThemedText>
                          <ThemedText type="t5">{ad.name}</ThemedText>
                          <ThemedText type="t7" themeColor="textSecondary">
                            {VENDOR_CATEGORY_LABEL[ad.category]} · {ad.region}
                          </ThemedText>
                        </View>
                      </Pressable>
                    ))}
                    <View style={[styles.adDivider, { backgroundColor: theme.line }]} />
                  </View>
                ) : null}
              </>
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <ThemedText type="t2">조건에 맞는 곳이{'\n'}없어요</ThemedText>
                {filters.category || filters.region ? (
                  <ThemedText type="t6" themeColor="textSecondary">
                    조건을 하나 풀어보세요
                  </ThemedText>
                ) : (
                  <ThemedText type="t6" themeColor="textSecondary">
                    {!isServerConfigured
                      ? '이 빌드는 서버에 붙어 있지 않아요.'
                      : error ?? '찾으시는 업체가 아직 등록되지 않았어요.'}
                  </ThemedText>
                )}
                {(filters.category || filters.region) ? (
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.filterResetBtn, { backgroundColor: theme.tint }]}
                    onPress={() =>
                      setFilters((current) => ({
                        ...current,
                        category: null,
                        region: null,
                      }))
                    }>
                    <ThemedText type="t5" style={styles.filterResetText}>
                      조건 초기화
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            }
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={theme.tint} style={styles.spinner} /> : null
            }
            renderItem={({ item }) => renderVendorCard(item)}
          />
        )}
      </>
    );
  }

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        {/* ── 헤더 ── */}
        <ThemedView style={styles.header}>
          {viewState === 'home' ? (
            <View style={styles.headerTop}>
              <ThemedText type="t4">검색</ThemedText>
            </View>
          ) : null}

          {/* 검색창 */}
          <View style={[styles.searchBox, { backgroundColor: theme.backgroundSelected }]}>
            {/* 검색 아이콘 */}
            <View style={styles.searchIcon}>
              <SearchIcon color={theme.textAssistive} />
            </View>
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={`업체나 지역을 검색해보세요`}
              placeholderTextColor={theme.textAssistive}
              value={filters.q}
              onChangeText={(text) => setFilters((current) => ({ ...current, q: text }))}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onSubmitEditing={() => submitSearch(filters.q)}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="업체 이름 검색"
            />
            {viewState === 'results' ? (
              <Pressable accessibilityRole="button" onPress={goHome} style={styles.cancelBtn}>
                <ThemedText type="t6" themeColor="textSecondary">취소</ThemedText>
              </Pressable>
            ) : null}
          </View>

          {/* 자동완성 — 입력 중에 뜬다 */}
          {renderSuggestions()}

          {/* 결과 모드 지도/목록 토글 */}
          {viewState === 'results' ? (
            <View style={styles.viewToggle}>
              <FilterChip
                role="radio"
                label="목록"
                selected={viewMode === 'list'}
                onPress={() => setViewMode('list')}
              />
              <FilterChip
                role="radio"
                label="지도"
                selected={viewMode === 'map'}
                onPress={() => setViewMode('map')}
              />
            </View>
          ) : null}
        </ThemedView>

        {/* ── 본문 ── */}
        {viewState === 'home' ? renderHome() : renderResults()}

        {/* ── 비교함 트레이 ── */}
        <ThemedView style={[styles.tray, { borderTopColor: theme.line }]}>
          <ThemedText type="t7" themeColor="textSecondary" style={styles.trayNote}>
            {picked.length === 0
              ? '같은 업종끼리만 비교할 수 있어요'
              : picked.length < 2
                ? '한 곳 더 담아주세요'
                : `${picked.length}곳 담음 · ${MAX_COMPARED_VENDORS}곳까지`}
          </ThemedText>
          <ActionButton
            variant="primary"
            label="비교함"
            disabled={picked.length < 2}
            onPress={() => router.push(`/search/compare?ids=${picked.join(',')}`)}
          />
        </ThemedView>

        <Toast message={toast} onHidden={() => setToast(null)} />
      </SafeAreaView>
    </ThemedView>
  );
}

/** 검색 아이콘 (돋보기). */
function SearchIcon({ color }: { color: string }) {
  return (
    <View accessibilityElementsHidden>
      {/* SVG를 React Native에서 인라인으로 쓸 수 없으므로 Text 대체 */}
      <ThemedText type="t6" style={{ color }}>
        🔍
      </ThemedText>
    </View>
  );
}

// ─── 레이아웃 상수 ──────────────────────────────────────────────────────────

// 핸드오프: 결과 카드 이미지 높이 168px, 2:1 비율 유지
const CARD_IMAGE_HEIGHT = 168;


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

  // ── 헤더 ──
  header: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // 검색창. 핸드오프: height 52, radius 6, background recessed
  searchBox: {
    height: Layout.controlXLarge,
    borderRadius: Radius.input,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.t6,
    lineHeight: LineHeight.t6,
    paddingVertical: 0,
  },
  cancelBtn: {
    paddingLeft: Spacing.two,
  },

  // 자동완성
  suggestions: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: -Spacing.one,
  },
  suggestionRow: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minHeight: Layout.rowMinHeight,
    justifyContent: 'center',
    gap: Spacing.one,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: Spacing.two,
  },

  // ── 홈 ──
  scroll: {
    flex: 1,
  },
  homeContent: {
    paddingBottom: Spacing.three,
  },
  homeSection: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.three,
    paddingBottom: Layout.sectionGap,
    gap: Spacing.three,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // 카테고리 2열 그리드. 핸드오프: gap 11, height 52, radius 10, bg recessed
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 11,
  },
  categoryCell: {
    width: '47.5%',
    height: Layout.controlXLarge,
    borderRadius: Radius.medium,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },

  // 최근 검색 칩. 핸드오프: height 36, border, radius 999, padding 0 14
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  recentChip: {
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 많이 확인된 곳 — 리스트 행
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Spacing.two,
  },
  rankNo: {
    width: 18,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  trendBody: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  trendMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  divider: {
    height: 1,
  },
  band: {
    height: Layout.sectionBand,
  },

  // ── 결과 ──
  // 필터바. 핸드오프: height 56, 가로 스크롤
  filterBar: {
    height: Layout.navBar,
    flexGrow: 0,
    flexShrink: 0,
  },
  filterBarContent: {
    alignItems: 'center',
    paddingHorizontal: Layout.gutter,
    gap: Spacing.two,
  },

  // 정렬 행. 핸드오프: height 40, count 좌 · 정렬 우
  sortRow: {
    height: Layout.controlMedium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
    flexShrink: 0,
  },
  sortChips: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  resultList: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.five,
  },

  // 결과 카드. 핸드오프: 이미지(full-width × 168) + 이름↔금액 + 건수 + Pick 버튼
  resultCard: {
    gap: Spacing.two,
  },
  cardImageWrap: {
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  cardName: {
    flex: 1,
    minWidth: 0,
  },
  cardPrice: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
  cardMeta: {
    marginTop: -Spacing.one,
  },
  // Pick 버튼. 핸드오프: height 48, radius 6
  pickBtn: {
    height: Layout.controlLarge,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  pickBtnTextOn: {
    color: Colors.light.onTint,
  },

  // 광고 카드
  adCard: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sponsoredBlock: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  adDivider: {
    height: 1,
  },

  // 결과 없음
  emptyWrap: {
    paddingTop: Layout.sectionGap + Spacing.three,
    gap: Spacing.two,
  },
  filterResetBtn: {
    height: Layout.controlXLarge,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  filterResetText: {
    color: Colors.light.onTint,
  },

  spinner: {
    paddingVertical: Spacing.five,
  },

  // ── 하단 트레이 ──
  tray: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    height: 70,
    borderTopWidth: 1,
    paddingHorizontal: Layout.gutter,
  },
  trayNote: {
    flex: 1,
  },
});
