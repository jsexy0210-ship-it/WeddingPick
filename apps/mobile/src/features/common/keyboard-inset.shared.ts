/**
 * 키패드 높이 — 앱 전체가 보는 **단 하나의 출처**(2026-09-26 대표 지시 「키패드 출력 시 화면을 위로
 * 올려야한다. 바텀시트 등 키패드와 겹치면 안된다」).
 *
 * 이 파일은 플랫폼을 가리지 않는 계산만 든다 — 시험이 브라우저 없이 돌게 하려고 창(`window`) ·
 * 문서(`document`)를 인자로 받는다. 실제로 붙이는 곳은 `keyboard-inset.web.ts`(웹) ·
 * `keyboard-inset.ts`(네이티브)다.
 *
 *   웹      브라우저는 키패드가 떠도 레이아웃 뷰포트(`innerHeight` · 100% 높이)를 줄이지 않는다
 *           (iOS Safari · Android Chrome 기본값 · 카카오톡 iOS 인앱). 줄어드는 것은
 *           `visualViewport`뿐이다 — 그래서 가려진 아래 높이를 직접 잰다.
 *
 *             inset = 레이아웃 높이 − visualViewport.height − visualViewport.offsetTop
 *
 *           창째 줄이는 브라우저(안드로이드 웹뷰 인앱 · resizes-content)는 inset이 0으로 나오고
 *           레이아웃이 이미 키패드 위로 줄어 있다. 그때는 「줄어든 높이」로 키패드가 떴다는 것만
 *           안다(`visible`) — 탭 바를 숨기는 데 쓴다.
 *   네이티브 `Keyboard` 이벤트 높이(`keyboard-inset.ts`). 화면 · 시트는 RN `KeyboardAvoidingView`가
 *           자기 자리 기준으로 겹친 만큼만 민다(`keyboard-avoid.tsx`).
 */

export type KeyboardInset = {
  /** 레이아웃 아래쪽이 키패드에 가려진 높이(px). 이만큼 올리면 키패드 바로 위에 선다. */
  inset: number;
  /** 키패드가 떠 있다 — 탭 바를 숨길지 판단한다. 창째 줄이는 브라우저에서는 inset 0이어도 참이다. */
  visible: boolean;
};

export const KEYBOARD_HIDDEN: KeyboardInset = { inset: 0, visible: false };

/**
 * 이만큼 가려져야 «키패드가 떴다»로 본다. 주소창이 접히고 펴지는 값(수십 px)과 가른다 — 폰 키패드는
 * 제안 줄 없이도 이보다 높다. 플랫폼 관례값이다(디자인 값이 아니다).
 */
export const KEYBOARD_VISIBLE_MIN = 100;

/**
 * 입력칸을 키패드 · 스크롤 영역 끝에 딱 붙이지 않고 띄우는 여백 — `Layout.gutter`(24)와 같은 값.
 * 초점은 안쪽 `<input>`(22)이 받고 테두리 상자(`TextField` 52)는 위아래로 15씩 더 크다 — 12로는
 * 상자 아래 선이 잘렸다(2026-09-26 캡처). 24면 상자 전체와 그 아래 틈이 보인다.
 */
export const REVEAL_MARGIN = 24;

export type ViewportMetrics = {
  /** 레이아웃 뷰포트 높이 — `document.documentElement.clientHeight`(없으면 `innerHeight`). */
  layoutHeight: number;
  /** `visualViewport.height`. */
  viewportHeight: number;
  /** `visualViewport.offsetTop` — 브라우저가 입력칸을 보이려고 화면을 끌어올린 만큼. */
  offsetTop: number;
};

/** 레이아웃 아래쪽이 키패드(보이는 영역 밖)에 가려진 높이. 음수 · 1px 미만 · 숫자 아님은 0이다. */
export function webKeyboardInset({ layoutHeight, viewportHeight, offsetTop }: ViewportMetrics): number {
  const hidden = layoutHeight - viewportHeight - (Number.isFinite(offsetTop) ? offsetTop : 0);

  if (!Number.isFinite(hidden) || hidden < 1) return 0;

  return Math.round(hidden);
}

