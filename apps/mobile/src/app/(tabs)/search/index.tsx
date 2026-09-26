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
  formatCount,
  priceLine,
  TERMS,
  type VendorCategory,
  VENDOR_CATEGORY_LABEL,
  regionLabel,
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
import { RootTabHeader } from '@/components/root-tab-header';
import { isServerConfigured } from '@/api/config';
import { savePendingAction } from '@/features/auth/pending-action';
import { PickDoneSheet, UnpickSheet } from '@/features/pick/pick-sheets';
import { useMyCandidates } from '@/features/pick/use-my-candidates';
import {
  addRecentSearch,
  clearRecentSearches,
  loadRecentSearches,
  removeRecentSearch,
} from '@/features/search/recent-searches';
import { FilterSheet, type SearchFilterValue } from '@/features/search/filter-sheet';
import { SORT_LABEL, SortPanel } from '@/features/search/sort-panel';
import { vendorImageCategory } from '@/features/search/vendor-image-category';
import {
  ActionButton,
  Border,
  Elevation,
  FontSize,
  LetterSpacing,
  Layout,
  LineHeight,
  MARK_HEART_PATH,
  MaxContentWidth,
  ProductSymbol,
  Radius,
  SeedIcon,
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
/**
 * 결과 필터바에 세우는 업종 — 루트 시안 `WP-SRCH-검색.dc.html` 16a `weddingCats`.
 *
 * «전체»는 칩 목록 밖에서 따로 그린다(조건 없음). 여기는 그다음 여섯이다.
 * 업종 전체(`@weddingpick/domain`의 `PREPARATION_CATEGORIES`, 열둘)가 아니다 — 칩 줄에
 * 다 늘어놓으면 가로
 * 스크롤만 길어져서 시안이 여섯만 뽑았다. 나머지는 필터 시트에서 고른다.
 *
 * 이름은 `VENDOR_CATEGORY_LABEL`을 쓴다. **이 칩 줄의 «본식스냅»을 «스냅»으로
 * 줄이지 않는다.**
 *
 * 이 화면의 시안은 `snap`을 «스냅»으로 적었다. 그것만 보면 바꾸고 싶어지는데,
 * 루트 시안 36장을 세어 보면 반대다(2026-09-11 실측).
 *
 *     본식스냅   14회 · 7개 파일   초기 설정 · 홈 · 웨딩일정 · 웨딩일정 하위 ·
 *                                  로딩 copy 2벌 · 잔여
 *     스냅        6회              검색 · 웨딩일정 하위 등
 *
 * **시안 자신이 공용 이름으로 «본식스냅»을 쓴다.** 검색 칩에서만 줄여 적은 것은
 * 칩 폭 때문으로 읽힌다. 한 화면을 위해 `VENDOR_CATEGORY_LABEL`을 바꾸면 Pick 탭 ·
 * 웨딩일정 · 준비 현황이 한꺼번에 흔들린다(2026-09-11 MASTER 판단 — 그대로 둔다).
 */
/* 헤더 · 칩 문구 — spec/strings.ko.json `search`. 피그마 `Search.tsx`(2026-09-14 정본)에서 왔다. */
const TITLE = '검색';
const PLACEHOLDER = '업체 이름, 지역, 카테고리 검색';
const CLEAR_LABEL = '검색어 지우기';

/** 자동완성은 결과보다 빨리 따라와야 한다(RN 정본 WP-SRCH-004 · search.jsx frame-008). */
const AUTOCOMPLETE_DEBOUNCE_MS = 200;
/** 추천 검색어 중 업체 이름 수 · 지역 이름 수. 정본 `acSuggest`는 네 줄이다. */
const AUTOCOMPLETE_VENDORS = 3;
const AUTOCOMPLETE_REGIONS = 1;

/** 추천 검색어 — v3.29 WP-SRCH-004 `acLabel`. */
const AC_GROUP_SUGGEST = '추천 검색어';
/** 최근 검색 — v3.29 WP-SRCH-004 `acLabel` · `acClearAll`. */
const AC_GROUP_RECENT = '최근 검색';
const AC_CLEAR_ALL = '전체 삭제';

/** 결과 없음 — RN 정본 WP-SRCH-003 `emptyTitle` · `nearLabel`(search.jsx frame-003). */
const EMPTY_TITLE = '조건에 맞는 곳이 없어요';
/** 조건 하나를 풀면 나오는 곳. 정본 `nearby`는 두 줄이지만 결과 수에 따라 세 줄까지 둔다. */
const EMPTY_SIMILAR_TITLE = '조건이 비슷한 곳';
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
  /** 예산 구간 한 칸(필터 시트 WP-SRCH-002). 고르지 않았으면 null. */
  budget: BudgetBandKey | null;
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

/** 자동완성 «업체» 행과 결과 카드 아래 줄의 오른쪽 꼬리. 시안: «실 제보 12건» · 적으면 «3건». */
function countTail(item: VendorSummary): string {
  const count = item.paidPrice.count;
  return count >= DISCLOSURE_THRESHOLDS.limited
    ? `${TERMS.verifiedData} ${formatCount(count)}건`
    : `${formatCount(count)}건`;
}

export default function SearchScreen() {
  const theme = useTheme();
  const entry = useLocalSearchParams<EntryParams>();
  const [filters, setFilters] = useState<Filters>({
    q: '',
    category: null,
    region: null,
    budget: null,
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
   * 결과 0건일 때 조건 하나를 풀면 몇 곳이 나오는지(WP-SRCH-003 결과 없음). 어느 조건에서 잰 값인지 키를
   * 함께 들고 있어 조건이 바뀌면 옛 값을 읽지 않는다.
   */
  const [relaxed, setRelaxed] = useState<{
    key: string;
    total: number;
    /** 그 조건을 풀면 나오는 곳 — 시안의 «비슷한 곳» 세 줄이 이 목록이다. */
    similar: VendorSummary[];
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** 정렬 패널(WP-SRCH-003 `sortPanel`)이 칩 아래 떠 있는가. */
  const [sortOpen, setSortOpen] = useState(false);
  /**
   * 필터 시트(WP-SRCH-002)가 떠 있는가.
   *
   * **화면을 옮기지 않는다.** 시안이 바텀시트라서이기도 하지만, 조건을 바꿀 때마다 결과
   * 수가 따라 바뀌려면 결과를 들고 있는 이 화면 위에 떠 있어야 한다.
   */
  const [filterOpen, setFilterOpen] = useState(false);
  /** 최근 검색. 자동완성 화면과 같은 저장소(`features/search/recent-searches`)를 본다. */
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  /* 자동완성 — 업체 · 결과 수. 지역은 이미 읽어둔 목록에서 고른다. */
  const [acVendors, setAcVendors] = useState<VendorSummary[]>([]);

  /*
   * Pick — 카드의 버튼이 진짜 후보에 담는다(SPEC §13.1).
   * 비회원 검색은 폐기됐으므로 이 화면 안에서 별도 로그인 시트를 다시 열지 않는다.
   */
  const candidates = useMyCandidates();
  const [pickDoneOpen, setPickDoneOpen] = useState(false);
  const [unpickTarget, setUnpickTarget] = useState<VendorCandidate | null>(null);

  useEffect(() => {
    loadRecentSearches().then(setRecentSearches);
  }, []);

  const requestId = useRef(0);
  const displayedQuery = useRef<string | null>(null);
  const acRequestId = useRef(0);

  /** 필터 시트에 넘길 지역 이름만. 시트는 수를 적지 않는다(WP-SRCH-002 `groups` 지역). */
  const regionNames = regions.map((region) => region.name);

  const trimmedQ = filters.q.trim();
  /*
   * v3.29 WP-SRCH-004 tagDesc: 「검색창을 누르면 열립니다」 — 입력 전에도(포커스만
   * 잡혀도) 열려 최근 검색을 보여준다. 입력이 생기면 업체·지역·«이 말로 검색» 묶음이
   * 대신 뜬다(아래 renderAutocomplete). 서버 제안 요청은 검색어가 있을 때만 보낸다.
   */
  const showAutocomplete = acOpen;

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
   * 자동완성. 검색어가 있을 때만 서버를 부른다 — 추천 검색어의 업체 이름 줄은 결과를
   * 건너뛰고 상세로 간다(WP-SRCH-004).
   */
  useEffect(() => {
    if (!isServerConfigured || !showAutocomplete || !trimmedQ) return;
    const id = (acRequestId.current += 1);
    const timer = setTimeout(() => {
      searchVendors({ q: trimmedQ })
        .then((response) => {
          if (id !== acRequestId.current) return;
          setAcVendors(response.vendors.slice(0, AUTOCOMPLETE_VENDORS));
        })
        .catch(() => undefined);
    }, AUTOCOMPLETE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      acRequestId.current += 1;
    };
  }, [showAutocomplete, trimmedQ]);

  /*
   * 결과가 0건이고 조건이 걸려 있으면, 그 조건 하나를 풀면 몇 곳인지 재본다(WP-SRCH-003 결과 없음).
   * 같은 질의가 «비슷한 곳» 세 줄도 함께 들고 온다 — 조건 하나를 푼 목록이 곧 비슷한 곳이다.
   *
   * 푸는 순서는 **예산이 먼저다**(RN 정본 `emptySub` «예산을 풀면 11곳을 볼 수 있어요»). 예산은 사용자가
   * 방금 고른 숫자라 되돌리기 쉽고, 지역·업종을 먼저 풀면 찾던 것과 다른 곳이 나온다.
   */
  const relaxKey: 'budget' | 'region' | 'category' | null = filters.budget
    ? 'budget'
    : filters.region
      ? 'region'
      : filters.category
        ? 'category'
        : null;

  const relaxedKey = `${filters.q.trim()}|${filters.region ?? ''}|${filters.category ?? ''}|${filters.budget ?? ''}|${filters.sort}`;
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
   * 세션이 사라졌다면 검색 안에서 로그인 UI를 겹쳐 띄우지 않고 로그인으로 복귀한다.
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
      router.replace('/login');
    }
    else setToast('Pick하지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  async function confirmUnpick() {
    if (!unpickTarget) return;
    const ok = await candidates.unpick(unpickTarget);
    setUnpickTarget(null);
    if (!ok) setToast('후보를 빼지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  /** 필터 칩에 적는 수. 시트가 거는 조건만 센다 — 정렬은 따로 고르는 자리다. */
  const activeFilterCount = [
    filters.category,
    filters.region,
    filters.budget,
  ].filter(Boolean).length;

  // ─── 검색창 ───────────────────────────────────────────────────────────────

  function renderSearchBox() {
    return (
      /*
        피그마 `Search.tsx` 검색창(2026-09-14 정본): 48 · radius 16 · 회색 면(secondary =
        SEED bg-layer-fill = backgroundElement) · 좌우 16 · 사이 8 · 돋보기 16은 **언제나**
        선다 · 글자 14. 입력이 있으면 오른쪽에 ✕(16)이 서서 지운다.
      */
      <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement }]}>
        <ProductSymbol name="magnifier" size={Layout.iconField} color={theme.textAssistive} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder={PLACEHOLDER}
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
        {/* ✕ — 입력이 있을 때만(피그마 `{query && <X/>}`). «취소» 글자 단추는 피그마에 없다. */}
        {filters.q !== '' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CLEAR_LABEL}
            hitSlop={Spacing.two}
            onPress={() => {
              setFilters((current) => ({ ...current, q: '' }));
              setAcOpen(false);
            }}>
            <ProductSymbol name="close" size={Layout.iconField} color={theme.textAssistive} />
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


  // ─── 자동완성 · WP-SRCH-004 ───────────────────────────────────────────────

  /**
   * RN 정본 WP-SRCH-004(`search.jsx` frame-008). 묶음 둘(`acSec`: 위 16 · 아래 4 · 사이 2):
   *   - «최근 검색» ↔ «전체 삭제»(13/700 보조색 · 아래 8) → 줄(`acRow` 최소 48 · 사이 10): 시계 18 ·
   *     검색어 15 잉크 · 지우기 16 흐린색. 입력 중에도 그대로 보인다.
   *   - «추천 검색어» → 줄: 돋보기 18 · 입력한 글자와 겹치는 부분만 굵게(`acBold`) 15 잉크.
   * 추천 검색어는 지어내지 않는다 — 서버가 찾은 업체 이름과 지역 이름뿐이다. 업체 이름은 상세로,
   * 지역 이름은 그 지역 결과로 간다. 2026-09-25 픽셀 대조로 정본에 없던 묶음 제목(«업체 · 바로
   * 상세로» · «지역» · «이 말로 검색»)과 줄 아래 설명 · 건수를 뺐다.
   */
  function renderAutocomplete() {
    const lower = trimmedQ.toLowerCase();
    const regionRows = trimmedQ
      ? regions.filter((region) => region.name.toLowerCase().includes(lower)).slice(0, AUTOCOMPLETE_REGIONS)
      : [];
    const suggestions = trimmedQ
      ? [
          ...acVendors.map((item) => ({
            key: item.id,
            text: item.name,
            label: `${item.name} 자세히 보기`,
            onPress: () => openVendorFromAutocomplete(item),
          })),
          ...regionRows.map((region) => ({
            key: `region-${region.name}`,
            text: region.name,
            label: `${region.name} 검색`,
            onPress: () => openRegionFromAutocomplete(region.name),
          })),
        ]
      : [];

    return (
      <View>
        {recentSearches.length > 0 ? (
          <View style={styles.acSec}>
            <View style={styles.acHead}>
              <ThemedText type="f13" themeColor="textAssistive" style={styles.bold}>
                {AC_GROUP_RECENT}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={AC_CLEAR_ALL}
                hitSlop={Spacing.two}
                onPress={() => clearRecentSearches().then(() => setRecentSearches([]))}>
                <ThemedText type="f13" themeColor="textAssistive" style={styles.bold}>
                  {AC_CLEAR_ALL}
                </ThemedText>
              </Pressable>
            </View>
            {recentSearches.map((query) => (
              <View key={query} style={styles.acRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${query} 검색`}
                  style={styles.acRecentQuery}
                  onPress={() => submitSearch(query)}>
                  <ProductSymbol name="clock" size={Layout.iconInline} color={theme.textAssistive} />
                  <ThemedText type="f15" numberOfLines={1} style={styles.acText}>
                    {query}
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${query} 삭제`}
                  hitSlop={Spacing.two}
                  onPress={() => removeRecentSearch(query, recentSearches).then(setRecentSearches)}>
                  <ProductSymbol name="close" size={Layout.iconField} color={theme.textDisabled} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {suggestions.length > 0 ? (
          <View style={styles.acSec}>
            <ThemedText type="f13" themeColor="textAssistive" style={styles.bold}>
              {AC_GROUP_SUGGEST}
            </ThemedText>
            {suggestions.map((row) => {
              const at = row.text.toLowerCase().indexOf(lower);
              return (
                <Pressable
                  key={row.key}
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                  onPress={row.onPress}
                  style={styles.acRow}>
                  <SeedIcon name="searchRegular" size={Layout.iconInline} color={theme.textAssistive} />
                  <ThemedText type="f15" numberOfLines={1} style={styles.acText}>
                    {at < 0 ? (
                      row.text
                    ) : (
                      <>
                        {row.text.slice(0, at)}
                        <ThemedText type="f15" style={styles.bold}>
                          {row.text.slice(at, at + trimmedQ.length)}
                        </ThemedText>
                        {row.text.slice(at + trimmedQ.length)}
                      </>
                    )}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  }

  // ─── 결과 화면 ────────────────────────────────────────────────────────────

  /**
   * 결과 카드 한 장. 2026-09-14 대표 지시로 **가로형**으로 바꿨다(피그마
   * `Search.tsx` 구조 채택, B등급이라 색·수치는 옮기지 않는다 — 이미지 폭·높이는
   * 이 화면 전용 로컬 값이다, `CARD_IMAGE_HEIGHT`가 예전에 그랬던 것과 같다).
   * 카드에 배경 상자를 두지 않는다 — 이미지와 글이 곧 카드다(이중 컨테이너 금지,
   * 2026-09-08). 해시태그 · 저장수는 서버에 없어 넣지 않는다. **별점은 이제 있다**
   * (`VendorSummary.rating`, v3.28 2026-09-23 「후기 별점 UI를 되살린다」) — 이 목록
   * 카드에 태우는 것은 이번 복원 범위(검색 업체상세 · Pick 후보카드 · MY 후기목록) 밖이라
   * 함께 손대지 않았다. 넣을 때는 이 가로형 카드(2026-09-14, B등급 스코프)의 값을
   * 더 옮기지 않는다는 원칙과 같이 검토한다.
   */
  function renderVendorCard(item: VendorSummary) {
    const chosen = candidates.candidateFor(item.id) !== null;
    const busy = candidates.busyVendorId === item.id;
    /* 금액 한 줄 — 0층 «업체 안내 150만원~» · 1층 «수집 중» · 3건+ 구간. 검색·상세·비교가 같은 규칙. */
    const line = priceLine(item.paidPrice, item.guidePrice);

    /*
     * 아래 줄 오른쪽 꼬리 — 피그마의 별점 · 저장 수 자리에 우리 값(실 제보 N건)을 둔다.
     * 0층(dim)은 금액 줄이 이미 출처를 말하므로 꼬리를 비운다 — 같은 말을 두 번 적지 않는다.
     */
    const tail = line.dim ? undefined : countTail(item);

    return (
      <ResultCard
        name={item.name}
        category={item.category}
        region={regionLabel(item.region)}
        imageUrl={item.imageUrl}
        price={{ text: line.text, dim: line.dim }}
        tail={tail}
        pick={{ chosen, busy, onPress: () => void onPressPick(item) }}
        onPress={() => router.push(`/search/${item.id}`)}
      />
    );
  }

  /**
   * 결과 0건 — RN 정본 WP-SRCH-003(`search.jsx` frame-003 `emptyWrap` · `nearWrap`).
   * 가운데 정렬 제목 16/22 · 안내 14/20 · CTA «예산 조건 풀기»(48 · 좌우 20 · radius 8 · 15/700)
   * → «조건이 비슷한 곳»(행 60 · 이름 15/700 · «실 제보 N건 · 지역» 12 · 오른쪽 금액 15/700).
   * 업체 제보 상자는 정본 비교표(`diffs` «결과 없음»: 조건 풀기 CTA + 비슷한 곳 + 업체 제보)를 따른다.
   */
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
            ? `${relaxLabel}을 풀면 ${formatCount(relaxedTotal)}곳을 볼 수 있어요`
            : `${relaxLabel} 조건을 풀어보세요`
          : '찾으시는 업체가 아직 등록되지 않았어요.';

    return (
      <View style={styles.emptyRoot}>
        <View style={styles.emptyWrap}>
          <ThemedText type="f16" style={[styles.bold, styles.emptyTitle]}>{EMPTY_TITLE}</ThemedText>
          <ThemedText type="f14" themeColor="textAssistive" style={styles.emptySub}>{body}</ThemedText>
          {relaxLabel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${relaxLabel} 조건 풀기`}
              onPress={() =>
                setFilters((current) =>
                  relaxKey === 'budget'
                    ? { ...current, budget: null }
                    : relaxKey === 'region'
                      ? { ...current, region: null }
                      : { ...current, category: null }
                )
              }
              style={({ pressed }) => [
                styles.emptyCta,
                { backgroundColor: theme.tint },
                pressed ? styles.pressed : null,
              ]}>
              <ThemedText type="f15" style={[styles.bold, { color: theme.onTint }]}>
                {`${relaxLabel} 조건 풀기`}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
        {similar.length > 0 ? (
          <View style={styles.nearWrap}>
            <ThemedText type="f13" themeColor="textAssistive" style={styles.bold}>{EMPTY_SIMILAR_TITLE}</ThemedText>
            <View>
              {similar.map((item) => {
                const line = priceLine(item.paidPrice, item.guidePrice);
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} 자세히 보기`}
                    onPress={() =>
                      router.push({
                        pathname: '/search/[vendorId]',
                        params: { vendorId: item.id },
                      })
                    }
                    style={[styles.nearRow, { borderBottomColor: theme.border }]}>
                    <View style={styles.nearCol}>
                      <ThemedText type="f15" numberOfLines={1} style={styles.bold}>
                        {item.name}
                      </ThemedText>
                      <ThemedText type="f12" themeColor="textAssistive" numeric numberOfLines={1}>
                        {`${countTail(item)} · ${regionLabel(item.region)}`}
                      </ThemedText>
                    </View>
                    <ThemedText
                      type="f15"
                      numeric
                      themeColor={line.dim ? 'textAssistive' : undefined}
                      style={[styles.bold, styles.nearPrice]}>
                      {line.text}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
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
        {/*
          결과 수 · 정렬 — v3.29 정본 WP-SRCH-001 `countRow`: 왼쪽 결과 수(14/700 잉크) ·
          오른쪽 정렬 칩 하나(«추천순 ▾», `sortChip`). 카테고리 · 지역 · 가격을 각각
          여는 칩 줄은 정본에 없다 — 그 세 조건은 헤더의 필터 단추(`headerFilterBtn`)
          하나로 필터 시트(WP-SRCH-002)를 열어 고른다. 필터 진입점을 헤더 하나로
          묶는다(2026-09-23 대표 지시 「등록 버튼은 헤더 영역에 있는 것만 쓴다 —
          전체 UX 통일」과 같은 원칙 — 여기서는 등록이 아니라 필터지만 «같은 동작을
          여는 진입점은 하나만 둔다»는 같은 이유다). 예전에 여기 있던 카테고리 ▾ ·
          지역 ▾ · 가격 ▾ 칩 셋은 필터 단추와 같은 시트를 여는 중복 진입점이었다 —
          v3.29 재대조로 뺐다(2026-09-23).

          정렬 칩은 열림 상태를 캐럿 방향으로 보여준다(WP-SRCH-003 `sortChipOn`
          `caretUp` vs 기본 `caretDim`) — 패널이 열려 있으면 위, 닫혀 있으면 아래.
          누르면 칩 바로 아래 인라인 패널(`sortPanel`)이 뜬다. 바텀시트가 아니다.
        */}
        <View style={styles.countBar}>
        <View style={[styles.countRow, { backgroundColor: theme.background }]}>
          <View style={styles.countText}>
            <ThemedText type="f14" numeric style={styles.bold}>
              {formatCount(total)}개 업체
            </ThemedText>
            <DelayedLoader active={refreshing} size={20} />
          </View>
          <View style={styles.sortChip}>
            <DropdownChip
              label={SORT_LABEL[filters.sort]}
              active={false}
              open={sortOpen}
              accessibilityLabel={`정렬: ${SORT_LABEL[filters.sort]}`}
              onPress={() => setSortOpen((open) => !open)}
            />
          </View>
        </View>
        {sortOpen ? (
          <View style={styles.sortPanel}>
            <SortPanel
              value={filters.sort}
              onSelect={(sort) => {
                setFilters((current) => ({ ...current, sort }));
                setSortOpen(false);
              }}
            />
          </View>
        ) : null}
        </View>
        {/* 패널 바깥을 누르면 닫는다 — 목록 위에 깔리는 투명 막. */}
        {sortOpen ? (
          <Pressable
            accessibilityLabel="정렬 닫기"
            onPress={() => setSortOpen(false)}
            style={styles.sortDismiss}
          />
        ) : null}

        {/* 결과 목록 */}
        {vendors === null ? (
          /* 목록에는 스피너를 쓰지 않는다. 실제 104×116 가로 카드 구조를 그대로 비운다. */
          <View style={styles.resultList}>
            <ListSkeleton variant="search" rows={3} />
          </View>
        ) : (
          <FlatList
            data={vendors}
            refreshing={refreshing}
            onRefresh={() => runSearch(true)}
            accessibilityState={{ busy: refreshing }}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.resultList, styles.resultListGrow]}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <>
                {/* 광고 — 자연 결과와 별도 배열. 이미지 좌상단 «광고» 라벨로만 가른다. */}
                {sponsored.length > 0 ? (
                  <View style={styles.sponsoredBlock}>
                    {sponsored.map((ad) => (
                      /* 광고는 자연 결과와 같은 카드 틀이고, 이미지 좌상단 배지(피그마 `badge` 자리)의 «광고»로만 가른다. */
                      <ResultCard
                        key={ad.vendorId}
                        name={ad.name}
                        category={ad.category}
                        region={regionLabel(ad.region)}
                        imageUrl={ad.imageUrl}
                        badge={ad.label}
                        onPress={() => router.push(`/search/${ad.vendorId}`)}
                      />
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
          검색은 Root 5탭의 1Depth라 뒤로가기를 두지 않는다.

          RN 정본 WP-SRCH-001(`search.jsx` frame-001) `stickyHead`: `headTop`은
          `headTitleRoot`(«검색» 22/700) 하나뿐이고 옆에 결과 수를 적지 않는다 — 결과
          수는 검색창 아래 별도 `countRow`에 있다(2026-09-23 v3.29 재대조로 여기 있던
          중복 «N곳» 표시를 뺐다). 검색 Root에는 Back을 두지 않는다.

          제목 줄은 Root 5탭 공통(`RootTabHeader`)이다. 크기 · 줄 높이 · 여백은 정본
          `headTitleRoot` 22 · `stickyHead` 위 12가 아니라 홈 헤더 기준(26/39/700 · 줄 66)이다
          — 2026-09-26 대표 지시 「히어로 영역이 제각각이다. 홈 화면 기준으로 통일한다」.
        */}
        <ThemedView style={[styles.header, { borderBottomColor: theme.border }]}>
          <RootTabHeader title={TITLE} />
          <View style={styles.headerSearchRow}>
            {renderSearchBox()}
            {/* 입력 중(WP-SRCH-004)에는 검색창이 줄을 다 쓴다 — 정본 frame-008에 필터 단추가 없다. */}
            {showAutocomplete ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={activeFilterCount > 0 ? `필터 ${formatCount(activeFilterCount)}개 적용됨` : '필터'}
                onPress={() => setFilterOpen(true)}
                style={[styles.headerFilterBtn, { backgroundColor: theme.backgroundElement }]}>
                {/* 정본 WP-SRCH-001 `icoSliders` = ICO('more-horiz', 16, INK) — search.js. */}
                <SeedIcon name="moreHorizRegular" size={Layout.iconField} color={theme.text} />
              </Pressable>
            )}
          </View>
          {/* 지도 보기는 여기 없다(2026-09-08) — 위치는 업체 상세에서만 보인다. */}
        </ThemedView>

        {/* ── 본문 ── */}
        {renderResults()}

        <Toast message={toast} onHidden={() => setToast(null)} />

        {/*
          필터 시트 — WP-SRCH-002. 고르는 즉시 조건이 걸려 결과와 CTA의 수가 함께 바뀐다.
          «{n}개 업체 보기»를 누르면 시트만 닫힌다 — 이미 그 조건으로 보고 있다.
        */}
        <FilterSheet
          visible={filterOpen}
          value={{
            category: filters.category,
            region: filters.region,
            budget: filters.budget,
            sort: filters.sort,
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
      </SafeAreaView>
    </ThemedView>
  );
}


/**
 * Pick pill 안의 하트.
 *
 * **Pick Mark(하트 + 체크)가 아니다.** 시안 16a의 `btnStyle`은 체크 없는 하트
 * 하나이고, Pick하면 코랄로 채운다. 경로는 확정본의 하트를 그대로 쓴다
 * (`MARK_HEART_PATH`) — 좌표를 새로 만들지 않는다.
 */
function PickHeartIcon({ color, filled }: { color: string; filled: boolean }) {
  /* 피그마 `Search.tsx` 카드 Pick 원 안의 하트 `w-3.5 h-3.5` = 14 — size.iconSmall과 같은 값. */
  return (
    <Svg width={Layout.iconSmall} height={Layout.iconSmall} viewBox="0 0 24 24" fill="none">
      <Path
        d={MARK_HEART_PATH}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * 결과 카드 한 장 — 피그마 `Search.tsx` 업체 목록의 카드(2026-09-14 정본 · 최상위
 * 규칙 1). 테두리 1 · radius 16(`rounded-2xl`) · 왼쪽 열 120(썸네일 104×116 ·
 * radius 8 — RN 정본 `vThumb` · 안쪽 8) · 오른쪽 정보 안쪽 14(`p-3.5`). 위 줄은 업종 라벨 + 이름(14/700)과
 * 오른쪽 Pick 원 28, 다음 줄은 핀 12 + 지역, 아래 줄은 금액(왼쪽)과 꼬리(오른쪽).
 *
 * **피그마의 해시태그 · 별점 · 저장 수는 그리지 않는다** — 서버가 주지 않는다
 * (`vendorSummarySchema`에 그 칸이 없다). 만들어 넣지 않는다. 그 자리는 우리 값으로
 * 채운다: 아래 줄 오른쪽이 «실 제보 N건»이다. 그림자(`shadow-sm`)는 `elevation.$rule`
 * (그림자를 거의 쓰지 않는다)에 따라 없다.
 *
 * 광고 카드도 같은 틀이다 — 이미지 좌상단 배지(피그마 `badge` 자리)에 «광고»가 선다.
 */
function ResultCard({
  name,
  category,
  region,
  imageUrl,
  badge,
  price,
  tail,
  pick,
  onPress,
}: {
  name: string;
  category: VendorCategory;
  region: string;
  imageUrl: string | null;
  badge?: string;
  price?: { text: string; dim: boolean };
  tail?: string;
  pick?: { chosen: boolean; busy: boolean; onPress: () => void };
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} 자세히 보기`}
      onPress={onPress}
      style={[styles.resultCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={styles.cardImageCol}>
        <VendorImage
          source={imageUrl ? { uri: imageUrl } : undefined}
          category={vendorImageCategory(category)}
          width={Layout.thumbSearchWidth}
          height={Layout.thumbSearchHeight}
          /* RN 정본 `vThumb` radius 8(전에는 피그마 18). */
          radius={Radius.picker}
        />
        {badge ? (
          /* 피그마 badge: 열 기준 left/top 14 · pill · 잉크 채움 · 흰 글자 · padding 8/2. */
          <View style={[styles.cardBadge, { backgroundColor: theme.text }]}>
            {/* 정본 `vBadge` 10/14/700(search.js) — micro(13/18)가 아니다. */}
            <ThemedText type="f10" style={[styles.bold, styles.badgeText, { color: theme.onInk }]}>
              {badge}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.cardInfo}>
        <View>
          <View style={styles.cardHeadRow}>
            <View style={styles.cardHeadText}>
              {/* 규격서 search.txt: 업종 «10/700 #868B94 · lh 15 · ls 0.5px» · 이름 «14/700 · lh 19 · mar 2 0 0 0». */}
              <ThemedText type="f10" themeColor="textAssistive" style={[styles.bold, styles.tracked]}>
                {VENDOR_CATEGORY_LABEL[category]}
              </ThemedText>
              <ThemedText type="f14" numberOfLines={1} style={[styles.bold, styles.cardName]}>
                {name}
              </ThemedText>
            </View>
            {pick ? (
              /* Pick 원 — 켜지면 키 컬러 채움 + 흰 하트, 꺼지면 회색 면 + 보조색 하트(피그마 `bg-primary` / `bg-secondary`). */
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={pick.chosen ? `${name} Pick했어요` : `${name} Pick하기`}
                accessibilityState={{ disabled: pick.busy }}
                disabled={pick.busy}
                hitSlop={Spacing.two}
                onPress={pick.onPress}
                style={({ pressed }) => [
                  styles.pickCircle,
                  { backgroundColor: pick.chosen ? theme.tint : theme.backgroundElement },
                  pressed ? styles.pressed : null,
                  pick.busy ? styles.busy : null,
                ]}>
                <PickHeartIcon color={pick.chosen ? theme.onTint : theme.textAssistive} filled={pick.chosen} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.cardLocation}>
            <ProductSymbol name="pin" size={Layout.iconMicro} color={theme.textAssistive} />
            {/* 규격서: 지역 «12/400 #868B94 · lh 16». */}
            <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1}>
              {region}
            </ThemedText>
          </View>
        </View>
        {price || tail ? (
          <View style={styles.cardFoot}>
            {/* 규격서: 금액 «12/600 #1A1C20 · lh 16» · 꼬리(«저장 2341» 자리) «10/400 #868B94 · lh 15». */}
            {price ? (
              <ThemedText
                type="f12"
                numeric
                numberOfLines={1}
                themeColor={price.dim ? 'textAssistive' : undefined}
                style={styles.semibold}>
                {price.text}
              </ThemedText>
            ) : (
              <View />
            )}
            {tail ? (
              <ThemedText type="f10" themeColor="textAssistive" numeric numberOfLines={1}>
                {tail}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * 결과 위 정렬 칩 «추천순 ▾» — v3.29 정본 WP-SRCH-001 `sortChip` / WP-SRCH-003
 * `sortChipOn`. 36 · 좌우 14 · radius 999 · 테두리 1 #eaebee · 배경 흰색 · 14/700 ·
 * 꺾쇠 14(반투명 .5). 열려 있으면 꺾쇠가 위를 본다(`caretUp`), 닫혀 있으면 아래
 * (`caretDim`). 누르면 칩 아래 인라인 정렬 패널(`SortPanel`, WP-SRCH-003)이 열린다.
 */
function DropdownChip({
  label,
  active,
  open,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  /** 이 칩이 여는 패널이 지금 열려 있는가 — 꺾쇠 방향만 바꾼다. */
  open?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const color = active ? theme.onInk : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dropChip,
        {
          backgroundColor: active ? theme.text : theme.background,
          borderColor: active ? theme.text : theme.border,
        },
        pressed ? styles.pressed : null,
      ]}>
      {/* 정본: 칩 «14/700». */}
      <ThemedText type="f14" numberOfLines={1} style={[styles.bold, { color }]}>
        {label}
      </ThemedText>
      <View style={[styles.dropChevron, open ? styles.dropChevronOpen : null]}>
        <ProductSymbol name="chevronDown" size={Layout.iconSmall} color={color} />
      </View>
    </Pressable>
  );
}


/** 정본 `nearRow` 최소 높이 60 — 사다리 밖의 행 높이라 여기 적는다. */
const NEAR_ROW_HEIGHT = 60;

/** 정본 `emptyWrap` 아래 여백 120 — 빈 상태를 화면 가운데보다 조금 위에 둔다. */
const EMPTY_PAD_BOTTOM = 120;

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

  // ── 검색 Root 헤더 — 제목 줄은 Root 5탭 공통(홈 기준), 검색창 줄 아래는 정본 수치 ──
  /* 제목 줄(`RootTabHeader` 66) 아래 검색창 줄 · 아래 16 · 아래 선. */
  header: {
    paddingBottom: Spacing.three,
    borderBottomWidth: Border.hairline,
  },
  /* 검색창과 필터 단추 `flex gap-2` · 좌우 24. */
  headerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Layout.pageX,
  },
  /* 필터 단추 `h-12 w-12 rounded-2xl bg-secondary` — 48 정사각 · radius 16. */
  headerFilterBtn: {
    width: Layout.searchField,
    height: Layout.searchField,
    borderRadius: Radius.cardLarge,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* 검색창 `flex-1 rounded-2xl bg-secondary px-4 h-12 gap-2` — 48 · radius 16 · 좌우 16 · 사이 8. */
  searchBox: {
    flex: 1,
    minWidth: 0,
    height: Layout.searchField,
    borderRadius: Radius.cardLarge,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  /* 규격서: 입력 «input 278×20» — 글자 14 · 줄높이 20. */
  searchInput: {
    flex: 1,
    fontSize: FontSize.f14,
    lineHeight: LineHeight.lh20,
    paddingVertical: 0,
  },

  // 자동완성 · 시안 #16b: 그룹 padding 0 24 20 · 제목→목록 8 · 행 56 · padding 12 0 · 행 사이 2
  /* 정본 `acSec`: 위 16 · 좌우 20(전역 거터 24) · 아래 4 · 사이 2. */
  acSec: {
    paddingTop: Spacing.three,
    paddingHorizontal: Layout.pageX,
    paddingBottom: Spacing.one,
    gap: Spacing.half,
  },
  /* 정본 `acHead`: 양끝 · 사이 12 · 아래 8. */
  acHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
    paddingBottom: Spacing.two,
  },
  /* 정본 `acRow`: 최소 48 · 사이 10. */
  acRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.cardGap,
    minHeight: Layout.searchField,
  },
  acRecentQuery: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.cardGap,
  },
  acText: {
    flex: 1,
    minWidth: 0,
  },

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
  /* 규격서의 굵기 600 · 500 — spec/tokens.json typography.$weights의 피그마 예외. */
  semibold: {
    fontWeight: 600,
  },
  medium: {
    fontWeight: 500,
  },
  /* 규격서 «ls 0.5px» — 업종 라벨. */
  tracked: {
    letterSpacing: LetterSpacing.p05,
  },
  /* `micro`는 기본이 700이다. 피그마에서 regular인 작은 글자(부제 · 지역 · 결과 수 · 꼬리)는 400으로 되돌린다. */
  regular: {
    fontWeight: 400,
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

  // ── 결과 — v3.29 정본 WP-SRCH-001 `countRow` ──
  /* 정렬 칩 — countRow 오른쪽 끝(`sortChip` `margin-left:auto`). */
  sortChip: {
    marginLeft: 'auto',
  },
  /* 칩 `h-9 px-3.5 rounded-full border gap-1` — 36 · 좌우 14 · 라벨↔꺾쇠 4. */
  dropChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: Layout.chip,
    paddingHorizontal: Layout.chipPaddingX,
    gap: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: Border.hairline,
  },
  /* 꺾쇠 `opacity-50`. */
  dropChevron: {
    opacity: 0.5,
  },
  /* 열려 있을 때 — 정본 `caretUp`은 위를 본다. `chevronDown`을 뒤집는다. */
  dropChevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  /* 전역 24px 좌우 거터 · 결과 수 왼쪽 · 정렬 칩 오른쪽. */
  countRow: {
    minHeight: Layout.chip,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.pageX,
    paddingTop: Layout.inlineGap,
    marginBottom: Layout.inlineGap,
  },
  countText: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  /* 결과 수 줄 + 정렬 패널의 기준 틀. 패널이 목록 위로 겹쳐 뜨게 z를 올린다. */
  countBar: {
    zIndex: 30,
  },
  /* 정본 `sortPanel` right 20 · top 52 — 칩 오른쪽 끝(pageX)에 맞추고 칩 바로 아래 4. */
  sortPanel: {
    position: 'absolute',
    right: Layout.pageX,
    top: Layout.inlineGap + Layout.chip + Spacing.one,
  },
  sortDismiss: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  /* 목록 `px-5 space-y-3` + 바깥 `pb-4` — 카드 사이 12 · 아래 16. */
  resultList: {
    paddingHorizontal: Layout.pageX,
    paddingBottom: Spacing.three,
    gap: Layout.inlineGap,
  },

  /* 규격서 「div 390×137 … bg #FFFFFF · r16 · border 1 #000000 6% · shadow」 — radius 16 · 테두리 1 · shadow-sm. */
  /* 결과가 없을 때 빈 상태가 남은 높이를 채운다(정본 `emptyWrap` flex:1). */
  resultListGrow: {
    flexGrow: 1,
  },

  resultCard: {
    flexDirection: 'row',
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    ...Elevation.figmaCard,
  },
  /* 왼쪽 열 `p-2` 안에 썸네일 104×116 — 열 폭 120. */
  cardImageCol: {
    padding: Spacing.two,
    flexShrink: 0,
  },
  /* 배지 `absolute left-3.5 top-3.5 rounded-full px-2 py-0.5` — 열 기준 14 · 안쪽 8/2. 14는 같은 값의 chipPaddingX. */
  cardBadge: {
    position: 'absolute',
    top: Layout.chipPaddingX,
    left: Layout.chipPaddingX,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  /* 오른쪽 정보 `flex-1 p-3.5 flex-col justify-between` — 안쪽 14(같은 값의 fieldPaddingX). */
  badgeText: {
    lineHeight: LineHeight.lh14,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    padding: Layout.fieldPaddingX,
    justifyContent: 'space-between',
  },
  /* 업종·이름 ↔ Pick 원 `flex items-start justify-between gap-1`. */
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  cardHeadText: {
    flex: 1,
    minWidth: 0,
  },
  /* 이름 `mt-0.5` — 업종 라벨 아래 2. */
  /* 규격서: 이름 «lh 19 · mar 2 0 0 0». */
  cardName: {
    marginTop: Spacing.half,
    lineHeight: LineHeight.lh19,
  },
  /* Pick 원 `w-7 h-7 rounded-full mt-0.5` — 28. */
  pickCircle: {
    width: Layout.pickCircle,
    height: Layout.pickCircle,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: Spacing.half,
  },
  /* 핀 + 지역 `flex items-center gap-1 mt-1` — 사이 4 · 위 4. */
  cardLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  /* 아래 줄 `flex items-center justify-between mt-2` — 금액 왼쪽 · 꼬리 오른쪽 · 위 8. */
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },

  /* 광고 묶음 — 자연 결과와 같은 간격(12). */
  sponsoredBlock: {
    gap: Layout.inlineGap,
    marginBottom: Layout.inlineGap,
  },

  // 결과 없음 · RN 정본 WP-SRCH-003 `emptyWrap`: 가운데 · 사이 12 · 좌우 40 · 제목 16/22 · 안내 14/20.
  emptyRoot: {
    flex: 1,
  },
  /* 정본 `emptyWrap`은 flex 1 · 가운데 정렬 · 아래 120 — 남은 높이 한가운데보다 조금 위에 선다. */
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Layout.inlineGap,
    paddingBottom: EMPTY_PAD_BOTTOM,
    /* 정본 좌우 40 — 목록(`resultList`)이 이미 24를 주므로 16만 더한다. */
    paddingHorizontal: Spacing.three,
  },
  emptyTitle: {
    lineHeight: LineHeight.lh22,
    textAlign: 'center',
  },
  emptySub: {
    lineHeight: LineHeight.lh20,
    textAlign: 'center',
  },
  /* 정본 `emptyCta`: 위 14 · 높이 48 · 좌우 20 · radius 8 · 코랄 면 · 15/700 흰 글자. */
  emptyCta: {
    marginTop: Layout.sectionHeadGap,
    height: Layout.searchField,
    paddingHorizontal: Layout.cardPadding,
    borderRadius: Radius.picker,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 정본 `nearWrap` 아래 24 · 사이 10 · `nearRow` 행 60 · 아래 선 1 · `nearCol` 사이 3. */
  /* 좌우는 목록(`resultList`)의 24가 이미 준다. */
  nearWrap: {
    paddingBottom: Layout.gutter,
    gap: Layout.cardGap,
  },
  nearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
    minHeight: NEAR_ROW_HEIGHT,
    borderBottomWidth: Border.hairline,
  },
  nearCol: {
    flex: 1,
    minWidth: 0,
    gap: Layout.cardNameGap,
  },
  nearPrice: {
    flexShrink: 0,
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
