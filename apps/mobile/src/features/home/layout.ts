import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 홈에 무엇을 어떤 순서로 보여줄지. 홈 편집(WP-HOME-007)이 고치고 홈이 읽는다.
 *
 * **기기에 둔다.** 미션 축하와 같은 이유다 — 잃어도 큰일이 아니고, 서버에 두면 홈이
 * 뜰 때마다 한 번 더 기다린다. 기기를 바꾸면 기본 순서로 돌아간다.
 *
 * **숨겨도 기록은 지우지 않는다**(시안 규칙). 여기 저장하는 것은 「보여줄지」와
 * 「어느 자리에」뿐이고, 준비 현황·제보·후보는 서버에 그대로 남는다. 다시 켜면
 * 켜기 전 그대로 보인다.
 */

/** 히어로 밑에 오는, 자리를 옮길 수 있는 섹션들. 히어로는 여기 없다 — 늘 맨 위 고정이다. */
export type HomeSectionKey = 'board' | 'recommendation' | 'next' | 'content';

/**
 * 시안 WP-HOME-007의 「순서 바꾸기」 목록.
 *
 * 시안에는 다섯 행(준비 현황 · 웨딩픽 추천 · 다음 준비 · 웨딩 소식 · 혜택)이 있지만,
 * 그 목록은 홈이 «TOP3 전체보기 · 우리가 쓴 돈 · 개인화 웨딩피드 · 혜택 한 줄»이던
 * 시절(00-ia WP-HOME-001)의 것이다. v3.22가 홈을 히어로 → 준비 현황 → 웨딩픽 추천 →
 * 다음 준비 → 웨딩 정보로 정리하면서 «혜택»은 홈에서 빠지고 «웨딩 소식»은 «웨딩 정보»가
 * 됐다(03-home-states · SPEC §13.8). 최신 쪽을 따라 네 행으로 둔다.
 */
export const HOME_SECTIONS: readonly { key: HomeSectionKey; label: string }[] = [
  { key: 'board', label: '준비 현황' },
  { key: 'recommendation', label: '웨딩픽 추천' },
  { key: 'next', label: '다음 준비' },
  { key: 'content', label: '웨딩 정보' },
] as const;

/** 「항상 보여요」 한 행. 히어로는 끄지도 옮기지도 못한다 — 홈에서 가장 먼저 찾는 값이다. */
export const HOME_FIXED_LABEL = 'D-day와 진행률';

export type HomeLayout = {
  /** 위에서 아래 순서. HOME_SECTIONS의 키가 한 번씩 들어간다. */
  readonly order: readonly HomeSectionKey[];
  /** 숨긴 섹션. 순서에서 빼지 않는다 — 다시 켜면 있던 자리로 돌아온다. */
  readonly hidden: readonly HomeSectionKey[];
};

export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  order: HOME_SECTIONS.map((section) => section.key),
  hidden: [],
};

const STORAGE_KEY = 'weddingpick.homeLayout.v1';

/**
 * 저장된 것과 현재 섹션 목록을 맞춘다.
 *
 * 앱이 올라가면서 섹션이 생기거나 없어진다. 저장된 순서를 그대로 믿으면 새 섹션이
 * 영영 안 보이거나 없어진 키가 남는다. 그래서 **아는 키만 저장 순서대로 앞에 놓고,
 * 처음 보는 키는 기본 순서 자리에 이어 붙인다.**
 */
export function normalizeHomeLayout(stored: Partial<HomeLayout> | null | undefined): HomeLayout {
  const known = new Set<HomeSectionKey>(HOME_SECTIONS.map((section) => section.key));
  const seen = new Set<HomeSectionKey>();
  const order: HomeSectionKey[] = [];

  for (const key of stored?.order ?? []) {
    if (known.has(key) && !seen.has(key)) {
      seen.add(key);
      order.push(key);
    }
  }
  for (const section of HOME_SECTIONS) {
    if (!seen.has(section.key)) order.push(section.key);
  }

  const hidden = (stored?.hidden ?? []).filter((key) => known.has(key));
  return { order, hidden: [...new Set(hidden)] };
}

/** 보여줄 섹션만, 정한 순서대로. 홈은 이 배열만 보고 그린다. */
export function visibleHomeSections(layout: HomeLayout): readonly HomeSectionKey[] {
  return layout.order.filter((key) => !layout.hidden.includes(key));
}

/** 한 칸 옮긴 새 순서. 범위를 벗어나면 그대로 돌려준다 — 드래그가 목록 밖으로 나갈 수 있다. */
export function moveSection(
  order: readonly HomeSectionKey[],
  from: number,
  to: number,
): readonly HomeSectionKey[] {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order;

  const next = [...order];
  const [moved] = next.splice(from, 1);

  next.splice(to, 0, moved);
  return next;
}

/**
 * 저장된 홈 구성. **못 읽으면 기본값이다** — 저장소가 막힌 기기에서 홈이 비는 것보다
 * 편집을 못 하는 쪽이 낫다.
 */
export async function readHomeLayout(): Promise<HomeLayout> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    return normalizeHomeLayout(raw === null ? null : (JSON.parse(raw) as Partial<HomeLayout>));
  } catch {
    return DEFAULT_HOME_LAYOUT;
  }
}

export async function writeHomeLayout(layout: HomeLayout): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // 못 써도 화면은 닫힌다. 다음에 열면 이전 구성이 보인다.
  }
}
