import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 최근 검색어 저장소. 검색 홈(WP-SRCH-001)이 쓴다.
 *
 * 자동완성 화면(`search/autocomplete.tsx`)과 **같은 키**를 쓴다 — 두 화면이 서로
 * 다른 목록을 들고 있으면 한쪽에서 지운 검색어가 다른 쪽에 남는다.
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
