import {
  KEYBOARD_HIDDEN,
  REVEAL_MARGIN,
  createWebKeyboardSource,
  isKeyboardEditable,
  resolveWebKeyboard,
  revealDelta,
  revealFocusedInput,
  webKeyboardInset,
  type ScrollNode,
  type WebKeyboardEnv,
} from './keyboard-inset.shared';

/**
 * 키패드 높이 출처(2026-09-26 대표 지시 「키패드 출력 시 화면을 위로 올려야한다. 바텀시트 등
 * 키패드와 겹치면 안된다」). 브라우저 없이 창 · 문서를 흉내 내서 잰다 — 390 × 844 폰에 키패드 336.
 */

describe('webKeyboardInset — visualViewport로 잰 가려진 높이', () => {
  it('키패드 336 — 레이아웃 844 · 보이는 영역 508', () => {
    expect(webKeyboardInset({ layoutHeight: 844, viewportHeight: 508, offsetTop: 0 })).toBe(336);
  });

  it('브라우저가 화면을 100 끌어올렸으면 그만큼 덜 가려져 있다', () => {
    expect(webKeyboardInset({ layoutHeight: 844, viewportHeight: 508, offsetTop: 100 })).toBe(236);
  });

  it('키패드가 없으면 0 · 음수 · 1px 미만 · 숫자 아님도 0', () => {
    expect(webKeyboardInset({ layoutHeight: 844, viewportHeight: 844, offsetTop: 0 })).toBe(0);
    expect(webKeyboardInset({ layoutHeight: 844, viewportHeight: 900, offsetTop: 0 })).toBe(0);
    expect(webKeyboardInset({ layoutHeight: 844, viewportHeight: 843.4, offsetTop: 0 })).toBe(0);
    expect(webKeyboardInset({ layoutHeight: Number.NaN, viewportHeight: 500, offsetTop: 0 })).toBe(0);
  });

  it('소수 픽셀은 반올림한다', () => {
    expect(webKeyboardInset({ layoutHeight: 844, viewportHeight: 507.6, offsetTop: 0 })).toBe(336);
  });
});

describe('resolveWebKeyboard — 떠 있는가', () => {
  const keyboard = { layoutHeight: 844, viewportHeight: 508, offsetTop: 0 };

  it('글을 쓰는 칸에 초점이 없으면 가려져 보여도 «없음» — 핀치 확대 · 주소창을 키패드로 읽지 않는다', () => {
    expect(resolveWebKeyboard({ metrics: keyboard, editing: false, restingHeight: 844 })).toEqual(KEYBOARD_HIDDEN);
  });

  it('쓰는 중 + 336 가려짐 → 올린다 · 떠 있다', () => {
    expect(resolveWebKeyboard({ metrics: keyboard, editing: true, restingHeight: 844 })).toEqual({
      inset: 336,
      visible: true,
    });
  });

  it('보조 줄(외부 키보드의 도구 막대)처럼 얕게 가리면 올리기만 하고 «떠 있음»은 아니다', () => {
    expect(
      resolveWebKeyboard({ metrics: { layoutHeight: 844, viewportHeight: 800, offsetTop: 0 }, editing: true, restingHeight: 844 })
    ).toEqual({ inset: 44, visible: false });
  });

  it('창째 줄이는 브라우저(안드로이드 인앱) — 가려진 것은 0이지만 줄어든 높이로 떠 있음을 안다', () => {
    expect(
      resolveWebKeyboard({ metrics: { layoutHeight: 508, viewportHeight: 508, offsetTop: 0 }, editing: true, restingHeight: 844 })
    ).toEqual({ inset: 0, visible: true });
  });

  it('visualViewport를 모르는 브라우저는 0', () => {
    expect(resolveWebKeyboard({ metrics: null, editing: true, restingHeight: 0 })).toEqual({ inset: 0, visible: false });
  });
});