export type WebKeyboardInput = {
  /** 없으면(visualViewport를 모르는 브라우저) 가려진 높이는 0으로 본다. */
  metrics: ViewportMetrics | null;
  /** 지금 글을 쓰는 칸에 초점이 있다. 없으면 키패드도 없다 — 확대 · 주소창 변화를 키패드로 읽지 않는다. */
  editing: boolean;
  /** 키패드 없이 잰 레이아웃 높이 — 창째 줄이는 브라우저에서 «줄었다»를 가른다. 모르면 0. */
  restingHeight: number;
};

/** 키패드 상태를 정한다. 글을 쓰는 중이 아니면 언제나 «없음»이다. */
export function resolveWebKeyboard({ metrics, editing, restingHeight }: WebKeyboardInput): KeyboardInset {
  if (!editing) return KEYBOARD_HIDDEN;

  const inset = metrics ? webKeyboardInset(metrics) : 0;
  const layoutHeight = metrics?.layoutHeight ?? 0;
  const resized = restingHeight > 0 && layoutHeight > 0 && restingHeight - layoutHeight >= KEYBOARD_VISIBLE_MIN;

  return { inset, visible: inset >= KEYBOARD_VISIBLE_MIN || resized };
}

export function sameKeyboardInset(a: KeyboardInset, b: KeyboardInset): boolean {
  return a.inset === b.inset && a.visible === b.visible;
}

/** 키패드를 띄우지 않는 input 종류 — 누르는 단추 · 체크 · 파일 고르기. */
const NON_TEXT_INPUT_TYPES = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']);

type EditableLike = {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
};

/** 초점을 받으면 키패드(또는 OS 입력 판)를 띄우는 요소인가. */
export function isKeyboardEditable(element: unknown): boolean {
  if (!element || typeof element !== 'object') return false;

  const node = element as EditableLike;
  if (node.isContentEditable) return true;

  const tag = typeof node.tagName === 'string' ? node.tagName.toUpperCase() : '';
  if (node.disabled) return false;
  if (tag === 'TEXTAREA') return !node.readOnly;
  if (tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (typeof node.type === 'string' && node.type ? node.type : 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type) && !node.readOnly;
  }

  return false;
}

// ─── 초점 칸을 보이는 자리로 ───────────────────────────────────────────────

export type Band = { top: number; bottom: number };

/**
 * 스크롤 영역 안의 칸(`element`)이 보이는 띠(`band` — 스크롤 영역 ∩ 키패드 위) 안에 들도록
 * 스크롤을 얼마나 옮길지(+ 아래로 · − 위로). 이미 보이면 0.
 *
 * 칸이 띠보다 크면(여러 줄 메모) 칸의 **위**를 맞춘다 — 쓰기 시작하는 자리가 보여야 한다.
 */
export function revealDelta(element: Band, band: Band, margin: number = REVEAL_MARGIN): number {
  const top = band.top + margin;
  const bottom = band.bottom - margin;

  if (bottom <= top) return 0;
  if (element.bottom - element.top > bottom - top) return Math.round(element.top - top);
  if (element.bottom > bottom) return Math.round(element.bottom - bottom);
  if (element.top < top) return Math.round(element.top - top);

  return 0;
}

type RectLike = { top: number; bottom: number };

export type ScrollNode = {
  parentElement: ScrollNode | null;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  getBoundingClientRect(): RectLike;
};

