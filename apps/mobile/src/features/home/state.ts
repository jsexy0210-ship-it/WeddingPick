import type { CandidateListResponse, CurrentUser, VendorSummary } from '@weddingpick/api-contract';
import {
  BUDGET_BRACKET_LABEL,
  MIN_COMPARABLE,
  PREPARATION_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  WEDDING_STYLE_LABEL,
  withSubject,
  type PreparationState,
  type VendorCategory,
} from '@weddingpick/domain';

/**
 * 홈이 지금 어떤 얼굴인가. 핸드오프 v3.22 SPEC §13.8 · `03-home-states.dc.html`.
 *
 * 상태를 나열하지 않고 **2층**으로 정의한다.
 *
 *   1층  진행 상황   0개 · 1~8개 · 9개 이상     화면 골격을 정한다
 *   2층  정보량      3건 이상 · 3건 미만        금액 표기와 CTA만 바꾼다
 *
 * 두 축을 같은 층위로 나열하면 3 × 4 = 12가지가 되고 아무도 다 만들지 못한다.
 * 이전의 «홈 C-1 6상태»(taste / empty / picking / decided)는 폐기했다 — 회원 축과
 * 정보 축을 같은 층위로 나열한 구조였다.
 */

/* ------------------------------------------------------------ 1층 · 진행 상황 */

/** 정한 업종 수로 갈리는 세 구간. 0개 → start · 1~8개 → going · 9개 이상 → finishing. */
export type HomeTier = 'start' | 'going' | 'finishing';

/** 9개 이상부터 마무리 구간. SPEC §13.8 1층 표. */
export const FINISHING_FROM = 9;

/**
 * 홈이 세는 업종. 12개다.
 *
 * `PREPARATION_CATEGORIES`와 같은 집합이되 **순서만 다르다** — 핸드오프(SPEC §13.8 ·
 * 시안 1)는 시작 전 사용자에게 «웨딩홀부터 정해볼까요?»라 말하고 격자도 웨딩홀 ·
 * 스튜디오 · 드레스 · 메이크업으로 연다. 결정사는 결혼을 정하기 전의 일이라 준비
 * 순서의 맨 뒤로 보낸다. 개수는 그대로 12다.
 */
export const HOME_CATEGORIES: readonly VendorCategory[] = [
  ...PREPARATION_CATEGORIES.filter((category) => category !== 'wedding_info_company'),
  ...PREPARATION_CATEGORIES.filter((category) => category === 'wedding_info_company'),
];

export const HOME_TOTAL = HOME_CATEGORIES.length;

export type CategoryStatus = {
  category: VendorCategory;
  label: string;
  state: PreparationState;
  /** 담아둔 후보 수. */
  pickCount: number;
  /** 앱에서 정한 업체 이름. 앱 밖에서 정했다고 체크만 한 업종은 null. */
  decidedName: string | null;
};

/**
 * 12업종 각각이 어디까지 왔는가.
 *
 * 후보 목록(`groups`)이 말하는 상태와 준비 현황(온보딩 3/5)에서 «이미 정했다»고
 * 체크한 업종(`preparedCategories`)을 합친다. 뒤쪽은 업체가 없어 `decidedVendorId`가
 * null이고, 후보 목록이 아직 안 왔을 때도(오프라인 등) 그 사실만은 알 수 있다.
 */
export function categoryStatuses(input: {
  candidates: CandidateListResponse | null;
  preparedCategories: readonly string[];
}): CategoryStatus[] {
  const groups = input.candidates?.groups ?? [];

  return HOME_CATEGORIES.map((category) => {
    const group = groups.find((row) => row.category === category) ?? null;
    const prepared = input.preparedCategories.includes(category);
    const state: PreparationState =
      group?.state === 'decided' || prepared ? 'decided' : (group?.state ?? 'before');
    const decidedName =
      state === 'decided' && group !== null
        ? (group.candidates.find((row) => row.vendorId === group.decidedVendorId)?.vendorName ??
          null)
        : null;

    return {
      category,
      label: group?.categoryLabel ?? VENDOR_CATEGORY_LABEL[category],
      state,
      pickCount: group?.candidates.length ?? 0,
      decidedName,
    };
  });
}

export function decidedCount(statuses: readonly CategoryStatus[]): number {
  return statuses.filter((row) => row.state === 'decided').length;
}

export function homeTier(decided: number): HomeTier {
  if (decided === 0) return 'start';
  if (decided >= FINISHING_FROM) return 'finishing';

  return 'going';
}

