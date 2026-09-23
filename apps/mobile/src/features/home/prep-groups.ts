import { PREPARATION_GROUPS, type PreparationGroupKey, type VendorCategory } from '@weddingpick/domain';
import type { CategoryIconKind } from '@weddingpick/ui';

import strings from '../../../../../spec/strings.ko.json';
import type { CategoryStatus } from './state';

const S = strings.home;

/**
 * 홈 「내 웨딩 준비」 4칸.
 *
 * 정본: `docs/design/html/대메뉴_홈(로그인, 온보딩).dc.html` WP-HOME-001~003 §11 `prep`·
 * `prepEmpty`·`prepPartial`. 항상 4칸이고(끝낸 것도 빠지지 않는다), 칸마다 상태가
 * 미정(todo) · 상담예약 완료(picking) · 계약 완료(contracted) 셋 중 하나다.
 *
 * 그룹 키(start · sdm · ceremony · goods)는 `packages/domain`의
 * `PREPARATION_GROUPS`(온보딩 3/5가 이미 쓰는 4그룹)를 그대로 따른다. 카드 라벨은
 * .dc.html 문구 그대로 다시 단다(온보딩은 「시작 준비」, 홈은 「웨딩홀」 — 화면마다
 * 다른 문구를 쓰는 것이지 지어낸 것이 아니다).
 *
 * DESIGN_UNRESOLVED → 확인 후 반영: 「웨딩홀」 카드의 업종 구성만은 `PREPARATION_GROUPS.start`
 * (결정사+웨딩홀)를 그대로 쓰지 않고 **hall 하나**로 좁혔다. 그대로 두면 결정사를
 * 고르지 않는 한(v3.29 PROJECT_RULES.md — 「결정사·플래너 대행 개념을 업종이나
 * 기능으로 넣지 않는다」라 실제로 거의 안 고른다) 웨딩홀 카드가 «계약 완료» 상태에
 * 영원히 못 이르는 버그가 된다. `대메뉴_Pick.dc.html`의 `cat-웨딩홀` 그룹 예시
 * 데이터도 hall 업체만 담고 있어(결정사 없음) 같은 결론을 가리킨다. 근거 둘이 같은
 * 방향이라 hall 단독으로 구현했다 — 대표님이 결정사를 포함하라고 하시면 되돌린다.
 */
export type HomePrepGroupKey = PreparationGroupKey;

/** .dc.html WP-HOME-001 `prep` 카드 문구 그대로. */
export const HOME_PREP_GROUP_LABEL: Record<HomePrepGroupKey, string> = {
  start: '웨딩홀',
  sdm: '스드메',
  ceremony: '본식',
  goods: '예물 · 신혼',
};

/**
 * 그룹당 실제로 세는 업종. `PREPARATION_GROUPS`에서 그대로 가져오되 `start`만
 * `wedding_info_company`(결정사)를 뺀다 — 위 DESIGN_UNRESOLVED 참고.
 */
const HOME_PREP_GROUP_CATEGORIES: Record<HomePrepGroupKey, readonly VendorCategory[]> =
  Object.fromEntries(
    PREPARATION_GROUPS.map((group) => [
      group.key,
      group.key === 'start'
        ? group.categories.filter((category) => category !== 'wedding_info_company')
        : group.categories,
    ])
  ) as Record<HomePrepGroupKey, readonly VendorCategory[]>;

/**
 * .dc.html은 Material Symbols Outlined(`storefront`·`face_retouching_natural`·
 * `dry_cleaning`·`diamond`)를 쓴다. CLAUDE.md CHANGELOG가 「구현 시 교체 가능」이라
 * 적어 둔 자리라, 새 폰트를 들이는 대신 앱이 이미 쓰는 `CategoryIcon`(12업종 선
 * 아이콘)에서 그룹의 대표 업종 아이콘을 고른다.
 */
export const HOME_PREP_GROUP_ICON: Record<HomePrepGroupKey, CategoryIconKind> = {
  start: 'hall',
  sdm: 'studio',
  ceremony: 'snap',
  goods: 'ring',
};

