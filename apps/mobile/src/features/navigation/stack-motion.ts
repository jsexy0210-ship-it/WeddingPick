import { Motion } from '@weddingpick/ui';

/**
 * 화면 전환 규칙 — **라우터 단위로 한 번만 정한다**(2026-09-26 대표 지시 「모든 전체 화면
 * 라우터 단위로 싹다 적용해」 · 「실제 앱처럼 자연스러운 화면이동」).
 *
 * 화면 파일은 전환을 모른다. 모든 `_layout.tsx`가 `useStackScreenOptions()`
 * (`screen-options.ts`)를 쓰고, 그 함수가 라우트 이름을 이 표에 비춰 전환을 고른다. 새 화면을
 * 만들면 아무것도 안 해도 `push`(오른쪽에서 밀려 들어옴)가 된다.
 *
 *   push    오른쪽에서 밀려 들어오고 이전 화면은 옅게 어두워진다. Back은 거꾸로.
 *   modal   아래에서 올라오고(풀팝업 — 좌측 X 닫기 머리) 닫으면 아래로 내려간다.
 *   sheet   시트형 라우트 — 부모 화면을 그대로 다시 그리고 그 위에 `BottomSheet`를 띄우는 화면
 *           (일정 추가 · 지출 추가 · 후기 쓰기 등, `registration-overlay-audit.test.ts`). 라우트는
 *           움직이지 않고(열릴 때 즉시) 시트가 스스로 올라온다. 닫힐 때는 라우트째 짧게 사라진다 —
 *           밑에 같은 부모 화면이 있어 시트와 딤만 걷히는 것으로 보인다. 밀면 부모 화면 사본이
 *           옆으로 끌려 나와 화면이 두 겹으로 보인다.
 *   fade    제자리에서 겹쳐 바뀐다 — 로그인 · 온보딩 · 앱 본체처럼 «문맥이 갈리는» 자리.
 *   none    움직이지 않는다 — 관리자 콘솔(웹 전용 1920 콘솔이라 앱 전환을 입히지 않는다).
 *
 * Root 탭끼리의 전환은 여기가 아니라 `useTabScreenOptions()`가 정한다(밀지 않고 짧게 겹친다).
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
  return STACK_ROUTE_TRANSITION[routeName] ?? 'push';
}

/**
 * 전환 시간(ms). **RN 정본(`docs/design/React_Native`)에는 화면 전환 값이 없다** — 정본의
 * 키프레임은 로더 · 뼈대뿐이다(`source-styles.css` wpSpin · wpSwap · wpSk). 그래서:
 *
 *   modal   `spec/tokens.json` motion.sheetEnter 350 · sheetExit 250 — 아래에서 올라오는 것은
 *           바텀시트와 같은 움직임이라 같은 토큰을 쓴다.
 *   fade    motion.scrimFade 200.
 *   sheet   열 때 0(시트가 스스로 `sheetEnter`로 올라온다) · 닫을 때 motion.sheetExit 250.
 *   push    토큰이 없다. 플랫폼 관례값(iOS UINavigationController ≈ 350 · Material 300)에서
 *           300 / 되돌아갈 때 250으로 둔다 — **DESIGN_UNRESOLVED**(대표님 확인 전 임시값).
 *   dim     밀려난 화면에 까는 검정의 최대 불투명도. overlay.scrim(.20 「옅은 스크림」) — 역시
 *           정본에 전환 딤이 없어 가장 옅은 딤 토큰을 빌렸다(DESIGN_UNRESOLVED).
 *   modalDim  풀팝업 뒤 딤 — overlay.dim(.45 「바텀시트 · 모달 뒤 딤」).
 *   tab     Root 탭 겹침 — motion.scrimFade 200(제자리 페이드 토큰). 전환 자체가 정본에 없어
 *           DESIGN_UNRESOLVED.
 *
 * 네이티브(iOS · 안드로이드)는 이 숫자를 쓰지 않고 OS의 native-stack 전환을 그대로 쓴다 —
 * 여기 값은 웹 빌드가 그 움직임을 흉내 낼 때만 읽는다.
 */
export const StackMotion = {
  pushOpen: 300,
  pushClose: 250,
  modalOpen: Motion.sheetEnter.duration,
  modalOpenBezier: Motion.sheetEnter.bezier,
  modalClose: Motion.sheetExit.duration,
  fade: Motion.scrimFade.duration,
  sheetClose: Motion.sheetExit.duration,
  dim: 0.2,
  modalDim: 0.45,
  tabFade: Motion.scrimFade.duration,
} as const;