/**
 * 지금 좁힐 업종 — 히어로가 말하고 격자에서 코랄 테두리를 받는 하나.
 *
 * 서버가 지목한 `nextCategory`(후보를 담다 만 업종이 먼저)를 따르고, 그것이 없거나
 * 이미 정한 것이면 안 정한 것 중 홈 순서의 첫째다. 다 정했으면 null — 없는 다음을
 * 지어내지 않는다.
 */
export function currentCategory(
  statuses: readonly CategoryStatus[],
  serverNext: VendorCategory | null
): VendorCategory | null {
  const open = statuses.filter((row) => row.state !== 'decided');
  /*
   * 아직 아무 데도 담아둔 곳이 없으면(0개 구간) 홈 순서의 첫 업종이다 — SPEC §13.8
   * «웨딩홀부터 정해볼까요?». 서버의 다음 업종은 준비 순서(결정사부터)라 여기서 쓰면
   * 히어로와 준비 현황 4칸이 서로 다른 업종을 가리킨다.
   */
  const picking = statuses.some((row) => row.pickCount > 0);

  if (picking && serverNext !== null && open.some((row) => row.category === serverNext)) {
    return serverNext;
  }

  return open[0]?.category ?? null;
}

/** 현재 업종 **다음**에 올 업종. 같은 업종을 두 번 적지 않는다. */
export function nextCategoryAfter(
  statuses: readonly CategoryStatus[],
  current: VendorCategory | null
): CategoryStatus | null {
  return (
    statuses.find((row) => row.state !== 'decided' && row.category !== current) ?? null
  );
}

/* ---------------------------------------------------------------- 히어로 */

export type HeroCopy = {
  /** 26px 두 줄. 첫째 줄 · 둘째 줄. */
  line1: string;
  line2: string;
};

/** 남은 수를 우리말로. 9개 이상 구간이라 셋 이하다. */
const REMAINING_WORD: Record<number, string> = { 3: '세 개만', 2: '두 개만', 1: '하나만' };

/**
 * 히어로 제목. 시안 1 · 2 · 3의 문장 그대로다.
 *
 *   0개      웨딩홀부터 / 정해볼까요?
 *   1~8개    이번 주엔 / 메이크업 차례예요
 *   9개 이상  세 개만 / 더 정하면 끝나요      12/12면 다 정했어요
 */
export function heroCopy(input: {
  tier: HomeTier;
  currentLabel: string | null;
  decided: number;
}): HeroCopy {
  const label = input.currentLabel ?? VENDOR_CATEGORY_LABEL.hall;

  if (input.tier === 'start') return { line1: `${label}부터`, line2: '정해볼까요?' };
  if (input.tier === 'going') return { line1: '이번 주엔', line2: `${label} 차례예요` };

  const remaining = HOME_TOTAL - input.decided;

  if (remaining <= 0) return { line1: '다 정했어요', line2: '이제 정리만 남았어요' };

  return { line1: REMAINING_WORD[remaining] ?? `${remaining}개만`, line2: '더 정하면 끝나요' };
}

/* ---------------------------------------------------------- 준비 현황 4칸 */

/** 격자는 항상 4칸이다. 12업종을 다 펼치지 않는다. */
export const BOARD_CELLS = 4;

export type BoardTone = 'now' | 'done' | 'going' | 'none';

export type BoardCell = {
  category: VendorCategory;
  /** 라벨은 업종명. */
  label: string;
  /** 값은 상태. 빈 칸이나 «—»를 쓰지 않는다. */
  value: string;
  tone: BoardTone;
};

/**
 * 한 칸의 값 줄. **라벨은 업종명 · 값은 상태**로 축을 통일하고 카운터를 섞지 않는다.
 *
 *   정함              완료
 *   후보를 담는 중     3곳
 *   지목받았는데 빈 칸  먼저
 *   손대지 않음        시작 전
 */
export function boardValue(row: CategoryStatus, isCurrent: boolean): string {
  if (row.state === 'decided') return '완료';
  if (row.pickCount > 0) return `${row.pickCount}곳`;

  return isCurrent ? '먼저' : '시작 전';
}

export function boardTone(row: CategoryStatus, isCurrent: boolean): BoardTone {
  if (isCurrent) return 'now';
  if (row.state === 'decided') return 'done';

  return row.pickCount > 0 ? 'going' : 'none';
}

/**
 * 네 칸에 무엇을 올리는가. SPEC §13.8 1층 표.
 *
 *   0개      순서상 첫 4개 · 첫 칸만 코랄
 *   1~8개    끝낸 것 + 지금 것 섞어 4개 · 홈 순서대로
 *   9개 이상  남은 것 먼저 · 모자라면 완료로 채운다
 */
