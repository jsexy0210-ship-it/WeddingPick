import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 최근 검색어 저장소. 검색 결과 화면(`search/index.tsx`)의 자동완성 패널(WP-SRCH-004)이
 * 쓴다.
 *
 * **독립 자동완성 페이지(`search/autocomplete.tsx`)는 2026-09-23에 지웠다** — v3.29
 * WP-SRCH-004는 자동완성을 검색 Root 화면 위에 겹쳐 그린다(자체 뒤로가기 헤더가 있는
 * 별도 화면이 아니다). 그 화면은 실제로 아무 곳에서도 `router.push`되지 않는 죽은
 * 라우트였고, 이 저장소를 자기만의 로컬 함수로 다시 구현해 들고 있었다(같은 키를
 * 쓰지만 별도 구현). 검색 Root 하나만 이 저장소를 쓴다.
 */
const STORAGE_KEY = 'weddingpick.recent_searches';
const MAX_RECENT = 8;

export async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function persist(list: string[]): Promise<void> {
  try {
    if (list.length === 0) await AsyncStorage.removeItem(STORAGE_KEY);
    else await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // 저장 실패는 조용히 무시 — 검색 자체는 막지 않는다.
  }
}

/** 맨 앞에 넣는다. 같은 말은 하나만, 최대 8개. */
export async function addRecentSearch(query: string, prev: string[]): Promise<string[]> {
  const next = [query, ...prev.filter((q) => q !== query)].slice(0, MAX_RECENT);
  await persist(next);
  return next;
}

/** 칩의 X — 그 하나만 지운다. */
export async function removeRecentSearch(query: string, prev: string[]): Promise<string[]> {
  const next = prev.filter((q) => q !== query);
  await persist(next);
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await persist([]);
}
