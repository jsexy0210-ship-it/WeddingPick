import {
  VENDOR_SORTS,
  VENDOR_SORT_LABEL,
  type PlannerSummary,
  type Top3Response,
  type VendorSort,
  type SponsoredCard,
  type VendorSummary,
} from '@weddingpick/api-contract';
import {
  MAX_COMPARED_VENDORS,
  rangeLabel,
  STILL_COLLECTING,
  type VendorCategory,
  TERMS,
  TOP3_REASON_LABEL,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
} from '@weddingpick/domain';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getTop3,
  listPlannerRegions,
  listVendorRegions,
  searchPlanners,
  searchVendors,
} from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { VendorMap } from '@/features/search/vendor-map';
import {
  ActionButton,
  FilterChip,
  FontSize,
  MaxContentWidth,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  useTheme,
} from '@weddingpick/ui';

/** 검색은 자주 쓰는 분류부터 보여준다. 사업계획서 6번의 확장 순서와 같다. */
const CATEGORY_ORDER: VendorCategory[] = [...VENDOR_CATEGORIES];

/** 글자를 칠 때마다 서버를 부르지 않는다. */
const DEBOUNCE_MS = 350;

type Mode = 'vendor' | 'planner';

type Filters = {
  mode: Mode;
  q: string;
  category: VendorCategory | null;
  region: string | null;
  sort: VendorSort;
};

/** 플래너는 업체 부속정보가 아니라 독립 비교대상이다. 사업계획서 11번. */
const MODE_LABEL: Record<Mode, string> = { vendor: '업체', planner: '플래너' };