export type HomePrepState = 'todo' | 'picking' | 'contracted';

export type HomePrepCard = {
  key: HomePrepGroupKey;
  label: string;
  icon: CategoryIconKind;
  state: HomePrepState;
  detail: string;
  /** 카드를 누르면 열 업종 — 그룹 안에서 아직 안 끝난 첫 업종, 다 끝났으면 그룹의 첫 업종. */
  targetCategory: VendorCategory;
  pickCount: number;
};

const PICKING_DETAIL = S['myPrep.picking'];
const TODO_DETAIL = S['myPrep.todo'];
const CONTRACTED_DETAIL = S['myPrep.contracted'];

/** 「웨딩홀」 카드만 계약 완료 상세에 업체 이름을 덧붙인다 — .dc.html WP-HOME-001 예시가 그렇다. */
function contractedDetail(key: HomePrepGroupKey, venueName: string | null): string {
  if (key === 'start' && venueName !== null) return `${CONTRACTED_DETAIL} · ${venueName}`;
  return CONTRACTED_DETAIL;
}

export function homePrepCards(input: {
  statuses: readonly CategoryStatus[];
  venueName: string | null;
}): HomePrepCard[] {
  const { statuses, venueName } = input;
  const byCategory = new Map(statuses.map((row) => [row.category, row]));

  return PREPARATION_GROUPS.map((group) => {
    const categories = HOME_PREP_GROUP_CATEGORIES[group.key];
    const rows = categories
      .map((category) => byCategory.get(category))
      .filter((row): row is CategoryStatus => row !== undefined);

    const allDecided = rows.length > 0 && rows.every((row) => row.state === 'decided');
    const anyStarted = rows.some((row) => row.state !== 'before' || row.pickCount > 0);
    const state: HomePrepState = allDecided ? 'contracted' : anyStarted ? 'picking' : 'todo';

    const openRow = rows.find((row) => row.state !== 'decided') ?? rows[0];
    const targetCategory = openRow?.category ?? categories[0]!;
    /*
     * 카드를 눌렀을 때 `/pick/{category}` vs `/pick?section=recommendations&category=`
     * 를 가르는 값 — 그룹 합계가 아니라 **실제로 열릴 업종**(targetCategory)의 담아둔
     * 수다. 합계를 쓰면 그룹 안 다른 업종에 후보가 있다는 이유로 target에 후보가
     * 있는 것처럼 잘못 안내한다.
     */
    const pickCount = openRow?.pickCount ?? 0;

    return {
      key: group.key,
      label: HOME_PREP_GROUP_LABEL[group.key],
      icon: HOME_PREP_GROUP_ICON[group.key],
      state,
      detail:
        state === 'contracted'
          ? contractedDetail(group.key, venueName)
          : state === 'picking'
            ? PICKING_DETAIL
            : TODO_DETAIL,
      targetCategory,
      pickCount,
    };
  });
}

const ALL_DONE_SUB = S['pending.done'];
const ALL_TODO_SUB = S['myPrep.allTodo'];

/**
 * 섹션 서브카피 — .dc.html 세 화면이 각각 「아직 정한 게 없어요」(WP-HOME-002) ·
 * 「지금은 웨딩홀 차례예요」(WP-HOME-003) · 「지금은 스튜디오 차례예요」(WP-HOME-001)를
 * 쓴다. 뒤 둘은 **12업종 중 지금 좁힐 업종**(`currentLabel`)을 가리키지, 4칸 그룹
 * 라벨이 아니다(웨딩홀은 우연히 그룹 라벨과 같다).
 */
export function homePrepSectionSub(input: {
  cards: readonly HomePrepCard[];
  currentLabel: string | null;
}): string {
  if (input.cards.every((card) => card.state === 'contracted')) return ALL_DONE_SUB;
  if (input.cards.every((card) => card.state === 'todo')) return ALL_TODO_SUB;

  return input.currentLabel === null
    ? ALL_TODO_SUB
    : S['myPrep.current'].replace('{category}', input.currentLabel);
}
