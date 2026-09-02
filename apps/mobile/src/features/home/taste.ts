import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 취향. 홈 C-1 시안 1 — 사진 넉 장으로 «어떤 결혼식을 원하세요?»를 받는 자리.
 *
 * **서버에 아직 자리가 없다.** 계약(`@weddingpick/api-contract`)에도 도메인에도
 * 취향이라는 개념이 없어서, 지금은 기기에 저장한다. 홈 순서(`sections.ts`)와 같은
 * 방식이고 같은 대가를 진다 — **새 기기에서는 다시 묻는다.**
 *
 * 그래도 화면을 비워두지 않는 이유는, 취향이 없는 사람에게 개인화 추천을 띄우면
 * 앱이 아는 척을 하기 때문이다. 고른 값이 기기에만 있어도 «무엇을 골랐는지»는
 * 사실이고, 그 사실만으로 홈이 다음 얼굴로 넘어갈 수 있다.
 *
 * TODO: 서버에 취향이 생기면 이 모듈은 그 API를 부르는 자리로 바뀐다. 화면은
 * `loadTaste`/`saveTaste` 두 함수만 알고 있어서 저장 위치가 바뀌어도 그대로다.
 */

const STORAGE_KEY = 'weddingpick.taste.v1';

/**
 * 고를 수 있는 취향.
 *
 * 사진으로 고르는 자리라 말은 짧다. 시안이 정한 넷을 그대로 쓴다 — 여기서 항목을
 * 늘리려면 사진이 먼저 있어야 한다.
 */
export const TASTES = ['white', 'daylight', 'flower', 'classic'] as const;

export type Taste = (typeof TASTES)[number];

export const TASTE_LABEL: Record<Taste, string> = {
  white: '깔끔한 화이트',
  daylight: '야외 자연광',
  flower: '플라워 아치',
  classic: '클래식 호텔',
};

function isTaste(value: string): value is Taste {
  return (TASTES as readonly string[]).includes(value);
}

/** 저장된 것 중 모르는 값은 버린다. 항목이 바뀌어도 화면이 빈 칸을 그리지 않게. */
export function reconcileTaste(stored: readonly string[] | null): readonly Taste[] {
  return (stored ?? []).filter(isTaste);
}

/** 하나라도 골랐는가. 홈이 취향 고르기를 계속 띄울지 이 값으로 정한다. */
export function hasTaste(chosen: readonly Taste[]): boolean {
  return chosen.length > 0;
}

/** 눌렀던 것을 다시 누르면 빠진다. 한 번 고르면 못 무르는 화면을 만들지 않는다. */
export function toggleTaste(chosen: readonly Taste[], taste: Taste): readonly Taste[] {
  return chosen.includes(taste)
    ? chosen.filter((row) => row !== taste)
    : [...chosen, taste];
}

export async function loadTaste(): Promise<readonly Taste[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    return reconcileTaste(raw === null ? null : (JSON.parse(raw) as string[]));
  } catch {
    // 못 읽거나 망가졌으면 안 고른 것으로 본다. 홈이 안 뜨는 것보다 낫다.
    return [];
  }
}

export async function saveTaste(chosen: readonly Taste[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(chosen));
}