describe('isKeyboardEditable', () => {
  it('글을 쓰는 input · textarea · select · contenteditable만', () => {
    expect(isKeyboardEditable({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isKeyboardEditable({ tagName: 'INPUT', type: '' })).toBe(true);
    expect(isKeyboardEditable({ tagName: 'input', type: 'tel' })).toBe(true);
    expect(isKeyboardEditable({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isKeyboardEditable({ tagName: 'SELECT' })).toBe(true);
    expect(isKeyboardEditable({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('단추 · 체크 · 읽기 전용 · 잠긴 칸 · 초점 없음은 아니다', () => {
    expect(isKeyboardEditable({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isKeyboardEditable({ tagName: 'INPUT', type: 'button' })).toBe(false);
    expect(isKeyboardEditable({ tagName: 'INPUT', type: 'text', readOnly: true })).toBe(false);
    expect(isKeyboardEditable({ tagName: 'TEXTAREA', disabled: true })).toBe(false);
    expect(isKeyboardEditable({ tagName: 'BUTTON' })).toBe(false);
    expect(isKeyboardEditable({ tagName: 'BODY' })).toBe(false);
    expect(isKeyboardEditable(null)).toBe(false);
  });
});

describe('revealDelta — 초점 칸을 보이는 띠 안으로', () => {
  const band = { top: 100, bottom: 500 };

  it('이미 보이면 0', () => {
    expect(revealDelta({ top: 200, bottom: 252 }, band)).toBe(0);
  });

  it('아래가 키패드에 걸리면 그만큼(+여백 24 — 입력칸 테두리 상자까지) 아래로 굴린다', () => {
    expect(REVEAL_MARGIN).toBe(24);
    expect(revealDelta({ top: 520, bottom: 572 }, band)).toBe(572 - (500 - REVEAL_MARGIN));
  });

  it('위로 벗어났으면 위로 굴린다', () => {
    expect(revealDelta({ top: 40, bottom: 92 }, band)).toBe(40 - (100 + REVEAL_MARGIN));
  });

  it('띠보다 큰 칸(여러 줄 메모)은 위 끝을 맞춘다 — 쓰기 시작하는 자리가 보인다', () => {
    expect(revealDelta({ top: 300, bottom: 900 }, band)).toBe(300 - (100 + REVEAL_MARGIN));
  });

  it('띠가 없으면(여백보다 좁다) 굴리지 않는다', () => {
    expect(revealDelta({ top: 300, bottom: 340 }, { top: 100, bottom: 140 })).toBe(0);
  });
});

// ─── 가짜 창 · 문서 ─────────────────────────────────────────────────────

type Listener = (event?: { relatedTarget?: unknown }) => void;

function fakeNode(rect: { top: number; bottom: number }, extra: Partial<ScrollNode> = {}): ScrollNode & { tagName?: string } {
  return {
    parentElement: null,
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    getBoundingClientRect: () => rect,
    ...extra,
  };
}

function fakeEnv({ viewportHeight = 844 }: { viewportHeight?: number } = {}) {
  const viewportListeners = new Map<string, Set<() => void>>();
  const windowListeners = new Map<string, Set<() => void>>();
  const documentListeners = new Map<string, Set<Listener>>();
  const frames: (() => void)[] = [];
  const timers: (() => void)[] = [];
  const root = { style: { paddingBottom: '', boxSizing: '' } };
  const viewport = {
    height: viewportHeight,
    offsetTop: 0,
    addEventListener: (type: string, listener: () => void) => {
      if (!viewportListeners.has(type)) viewportListeners.set(type, new Set());
      viewportListeners.get(type)!.add(listener);
    },
    removeEventListener: (type: string, listener: () => void) => viewportListeners.get(type)?.delete(listener),
  };
  const scrollingElement = { scrollTop: 0 };
  const scrollTo = jest.fn((_x: number, y: number) => {
    scrollingElement.scrollTop = y;
  });
  const overflow = new Map<unknown, string>();
  const body = {};
  const documentElement = { clientHeight: 844, clientWidth: 390 };

  const env: WebKeyboardEnv = {
    window: {
      innerHeight: 844,
      innerWidth: 390,
      visualViewport: viewport,
      navigator: { maxTouchPoints: 5 },
      getComputedStyle: (node: unknown) => ({ overflowY: overflow.get(node) ?? 'visible' }),
      addEventListener: (type, listener) => {
        if (!windowListeners.has(type)) windowListeners.set(type, new Set());
        windowListeners.get(type)!.add(listener);
      },
      removeEventListener: (type, listener) => windowListeners.get(type)?.delete(listener),
      requestAnimationFrame: (callback) => frames.push(callback),
      setTimeout: (callback) => timers.push(callback),
      clearTimeout: () => undefined,
      scrollTo,
    },
    document: {
      activeElement: body,
      body,
      documentElement,
      scrollingElement,
      getElementById: (id) => (id === 'root' ? root : null),
      addEventListener: (type, listener) => {
        if (!documentListeners.has(type)) documentListeners.set(type, new Set());
        documentListeners.get(type)!.add(listener as Listener);
      },
      removeEventListener: (type, listener) => documentListeners.get(type)?.delete(listener as Listener),
    },
  };

  return {
    env,
    root,
    viewport,
    overflow,
    scrollTo,
    scrollingElement,
    viewportListenerCount: () => [...viewportListeners.values()].reduce((sum, set) => sum + set.size, 0),
    /** 키패드가 오르내린다 — visualViewport resize. */
    keyboard(height: number) {
      viewport.height = 844 - height;
      viewportListeners.get('resize')?.forEach((listener) => listener());
    },
    focus(element: unknown) {
      env.document.activeElement = element;
      documentListeners.get('focusin')?.forEach((listener) => listener());
    },
    blur(relatedTarget: unknown = null) {
      env.document.activeElement = body;
      documentListeners.get('focusout')?.forEach((listener) => listener({ relatedTarget }));
    },
    flushFrames() {
      while (frames.length) frames.shift()!();
    },
    flushTimers() {
      while (timers.length) timers.shift()!();
    },
  };
}

const input = { tagName: 'INPUT', type: 'text' };

describe('createWebKeyboardSource — 앱 전체가 나눠 쓰는 출처', () => {
  it('키패드가 뜨면 구독자에게 알리고 앱 뿌리(#root)를 그만큼 줄인다 · 내리면 되돌린다', () => {
    const fake = fakeEnv();
    const source = createWebKeyboardSource(fake.env);
    const listener = jest.fn();
    const unsubscribe = source.subscribe(listener);
    const detach = source.attachRoot();

    fake.focus(input);
    fake.keyboard(336);

    expect(source.getSnapshot()).toEqual({ inset: 336, visible: true });
    expect(listener).toHaveBeenCalled();
    expect(fake.root.style).toEqual({ paddingBottom: '336px', boxSizing: 'border-box' });

    fake.keyboard(0);
    expect(source.getSnapshot()).toEqual(KEYBOARD_HIDDEN);
    expect(fake.root.style).toEqual({ paddingBottom: '', boxSizing: '' });

    detach();
    unsubscribe();
    expect(fake.viewportListenerCount()).toBe(0);
  });

  it('초점이 칸에서 빠지면 다음 초점이 정해진 뒤에 잰다 — 칸에서 칸으로 옮길 때 내려갔다 오르지 않는다', () => {
    const fake = fakeEnv();
    const source = createWebKeyboardSource(fake.env);
    source.subscribe(jest.fn());

    fake.focus(input);
    fake.keyboard(336);

    /* 다음 칸으로 — relatedTarget이 글쓰기 칸이면 아예 다시 재지 않는다. */
    fake.blur({ tagName: 'TEXTAREA' });
    fake.flushTimers();
    expect(source.getSnapshot().inset).toBe(336);

    /* 칸 밖을 눌러 초점이 빠졌다 — 키패드가 내려가기 전이라도 «없음». */
    fake.blur(null);
    expect(source.getSnapshot().inset).toBe(336);
    fake.flushTimers();
    expect(source.getSnapshot()).toEqual(KEYBOARD_HIDDEN);
  });

  it('데스크톱(터치 없음)은 확대해도 키패드로 읽지 않는다', () => {
    const fake = fakeEnv();
    fake.env.window.navigator = { maxTouchPoints: 0 };
    const source = createWebKeyboardSource(fake.env);
    source.subscribe(jest.fn());

    fake.focus(input);
    fake.keyboard(336);

    expect(source.getSnapshot()).toEqual(KEYBOARD_HIDDEN);
  });

  it('키패드가 내려갔는데 문서가 끌어올려진 채면(iOS) 제자리로 돌린다', () => {
    const fake = fakeEnv();
    const source = createWebKeyboardSource(fake.env);
    source.subscribe(jest.fn());

    fake.focus(input);
    fake.keyboard(336);
    fake.scrollingElement.scrollTop = 120;
    fake.keyboard(0);

    expect(fake.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(fake.scrollingElement.scrollTop).toBe(0);
  });

  it('키패드가 뜨면 초점 칸을 가진 스크롤 영역만 굴려 키패드 위로 보인다(두 프레임 뒤 · 시트 움직임 뒤)', () => {
    const fake = fakeEnv();
    /* 스크롤 영역 0~700(시트 안 ScrollView), 칸은 600~652 — 키패드(336) 위는 508까지. */
    const scroll = fakeNode({ top: 0, bottom: 700 }, { scrollHeight: 1200, clientHeight: 700 });
    fake.overflow.set(scroll, 'auto');
    const field = { ...fakeNode({ top: 600, bottom: 652 }, { parentElement: scroll }), tagName: 'INPUT', type: 'text' };
    const source = createWebKeyboardSource(fake.env);
    source.subscribe(jest.fn());

    fake.focus(field);
    expect(scroll.scrollTop).toBe(0);
    fake.keyboard(336);
    fake.flushFrames();

    expect(scroll.scrollTop).toBe(652 - (508 - REVEAL_MARGIN));
  });
});

describe('revealFocusedInput', () => {
  it('굴러가는 영역이 없으면(고정 화면) 아무것도 옮기지 않는다', () => {
    const fake = fakeEnv({ viewportHeight: 508 });
    const field = { ...fakeNode({ top: 600, bottom: 652 }), tagName: 'INPUT', type: 'text' };
    fake.env.document.activeElement = field;

    expect(revealFocusedInput(fake.env)).toBe(0);
  });

  it('overflow가 auto여도 넘치지 않는 영역은 건너뛰고 바깥 스크롤을 굴린다', () => {
    const fake = fakeEnv({ viewportHeight: 508 });
    const outer = fakeNode({ top: 56, bottom: 844 }, { scrollHeight: 2000, clientHeight: 788 });
    const inner = fakeNode({ top: 500, bottom: 700 }, { parentElement: outer, scrollHeight: 200, clientHeight: 200 });
    fake.overflow.set(outer, 'auto');
    fake.overflow.set(inner, 'auto');
    const field = { ...fakeNode({ top: 560, bottom: 660 }, { parentElement: inner }), tagName: 'TEXTAREA' };
    fake.env.document.activeElement = field;

    expect(revealFocusedInput(fake.env)).toBe(660 - (508 - REVEAL_MARGIN));
    expect(outer.scrollTop).toBe(660 - (508 - REVEAL_MARGIN));
    expect(inner.scrollTop).toBe(0);
  });

  it('초점이 글쓰기 칸이 아니면 0', () => {
    const fake = fakeEnv({ viewportHeight: 508 });
    fake.env.document.activeElement = { tagName: 'BUTTON' };

    expect(revealFocusedInput(fake.env)).toBe(0);
  });
});
