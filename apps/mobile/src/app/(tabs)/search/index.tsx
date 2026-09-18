import {
  VENDOR_SORTS,
  type VendorSort,
  type SponsoredCard,
  type VendorCandidate,
  type VendorSummary,
} from '@weddingpick/api-contract';
import {
  BUDGET_BANDS,
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
import { isServerConfigured } from '@/api/config';
import { useDepthBack } from '@/features/navigation/depth-back';
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
const TITLE = '업체 검색';
const SUBTITLE = '우리 조건에 맞는 선택만 모았어요';
const PLACEHOLDER = '업체 이름, 지역, 카테고리 검색';
const BACK_LABEL = '홈으로 돌아가기';
const CLEAR_LABEL = '검색어 지우기';
const CHIP_CATEGORY = '카테고리';
const CHIP_REGION = '지역';
const CHIP_PRICE = '가격';

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

/** 자동완성 «업체» 행과 결과 카드 아래 줄의 오른쪽 꼬리. 시안: «실 제보 12건» · 적으면 «3건». */
function countTail(item: VendorSummary): string {
  const count = item.paidPrice.count;
  return count >= DISCLOSURE_THRESHOLDS.limited
    ? `${TERMS.verifiedData} ${formatCount(count)}건`
    : `${formatCount(count)}건`;
}

export default function SearchScreen() {
  const theme = useTheme();
  const depthBack = useDepthBack();
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
  /** 최근 검색. 자동완성 화면과 같은 저장소(`features/search/recent-searches`)를 본다. */
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  /* 자동완성 — 업체 · 결과 수. 지역은 이미 읽어둔 목록에서 고른다. */
  const [acVendors, setAcVendors] = useState<VendorSummary[]>([]);
  const [acTotal, setAcTotal] = useState<number | null>(null);

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
  /** 헤더 ← — 온 곳으로 돌아간다(피그마 `navigate("/")`). 이력이 없으면(딥링크) 홈. */
  function goBack() {
    depthBack();
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
    else if (result === 'login') router.replace('/login');
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
    filters.region,
    filters.budget,
    filters.onlyVerified ? 'verified' : null,
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
   * 결과 카드 한 장. 2026-09-14 대표 지시로 **가로형**으로 바꿨다(피그마
   * `Search.tsx` 구조 채택, B등급이라 색·수치는 옮기지 않는다 — 이미지 폭·높이는
   * 이 화면 전용 로컬 값이다, `CARD_IMAGE_HEIGHT`가 예전에 그랬던 것과 같다).
   * 카드에 배경 상자를 두지 않는다 — 이미지와 글이 곧 카드다(이중 컨테이너 금지,
   * 2026-09-08). 해시태그 · 별점 · 저장수는 서버에 없어(`VendorSummary`) 넣지 않는다.
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
        region={item.region}
        imageUrl={item.imageUrl}
        price={{ text: line.text, dim: line.dim }}
        tail={tail}
        pick={{ chosen, busy, onPress: () => void onPressPick(item) }}
        onPress={() => router.push(`/search/${item.id}`)}
      />
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

    const budgetLabel = BUDGET_BANDS.find((band) => band.key === filters.budget)?.label ?? null;

    return (
      <>
        {/*
          칩 줄 — 피그마 `Search.tsx`(2026-09-14 정본 · 최상위 규칙 1). «카테고리 ▾ ·
          지역 ▾ · 가격 ▾» 셋은 필터 시트를 열고, 오른쪽 끝의 «추천순 ▾»은 정렬 시트를
          연다. 위 24 · 아래 8 · 칩 사이 8. 조건이 걸린 칩은 그 값을 라벨로 적고
          잉크로 채운다(«메이크업» · «경기» · «100~200만원»).

          피그마의 지역 칩 기본 라벨은 «서울»인데 그것은 시안의 가짜 기본값(«서울 전체»)
          이다 — 우리는 기본 지역이 없으므로 «지역»으로 적는다. 카테고리 칩의 업종 이름은
          VENDOR_CATEGORY_LABEL 하나만 본다(본식스냅 · 헤어변형 · 결정사).

          업종 칩 일곱(전체 · 웨딩홀 · …)이 여기 서 있었다(루트 시안 16a). 피그마가
          그 자리를 드롭다운 칩으로 바꿨고 업종은 필터 시트의 첫 그룹으로 갔다.
        */}
        <View style={[styles.filterRow, { backgroundColor: theme.background }]}>
          <DropdownChip
            label={filters.category ? VENDOR_CATEGORY_LABEL[filters.category] : CHIP_CATEGORY}
            active={filters.category !== null}
            onPress={() => setFilterOpen(true)}
          />
          <DropdownChip
            label={filters.region ?? CHIP_REGION}
            active={filters.region !== null}
            onPress={() => setFilterOpen(true)}
          />
          <DropdownChip
            label={budgetLabel ?? CHIP_PRICE}
            active={filters.budget !== null}
            onPress={() => setFilterOpen(true)}
          />
          <View style={styles.sortChip}>
            <DropdownChip
              label={SORT_LABEL[filters.sort]}
              active={false}
              accessibilityLabel={`정렬: ${SORT_LABEL[filters.sort]}`}
              onPress={() => setSortOpen(true)}
            />
          </View>
        </View>

        {/* 결과 수 — 피그마 «7개 업체»(12 · muted). 아래 12. 새로고침 표시가 같은 줄에 붙는다. */}
        <View style={[styles.countRow, { backgroundColor: theme.background }]}>
          {/* 규격서: «12/500 #868B94 · lh 16». */}
          <ThemedText type="f12" themeColor="textAssistive" numeric style={styles.medium}>
            {formatCount(total)}개 업체
          </ThemedText>
          <DelayedLoader active={refreshing} size={20} />
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
          피그마 `Search.tsx` 헤더(2026-09-14 정본 · 최상위 규칙 1). 루트 시안 16a의
          두 줄(«검색» 제목 56 + 검색창 60)은 이 앞에 있었고, 피그마가 그 자리를 이긴다.
          한 덩어리다: 위 12 · 아래 16 · 아래 선 1. 첫 줄은 ← 36 원 + 제목(20/700)과
          부제(13 · muted), 12 아래에 검색창(48 · radius 16 · 회색 면)과 필터 단추(48 정사각).

          제목은 피그마의 «업체 탐색»이 아니라 «업체 검색»이다 — «탐색»은 금지어(CLAUDE.md 용어).
          ←는 언제나 선다: 검색은 탭에서 내려왔고(2026-09-14) 홈의 검색바로 들어오므로 돌아갈
          곳이 있다. 뒤로 갈 이력이 없으면(딥링크) 홈으로 간다.
        */}
        <ThemedView style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.headerTitleRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={BACK_LABEL}
              onPress={goBack}
              style={styles.headerBack}>
              <ProductSymbol name="arrowLeft" size={Layout.iconRow} color={theme.text} />
            </Pressable>
            <View style={styles.headerTitleText}>
              {/* 규격서: 제목 «20/700 · lh 28 · ls -0.4px» · 부제 «11/400 #868B94 · lh 17». */}
              <ThemedText type="f20" style={[styles.bold, styles.title]}>
                {TITLE}
              </ThemedText>
              <ThemedText type="f11" themeColor="textAssistive">
                {SUBTITLE}
              </ThemedText>
            </View>
          </View>
          <View style={styles.headerSearchRow}>
            {renderSearchBox()}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={activeFilterCount > 0 ? `필터 ${formatCount(activeFilterCount)}개 적용됨` : '필터'}
              onPress={() => setFilterOpen(true)}
              style={[styles.headerFilterBtn, { backgroundColor: theme.backgroundElement }]}>
              <FilterIcon color={theme.text} />
            </Pressable>
          </View>
          {/* 지도 보기는 여기 없다(2026-09-08) — 위치는 업체 상세에서만 보인다. */}
        </ThemedView>

        {/* ── 본문 ── */}
        {renderResults()}

        <Toast message={toast} onHidden={() => setToast(null)} />

        {/* 결과 머리 ⓘ가 여는 설명 시트 — WP-SHT-014. */}

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
            category: filters.category,
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
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * 검색바 옆 필터 버튼 아이콘 — 2026-09-14 대표 지시(피그마 채택). 길이가 줄어드는
 * 가로줄 셋으로 "거르기"를 뜻하는 통상적인 필터 기호다. `ProductSymbol`에 없는
 * 아이콘이라 이 화면에 로컬로 둔다. 크기는 피그마 `SlidersHorizontal w-4 h-4` = 16.
 */
function FilterIcon({ color }: { color: string }) {
  return (
    <Svg width={Layout.iconField} height={Layout.iconField} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M7 12h10M10 17h4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
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
 * radius 18 · 안쪽 8) · 오른쪽 정보 안쪽 14(`p-3.5`). 위 줄은 업종 라벨 + 이름(14/700)과
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
          radius={Radius.thumb}
        />
        {badge ? (
          /* 피그마 badge: 열 기준 left/top 14 · pill · 잉크 채움 · 흰 글자 · padding 8/2. */
          <View style={[styles.cardBadge, { backgroundColor: theme.text }]}>
            <ThemedText type="micro" style={[styles.bold, { color: theme.onInk }]}>
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
 * 결과 위 칩 «라벨 ▾» — 피그마 `Search.tsx` 칩 줄(2026-09-14 정본). 36 · 좌우 14 ·
 * radius 999 · 테두리 1 · 14/700 · 꺾쇠 14(반투명 .5). 조건이 걸리면 잉크 채움 · 흰 글자.
 * 누르면 시트가 열린다 — 피그마의 인라인 드롭다운 대신 우리 정렬 시트(최상위 규칙 5:
 * 바텀시트는 기존 정본 그대로).
 */
function DropdownChip({
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
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
      {/* 규격서: 칩 «14/600 · lh 20». */}
      <ThemedText type="f14" numberOfLines={1} style={[styles.semibold, { color }]}>
        {label}
      </ThemedText>
      <View style={styles.dropChevron}>
        <ProductSymbol name="chevronDown" size={Layout.iconSmall} color={color} />
      </View>
    </Pressable>
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

  // ── 헤더 — 피그마 `Search.tsx`(2026-09-14 정본) ──
  /* 규격서 search.txt 「div 430×134 pad 12 20 16 20」 — 위 12 · 좌우 20(pageX) · 아래 16 · 아래 선 1. */
  header: {
    paddingTop: Layout.inlineGap,
    paddingBottom: Spacing.three,
    paddingHorizontal: Layout.pageX,
    borderBottomWidth: Border.hairline,
  },
  /* `mb-3 flex items-center gap-2` — ← 와 제목 사이 8, 아래 12. */
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Layout.inlineGap,
  },
  headerTitleText: {
    flex: 1,
    minWidth: 0,
  },
  /* ← `h-9 w-9 rounded-full` — 36 원. */
  headerBack: {
    width: Layout.headerBack,
    height: Layout.headerBack,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 검색창과 필터 단추 `flex gap-2`. */
  headerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  /* 규격서 제목 «lh 28 · ls -0.4px». */
  title: {
    lineHeight: LineHeight.lh28,
    letterSpacing: LetterSpacing.n04,
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

  // ── 결과 — 피그마 `Search.tsx`(2026-09-14 정본) ──
  /* 칩 줄 `flex items-center gap-2 px-5 pt-3 pb-2` — 위 12 · 아래 8 · 칩 사이 8. 넘치면 줄을 바꾼다. */
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Layout.pageX,
    paddingTop: Layout.inlineGap,
    paddingBottom: Spacing.two,
  },
  /* 정렬 칩 `ml-auto` — 오른쪽 끝에 붙는다. */
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
  /* 결과 수 `mb-3 px-5` — 아래 12. 새로고침 표시가 같은 줄에 붙는다, 사이 4. */
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Layout.pageX,
    marginBottom: Layout.inlineGap,
  },
  /* 목록 `px-5 space-y-3` + 바깥 `pb-4` — 카드 사이 12 · 아래 16. */
  resultList: {
    paddingHorizontal: Layout.pageX,
    paddingBottom: Spacing.three,
    gap: Layout.inlineGap,
  },

  /* 규격서 「div 390×137 … bg #FFFFFF · r16 · border 1 #000000 6% · shadow」 — radius 16 · 테두리 1 · shadow-sm. */
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