export type VisualViewportLike = {
  height: number;
  offsetTop: number;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

export type WebKeyboardWindow = {
  innerHeight: number;
  innerWidth: number;
  visualViewport?: VisualViewportLike | null;
  navigator?: { maxTouchPoints?: number };
  matchMedia?: (query: string) => { matches: boolean };
  getComputedStyle(node: unknown): { overflowY: string };
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  requestAnimationFrame(callback: () => void): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  scrollTo(x: number, y: number): void;
  scrollY?: number;
};

type RootStyle = { paddingBottom: string; boxSizing: string };

export type WebKeyboardDocument = {
  activeElement: unknown;
  body?: unknown;
  documentElement?: { clientHeight: number; clientWidth: number } | null;
  scrollingElement?: { scrollTop: number } | null;
  getElementById(id: string): { style: RootStyle } | null;
  addEventListener(type: string, listener: (event: { relatedTarget?: unknown }) => void): void;
  removeEventListener(type: string, listener: (event: { relatedTarget?: unknown }) => void): void;
};

export type WebKeyboardEnv = { window: WebKeyboardWindow; document: WebKeyboardDocument };

/** 초점 칸에서 위로 올라가며 세로로 굴러가는 첫 영역(RN `ScrollView`의 div)을 찾는다. */
export function findScrollContainer(element: ScrollNode, env: WebKeyboardEnv): ScrollNode | null {
  const stop = new Set<unknown>([env.document.body, env.document.documentElement]);
  let node = element.parentElement;

  while (node && !stop.has(node)) {
    const { overflowY } = env.window.getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }

  return null;
}

/**
 * 초점 칸이 키패드 · 스크롤 영역 밖에 있으면 그 스크롤 영역만 굴려서 보이게 한다. 옮긴 만큼을 돌려준다.
 *
 * `scrollIntoView`를 쓰지 않는다 — 문서(`html` · `body`, overflow hidden)까지 굴려서 앱 껍데기가
 * 통째로 밀려 올라간다. 가장 가까운 스크롤 영역 하나만 옮긴다.
 */
export function revealFocusedInput(env: WebKeyboardEnv): number {
  const active = env.document.activeElement;
  if (!isKeyboardEditable(active)) return 0;

  const element = active as ScrollNode;
  const container = findScrollContainer(element, env);
  if (!container) return 0;

  const viewport = env.window.visualViewport;
  const layoutHeight = layoutHeightOf(env);
  const box = container.getBoundingClientRect();
  const band = {
    top: Math.max(box.top, viewport ? viewport.offsetTop : 0),
    bottom: Math.min(box.bottom, viewport ? viewport.offsetTop + viewport.height : layoutHeight),
  };
  const rect = element.getBoundingClientRect();
  const delta = revealDelta({ top: rect.top, bottom: rect.bottom }, band);

  if (delta !== 0) container.scrollTop += delta;

  return delta;
}

function layoutHeightOf(env: WebKeyboardEnv): number {
  return env.document.documentElement?.clientHeight || env.window.innerHeight;
}

function layoutWidthOf(env: WebKeyboardEnv): number {
  return env.document.documentElement?.clientWidth || env.window.innerWidth;
}

/** 화상 키패드가 있을 수 있는 기기 — 터치 · 굵은 포인터. 데스크톱 확대(핀치)를 키패드로 읽지 않는다. */
export function mayHaveVirtualKeyboard(env: WebKeyboardEnv): boolean {
  const touch = (env.window.navigator?.maxTouchPoints ?? 0) > 0;
  const coarse = env.window.matchMedia?.('(pointer: coarse)').matches ?? false;

  return touch || coarse;
}

// ─── 웹 출처 ─────────────────────────────────────────────────────────────

export type WebKeyboardSource = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): KeyboardInset;
  /** 앱 뿌리(`#root`)를 키패드 위로 줄인다 — 화면 · 고정 dock · 탭 화면 전부가 이 한 줄로 올라간다. */
  attachRoot(): () => void;
  /** 지금 값으로 다시 잰다(시험 · 강제 갱신). */
  measure(): void;
};

/** 시트가 올라오는 움직임(`Motion.sheetEnter` 350)이 끝난 뒤 한 번 더 초점 칸을 맞춘다. */
export const REVEAL_SETTLE_MS = 400;

/**
 * 웹 키패드 출처. 구독자가 하나라도 있거나 뿌리가 붙어 있을 때만 창 이벤트를 듣는다.
 *
 *   visualViewport resize · scroll    키패드가 오르내리거나 브라우저가 화면을 끌어올렸다
 *   window resize                      창째 줄이는 브라우저 · 회전
 *   focusin · focusout                 글쓰기 칸에 들어가고 나왔다(나올 때는 다음 칸이 정해진 뒤에 잰다)
 *
 * 값이 바뀌면 `#root`의 아래 여백을 맞추고(뿌리가 붙어 있으면) 구독자에게 알린다. 키패드가 떠 있으면
 * 초점 칸을 보이는 자리로 굴린다(`revealFocusedInput`) — 화면이 다시 그려진 뒤(두 프레임)와 시트
 * 움직임이 끝난 뒤 두 번.
 */
