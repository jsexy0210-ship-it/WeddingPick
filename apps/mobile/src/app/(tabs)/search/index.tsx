import {
  VENDOR_SORTS,
  type VendorSort,
  type SponsoredCard,
  type VendorCandidate,
  type VendorSummary,
} from '@weddingpick/api-contract';
import {
  type BudgetBandKey,
  DISCLOSURE_THRESHOLDS,
  NOT_ENOUGH_DATA,
  PREPARATION_CATEGORIES,
  priceLine,
  TERMS,
  type VendorCategory,
  VENDOR_CATEGORY_LABEL,
  regionLabel,
  withParticle,
} from '@weddingpick/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, listVendorRegions, searchVendors } from '@/api/client';
import { isServerConfigured } from '@/api/config';
import { LoginSheet } from '@/features/auth/login-sheet';
import { InfoDot, InfoSheet, type InfoTopic } from '@/features/common/info-sheet';
import { savePendingAction } from '@/features/auth/pending-action';
import { PickDoneSheet, UnpickSheet } from '@/features/pick/pick-sheets';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import {
  addRecentSearch,
  loadRecentSearches,
} from '@/features/search/recent-searches';
import { FilterSheet, type SearchFilterValue } from '@/features/search/filter-sheet';
import { SORT_LABEL, SortSheet } from '@/features/search/sort-sheet';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import {
  ActionButton,
  Colors,
  FilterChip,
  FontSize,
  Layout,
  LineHeight,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  Toast,
  VendorImage,
  useTheme,
  ListSkeleton,
} from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';

/**
 * 검색은 자주 쓰는 분류부터 보여준다. 사업계획서 6번의 확장 순서와 같다.
 * «기타»는 격자에 두지 않는다 — 고를 이유를 설명할 수 없는 칸이다.
 */

/**
 * 업종 칩의 순서. 준비 현황과 같은 차례로 둔다 — 두 화면이 업종을 다른 순서로
 * 늘어놓으면 같은 목록으로 읽히지 않는다.
 */
const CATEGORY_ORDER: readonly VendorCategory[] = PREPARATION_CATEGORIES;

/** 자동완성은 결과보다 빨리 따라와야 한다(시안 WP-SRCH-002). */
const AUTOCOMPLETE_DEBOUNCE_MS = 200;
/** 자동완성 «업체» 행 수 · «지역» 행 수. 시안은 3줄이다. */
const AUTOCOMPLETE_VENDORS = 3;
const AUTOCOMPLETE_REGIONS = 3;

/** 자동완성 그룹 제목. spec/strings.ko.json search.group.* · SPEC §13.7(«업체 · 바로 상세로»). */
const AC_GROUP_VENDOR = '업체 · 바로 상세로';
const AC_GROUP_REGION = '지역';
const AC_GROUP_KEYWORD = '이 말로 검색';

/** 결과 없음 카드. spec/strings.ko.json search.empty.* */
const EMPTY_TITLE = '조건에 맞는 곳이\n없어요';
/** 조건 하나를 풀면 나오는 곳 — 시안은 세 줄이다(06-search #16f). */
const EMPTY_SIMILAR_TITLE = '비슷한 곳';
const SIMILAR_LIMIT = 3;
const EMPTY_REPORT_TITLE = '찾는 곳이 없나요?';
const EMPTY_REPORT_BODY = '업체를 알려주시면 등록하고 알려드릴게요.';
const EMPTY_REPORT_CTA = '업체 제보';

function isVendorCategory(value: string | undefined): value is VendorCategory {
  return value !== undefined && value in VENDOR_CATEGORY_LABEL;
}

function isVendorSort(value: string | undefined): value is VendorSort {
  return value !== undefined && (VENDOR_SORTS as readonly string[]).includes(value);
}

type Filters = {
  q: string;
  category: VendorCategory | null;
  region: string | null;
  /** 예산 구간 한 칸(WP-SRCH-005). 고르지 않았으면 null. */
  budget: BudgetBandKey | null;
  /** «실 제보가 있는 곳만» — 금액을 볼 수 있는 곳만 남긴다(WP-SRCH-005). */
  onlyVerified: boolean;
  sort: VendorSort;
};

/**
 * 화면 상태.
 *
 * - `home`: 검색어 없음 — 카테고리·최근·많이 확인된 곳.
 * - `results`: 검색어 제출됨 — 필터바·결과 카드.
 */
type ViewState = 'home' | 'results';

/**
 * 밖에서 조건을 걸어 들어오는 길. 홈 조건 칩 · Pick 탭 «검색으로 가기»(`category` ·
 * `region`) · 필터 시트 «필터 적용»(`sort`까지)이 넘긴다.
 *
 * **검색은 스스로 조건을 걸지 않는다**(SPEC §13.7). 여기 값은 사용자가 그 화면에서
 * 눌러서 넘긴 것뿐이고, 온보딩 값은 어디서도 자동으로 읽어 오지 않는다.
 */
type EntryParams = { q?: string; category?: string; region?: string; sort?: string };

/**
 * 결과 카드 한 장의 금액 아래 줄. 시안: «실 제보 12건 · 강남» / «아직 정보가 적어요 · 3건 · 청담» /
 * 0층은 출처. 검색 홈 «많이 본 곳»도 같은 줄을 쓴다(꼬리만 지역 대신 업종).
 */
function metaLine(item: VendorSummary, tail: string): string {
  const paidPrice = item.paidPrice;
  const line = priceLine(paidPrice, item.guidePrice);
  if (line.dim) return `${line.caption} · ${tail}`;
  if (paidPrice.stage === 'limited') return `${NOT_ENOUGH_DATA} · ${paidPrice.count}건 · ${tail}`;
  return `${TERMS.verifiedData} ${paidPrice.count}건 · ${tail}`;
}

/** 자동완성 «업체» 행의 오른쪽 꼬리. 시안: «실 제보 12건» · 적으면 «3건». */
function countTail(item: VendorSummary): string {
  const count = item.paidPrice.count;
  return count >= DISCLOSURE_THRESHOLDS.limited ? `${TERMS.verifiedData} ${count}건` : `${count}건`;
}