export function boardCells(input: {
  tier: HomeTier;
  statuses: readonly CategoryStatus[];
  current: VendorCategory | null;
}): BoardCell[] {
  const { statuses, current } = input;
  const toCell = (row: CategoryStatus): BoardCell => {
    const isCurrent = row.category === current;

    return {
      category: row.category,
      label: row.label,
      value: boardValue(row, isCurrent),
      tone: boardTone(row, isCurrent),
    };
  };

  if (input.tier === 'start') return statuses.slice(0, BOARD_CELLS).map(toCell);

  if (input.tier === 'finishing') {
    const now = statuses.filter((row) => row.category === current);
    const rest = statuses.filter((row) => row.state !== 'decided' && row.category !== current);
    const done = statuses.filter((row) => row.state === 'decided').reverse();

    return [...now, ...rest, ...done].slice(0, BOARD_CELLS).map(toCell);
  }

  /*
   * 진행 중 — 끝낸 것과 지금 것을 섞는다. 끝낸 것이 셋을 넘으면 지금 것에 가까운
   * 셋만, 셋이 안 되면 그다음 올 업종으로 채운다. 고른 뒤에는 홈 순서로 다시
   * 세워 시안(완료 · 완료 · 완료 · 지금)처럼 읽히게 한다.
   */
  const now = statuses.filter((row) => row.category === current);
  const done = statuses.filter((row) => row.state === 'decided').slice(-(BOARD_CELLS - 1));
  const upcoming = statuses.filter((row) => row.state !== 'decided' && row.category !== current);
  const chosen = [...done, ...now];

  for (const row of upcoming) {
    if (chosen.length >= BOARD_CELLS) break;
    chosen.push(row);
  }

  return chosen
    .slice(0, BOARD_CELLS)
    .sort((a, b) => HOME_CATEGORIES.indexOf(a.category) - HOME_CATEGORIES.indexOf(b.category))
    .map(toCell);
}

/** 섹션 헤더 오른쪽 링크. 완료 개수는 격자가 아니라 여기에 적는다. */
export function boardMoreLabel(tier: HomeTier, decided: number): string {
  return tier === 'finishing' ? `완료 ${decided}개 · 전체 보기` : '전체 보기';
}

/** 시작 전 구간에서 격자 아래 한 줄. 웨딩홀이 먼저인 이유다. */
export const BOARD_NOTE_START = '웨딩홀이 정해지면 날짜와 예산이 잡혀요';

export function boardNote(tier: HomeTier, current: VendorCategory | null): string | null {
  return tier === 'start' && current === 'hall' ? BOARD_NOTE_START : null;
}

/* ------------------------------------------------------------ 2층 · 정보량 */

/**
 * 추천에 정보가 충분한가 — 대표 업체의 실 제보가 3건 이상이고 견줄 곳이 둘 이상이다.
 *
 * 충분하면 «N곳 비교하기»(코랄), 아니면 «Pick 인증하기»(아웃라인). **섹션 순서와
 * 개수는 바뀌지 않는다** — 금액 텍스트 색과 CTA 두 가지만 달라진다.
 */
export function hasEnoughInfo(recommended: readonly VendorSummary[]): boolean {
  const main = recommended[0];

  return (
    main !== undefined &&
    main.paidPrice.stage !== 'collecting' &&
    recommended.length >= MIN_COMPARABLE
  );
}

export type HomeCta =
  | { kind: 'compare'; label: string; ids: string[] }
  | { kind: 'proof'; label: string };

export function homeCta(recommended: readonly VendorSummary[]): HomeCta {
  if (hasEnoughInfo(recommended)) {
    return {
      kind: 'compare',
      label: `${recommended.length}곳 비교하기`,
      ids: recommended.map((vendor) => vendor.id),
    };
  }

  return { kind: 'proof', label: 'Pick 인증하기' };
}

/* -------------------------------------------------------------- 조건 칩 */

export type ConditionChip = {
  kind: 'region' | 'budget' | 'style' | 'date';
  label: string;
  /** 날짜 칩은 흐리게. 추천 조건이 아니라 참고다. */
  dim: boolean;
};

/** «5월 12일». 칩 안에 들어갈 짧은 날짜. */
export function dateChipLabel(date: string): string {
  const [, month, day] = date.split('-').map(Number);

  return `${month}월 ${day}일`;
}

/**
 * 웨딩픽 추천 라벨 아래 조건 칩. 온보딩에서 받은 값을 그대로 보인다 — 무엇을
 * 기준으로 골랐는지 보여야 추천을 믿는다. 없는 조건은 칩을 만들지 않는다.
 */
