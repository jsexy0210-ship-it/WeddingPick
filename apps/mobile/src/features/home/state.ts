import type { CandidateListResponse, CurrentUser, VendorSummary } from '@weddingpick/api-contract';
import { MIN_COMPARABLE, type VendorCategory } from '@weddingpick/domain';

/**
 * 홈이 지금 어떤 얼굴인가. 디자인 확정본 `웨딩픽 홈 C-1 상태`.
 *
 * 시안은 여섯 장이지만 **레이아웃은 다섯 가지다.** 시안 3(후보는 있는데 확인된
 * 정보가 없음)은 다른 레이아웃이 아니라 시안 4에서 추천 영역의 행동만 바뀐
 * 것이다 — 그래서 여기서는 레이아웃 다섯에 `comparable` 한 값을 곁들여 여섯 장을
 * 전부 되살린다. 상태를 여섯으로 두면 «정보가 없다»는 사실이 레이아웃 이름 안에
 * 숨고, 결정을 내린 사람에게 정보가 없는 경우처럼 둘이 겹치는 자리에서 어느 쪽
 * 이름을 붙일지 매번 다투게 된다.
 *
 * | 시안 | state | comparable |
 * | --- | --- | --- |
 * | 0 비회원 · 정보 없음 | `guest` | — |
 * | 1 취향도 후보도 없음 | `taste` | — |
 * | 2 취향은 있고 후보가 없음 | `empty` | true |
 * | 3 후보는 있고 확인된 정보가 없음 | `picking` | **false** |
 * | 4 Pick 중 · 기본 | `picking` | true |
 * | 5 결정 이후 | `decided` | true |
 */

export const HOME_STATES = ['guest', 'taste', 'empty', 'picking', 'decided'] as const;

export type HomeState = (typeof HOME_STATES)[number];

export type HomeView = {
  state: HomeState;
  /**
   * 현황판을 격자로 펼치는가.
   *
   * **빈 칸 네 개를 그대로 보여주지 않는다**(시안이 명시한 규칙). 정할 것이
   * 하나도 없으면 격자를 접고 «우리 준비 · 아직 시작 전» 한 줄로 대신한다.
   */
  board: 'grid' | 'folded';
  /** 오늘의 Pick이 지목하는 업종. 다 정했으면 null — 없는 다음을 지어내지 않는다. */
  focus: VendorCategory | null;
  /**
   * 추천 세 곳을 견줄 수 있는가.
   *
   * **비교할 수 없으면 비교를 권하지 않는다**(시안이 명시한 규칙). 눌러도 소득이
   * 없는 버튼 대신 제보를 권한다.
   */
  comparable: boolean;
  /** 정한 곳을 한 줄 목록으로 내려 보이는가. 시안 5. */
  showsDecided: boolean;
};

/**
 * 견줄 수 있는 최소 조건.
 *
 * 시안의 문장은 «세 곳 모두 정보가 없으면»이지만 그대로 옮기지 않았다 — 한 곳만
 * 금액이 있고 두 곳이 «수집 중»이면 그 표는 비교가 아니라 금액 하나다. 업종 안
 * 비교와 같은 기준(`MIN_COMPARABLE`)을 쓴다.
 */
export function comparableCount(vendors: readonly VendorSummary[]): number {
  return vendors.filter((vendor) => vendor.paidPrice.stage !== 'collecting').length;
}

/**
 * 지금 홈이 무엇을 보여줘야 하는가.
 *
 * **로그인 여부가 가장 먼저다.** 이름도 예식일도 모르는 사람에게 D-day와 현황판을
 * 띄우면 앱이 갑자기 점쟁이가 된다 — 비회원에게는 조건 없이 보여줄 수 있는 확인된
 * 정보가 본문이고, 개인화는 하나도 꺼내지 않는다.
 */