export default function SearchScreen() {
  const theme = useTheme();
  const entry = useLocalSearchParams<EntryParams>();
  const [filters, setFilters] = useState<Filters>({
    q: '',
    category: null,
    region: null,
    budget: null,
    onlyVerified: false,
    sort: 'data',
  });
  /*
   * 탭을 열면 곧바로 결과다. 'home'으로 시작하던 것을 2026-09-11 대표 지시로 바꿨다 —
   * 루트 시안이 «검색 홈 없음, 즉시 결과»다. 상태 자체는 남긴다: 자동완성이
   * 검색창 자리에 겹쳐 그려질 때 결과와 구분할 자리가 아직 필요하다.
   */
  const [viewState, setViewState] = useState<ViewState>('results');
  /**
   * 자동완성이 열려 있는가. 입력 칸에 글자를 치면 열리고, 행을 고르거나 제출·취소하면 닫힌다.
   * blur로는 닫지 않는다 — 웹에서 행을 누르는 순간 blur가 먼저 와서 행이 사라진다.
   */
  const [acOpen, setAcOpen] = useState(false);

  const [vendors, setVendors] = useState<VendorSummary[] | null>(isServerConfigured ? null : []);
  /*
   * 광고 자리. **결과 배열과 따로 둔다**(v2.0 E-1).
   */
  const [sponsored, setSponsored] = useState<SponsoredCard[]>([]);
  const [regions, setRegions] = useState<{ name: string; count: number }[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  /**
   * 결과 0건일 때 조건 하나를 풀면 몇 곳이 나오는지(WP-SRCH-008). 어느 조건에서 잰 값인지 키를
   * 함께 들고 있어 조건이 바뀌면 옛 값을 읽지 않는다.
   */
  const [relaxed, setRelaxed] = useState<{
    key: string;
    total: number;
    /** 그 조건을 풀면 나오는 곳 — 시안의 «비슷한 곳» 세 줄이 이 목록이다. */
    similar: VendorSummary[];
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** 정렬 시트(WP-SRCH-006)가 떠 있는가. */
  const [sortOpen, setSortOpen] = useState(false);
  /**
   * 필터 시트(WP-SRCH-005)가 떠 있는가.
   *
   * **화면을 옮기지 않는다.** 시안이 바텀시트라서이기도 하지만, 조건을 바꿀 때마다 결과
   * 수가 따라 바뀌려면 결과를 들고 있는 이 화면 위에 떠 있어야 한다.
   */
  const [filterOpen, setFilterOpen] = useState(false);
  /** 금액 옆 ⓘ가 연 설명 시트(WP-SHT-014). null이면 닫혀 있다. */
  const [infoTopic, setInfoTopic] = useState<InfoTopic | null>(null);
  /** 최근 검색. 자동완성 화면과 같은 저장소(`features/search/recent-searches`)를 본다. */
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  /* 자동완성 — 업체 · 결과 수. 지역은 이미 읽어둔 목록에서 고른다. */
  const [acVendors, setAcVendors] = useState<VendorSummary[]>([]);
  const [acTotal, setAcTotal] = useState<number | null>(null);

  /*
   * Pick — 카드의 버튼이 진짜 후보에 담는다(SPEC §13.1). 완료 시트(WP-SHT-002) · 해제
   * 시트(WP-SHT-003) · 로그인 시트(첫 Pick이 대표 트리거)를 여기서 띄운다.
   */
  const candidates = useMyCandidates();
  const [pickDoneOpen, setPickDoneOpen] = useState(false);
  const [unpickTarget, setUnpickTarget] = useState<VendorCandidate | null>(null);
  const [loginFor, setLoginFor] = useState<VendorSummary | null>(null);

  useEffect(() => {
    loadRecentSearches().then(setRecentSearches);
  }, []);

  const requestId = useRef(0);
  const displayedQuery = useRef<string | null>(null);
  const acRequestId = useRef(0);

  /** 필터 시트에 넘길 지역 이름만. 시트는 수를 적지 않는다(시안 06-search #16d). */
  const regionNames = regions.map((region) => region.name);

  const trimmedQ = filters.q.trim();
  const showAutocomplete = acOpen && trimmedQ.length > 0;

  /*
   * 밖에서 걸어 들어온 조건(홈 조건 칩 · Pick 탭 · 필터 시트)을 그대로 적용해 결과로
   * 연다. 사용자가 그 화면에서 누른 값이지 자동 적용이 아니다. 아무 값도 없으면 홈
   * 그대로다 — 필터 칩은 모두 꺼진 채 열린다.
   *
   * 파라미터가 바뀐 그 렌더에서 상태를 맞춘다(React «prop이 바뀔 때 state 조정»
   * 패턴) — 이펙트에서 setState를 부르면 한 번 더 그리게 된다.
   */
  const entryQuery = entry.q?.trim() || null;
  const entryCategory = isVendorCategory(entry.category) ? entry.category : null;
  const entryRegion = entry.region?.trim() ? entry.region.trim() : null;
  const entrySort = isVendorSort(entry.sort) ? entry.sort : null;
  const entryKey = `${entryQuery ?? ''}|${entryCategory ?? ''}|${entryRegion ?? ''}|${entrySort ?? ''}`;
  const [appliedEntryKey, setAppliedEntryKey] = useState<string | null>(null);

  if (entryKey !== appliedEntryKey) {
    setAppliedEntryKey(entryKey);
    if (entryQuery || entryCategory || entryRegion || entrySort) {
      setFilters((current) => ({
        ...current,
        q: entryQuery ?? '',
        category: entryCategory,
        region: entryRegion,
        sort: entrySort ?? current.sort,
      }));
      setViewState('results');
      setAcOpen(false);
    }
  }

  useEffect(() => {
    if (!isServerConfigured) return;

    listVendorRegions()
      .then((response) =>
        response.regions.map((region) => ({ name: region.name, count: region.vendorCount }))
      )
      .then(setRegions)
      .catch(() => undefined);
  }, []);

  const runSearch = useCallback((force = false) => {
    const id = (requestId.current += 1);
    const query = JSON.stringify(filters);
    let revalidated = false;
    const apply = (response: Awaited<ReturnType<typeof searchVendors>>) => {
      if (id !== requestId.current) return;
      displayedQuery.current = query;
      setVendors(response.vendors);
      setSponsored(response.sponsored);
      setTotal(response.total);
      setNextCursor(response.nextCursor);
      setError(null);
      setLoadingMore(false);
    };
    searchVendors({
      q: filters.q.trim() || undefined,
      region: filters.region ?? undefined,
      category: filters.category ?? undefined,
      budget: filters.budget ?? undefined,
      onlyVerified: filters.onlyVerified || undefined,
      sort: filters.sort,
    }, {
      force,
      onValue: (response) => { revalidated = true; apply(response); },
      onRefreshing: (value) => {
        if (id !== requestId.current) return;
        setRefreshing(value);
        if (value && displayedQuery.current !== query) {
          setVendors(null);
          setSponsored([]);
          setTotal(0);
          setNextCursor(null);
        }
      },
      onError: (caught) => {
        revalidated = true;
        if (id !== requestId.current) return;
        setError(caught.message);
        if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) {
          setVendors([]);
          setSponsored([]);
          setNextCursor(null);
          setTotal(0);
        }
      },
    })
      .then((response) => { if (!revalidated) apply(response); })
      .catch((caught: Error) => {
        if (id !== requestId.current) return;
        setVendors([]);
        setSponsored([]);
        setNextCursor(null);
        setTotal(0);
        setError(caught.message);
      });
  }, [filters]);

  useEffect(() => {
    if (!isServerConfigured) return;
    if (viewState !== 'results' || showAutocomplete) return;

    // 입력 중에는 자동완성만 기다린다. 검색 확정·필터 변경은 즉시 요청한다.
    runSearch();
    return () => { requestId.current += 1; };
  }, [viewState, showAutocomplete, runSearch]);

  /*
   * 자동완성. 검색어가 있을 때만 서버를 부른다 — 업체명 행은 결과를 건너뛰고 상세로 가고,
   * «이 말로 검색» 행은 결과 수를 미리 보여준다(시안 WP-SRCH-002).
   */
  useEffect(() => {
    if (!isServerConfigured || !showAutocomplete) return;
    const id = (acRequestId.current += 1);
    const timer = setTimeout(() => {
      searchVendors({ q: trimmedQ })
        .then((response) => {
          if (id !== acRequestId.current) return;
          setAcVendors(response.vendors.slice(0, AUTOCOMPLETE_VENDORS));
          setAcTotal(response.total);
        })
        .catch(() => undefined);
    }, AUTOCOMPLETE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      acRequestId.current += 1;
    };
  }, [showAutocomplete, trimmedQ]);

  /*
   * 결과가 0건이고 조건이 걸려 있으면, 그 조건 하나를 풀면 몇 곳인지 재본다(WP-SRCH-008).
   * 같은 질의가 «비슷한 곳» 세 줄도 함께 들고 온다 — 조건 하나를 푼 목록이 곧 비슷한 곳이다.
   *
   * 푸는 순서는 **예산이 먼저다**(시안 «예산 조건을 풀면 6곳이 나와요»). 예산은 사용자가
   * 방금 고른 숫자라 되돌리기 쉽고, 지역·업종을 먼저 풀면 찾던 것과 다른 곳이 나온다.
   */
  const relaxKey: 'budget' | 'region' | 'category' | null = filters.budget
    ? 'budget'
    : filters.region
      ? 'region'
      : filters.category
        ? 'category'
        : null;

  const relaxedKey = `${filters.q.trim()}|${filters.region ?? ''}|${filters.category ?? ''}|${filters.budget ?? ''}|${filters.onlyVerified ? '1' : ''}|${filters.sort}`;
  const relaxedTotal = relaxed?.key === relaxedKey ? relaxed.total : null;
  const similar = relaxed?.key === relaxedKey ? relaxed.similar : [];

  useEffect(() => {
    if (!isServerConfigured || viewState !== 'results') return;
    if (vendors === null || vendors.length > 0 || relaxKey === null) return;
    let alive = true;
    searchVendors({
      q: filters.q.trim() || undefined,
      region: relaxKey === 'region' ? undefined : (filters.region ?? undefined),
      category: relaxKey === 'category' ? undefined : (filters.category ?? undefined),
      budget: relaxKey === 'budget' ? undefined : (filters.budget ?? undefined),
      onlyVerified: filters.onlyVerified || undefined,
      sort: filters.sort,
    })
      .then((response) => {
        if (alive) {
          setRelaxed({
            key: relaxedKey,
            total: response.total,
            similar: response.vendors.slice(0, SIMILAR_LIMIT),
          });
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [filters, relaxKey, relaxedKey, vendors, viewState]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || refreshing) return;
    const id = requestId.current;
    setLoadingMore(true);

    try {
      const response = await searchVendors({
        q: filters.q.trim() || undefined,
        region: filters.region ?? undefined,
        cursor: nextCursor,
        category: filters.category ?? undefined,
        budget: filters.budget ?? undefined,
        onlyVerified: filters.onlyVerified || undefined,
        sort: filters.sort,
      });
      if (id !== requestId.current) return;
      setVendors((current) => [...(current ?? []), ...response.vendors]);
      setNextCursor(response.nextCursor);
    } catch (caught) {
      if (id === requestId.current) setError((caught as Error).message);
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
  }, [filters, nextCursor, loadingMore, refreshing]);

  function toggle<K extends 'category' | 'region'>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: current[key] === value ? null : value }));
  }

  /**
   * 검색 제출. 홈 → 결과 전환.
   */
  function submitSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;

    addRecentSearch(trimmed, recentSearches).then(setRecentSearches);
    setFilters((current) => ({ ...current, q: trimmed }));
    setViewState('results');
    setAcOpen(false);
  }

  /**
   * 걸린 조건을 비운다. 검색 홈이 없어진 뒤로 «돌아갈 곳»이 아니라 «비우는 자리»다
   * (2026-09-11 대표 지시). 화면은 결과에 머문 채 조건 없는 목록으로 돌아간다.
   */
  function goHome() {
    setFilters((current) => ({ ...current, q: '', category: null, region: null }));
    setAcOpen(false);
    /* 들어올 때 걸린 조건을 비운다 — 같은 조건으로 다시 들어와도 결과로 열리게. */
    router.setParams({ category: '', region: '', sort: '' });
  }

  /** 자동완성 «업체» 행 — 결과를 건너뛰고 상세로(SPEC §13.7). 검색어는 최근 검색에 남긴다. */
  function openVendorFromAutocomplete(item: VendorSummary) {
    addRecentSearch(trimmedQ, recentSearches).then(setRecentSearches);
    setAcOpen(false);
    router.push(`/search/${item.id}`);
  }

  /** 자동완성 «지역» 행 — 지역 조건을 걸고 결과로. */
  function openRegionFromAutocomplete(region: string) {
    addRecentSearch(region, recentSearches).then(setRecentSearches);
    setFilters((current) => ({ ...current, q: '', region }));
    setViewState('results');
    setAcOpen(false);
  }


  /**
   * 카드의 Pick 버튼(SPEC §13.1). Pick 전이면 후보에 담고 완료 시트, Pick 후면 해제 시트.
   * 로그인 전이면 누른 것을 적어두고 로그인 시트를 연다.
   */
  async function onPressPick(item: VendorSummary) {
    const existing = candidates.candidateFor(item.id);
    if (existing) {
      setUnpickTarget(existing);
      return;
    }
    const result = await candidates.pick(item.id);
    if (result === 'picked') setPickDoneOpen(true);
    else if (result === 'login') {
      await savePendingAction({ kind: 'pick', vendorId: item.id, vendorName: item.name });
      setLoginFor(item);
    } else setToast('Pick하지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  async function confirmUnpick() {
    if (!unpickTarget) return;
    const ok = await candidates.unpick(unpickTarget);
    setUnpickTarget(null);
    if (!ok) setToast('후보를 빼지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  /** 필터 칩에 적는 수. 시트가 거는 조건만 센다 — 정렬은 따로 고르는 자리다. */
  const activeFilterCount = [
    filters.region,
    filters.budget,
    filters.onlyVerified ? 'verified' : null,
  ].filter(Boolean).length;

  // ─── 검색창 ───────────────────────────────────────────────────────────────

  /**
   * 검색창. 홈에서는 스크롤 콘텐츠 맨 위에, 결과에서는 헤더에 앉는다 — 목업
   * 9a(홈)의 헤더는 제목과 알림 벨뿐이다.
   */
  /** 비울 조건이 있는가. 없으면 여기가 탭의 첫 화면이라 뒤로 갈 곳이 없다. */
  const hasCondition =
    filters.q.trim() !== '' || filters.category !== null || filters.region !== null;

  function renderSearchBox({ compact = false }: { compact?: boolean } = {}) {
    return (
      /* 시안 searchBox 52/0 16(홈) vs searchBoxSm 44/0 14(결과 헤더) — 두 크기가 다르다. */
      <View style={[styles.searchBox, compact && styles.searchBoxCompact, { backgroundColor: theme.backgroundSelected }]}>
        <ProductSymbol name="magnifier" size={Layout.iconTab} color={theme.textAssistive} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="업체나 지역을 검색해보세요"
          placeholderTextColor={theme.textAssistive}
          value={filters.q}
          onChangeText={(text) => {
            setFilters((current) => ({ ...current, q: text }));
            setAcOpen(true);
          }}
          onFocus={() => setAcOpen(true)}
          onSubmitEditing={() => submitSearch(filters.q)}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="업체 이름 검색"
        />
        {viewState === 'results' || showAutocomplete ? (
          <Pressable
            accessibilityRole="button"
            onPress={viewState === 'results' ? goHome : () => {
              setFilters((current) => ({ ...current, q: '' }));
              setAcOpen(false);
            }}
            style={styles.cancelBtn}>
            <ThemedText type="t6" themeColor="textSecondary" style={styles.bold}>취소</ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // ─── 홈 화면 ──────────────────────────────────────────────────────────────

  // 검색 홈은 없다 — 탭을 열면 곧바로 결과다(2026-09-11 대표 지시).
  //
  // 원래는 «검색 홈»(카테고리 격자 · 최근 검색 · 많이 본 곳)을 먼저 세우고 거기서
  // 결과로 넘어갔다. 그 화면은 저장소에 들어온 handoff 시안(06-search.dc.html의
  // WP-SRCH-001)에만 있었고, 대표님의 루트 시안은 «검색 홈 없음, 즉시 결과»였다.
  // 두 자료가 어긋난 것은 2026-09-10에 이미 적혀 있었는데
  // (docs/DESIGN_ZIP_AUDIT_2026-09-10.md 3-A), 저장소에는 handoff 쪽만 들어와 있어
  // 세션들이 계속 없어질 화면 위에 쌓았다. 루트 시안 쪽으로 맞춘다.


  // ─── 자동완성 · WP-SRCH-002 ───────────────────────────────────────────────

  /**
   * 시안 06-search #16b. 그룹 셋 — «업체 · 바로 상세로»(이름 18 · «지역 · 업종» 14 · 꼬리 «실 제보 N건») ·
   * «지역»(지역명 · «N곳») · «이 말로 검색»(검색어 · «결과 N곳»). 행 56 · padding 12 0 · 아래 선 1.
   * 그룹 제목 t14m · 그룹 사이 20.
   */
  function renderAutocomplete() {
    const lower = trimmedQ.toLowerCase();
    const regionRows = regions
      .filter((region) => region.name.toLowerCase().includes(lower))
      .slice(0, AUTOCOMPLETE_REGIONS);

    const row = (
      key: string,
      name: string,
      meta: string | null,
      tail: string | null,
      onPress: () => void,
      label: string
    ) => (
      <View key={key}>
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
          <View style={styles.acRow}>
            <View style={styles.acBody}>
              <ThemedText type="t5" numberOfLines={1}>{name}</ThemedText>
              {meta ? (
                <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>{meta}</ThemedText>
              ) : null}
            </View>
            {tail ? (
              <ThemedText type="t7" themeColor="textAssistive" numeric style={styles.acTail}>{tail}</ThemedText>
            ) : null}
          </View>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
      </View>
    );

    return (
      <View style={styles.acPanel}>
        {acVendors.length > 0 ? (
          <View style={styles.acGroup}>
            <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>{AC_GROUP_VENDOR}</ThemedText>
            <View style={styles.acList}>
              {acVendors.map((item) =>
                row(
                  item.id,
                  item.name,
                  `${regionLabel(item.region)} · ${VENDOR_CATEGORY_LABEL[item.category]}`,
                  countTail(item),
                  () => openVendorFromAutocomplete(item),
                  `${item.name} 자세히 보기`
                )
              )}
            </View>
          </View>
        ) : null}
        {regionRows.length > 0 ? (
          <View style={styles.acGroup}>
            <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>{AC_GROUP_REGION}</ThemedText>
            <View style={styles.acList}>
              {regionRows.map((region) =>
                row(
                  region.name,
                  region.name,
                  `${region.count}곳`,
                  null,
                  () => openRegionFromAutocomplete(region.name),
                  `${region.name} 검색`
                )
              )}
            </View>
          </View>
        ) : null}
        <View style={styles.acGroup}>
          <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>{AC_GROUP_KEYWORD}</ThemedText>
          <View style={styles.acList}>
            {row(
              'keyword',
              trimmedQ,
              null,
              acTotal === null ? null : `결과 ${acTotal}곳`,
              () => submitSearch(trimmedQ),
              `${trimmedQ} 검색`
            )}
          </View>
        </View>
      </View>
    );
  }

  // ─── 결과 화면 ────────────────────────────────────────────────────────────

  /**
   * 결과 카드 한 장. WP-SRCH-004 스펙 — 이미지 168 / 업체명 20 ↔ 금액 16 700 /
   * 건수 14 / Pick 48. 카드에 배경 상자를 두지 않는다 — 이미지와 글이 곧
   * 카드다(이중 컨테이너 금지, 2026-09-08).
   */
  function renderVendorCard(item: VendorSummary) {
    const chosen = candidates.candidateFor(item.id) !== null;
    const busy = candidates.busyVendorId === item.id;
    /* 금액 한 줄 — 0층 «업체 안내 150만원~» · 1층 «수집 중» · 3건+ 구간. 검색·상세·비교가 같은 규칙. */
    const line = priceLine(item.paidPrice, item.guidePrice);

    return (
      <View style={styles.resultCard}>
        {/* 대표 이미지 — 승인된 대표 사진이 없으면 카테고리 기본(CLAUDE.md §8) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name} 자세히 보기`}
          onPress={() => router.push(`/search/${item.id}`)}>
          <View style={styles.cardImageWrap}>
            <VendorImage
              source={item.imageUrl ? { uri: item.imageUrl } : undefined}
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
            <ThemedText
              type="t6"
              numeric
              themeColor={line.dim ? 'textAssistive' : undefined}
              style={[styles.cardPrice, styles.bold]}>
              {line.text}
            </ThemedText>
          </View>

          {/* 출처 또는 실 제보 · 지역 */}
          <ThemedText type="t7" themeColor="textAssistive" numeric numberOfLines={1} style={styles.cardMeta}>
            {metaLine(item, item.region)}
          </ThemedText>
        </Pressable>

        {/* Pick 버튼 — 48 · radius 6 · 16 700. 전: 흰 바탕 1px 테두리 · 후: coral 채움(SPEC §13.1) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={chosen ? `${item.name} Pick했어요` : `${item.name} Pick하기`}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          style={({ pressed }) => [
            styles.pickBtn,
            chosen
              ? { backgroundColor: theme.tint }
              : { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.track },
            pressed ? styles.pressed : null,
            busy ? styles.busy : null,
          ]}
          onPress={() => void onPressPick(item)}>
          <ThemedText
            type="t6"
            style={[styles.bold, chosen ? styles.pickBtnTextOn : null]}
            themeColor={chosen ? undefined : 'text'}>
            {chosen ? 'Pick했어요' : 'Pick하기'}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  /** 결과 0건 · WP-SRCH-008. 막다른 길로 두지 않는다 — 조건을 하나 풀어주는 버튼과 업체 제보. */
  function renderEmpty() {
    const relaxLabel =
      relaxKey === 'budget'
        ? '예산'
        : relaxKey === 'region'
          ? '지역'
          : relaxKey === 'category'
            ? '업종'
            : null;
    const body = !isServerConfigured
      ? '이 빌드는 서버에 붙어 있지 않아요.'
      : error
        ? error
        : relaxLabel
          ? relaxedTotal !== null && relaxedTotal > 0
            ? `${relaxLabel} 조건을 풀면 ${relaxedTotal}곳이 나와요`
            : `${relaxLabel} 조건을 풀어보세요`
          : '찾으시는 업체가 아직 등록되지 않았어요.';

    return (
      <View>
        <View style={styles.emptyHero}>
          <ThemedText type="t2">{EMPTY_TITLE}</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">{body}</ThemedText>
        </View>
        {relaxLabel ? (
          <View style={styles.emptyCta}>
            <ActionButton
              variant="primary"
              size="xlarge"
              label={`${relaxLabel} 조건 풀기`}
              onPress={() =>
                setFilters((current) =>
                  relaxKey === 'budget'
                    ? { ...current, budget: null }
                    : relaxKey === 'region'
                      ? { ...current, region: null }
                      : { ...current, category: null }
                )
              }
            />
          </View>
        ) : null}
        {/*
          비슷한 곳 — 조건 하나를 푼 목록의 앞 세 곳(시안 06-search #16f). 썸네일 52 ·
          이름 18 · 금액 16 · 건수 14. 막다른 길에 놓아둔 다음 걸음이라 없으면 그리지 않는다.
        */}
        {similar.length > 0 ? (
          <>
            <View style={[styles.band, { backgroundColor: theme.backgroundSelected }]} />
            <View style={[styles.section, styles.sectionAfterBand]}>
              <ThemedText type="t4">{EMPTY_SIMILAR_TITLE}</ThemedText>
              <View style={styles.trendList}>
                {similar.map((item) => {
                  const line = priceLine(item.paidPrice, item.guidePrice);
                  return (
                    <View key={item.id}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name} 자세히 보기`}
                        onPress={() =>
                          router.push({
                            pathname: '/search/[vendorId]',
                            params: { vendorId: item.id },
                          })
                        }
                        style={styles.trendRow}>
                        <VendorImage
                          source={item.imageUrl ? { uri: item.imageUrl } : undefined}
                          category={vendorImageCategory(item.category)}
                          width={Layout.thumbList}
                          height={Layout.thumbList}
                          radius={Radius.small}
                        />
                        <View style={styles.trendBody}>
                          <ThemedText type="t5" numberOfLines={1}>
                            {item.name}
                          </ThemedText>
                          <View style={styles.trendMeta}>
                            <ThemedText
                              type="t6"
                              numeric
                              themeColor={line.dim ? 'textAssistive' : undefined}
                              style={styles.bold}>
                              {line.text}
                            </ThemedText>
                            <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
                              {countTail(item)}
                            </ThemedText>
                          </View>
                        </View>
                      </Pressable>
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}
        <View style={[styles.emptyNote, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="t5">{EMPTY_REPORT_TITLE}</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">{EMPTY_REPORT_BODY}</ThemedText>
          <ActionButton
            variant="ghost"
            size="large"
            label={EMPTY_REPORT_CTA}
            onPress={() =>
              router.push({
                pathname: '/my/contact',
                params: { category: 'data_correction', subjectKind: 'vendor', subjectName: trimmedQ },
              })
            }
          />
        </View>
      </View>
    );
  }

  function renderResults() {
    if (showAutocomplete) {
      return (
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {renderAutocomplete()}
        </ScrollView>
      );
    }

    return (
      <>
        {/* 필터바 — 56 · 가로 스크롤 · 칩 사이 8. 맨 앞은 필터 시트 입구(WP-SRCH-005). */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.filterBar, { backgroundColor: theme.background }]}
          contentContainerStyle={styles.filterBarContent}>
          <View style={styles.filterChip}>
            <FilterChip
              label={activeFilterCount > 0 ? `필터 ${activeFilterCount}` : '필터'}
              selected={activeFilterCount > 0}
              onPress={() => setFilterOpen(true)}
            />
          </View>
          {/*
            업종 칩 — 루트 시안 `WP-SRCH-검색.dc.html` 16a의 `weddingCats`다.
            「전체」가 맨 앞이고 그다음이 업종이다.

            2026-09-08에는 두지 않기로 했었다. 근거는 「업종은 검색 홈의 격자에서
            이미 골랐고, 결과에서 또 고르게 하면 같은 선택을 두 번 시킨다」였다.
            **그 검색 홈이 없어졌으므로 근거도 없어졌다**(2026-09-11 대표 지시).
            지금은 여기가 업종을 고르는 유일한 자리다.
          */}
          <View style={styles.filterChip}>
            <FilterChip
              label="전체"
              selected={filters.category === null}
              onPress={() => setFilters((current) => ({ ...current, category: null }))}
            />
          </View>
          {CATEGORY_ORDER.map((category) => (
            <View key={category} style={styles.filterChip}>
              <FilterChip
                label={VENDOR_CATEGORY_LABEL[category]}
                selected={filters.category === category}
                onPress={() => toggle('category', category)}
              />
            </View>
          ))}
          {regions.map((region) => (
            <View key={region.name} style={styles.filterChip}>
              <FilterChip
                label={region.name}
                selected={filters.region === region.name}
                onPress={() => toggle('region', region.name)}
              />
            </View>
          ))}
        </ScrollView>

        {/* 결과 수 + 정렬 — 40. 시안: 결과 수 t14n · 정렬 t14m */}
        <View style={[styles.sortRow, { backgroundColor: theme.background }]}>
          {/*
            결과 수 옆 ⓘ — WP-SHT-014 «실 제보가 뭔가요?». screens.json은 «금액 옆 ⓘ»라고 적지만,
            카드마다 붙이면 카드 전체를 누르는 링크 안에 버튼이 하나씩 더 들어간다. 목록의 금액은
            전부 같은 규칙으로 만든 값이라 목록 머리에 하나만 둔다.
          */}
          <View style={styles.countWithInfo}>
            <ThemedText type="t7" themeColor="textAssistive" numeric>
              {filters.category ? `${VENDOR_CATEGORY_LABEL[filters.category]} ` : ''}
              {total}곳
            </ThemedText>
            <DelayedLoader active={refreshing} size={20} />
            <InfoDot label="실 제보 설명" onPress={() => setInfoTopic('verifiedData')} />
          </View>
          {/* 정렬 — 셀렉트. 누르면 바텀시트(WP-SRCH-006)에서 하나를 고른다. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`정렬: ${SORT_LABEL[filters.sort]}`}
            onPress={() => setSortOpen(true)}
            style={styles.sortSelect}>
            <ThemedText type="t7" themeColor="textAssistive" style={styles.bold}>
              {SORT_LABEL[filters.sort]}
            </ThemedText>
            <ChevronDownIcon color={theme.textAssistive} />
          </Pressable>
        </View>

        {/* 결과 목록 */}
        {vendors === null ? (
          /* 목록에는 스피너를 쓰지 않는다 — 뼈대 3줄(WP-ST-007). 카드 이미지 자리(168)부터. */
          <View style={styles.resultList}>
            <ListSkeleton hero rows={3} />
          </View>
        ) : (
          <FlatList
            data={vendors}
            refreshing={refreshing}
            onRefresh={() => runSearch(true)}
            accessibilityState={{ busy: refreshing }}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.resultList}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <>
                {/* 광고 — 자연 결과와 별도 배열. 이미지 좌상단 «광고» 라벨로만 가른다. */}
                {sponsored.length > 0 ? (
                  <View style={styles.sponsoredBlock}>
                    {sponsored.map((ad) => (
                      <Pressable
                        key={ad.vendorId}
                        accessibilityRole="button"
                        accessibilityLabel={`${ad.label} ${ad.name} 자세히 보기`}
                        onPress={() => router.push(`/search/${ad.vendorId}`)}
                        style={styles.resultCard}>
                        <View style={styles.cardImageWrap}>
                          <VendorImage
                            source={ad.imageUrl ? { uri: ad.imageUrl } : undefined}
                            category={vendorImageCategory(ad.category)}
                            width={undefined}
                            height={CARD_IMAGE_HEIGHT}
                            radius={Radius.medium}
                          />
                          {/* 시안 adPill: top 10 left 10 · rgba(0,0,0,.5) · 13/18 700 · padding 3 9 · radius 4 */}
                          <View style={[styles.adPill, { backgroundColor: theme.scrim }]}>
                            <ThemedText type="micro" style={{ color: theme.onTint }}>
                              {ad.label}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText type="t4" numberOfLines={1}>{ad.name}</ThemedText>
                        <ThemedText type="t7" themeColor="textAssistive" numberOfLines={1}>
                          {VENDOR_CATEGORY_LABEL[ad.category]} · {regionLabel(ad.region)}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            }
            ListEmptyComponent={renderEmpty()}
            ListFooterComponent={
              <DelayedLoader active={loadingMore} size={20} style={styles.loadMore} />
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
        {/*
         * 루트 시안 `docs/design-handoff/root/WP-SRCH-검색.dc.html` 16a를 그대로 따른다.
         * 줄이 둘이다 — 위는 「검색」 제목(head 56), 아래는 검색창(navSearch 60).
         * 하나로 합치지 않는다. 합치면 탭 이름이 사라져 여기가 어디인지 알 수 없다.
         *
         * 검색창 왼쪽의 40 원형은 조건이 걸렸을 때만 선다(시안 16c). 조건이 없으면
         * 탭의 첫 화면이라 갈 곳이 없다 — 아무 데도 가지 않는 뒤로 가기 단추를
         * 두는 것이 가장 나쁘다.
         */}
        <ThemedView style={styles.homeHeader}>
          <ThemedText type="t4">검색</ThemedText>
        </ThemedView>
        <ThemedView style={styles.header}>
          {hasCondition ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="검색 조건 비우기"
              onPress={goHome}
              style={styles.headerBack}>
              <ProductSymbol name="chevronLeft" size={Layout.iconTab} color={theme.textStrong} />
            </Pressable>
          ) : null}
          {renderSearchBox({ compact: true })}
          {/* 지도 보기는 여기 없다(2026-09-08) — 위치는 업체 상세에서만 보인다. */}
        </ThemedView>

        {/* ── 본문 ── */}
        {renderResults()}

        <Toast message={toast} onHidden={() => setToast(null)} />

        {/* 결과 머리 ⓘ가 여는 설명 시트 — WP-SHT-014. */}
        <InfoSheet topic={infoTopic} onClose={() => setInfoTopic(null)} />

        <SortSheet
          visible={sortOpen}
          value={filters.sort}
          onSelect={(sort) => {
            setFilters((current) => ({ ...current, sort }));
            setSortOpen(false);
          }}
          onDismiss={() => setSortOpen(false)}
        />
        {/*
          필터 시트 — WP-SRCH-005. 고르는 즉시 조건이 걸려 결과와 CTA의 수가 함께 바뀐다.
          «{n}곳 보기»를 누르면 시트만 닫힌다 — 이미 그 조건으로 보고 있다.
        */}
        <FilterSheet
          visible={filterOpen}
          value={{
            region: filters.region,
            budget: filters.budget,
            onlyVerified: filters.onlyVerified,
          }}
          regions={regionNames}
          count={total}
          onChange={(next: SearchFilterValue) => {
            setFilters((current) => ({ ...current, ...next }));
            setViewState('results');
          }}
          onApply={() => setFilterOpen(false)}
          onDismiss={() => setFilterOpen(false)}
        />
        <PickDoneSheet visible={pickDoneOpen} onDismiss={() => setPickDoneOpen(false)} />
        <UnpickSheet
          candidate={unpickTarget}
          partnerName={candidates.partnerName}
          busy={candidates.busyVendorId !== null}
          onConfirm={() => void confirmUnpick()}
          onDismiss={() => setUnpickTarget(null)}
        />
        <LoginSheet
          visible={loginFor !== null}
          reason={loginFor ? `로그인하면 ${withParticle(loginFor.name, '을를')} 바로 Pick해드려요.` : ''}
          onSignedIn={(result) => {
            setLoginFor(null);
            if (result.needsSignup) {
              router.push('/setup');
              return;
            }
            candidates.reload().catch(() => undefined);
            if (result.completed) setPickDoneOpen(true);
            else if (result.weddingError) setToast(result.weddingError);
          }}
          onDismiss={() => setLoginFor(null)}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

/** 셀렉트의 ▾. */
function ChevronDownIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
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
  /* 홈 헤더. 목업: height 56 · padding 0 20 0 24 · 제목 좌 · 벨 우. 테두리 없음. */
  homeHeader: {
    height: Layout.navBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Layout.gutter,
    /* 오른쪽 20 — 06-search head «padding:0 20px 0 24px». component.navBack.paddingRight와 같은 값이다. */
    paddingRight: Layout.navPaddingRight,
  },
  bellBtn: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 결과 헤더 — 시안 navSearch: `flex:0 0 60px` · gap 10 · `padding:0 24px 0 12px`. */
  header: {
    height: Layout.headerSearch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.cardGap,
    paddingLeft: Layout.navPaddingLeft,
    paddingRight: Layout.gutter,
  },
  /* 시안 backBtn — 40 원형. */
  headerBack: {
    width: Layout.iconButton,
    height: Layout.iconButton,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 홈의 검색창 블록. 목업: padding 4 24 24. */
  searchBlock: {
    paddingTop: Spacing.one,
    paddingHorizontal: Layout.gutter,
    paddingBottom: Spacing.four,
  },
  // 검색창(홈). 시안 searchBox: height 52, radius 6, bg gray100, padding 0 16, gap 10
  searchBox: {
    height: Layout.field,
    borderRadius: Radius.input,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    gap: Layout.cardGap,
  },
  /* 검색창(결과 헤더). 시안 searchBoxSm — 44 · 좌우 14 · 헤더에서 남는 폭을 채운다. */
  searchBoxCompact: {
    flex: 1,
    minWidth: 0,
    height: Layout.touchTarget,
    paddingHorizontal: Layout.fieldPaddingX,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.t6,
    lineHeight: LineHeight.t6,
    paddingVertical: 0,
  },
  cancelBtn: {
    paddingLeft: Spacing.two,
    minHeight: Layout.touchTarget,
    justifyContent: 'center',
  },

  // 자동완성 · 시안 #16b: 그룹 padding 0 24 20 · 제목→목록 8 · 행 56 · padding 12 0 · 행 사이 2
  acPanel: {
    paddingBottom: Spacing.two,
  },
  acGroup: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.listGap,
    gap: Spacing.two,
  },
  acList: {
    gap: Spacing.half,
  },
  acRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.rowPaddingY,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY,
  },
  acBody: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  acTail: {
    flexShrink: 0,
  },

  // ── 홈 ──
  scroll: {
    flex: 1,
  },
  /* 목업: 마지막 섹션 아래 32 여백. */
  homeContent: {
    paddingBottom: Spacing.five,
  },
  /*
   * 섹션. 목업(06-search): padding 0 24 · 제목→콘텐츠 12. 02-design-system은 14라 갈리는데,
   * 그 화면 시안을 따른다(2026-09-09 패딩 감사) — spacing.sectionGapCompact.
   * 섹션 아래 28은 밴드/다음 섹션이 잡는다.
   */
  section: {
    paddingHorizontal: Layout.gutter,
    gap: Layout.sectionHeadGapCompact,
  },
  /* 밴드 뒤·섹션 뒤 28. 목업: 밴드 margin 28 0, 마지막 섹션 padding-top 28. */
  sectionAfterBand: {
    paddingTop: Layout.sectionGap,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bold: {
    fontWeight: 700,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  busy: {
    opacity: 0.6,
  },

  // 카테고리 2열 격자. 목업: gap 11 · min-height 56 · radius 6 · bg gray50 · padding 14 16 · 세로 배치
  categoryGrid: {
    gap: Layout.gap2col,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: Layout.gap2col,
  },
  /* 시안 06-search catBox — min-height 56 · radius 10 · padding 16 전면 · gap 3. */
  categoryCell: {
    flex: 1,
    minHeight: Layout.rowMinHeight,
    borderRadius: Radius.medium,
    flexDirection: 'column',
    justifyContent: 'center',
    /* 시안 gap 3은 간격 사다리(2 · 4 · 6 …)에 없다 — 가장 가까운 2를 쓴다. */
    gap: Spacing.half,
    padding: Spacing.three,
  },
  /* 홀수 개일 때 마지막 행의 빈 칸 — 칸 폭을 지킨다. */
  categoryCellEmpty: {
    flex: 1,
  },

  // 최근 검색 칩. 목업: height 36 · radius 999 · bg gray100 · 테두리 없음 · padding 0 14 · 라벨↔X 6
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  recentChip: {
    height: Layout.chip,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    /* 목업 좌우 14 — component.chip.paddingX. 라벨↔X 6은 토큰이 없어 가장 가까운 8을 쓴다. */
    paddingHorizontal: Layout.chipPaddingX,
    gap: Spacing.two,
  },
  recentChipLabel: {
    height: '100%',
    justifyContent: 'center',
  },

  // 많이 본 곳 — 목업: 행 gap 2 · 행 min-height 56 · padding 12 0 · 순번 18 · 요소 gap 14
  trendList: {
    gap: Spacing.half,
  },
  /* 시안 06-search 행 «gap:12» — 섹션 제목 간격(14)이 아니라 행 안 간격(inlineGap)이다. */
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
    minHeight: Layout.rowMinHeight,
    paddingVertical: Layout.rowPaddingY,
  },
  rankNo: {
    /* 목업 18 — 같은 값의 인라인 아이콘 토큰을 쓴다. */
    width: Layout.iconInline,
    flexShrink: 0,
  },
  trendBody: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  trendPrice: {
    flexShrink: 0,
  },
  /* 비슷한 곳 — 금액 16 ↔ «실 제보 N건» 14를 한 줄에. 시안 gap 6은 사다리에 없어 가장 가까운 4다. */
  trendMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
    minWidth: 0,
  },
  divider: {
    height: 1,
  },
  /* 목업: 밴드 위 28. 아래 28은 다음 섹션의 paddingTop. */
  band: {
    height: Layout.sectionBand,
    marginTop: Layout.sectionGap,
  },

  // ── 결과 ──
  // 필터바. 핸드오프: height 56, 가로 스크롤. 칩은 flex 0 0 auto(SPEC §12.4).
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
  filterChip: {
    flexGrow: 0,
    flexShrink: 0,
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
  /* 결과 수 + ⓘ. 글자와 같은 줄, 사이 4. */
  countWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  /* 정렬 셀렉트. 44 터치 영역, 오른쪽 정렬. */
  sortSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: Layout.touchTarget,
    paddingLeft: Spacing.two,
  },
  /* 목업: padding 4 24 28 · 카드 사이 20. */
  resultList: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.one,
    paddingBottom: Layout.sectionGap,
    gap: Layout.listGap,
  },

  // 결과 카드. 핸드오프: 이미지(full-width × 168) + 이름↔금액 + 건수 + Pick 버튼, 사이 10
  resultCard: {
    gap: Layout.cardGap,
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
    gap: Layout.rowPaddingY,
  },
  cardName: {
    flex: 1,
    minWidth: 0,
  },
  cardPrice: {
    flexShrink: 0,
  },
  cardMeta: {
    marginTop: Layout.cardGap,
  },
  // Pick 버튼. 핸드오프: height 48, radius 6
  pickBtn: {
    height: Layout.controlLarge,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickBtnTextOn: {
    color: Colors.light.onTint,
  },

  // 광고 — 이미지 좌상단 라벨
  adPill: {
    position: 'absolute',
    top: Layout.cardGap,
    left: Layout.cardGap,
    borderRadius: Radius.badge,
    paddingHorizontal: Layout.badgePaddingX,
    paddingVertical: Spacing.half + 1,
  },
  sponsoredBlock: {
    gap: Layout.listGap,
    marginBottom: Layout.listGap,
  },

  // 결과 없음 · 시안 #16f: hero padding 36 24 28 · gap 10 → CTA → 제보 카드(bg gray50 · radius 10 · padding 20 · gap 8)
  emptyHero: {
    paddingTop: Layout.sectionGap + Spacing.two,
    paddingBottom: Layout.sectionGap,
    gap: Layout.cardGap,
  },
  emptyCta: {
    paddingBottom: Layout.sectionGap,
  },
  emptyNote: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Spacing.two,
  },

  loadMore: {
    alignSelf: 'center',
    marginVertical: Spacing.five,
  },
});
