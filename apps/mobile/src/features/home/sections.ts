import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 홈 섹션의 순서와 숨김. 디자인 핸드오프 5·6번.
 *
 * **D-Day와 다음 일정은 여기 없다.** 핸드오프가 그 둘을 고정으로 못박았다 —
 * 오늘 무엇을 해야 하는지가 홈의 이유이고, 숨길 수 있게 두면 홈이 빈 화면이 될 수 있다.
 *
 * 기기에 저장한다. 서버에 두면 홈이 뜰 때마다 한 번 더 기다려야 하는데, 이건
 * 보기 좋으라고 바꾸는 값이지 잃으면 큰일 나는 값이 아니다. **새 기기에서는 기본
 * 순서로 돌아간다** — 그 대가를 알고 고른 것이다.
 */

const STORAGE_KEY = 'weddingpick.homeLayout.v1';

export const HOME_SECTIONS = ['quickMenu', 'tasks', 'expenses', 'candidates', 'unlock'] as const;

export type HomeSection = (typeof HOME_SECTIONS)[number];

export const HOME_SECTION_LABEL: Record<HomeSection, string> = {
  quickMenu: '퀵메뉴',
  tasks: '웨딩 스케줄',
  expenses: '지출 현황',
  candidates: '관심업체',
  unlock: '결제 데이터 안내',
};

export type HomeLayout = {
  order: readonly HomeSection[];
  hidden: Readonly<Record<string, boolean>>;
};

export const DEFAULT_LAYOUT: HomeLayout = { order: HOME_SECTIONS, hidden: {} };

function isSection(value: string): value is HomeSection {
  return (HOME_SECTIONS as readonly string[]).includes(value);
}

/**
 * 저장된 순서를 읽되 **목록에 없는 것은 버리고 빠진 것은 뒤에 붙인다.**
 *
 * 섹션이 늘거나 줄면 저장된 순서가 낡는다. 그대로 쓰면 새 섹션이 영영 안 보이거나
 * 없어진 섹션 자리가 빈칸으로 남는다.
 */
export function reconcile(stored: Partial<HomeLayout> | null): HomeLayout {
  const known = (stored?.order ?? []).filter(isSection);
  const missing = HOME_SECTIONS.filter((section) => !known.includes(section));

  return { order: [...known, ...missing], hidden: stored?.hidden ?? {} };
}

export async function loadHomeLayout(): Promise<HomeLayout> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    return reconcile(raw === null ? null : (JSON.parse(raw) as Partial<HomeLayout>));
  } catch {
    // 못 읽거나 망가졌으면 기본 순서로 돈다. 홈이 안 뜨는 것보다 낫다.
    return DEFAULT_LAYOUT;
  }
}

export async function saveHomeLayout(layout: HomeLayout): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function isVisible(layout: HomeLayout, section: HomeSection): boolean {
  return layout.hidden[section] !== true;
}

export function toggle(layout: HomeLayout, section: HomeSection): HomeLayout {
  return { ...layout, hidden: { ...layout.hidden, [section]: !layout.hidden[section] } };
}

/**
 * 한 칸 올리고 내린다.
 *
 * 핸드오프는 **끌어서** 옮기라고 적었다. 끌기를 제대로 하려면 라이브러리가
 * 필요한데 지금 넣을 수 없어(네트워크가 막혀 있다) 단추로 옮긴다. 하는 일은
 * 같고, 스크린 리더로도 쓸 수 있다는 점은 오히려 낫다.
 */
export function move(layout: HomeLayout, section: HomeSection, delta: number): HomeLayout {
  const order = [...layout.order];
  const from = order.indexOf(section);
  const to = from + delta;

  if (from < 0 || to < 0 || to >= order.length) {
    return layout;
  }

  order.splice(to, 0, ...order.splice(from, 1));

  return { ...layout, order };
}