export default function SearchScreen() {
  const theme = useTheme();
  const [filters, setFilters] = useState<Filters>({
    mode: 'vendor',
    q: '',
    category: null,
    region: null,
    sort: 'data',
  });
  // 서버 주소가 없으면 부를 곳도 없다. 처음부터 빈 목록으로 시작한다.
  const [vendors, setVendors] = useState<VendorSummary[] | null>(isServerConfigured ? null : []);
  /*
   * 광고 자리. **결과 배열과 따로 둔다**(v2.0 E-1).
   *
   * 목록의 data는 vendors뿐이라 광고가 결과 사이에 끼어들 수가 없다 — 섞어 놓고
   * 배지만 붙이면 배지를 못 본 사람에게 그건 그냥 검색 결과다.
   */
  const [sponsored, setSponsored] = useState<SponsoredCard[]>([]);
  const [planners, setPlanners] = useState<PlannerSummary[] | null>(isServerConfigured ? null : []);
  /** 노출 중단 안내. 서버가 결과와 함께 준다. */
  const [withdrawalNotice, setWithdrawalNotice] = useState<string | null>(null);
  /** 지역 필터. 모드마다 다른 목록을 쓴다 — 플래너가 없는 지역을 업체 목록으로 띄우지 않는다. */
  const [regions, setRegions] = useState<{ name: string; count: number }[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 이 조건에 몇 곳이 있는지. 핸드오프 7번이 정렬 옆에 개수를 뒀다. */
  const [total, setTotal] = useState(0);
  /** 견줄 업체. 고른 순서를 지킨다 — 화면에 그 순서로 나온다. */
  const [picked, setPicked] = useState<string[]>([]);
  /** 담긴 업체들의 업종. 섞이는 것을 막는 데 쓴다. */
  const [pickedCategory, setPickedCategory] = useState<VendorCategory | null>(null);
  /** 눌렀는데 아무 일도 없으면 고장난 줄 안다. 막은 이유를 말한다. */
  const [toast, setToast] = useState<string | null>(null);
  /**
   * 이 지역·업종에서 볼 만한 곳. v3.10 §2의 TOP3다.
   *
   * 홈 C-1이 가격 TOP3 섹션을 홈에서 뺐고, 탐색 성격이라 여기로 왔다.
   */
  const [top3, setTop3] = useState<Top3Response | null>(null);
  /** 목록 · 지도. 지도는 업체 모드에서만 쓴다(WP-SRCH-007). */
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  /** 늦게 도착한 옛 요청이 새 결과를 덮어쓰지 않게 한다. */
  const requestId = useRef(0);
  const [inputFocused, setInputFocused] = useState(false);

  const trimmedQ = filters.q.trim();
  const suggestions = useMemo(() => {
    if (!inputFocused || trimmedQ.length === 0) return [];
    const lower = trimmedQ.toLowerCase();
    if (filters.mode === 'vendor') {
      return (vendors ?? []).filter((v) => v.name.toLowerCase().includes(lower)).slice(0, 5);
    }
    return (planners ?? []).filter((p) => p.name.toLowerCase().includes(lower)).slice(0, 5);
  }, [inputFocused, trimmedQ, filters.mode, vendors, planners]);

  /*
   * 검색어를 치는 중에는 추천을 접는다. 조건을 정한 사람의 결과 위에 우리가 고른
   * 목록이 남아 있으면 그건 결과를 가리는 것이다.
   */
  const recommended =
    filters.mode === 'vendor' && filters.q.trim() === '' ? (top3?.items ?? []) : [];

  useEffect(() => {
    if (!isServerConfigured) return;

    /*
     * 업체 모드에서만 부른다. 플래너는 확인된 결제 자료가 업체와 다른 방식으로
     * 쌓여 같은 사다리를 못 쓴다 — 없는 추천을 만들지 않는다. 모드를 되돌렸을 때
     * 쓰라고 받아둔 값은 지우지 않고, 그릴지 말지는 아래 `recommended`가 정한다.
     */
    if (filters.mode !== 'vendor') return;

    getTop3({
      region: filters.region ?? undefined,
      category: filters.category ?? undefined,
    })
      .then(setTop3)
      // 추천을 못 불러와도 검색은 된다.
      .catch(() => setTop3(null));
  }, [filters.mode, filters.region, filters.category]);

  useEffect(() => {
    if (!isServerConfigured) return;

    const load =
      filters.mode === 'vendor'
        ? listVendorRegions().then((response) =>
            response.regions.map((region) => ({ name: region.name, count: region.vendorCount }))
          )
        : listPlannerRegions().then((response) =>
            response.regions.map((region) => ({ name: region.name, count: region.plannerCount }))
          );

    load
      .then(setRegions)
      // 지역 목록을 못 불러와도 검색은 된다.
      .catch(() => undefined);
  }, [filters.mode]);

  /**
   * 지금 조건으로 다시 부른다. 디바운스 효과와 지도의 "다시 찾기" 단추가 같이
   * 쓴다 — 지도는 새 검색 로직을 만들지 않고 이 자리를 그대로 쓴다.
   */
  const runSearch = useCallback(() => {
    const id = (requestId.current += 1);
    const shared = {
      q: filters.q.trim() || undefined,
      region: filters.region ?? undefined,
    };

    const search =
      filters.mode === 'vendor'
        ? searchVendors({
            ...shared,
            category: filters.category ?? undefined,
            sort: filters.sort,
          }).then((response) => {
            setVendors(response.vendors);
            setSponsored(response.sponsored);
            setTotal(response.total);
            return response.nextCursor;
          })
        : searchPlanners(shared).then((response) => {
            setPlanners(response.planners);
            setWithdrawalNotice(response.withdrawalNotice);
            return response.nextCursor;
          });

    search
      .then((cursor) => {
        if (id !== requestId.current) return;

        setNextCursor(cursor);
        setError(null);
      })
      .catch((caught: Error) => {
        if (id !== requestId.current) return;

        setVendors([]);
        setPlanners([]);
        setError(caught.message);
      });
  }, [filters]);

  useEffect(() => {
    if (!isServerConfigured) {
      return;
    }

    const timer = setTimeout(runSearch, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [filters, runSearch]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    try {
      const shared = {
        q: filters.q.trim() || undefined,
        region: filters.region ?? undefined,
        cursor: nextCursor,
      };

      if (filters.mode === 'vendor') {
        const response = await searchVendors({
          ...shared,
          category: filters.category ?? undefined,
          sort: filters.sort,
        });

        setVendors((current) => [...(current ?? []), ...response.vendors]);
        setNextCursor(response.nextCursor);
      } else {
        const response = await searchPlanners(shared);

        setPlanners((current) => [...(current ?? []), ...response.planners]);
        setNextCursor(response.nextCursor);
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [filters, nextCursor, loadingMore]);

  function toggle<K extends 'category' | 'region'>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: current[key] === value ? null : value }));
  }

  function switchMode(mode: Mode) {
    if (mode === filters.mode) return;

    // 결과가 갈아끼워지는 동안 옛 목록을 보여주지 않는다.
    setVendors(isServerConfigured ? null : []);
    setPlanners(isServerConfigured ? null : []);
    setNextCursor(null);
    setError(null);
    setRegions([]);
    setFilters((current) => ({ ...current, mode, category: null, region: null }));
  }

  /**
   * 비교함에 담기.
   *
   * **업종이 섞이면 담지 않는다**(핸드오프 7번). 웨딩홀과 스튜디오를 나란히 놓은
   * 표는 아무것도 말해주지 않는다 — 비교할 항목 자체가 다르다.
   */
  function togglePicked(vendor: VendorSummary) {
    if (picked.includes(vendor.id)) {
      const left = picked.filter((id) => id !== vendor.id);

      setPicked(left);
      // 다 빼면 업종 잠금도 푼다. 안 그러면 다음에 다른 업종을 못 담는다.
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">{MODE_LABEL[filters.mode]} 찾기</ThemedText>

          <ThemedView style={styles.chips}>
            {(Object.keys(MODE_LABEL) as Mode[]).map((mode) => (
              <FilterChip
                key={mode}
                role="radio"
                label={MODE_LABEL[mode]}
                selected={filters.mode === mode}
                onPress={() => switchMode(mode)}
              />
            ))}
          </ThemedView>

          {/* 지도 보기. 핸드오프 WP-SRCH-007 — 결과 상단 토글. 업체 모드에서만 쓴다. */}
          {filters.mode === 'vendor' ? (
            <ThemedView style={styles.chips}>
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
            </ThemedView>
          ) : null}

          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder={`${MODE_LABEL[filters.mode]} 이름으로 찾아보세요`}
            placeholderTextColor={theme.textSecondary}
            value={filters.q}
            onChangeText={(text) => setFilters((current) => ({ ...current, q: text }))}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={`${MODE_LABEL[filters.mode]} 이름 검색`}
          />

          {suggestions.length > 0 ? (
            <ThemedView
              type="backgroundElement"
              style={[styles.suggestions, { borderColor: theme.border }]}>
              {suggestions.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setInputFocused(false);
                    router.push(
                      filters.mode === 'vendor'
                        ? `/search/${item.id}`
                        : `/search/planner/${item.id}`
                    );
                  }}>
                  <ThemedView type="backgroundElement" style={styles.suggestionRow}>
                    <ThemedText type="t6">{item.name}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          ) : null}

          {filters.mode === 'vendor' ? (
            <ThemedView style={styles.chips}>
              {CATEGORY_ORDER.map((category) => (
                <FilterChip
                  key={category}
                  label={VENDOR_CATEGORY_LABEL[category]}
                  selected={filters.category === category}
                  onPress={() => toggle('category', category)}
                />
              ))}
            </ThemedView>
          ) : null}

          {regions.length > 0 ? (
            <ThemedView style={styles.chips}>
              {regions.map((region) => (
                <FilterChip
                  key={region.name}
                  label={`${region.name} ${region.count}${filters.mode === 'vendor' ? '곳' : '명'}`}
                  selected={filters.region === region.name}
                  onPress={() => toggle('region', region.name)}
                />
              ))}
            </ThemedView>
          ) : null}

          {/*
            정렬과 개수. 핸드오프 7번이 이 둘을 한 줄에 뒀다.

            **`인기 순`은 없다.** 인기를 재는 것이 우리에게 없고, 없는 것에 이름만
            붙이면 그건 정렬이 아니라 꾸밈이다. 대신 `확인된 정보 많은 순`을 기본으로
            둔다 — 결제인증이 많이 모인 업체가 먼저 나오는 것은 잴 수 있는 사실이다.
          */}
          {filters.mode === 'vendor' ? (
            <ThemedView style={styles.sortRow}>
              {/*
                개수를 정렬 칩과 한 줄에 두면 390px에서 잘린다. 그려보고 알았다 —
                핸드오프는 드롭다운을 그렸고, 칩 셋은 그 자리에 들어가지 않는다.
              */}
              <ThemedText type="t7" themeColor="textSecondary">
                {filters.category ? `${VENDOR_CATEGORY_LABEL[filters.category]} ` : ''}
                {total}곳
              </ThemedText>

              <ThemedView style={styles.chips}>
                {VENDOR_SORTS.filter((sort) => sort !== 'name').map((sort) => (
                  <FilterChip
                    key={sort}
                    role="radio"
                    label={VENDOR_SORT_LABEL[sort]}
                    selected={filters.sort === sort}
                    onPress={() => setFilters((current) => ({ ...current, sort }))}
                  />
                ))}
              </ThemedView>
            </ThemedView>
          ) : null}
        </ThemedView>

        {filters.mode === 'vendor' ? (
          vendors === null ? (
            <ActivityIndicator color={theme.tint} style={styles.spinner} />
          ) : viewMode === 'map' ? (
            <VendorMap vendors={vendors} loading={false} onRefresh={runSearch} />
          ) : (
            <FlatList
              data={vendors}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              ListEmptyComponent={
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {!isServerConfigured
                      ? '이 빌드는 서버에 붙어 있지 않아 업체를 찾을 수 없어요. 촬영과 기기 저장은 그대로 쓰실 수 있어요.'
                      : error
                        ? error
                        : '찾으시는 업체가 아직 등록되지 않았어요. 자료를 올리시면 그 업체가 등록될 때 자동으로 이어져요.'}
                  </ThemedText>
                </ThemedView>
              }
              ListHeaderComponent={
                <>
                  {/*
                    추천. 홈 C-1이 가격 TOP3 섹션을 홈에서 뺐고, TOP3 성격의 탐색은
                    여기에 둔다 — 찾으러 온 사람에게 "이 지역에서 볼 만한 곳"을
                    먼저 보이는 것은 검색의 일이다.

                    검색어나 필터를 건드리면 접는다. 사용자가 조건을 정한 뒤에도
                    우리가 고른 목록이 위에 남아 있으면, 그건 검색 결과를 가린다.

                    **광고와 다른 자리다.** 스폰서는 산 자리이고 이 목록은 확인된
                    정보가 고른 자리라, 붙여두면 둘이 같은 것으로 읽힌다. 그래서
                    추천을 먼저 두고 그 아래에 스폰서를 둔다.
                   */}
                  {recommended.length > 0 ? (
                    <ThemedView style={styles.section}>
                      <ThemedText type="t4">
                        {top3 === null ? '추천' : `${VENDOR_CATEGORY_LABEL[top3.category]} 추천`}
                      </ThemedText>
                      {recommended.map((item) => (
                        <Pressable
                          key={item.vendorId}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.name} 자세히 보기`}
                          onPress={() => router.push(`/search/${item.vendorId}`)}>
                          <ThemedView type="backgroundElement" style={styles.card}>
                            {/* 이유가 먼저다. 이름부터 보이면 왜 이 곳인지 묻게 된다. */}
                            <ThemedText type="t7" themeColor="tint">
                              {TERMS.recommendReason}
                            </ThemedText>
                            <ThemedText type="t7" themeColor="textSecondary">
                              {item.reasons.map((reason) => TOP3_REASON_LABEL[reason]).join(' · ')}
                            </ThemedText>
                            <ThemedText type="t5">{item.name}</ThemedText>
                            <ThemedText type="t7" themeColor="textAssistive">
                              {VENDOR_CATEGORY_LABEL[item.category]} · {item.region}
                            </ThemedText>
                            <ThemedText type="t7" themeColor="textSecondary">
                              {item.paidPrice.stage === 'collecting'
                                ? item.paidPrice.caption
                                : `${rangeLabel(item.paidPrice.low, item.paidPrice.high)} · ${item.paidPrice.caption}`}
                            </ThemedText>
                            {item.confirmedCount > 0 ? (
                              <ThemedText type="t7" themeColor="textAssistive">
                                확인된 계약 {item.confirmedCount}건
                              </ThemedText>
                            ) : null}
                          </ThemedView>
                        </Pressable>
                      ))}
                      {top3?.note ? (
                        <ThemedText type="t7" themeColor="textAssistive">
                          {top3.note}
                        </ThemedText>
                      ) : null}
                    </ThemedView>
                  ) : null}

                  {sponsored.length === 0 ? null : (
                  <ThemedView style={styles.sponsored}>
                    {sponsored.map((ad) => (
                      <Pressable
                        key={ad.vendorId}
                        accessibilityRole="button"
                        accessibilityLabel={`${ad.label} ${ad.name} 자세히 보기`}
                        onPress={() => router.push(`/search/${ad.vendorId}`)}>
                        <ThemedView
                          type="backgroundElement"
                          style={[styles.card, styles.adCard, { borderColor: theme.border }]}>
                          {/* 유료 노출임을 먼저 밝힌다. 애매한 말을 쓰지 않는다. */}
                          <ThemedText type="badge" themeColor="textAssistive">
                            {ad.label}
                          </ThemedText>
                          <ThemedText type="smallBold">{ad.name}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {VENDOR_CATEGORY_LABEL[ad.category]} · {ad.region}
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    ))}
                    {/*
                      여기서 아래가 자연 결과라는 것을 눈으로 갈라 보여준다.
                      선 하나가 배지보다 잘 읽힌다.
                     */}
                    <ThemedView style={[styles.adDivider, { backgroundColor: theme.line }]} />
                  </ThemedView>
                  )}
                </>
              }
              ListFooterComponent={
                loadingMore ? <ActivityIndicator color={theme.tint} style={styles.spinner} /> : null
              }
              renderItem={({ item }) => {
                const chosen = picked.includes(item.id);

                return (
                  <ThemedView type="backgroundElement" style={styles.card}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item.name} 자세히 보기`}
                      onPress={() => router.push(`/search/${item.id}`)}>
                      <ThemedView type="backgroundElement" style={styles.cardBody}>
                        <ThemedText type="smallBold">{item.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {VENDOR_CATEGORY_LABEL[item.category]} · {item.region}
                        </ThemedText>
                        {/*
                         * 실제 결제 구간. 상세와 같은 사다리를 쓴다 — 목록만
                         * 기준을 낮추면 목록에서 본 숫자가 상세에서 사라진다.
                         *
                         * 수집 중인 업체도 숨기지 않는다. "아직 자료가 없다"도
                         * 사용자가 알아야 할 사실이고, 숨기면 자료가 없는 업체와
                         * 싼 업체가 같은 얼굴이 된다.
                         */}
                        {item.paidPrice.stage === 'collecting' ? (
                          <ThemedText type="t6" themeColor="textAssistive">
                            {STILL_COLLECTING}
                          </ThemedText>
                        ) : (
                          <ThemedText type="t5" numeric>
                            {rangeLabel(item.paidPrice.low, item.paidPrice.high)}
                          </ThemedText>
                        )}
                        <ThemedText type="t7" themeColor="textSecondary">
                          {item.paidPrice.caption}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>

                    <ThemedView type="backgroundElement" style={styles.pickRow}>
                      <FilterChip
                        label={chosen ? '비교에서 빼기' : '비교에 담기'}
                        selected={chosen}
                        onPress={() => togglePicked(item)}
                      />
                    </ThemedView>
                  </ThemedView>
                );
              }}
            />
          )
        ) : planners === null ? (
          <ActivityIndicator color={theme.tint} style={styles.spinner} />
        ) : (
          <FlatList
            data={planners}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={
              /*
               * 검색 결과에 개인 이름이 있는데 왜 있는지, 원하지 않으면 어떻게 하는지
               * 적어두지 않으면 본인도 다른 사람도 그것을 따져볼 방법이 없다.
               */
              withdrawalNotice ? (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {withdrawalNotice}
                  </ThemedText>
                </ThemedView>
              ) : null
            }
            ListEmptyComponent={
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  {!isServerConfigured
                    ? '이 빌드는 서버에 붙어 있지 않아 플래너를 찾을 수 없어요.'
                    : error
                      ? error
                      : '찾으시는 플래너가 아직 없어요. 공개된 자료에 실려 있거나 본인이 밝힌 플래너만 검색에 나와요.'}
                </ThemedText>
              </ThemedView>
            }
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={theme.tint} style={styles.spinner} /> : null
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name} 자세히 보기`}
                onPress={() => router.push(`/search/planner/${item.id}`)}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[item.vendor?.name ?? '프리랜서', item.regions.join(' · ')]
                      .filter(Boolean)
                      .join(' · ')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.comparableQuoteCount === 0
                      ? '확인된 계약 자료가 아직 없어요'
                      : `확인된 계약 ${item.comparableQuoteCount}건`}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.listingBasis}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            )}
          />
        )}

        {/*
          하단 트레이. 핸드오프 7번 — 문구는 왼쪽, 단추는 오른쪽에 고정.

          두 곳 미만이면 왜 못 누르는지 왼쪽이 말한다. 비활성 단추만 두고 이유를
          말하지 않으면 사용자는 자기가 뭘 잘못했는지 모른다.
        */}
        {filters.mode === 'vendor' ? (
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
        ) : (
          <ThemedView style={styles.footer}>
            <ActionButton
              label="자료 촬영하기"
              hint={`찾는 ${MODE_LABEL[filters.mode]}가 없어도 자료를 올리면 정리해드려요`}
              onPress={() => router.push('/capture')}
            />
          </ThemedView>
        )}

        <Toast message={toast} onHidden={() => setToast(null)} />
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
    paddingHorizontal: Spacing.four,
  },
  header: {
    paddingTop: Spacing.five,
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    /* 입력 칸 글자도 본문이다. 토큰 밖의 크기를 쓰지 않는다. */
    fontSize: FontSize.t6,
  },
  sortRow: {
    gap: Spacing.two,
  },
  /** 핸드오프 7번: 높이 70, 문구 좌측 · 단추 우측. */
  tray: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    height: 70,
    borderTopWidth: 1,
  },
  trayNote: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  list: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardBody: {
    gap: Spacing.one,
  },
  /** 추천 묶음. 스폰서와 붙지 않게 아래에 여백을 둔다 — 둘은 다른 자리다. */
  section: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  sponsored: {
    gap: Spacing.two,
  },
  /** 자연 결과 카드와 다른 얼굴이어야 한다. 테두리로 가른다. */
  adCard: {
    borderWidth: 1,
  },
  adDivider: {
    height: 1,
    marginTop: Spacing.one,
  },
  pickRow: {
    flexDirection: 'row',
  },
  suggestions: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  spinner: {
    paddingVertical: Spacing.five,
  },
  footer: {
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
});