export function homeView(input: {
  me: CurrentUser | null;
  candidates: CandidateListResponse | null;
  /** 오늘의 Pick 자리에 올릴 추천 세 곳. */
  recommended: readonly VendorSummary[];
  /** 취향을 고른 적이 있는가. 아직 서버에 자리가 없어 기기에 저장한다. */
  tasteChosen: boolean;
}): HomeView {
  if (input.me === null) {
    return { state: 'guest', board: 'folded', focus: null, comparable: false, showsDecided: false };
  }

  const comparable = comparableCount(input.recommended) >= MIN_COMPARABLE;
  const focus = input.candidates?.nextCategory ?? null;
  const picked = input.candidates?.total ?? 0;
  const decided = input.candidates?.progress.decided ?? 0;

  /*
   * 아직 아무것도 담지 않았다. 현황판을 펼치면 빈 칸만 남으므로 접고, 그 자리를
   * 취향 고르기가 대신한다 — 취향을 이미 골랐다면 격자로 펼치되 첫 업종 하나만
   * 지목한다.
   */
  if (picked === 0) {
    return input.tasteChosen
      ? { state: 'empty', board: 'grid', focus, comparable, showsDecided: false }
      : { state: 'taste', board: 'folded', focus, comparable, showsDecided: false };
  }

  /*
   * 정한 것이 하나라도 있으면 그 사실이 화면에서 가장 굳은 정보다. 정한 곳은
   * 카드가 아니라 한 줄로 내려가고, 오늘의 Pick은 다음 업종으로 넘어간다.
   */
  if (decided > 0) {
    return { state: 'decided', board: 'grid', focus, comparable, showsDecided: true };
  }

  return { state: 'picking', board: 'grid', focus, comparable, showsDecided: false };
}

/**
 * 다음 준비 — 오늘의 Pick이 지목한 업종 **다음**에 올 업종.
 *
 * 오늘의 Pick과 같은 업종을 또 적으면 같은 말을 두 번 하는 것이라, 지목받은 것을
 * 빼고 아직 정하지 않은 것 중 첫째를 고른다. 남은 것이 없으면 null이고, 그러면
 * 이 섹션은 뜨지 않는다 — 없는 다음을 지어내지 않는다.
 */
export function nextUpCategory(
  groups: CandidateListResponse['groups'],
  focus: VendorCategory | null
): CandidateListResponse['groups'][number] | null {
  return (
    groups.find((group) => group.state !== 'decided' && group.category !== focus) ?? null
  );
}

/**
 * 현황판 한 칸이 어떻게 보이는가.
 *
 * **지금 할 일 하나만 코랄이다.** 넷 다 색이 있으면 무엇이 다음인지 사라진다 —
 * 정한 곳은 초록, 손대지 않은 곳은 회색으로 물러난다.
 */
export type BoardTone = 'done' | 'now' | 'going' | 'none';

export function boardTone(input: {
  state: 'before' | 'picking' | 'decided';
  isFocus: boolean;
}): BoardTone {
  if (input.state === 'decided') return 'done';
  if (input.isFocus) return 'now';

  return input.state === 'picking' ? 'going' : 'none';
}

/** 현황판 한 칸의 값 줄. 담은 수를 세되 0은 숫자로 적지 않는다. */
export function boardValue(input: { pickCount: number; decidedName: string | null }): string {
  if (input.decidedName !== null) return input.decidedName;
  if (input.pickCount === 0) return '아직 없어요';

  return `후보 ${input.pickCount}곳`;
}

/**
 * 현황판 한 칸의 상태 줄.
 *
 * `PREPARATION_STATE_LABEL`(준비 전 / 후보 Pick 중 / 결정 완료)을 쓰지 않는다 —
 * 좁은 칸에 한 줄로 들어가야 하고, 무엇보다 **지목받은 칸은 상태가 아니라 다음
 * 행동을 말해야** 한다. 아직 담은 것이 없는데 «좁히는 중»이라고 적으면 거짓이다.
 */
export function boardMark(input: { tone: BoardTone; pickCount: number }): string {
  if (input.tone === 'done') return '결정';
  if (input.tone === 'going') return '모으는 중';
  if (input.tone === 'none') return '시작 전';

  return input.pickCount === 0 ? '먼저 정할 차례' : '좁히는 중';
}

/** 아직 아무것도 시작하지 않았을 때 현황판 자리에 놓는 한 줄. */
export const BOARD_FOLDED_VALUE = '아직 시작 전';