export function createWebKeyboardSource(env: WebKeyboardEnv): WebKeyboardSource {
  let snapshot: KeyboardInset = KEYBOARD_HIDDEN;
  const listeners = new Set<() => void>();
  let rootAttached = 0;
  let listening = false;
  let restingHeight = 0;
  let restingWidth = 0;
  let focusTimer: unknown = null;
  let settleTimer: unknown = null;

  function metricsNow(): ViewportMetrics | null {
    const viewport = env.window.visualViewport;
    if (!viewport) return null;

    return { layoutHeight: layoutHeightOf(env), viewportHeight: viewport.height, offsetTop: viewport.offsetTop };
  }

  function applyRoot(next: KeyboardInset) {
    if (rootAttached === 0) return;
    const root = env.document.getElementById('root');
    if (!root) return;

    if (next.inset > 0) {
      root.style.boxSizing = 'border-box';
      root.style.paddingBottom = `${next.inset}px`;
    } else {
      root.style.paddingBottom = '';
      root.style.boxSizing = '';
    }
  }

  function reveal() {
    if (snapshot.visible) revealFocusedInput(env);
  }

  function scheduleReveal() {
    env.window.requestAnimationFrame(() => env.window.requestAnimationFrame(reveal));
    if (settleTimer !== null) env.window.clearTimeout(settleTimer);
    settleTimer = env.window.setTimeout(() => {
      settleTimer = null;
      reveal();
    }, REVEAL_SETTLE_MS);
  }

  /*
   * iOS Safari는 키패드를 내린 뒤에도 문서를 끌어올린 채로 둘 때가 있다(앱 아래가 비어 보인다).
   * 앱 껍데기는 문서가 굴러가지 않는 구조(body overflow hidden)라 0이 아닌 값은 전부 그 흔적이다.
   */
  function resetDocumentScroll() {
    const scrolled = env.document.scrollingElement?.scrollTop ?? env.window.scrollY ?? 0;
    if (scrolled > 0) env.window.scrollTo(0, 0);
  }

  function measure() {
    const metrics = metricsNow();
    const editing = isKeyboardEditable(env.document.activeElement) && mayHaveVirtualKeyboard(env);
    const width = layoutWidthOf(env);

    /* 키패드 없이 잰 높이를 기준으로 둔다. 폭이 바뀌면(회전) 기준을 새로 잡는다. */
    if (width !== restingWidth) {
      restingWidth = width;
      restingHeight = layoutHeightOf(env);
    } else if (!editing) {
      restingHeight = layoutHeightOf(env);
    }

    const next = resolveWebKeyboard({ metrics, editing, restingHeight });
    const wasVisible = snapshot.visible;

    if (!sameKeyboardInset(next, snapshot)) {
      snapshot = next;
      applyRoot(next);
      listeners.forEach((listener) => listener());
    }

    if (next.visible) scheduleReveal();
    else if (wasVisible) resetDocumentScroll();
  }

  function onFocusIn() {
    measure();
  }

  /* 칸에서 칸으로 옮길 때 잠깐 body에 초점이 머문다 — 그 틈에 재면 시트가 내려갔다 다시 오른다. */
  function onFocusOut(event: { relatedTarget?: unknown }) {
    if (isKeyboardEditable(event.relatedTarget)) return;
    if (focusTimer !== null) env.window.clearTimeout(focusTimer);
    focusTimer = env.window.setTimeout(() => {
      focusTimer = null;
      measure();
    }, 0);
  }

  function start() {
    if (listening) return;
    listening = true;
    env.window.visualViewport?.addEventListener('resize', measure);
    env.window.visualViewport?.addEventListener('scroll', measure);
    env.window.addEventListener('resize', measure);
    env.document.addEventListener('focusin', onFocusIn);
    env.document.addEventListener('focusout', onFocusOut);
    measure();
  }

  function stopIfIdle() {
    if (!listening || listeners.size > 0 || rootAttached > 0) return;
    listening = false;
    env.window.visualViewport?.removeEventListener('resize', measure);
    env.window.visualViewport?.removeEventListener('scroll', measure);
    env.window.removeEventListener('resize', measure);
    env.document.removeEventListener('focusin', onFocusIn);
    env.document.removeEventListener('focusout', onFocusOut);
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      start();

      return () => {
        listeners.delete(listener);
        stopIfIdle();
      };
    },
    getSnapshot: () => snapshot,
    attachRoot() {
      rootAttached += 1;
      start();
      applyRoot(snapshot);

      return () => {
        rootAttached -= 1;
        if (rootAttached === 0) {
          const root = env.document.getElementById('root');
          if (root) {
            root.style.paddingBottom = '';
            root.style.boxSizing = '';
          }
        }
        stopIfIdle();
      };
    },
    measure,
  };
}