export function conditionChips(me: CurrentUser | null): ConditionChip[] {
  if (me === null) return [];

  const chips: ConditionChip[] = [];

  if (me.region !== null) chips.push({ kind: 'region', label: me.region, dim: false });
  if (me.budgetBracket !== null && me.budgetBracket !== 'unknown') {
    chips.push({ kind: 'budget', label: BUDGET_BRACKET_LABEL[me.budgetBracket], dim: false });
  }
  for (const style of me.styleTags) {
    chips.push({ kind: 'style', label: WEDDING_STYLE_LABEL[style], dim: false });
  }
  if (me.weddingDate !== null) {
    chips.push({ kind: 'date', label: dateChipLabel(me.weddingDate), dim: true });
  }

  return chips;
}

/* -------------------------------------------------------------- 다음 준비 */

export type NextStep = {
  /** 섹션 제목. */
  title: string;
  name: string;
  meta: string;
  /** 오른쪽 짧은 표시. «D-60» · «대기» · «인증». */
  aside: string;
  /** 누르면 어디로. */
  target: { kind: 'pick'; category: VendorCategory } | { kind: 'capture' };
};

/**
 * 다음 준비 자리. 구간마다 말하는 것이 다르다.
 *
 *   0개      그다음은 / 스튜디오 정하기 / 웨딩홀이 정해지면 알려드려요 / 대기
 *   1~8개    다음 준비 / 본식스냅 정하기 / 상태 / D-60
 *   9개 이상  정리하면 좋은 것 / Pick 인증 3건 남았어요 / 금액이 확인되면 … / 인증
 *
 * 마지막 구간은 새 업체를 들이밀지 않는다 — 다음 준비 자리를 Pick 인증으로 바꾼다.
 * 남은 인증 건수는 업종별 인증 여부를 계약이 싣지 않아 정한 업종 수로 센다.
 */
export function nextStep(input: {
  tier: HomeTier;
  statuses: readonly CategoryStatus[];
  current: VendorCategory | null;
  daysLeft: number | null;
}): NextStep | null {
  if (input.tier === 'finishing') {
    const proofs = decidedCount(input.statuses);

    return {
      title: '정리하면 좋은 것',
      name: `Pick 인증 ${proofs}건 남았어요`,
      meta: '금액이 확인되면 다음 커플에게 도움이 돼요',
      aside: '인증',
      target: { kind: 'capture' },
    };
  }

  const next = nextCategoryAfter(input.statuses, input.current);

  if (next === null) return null;

  if (input.tier === 'start') {
    const currentLabel =
      input.current === null ? VENDOR_CATEGORY_LABEL.hall : VENDOR_CATEGORY_LABEL[input.current];

    return {
      title: '그다음은',
      name: `${next.label} 정하기`,
      meta: `${withSubject(currentLabel)} 정해지면 알려드려요`,
      aside: '대기',
      target: { kind: 'pick', category: next.category },
    };
  }

  return {
    title: '다음 준비',
    name: `${next.label} 정하기`,
    meta: next.pickCount > 0 ? `후보 ${next.pickCount}곳` : '시작 전',
    aside: input.daysLeft === null ? '예식일 미정' : `D-${input.daysLeft}`,
    target: { kind: 'pick', category: next.category },
  };
}

/* ------------------------------------------------------------------ 종합 */

export type HomeView = {
  tier: HomeTier;
  statuses: CategoryStatus[];
  decided: number;
  current: VendorCategory | null;
  currentLabel: string | null;
  hero: HeroCopy;
  /** 진행바 0~1. */
  progress: number;
  progressText: string;
  cells: BoardCell[];
  boardMore: string;
  boardNote: string | null;
  chips: ConditionChip[];
  cta: HomeCta;
  next: NextStep | null;
};

export function homeView(input: {
  me: CurrentUser | null;
  candidates: CandidateListResponse | null;
  recommended: readonly VendorSummary[];
  daysLeft: number | null;
}): HomeView {
  const statuses = categoryStatuses({
    candidates: input.candidates,
    preparedCategories: input.me?.preparedCategories ?? [],
  });
  const decided = decidedCount(statuses);
  const tier = homeTier(decided);
  const current = currentCategory(statuses, input.candidates?.nextCategory ?? null);
  const currentLabel =
    current === null ? null : (statuses.find((row) => row.category === current)?.label ?? null);

  return {
    tier,
    statuses,
    decided,
    current,
    currentLabel,
    hero: heroCopy({ tier, currentLabel, decided }),
    progress: decided / HOME_TOTAL,
    progressText: `${decided} / ${HOME_TOTAL}`,
    cells: boardCells({ tier, statuses, current }),
    boardMore: boardMoreLabel(tier, decided),
    boardNote: boardNote(tier, current),
    chips: conditionChips(input.me),
    cta: homeCta(input.recommended),
    next: nextStep({ tier, statuses, current, daysLeft: input.daysLeft }),
  };
}
