/**
 * 라우트 이름 → 화면 전환 종류. 움직임 값(`Motion`)은 `stack-motion.ts`가 들고, 여기는 이름표만 든다 —
 * 토큰 없이 읽을 수 있어야 하는 자리(공통 바텀시트의 시트형 라우트 판별)가 있어서 떼어 뒀다.
 * 각 종류의 뜻은 `stack-motion.ts` 머리말.
 */
export type StackTransition = 'push' | 'modal' | 'sheet' | 'fade' | 'none';

/**
 * 라우트 이름(각 레이아웃 기준 상대 이름) → 전환. 없으면 `push`.
 *
 * `modal`은 **머리가 풀팝업인 화면**이다 — 좌측 슬롯이 뒤로(‹)가 아니라 닫기(X)인 화면
 * (CLAUDE.md v3.29 「풀팝업」 행 · `FullPopupHeader` · `DepthHeader`/`NavBar`의 `variant="close"`).
 * 화면은 X로 닫히는데 옆으로 밀려 나가면 머리와 움직임이 서로 다른 말을 한다.
 * `stack-motion.test.ts`가 화면 파일을 읽어 이 목록과 X 머리가 어긋나지 않는지 센다.
 */
export const STACK_ROUTE_TRANSITION: Readonly<Record<string, StackTransition>> = {
  /* 루트 스택 — 로그인 · 온보딩 ↔ 앱 본체는 replace로 갈아끼운다. 밀면 뒤로 갈 곳이 있는 것처럼 보인다. */
  '(tabs)': 'fade',
  login: 'fade',
  setup: 'fade',
  admin: 'none',
  /* 검색 스택의 풀팝업. `booking`은 `consult`를 그대로 다시 내보내는 옛 주소다. */
  '[vendorId]/consult': 'modal',
  '[vendorId]/booking': 'modal',
  '[vendorId]/images': 'modal',
  compare: 'modal',
  /* 검색 스택의 시트형 라우트. */
  '[vendorId]/write-review': 'sheet',
  'expo/[expoId]/calendar': 'sheet',
  /* 웨딩노트 스택의 풀팝업. */
  '[id]/changelog': 'modal',
  '[id]/decided': 'modal',
  '[id]/expenses/list': 'modal',
  /* 웨딩노트 스택의 시트형 라우트. */
  '[id]/events/new': 'sheet',
  '[id]/expenses/add': 'sheet',
  '[id]/consultations/upload': 'sheet',
  '[id]/consultations/[recordId]': 'sheet',
  /* 라운지 스택의 시트형 라우트. */
  'review/write': 'sheet',
};

export function stackTransitionFor(routeName: string): StackTransition {
  /*
   * 출처 스택 별칭(`stack-alias.ts`)의 업체 상세 묶음 — Pick · 라운지 · MY · 웨딩노트 스택에서는
   * `vendor/[vendorId]/…`다. 원래 화면(`[vendorId]/…`)과 같은 움직임을 쓴다.
   */
  const name = routeName.startsWith('vendor/[vendorId]') ? routeName.slice('vendor/'.length) : routeName;
  return STACK_ROUTE_TRANSITION[name] ?? 'push';
}
