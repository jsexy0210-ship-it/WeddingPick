/**
 * 웹 브라우저 뒤로가기가 열린 시트 · 풀팝업만 닫는다(`sheet-browser-back.ts`).
 *
 * 브라우저 히스토리를 흉내 낸 창으로 본다 — 칸 쌓기 · 비동기 `history.go` · popstate 캡처 순서(캡처가
 * 라우터의 일반 리스너보다 먼저)까지. 고정하는 경우:
 *
 *   단일 시트 · 중첩 시트(시트 위 시트) · 같은 틱에 둘 다 닫힘 · 닫힘 직후 라우팅(push/replace) ·
 *   닫을 수 없는 시트 · 스택 없는 첫 진입(history.state 없음) · 여러 칸 뒤로(다른 화면까지) ·
 *   열린 동안 라우터의 replace · 네이티브(안드로이드 하드웨어 Back은 Modal이 받는다 — 여기서는 아무것도 안 쌓는다)
 */
import { Platform } from 'react-native';

import { RELEASE_SETTLE, SHEET_HISTORY_KEY, createSheetHistory, holdBrowserBackForSheet, type BrowserBackWindow } from './sheet-browser-back';

type Listener = (event: Event) => void;
type Entry = Record<string, unknown> | null;

/** 브라우저 흉내 — go(n)은 다음 틱에 움직이고 popstate를 한 번 낸다. */
function fakeWindow(initial: Entry = { id: 'route-1' }) {
  const entries: Entry[] = [initial];
  let index = 0;
  const capture: Listener[] = [];
  const bubble: Listener[] = [];

  const fire = () => {
    let stopped = false;
    const event = { stopImmediatePropagation: () => (stopped = true) } as unknown as Event;
    for (const listener of [...capture]) {
      listener(event);
      if (stopped) return;
    }
    for (const listener of [...bubble]) {
      listener(event);
      if (stopped) return;
    }
  };

  const history = {
    get state() {
      return entries[index];
    },
    pushState(state: Entry) {
      entries.splice(index + 1);
      entries.push(state);
      index += 1;
    },
    replaceState(state: Entry) {
      entries[index] = state;
    },
    go(delta: number) {
      move(delta);
    },
  };
  /* 브라우저 자신의 이동(뒤로 단추) — 관리자가 감싼 history.go를 거치지 않는다. */
  let frozen = false;
  function move(delta: number) {
    if (frozen) return;
    setTimeout(() => {
      const next = index + delta;
      if (next < 0 || next >= entries.length) return;
      index = next;
      fire();
    }, 0);
  }

  const win: BrowserBackWindow = {
    history: history as unknown as BrowserBackWindow['history'],
    location: { href: 'https://example.test/search' },
    addEventListener: (_type, listener, useCapture) => (useCapture ? capture : bubble).push(listener),
    removeEventListener: (_type, listener, useCapture) => {
      const list = useCapture ? capture : bubble;
      const at = list.indexOf(listener);
      if (at >= 0) list.splice(at, 1);
    },
  };

  /* 라우터 — 일반 리스너(expo-router 메모리 히스토리처럼). */
  const router = jest.fn();
  win.addEventListener('popstate', router, false);

  return {
    win,
    router,
    /** 브라우저의 뒤로 단추. */
    browserBack: (steps = 1) => {
      move(-steps);
      jest.advanceTimersByTime(1);
    },
    /* 닫힌 칸을 빼는 기다림(RELEASE_SETTLE) + 브라우저 이동 한 틱. */
    /** 이동이 먹히지 않는 브라우저. */
    freeze: () => (frozen = true),
    settle: () => jest.advanceTimersByTime(RELEASE_SETTLE + 2),
    position: () => index + 1,
    length: () => entries.length,
    top: () => entries[index],
    entries,
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('한 시트', () => {
  it('열리면 같은 주소로 한 칸 쌓고 라우터의 id를 그대로 둔다', () => {
    const w = fakeWindow();
    createSheetHistory(w.win).hold(jest.fn());

    expect(w.position()).toBe(2);
    expect(w.top()?.id).toBe('route-1');
    expect(typeof w.top()?.[SHEET_HISTORY_KEY]).toBe('string');
  });

  it('브라우저 뒤로가기는 시트만 닫는다 — 라우터에는 넘기지 않는다', () => {
    const w = fakeWindow();
    const onBack = jest.fn();
    const release = createSheetHistory(w.win).hold(onBack);

    w.browserBack();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(w.router).not.toHaveBeenCalled();
    expect(w.position()).toBe(1);

    /* 시트가 닫히며 부르는 정리는 아무것도 더 빼지 않는다. */
    release();
    w.settle();
    expect(w.position()).toBe(1);
  });

  it('X · 딤 · CTA로 닫히면 쌓은 칸을 스스로 빼고, 그 popstate는 라우터에 넘기지 않는다', () => {
    const w = fakeWindow();
    const onBack = jest.fn();
    const release = createSheetHistory(w.win).hold(onBack);

    release();
    w.settle();
    expect(w.position()).toBe(1);
    expect(onBack).not.toHaveBeenCalled();
    expect(w.router).not.toHaveBeenCalled();
  });

  it('닫힌 뒤 다음 뒤로가기는 라우터가 받는다(화면 이동)', () => {
    const w = fakeWindow({ id: 'route-2' });
    w.entries.unshift({ id: 'route-1' });
    w.win.history.go(1);
    w.settle();
    w.router.mockClear();
    const release = createSheetHistory(w.win).hold(jest.fn());
    release();
    w.settle();

    w.browserBack();
    expect(w.router).toHaveBeenCalledTimes(1);
    expect(w.top()?.id).toBe('route-1');
  });
});

describe('중첩 시트(시트 위 시트)', () => {
  it('뒤로가기 한 번은 맨 위 시트만 닫고, 두 번째가 아래 시트를 닫는다', () => {
    const w = fakeWindow();
    const history = createSheetHistory(w.win);
    const outer = jest.fn();
    const inner = jest.fn();
    history.hold(outer);
    history.hold(inner);
    expect(w.position()).toBe(3);

    w.browserBack();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();

    w.browserBack();
    expect(outer).toHaveBeenCalledTimes(1);
    expect(w.router).not.toHaveBeenCalled();
    expect(w.position()).toBe(1);
  });

  it('안쪽만 X로 닫으면 안쪽 칸만 빠지고 바깥 시트는 그대로 쥐고 있다', () => {
    const w = fakeWindow();
    const history = createSheetHistory(w.win);
    const outer = jest.fn();
    history.hold(outer);
    const releaseInner = history.hold(jest.fn());

    releaseInner();
    w.settle();
    expect(w.position()).toBe(2);
    expect(history.depth()).toBe(1);

    w.browserBack();
    expect(outer).toHaveBeenCalledTimes(1);
    expect(w.router).not.toHaveBeenCalled();
  });

  it('같은 틱에 안쪽 · 바깥이 함께 닫혀도 두 칸이 다 빠진다', () => {
    const w = fakeWindow();
    const history = createSheetHistory(w.win);
    const releaseOuter = history.hold(jest.fn());
    const releaseInner = history.hold(jest.fn());

    releaseInner();
    releaseOuter();
    w.settle();
    w.settle();
    expect(w.position()).toBe(1);
    expect(history.depth()).toBe(0);
    expect(w.router).not.toHaveBeenCalled();
  });

  it('바깥이 먼저 닫혀도(안쪽은 열린 채) 칸을 빼지 않는다 — 안쪽이 닫힐 때 둘을 함께 뺀다', () => {
    const w = fakeWindow();
    const history = createSheetHistory(w.win);
    const releaseOuter = history.hold(jest.fn());
    const releaseInner = history.hold(jest.fn());

    releaseOuter();
    w.settle();
    expect(w.position()).toBe(3);

    releaseInner();
    w.settle();
    expect(w.position()).toBe(1);
  });
});

describe('시트 닫힘 직후 라우팅', () => {
  it('닫고 곧바로 다른 화면으로 가도(push) 새 화면이 되돌려지지 않는다', () => {
    const w = fakeWindow();
    const release = createSheetHistory(w.win).hold(jest.fn());

    release();
    /* 라우터 — 같은 틱에 다음 화면을 민다(«Pick 목록 보기»). */
    w.win.history.pushState({ id: 'route-2' }, '', '/next');
    w.settle();

    expect(w.top()).toEqual({ id: 'route-2' });
    expect(w.router).not.toHaveBeenCalled();
  });

  it('닫고 조금 뒤(시트가 내려가는 사이) 다른 화면으로 가도 되돌려지지 않는다', () => {
    const w = fakeWindow();
    const release = createSheetHistory(w.win).hold(jest.fn());

    release();
    jest.advanceTimersByTime(RELEASE_SETTLE - 50);
    w.win.history.pushState({ id: 'route-2' }, '', '/next');
    w.settle();
    expect(w.top()).toEqual({ id: 'route-2' });
  });

  it('닫고 곧바로 같은 화면 안에서 replace해도 그 값이 칸을 뺀 뒤 남는다', () => {
    const w = fakeWindow();
    const release = createSheetHistory(w.win).hold(jest.fn());

    release();
    w.win.history.replaceState({ id: 'route-1', q: 'b' }, '', '/replaced');
    w.settle();

    expect(w.position()).toBe(1);
    expect(w.top()).toEqual({ id: 'route-1', q: 'b' });
  });

  it('칸을 빼는 중(popstate 전)에 들어온 이동은 빼기가 끝난 뒤로 미룬다 — 오지 않으면 제한 시간 뒤 흘러간다', () => {
    const w = fakeWindow();
    const history = createSheetHistory(w.win);
    const release = history.hold(jest.fn());
    /* go가 아무 일도 안 하는 브라우저. */
    w.freeze();

    release();
    jest.advanceTimersByTime(RELEASE_SETTLE + 1);
    w.win.history.pushState({ id: 'route-2' }, '', '/next');
    expect(w.top()?.id).not.toBe('route-2');
    jest.advanceTimersByTime(1000);
    expect(w.top()).toEqual({ id: 'route-2' });
  });

  it('시트가 열린 채로 라우터가 화면을 쌓았으면, 닫을 때 남의 칸을 빼지 않는다', () => {
    const w = fakeWindow();
    const release = createSheetHistory(w.win).hold(jest.fn());
    w.win.history.pushState({ id: 'route-2' }, '', '/next');

    release();
    w.settle();
    expect(w.top()).toEqual({ id: 'route-2' });
  });

  it('열린 동안 라우터가 replace해도 표식이 남아 닫을 때 칸이 빠진다', () => {
    const w = fakeWindow();
    const release = createSheetHistory(w.win).hold(jest.fn());
    w.win.history.replaceState({ id: 'route-1', q: '1' }, '', '/search?q=1');
    expect(typeof w.top()?.[SHEET_HISTORY_KEY]).toBe('string');

    release();
    w.settle();
    expect(w.position()).toBe(1);
    /* 같은 화면 안의 변화는 아래 칸으로 옮겨진다. */
    expect(w.top()).toEqual({ id: 'route-1', q: '1' });
  });
});

describe('닫을 수 없는 시트', () => {
  it('뒤로가기에 닫히지 않고 화면째 떠나지도 않는다 — 칸을 다시 쌓는다', () => {
    const w = fakeWindow();
    const history = createSheetHistory(w.win);
    const onBack = jest.fn();
    history.hold(onBack, { sticky: true });

    w.browserBack();
    expect(onBack).not.toHaveBeenCalled();
    expect(w.router).not.toHaveBeenCalled();
    expect(w.position()).toBe(2);
    expect(history.depth()).toBe(1);
  });
});

describe('스택 없는 첫 진입', () => {
  it('history.state가 비어 있어도(주소로 바로 들어옴) 뒤로가기가 시트만 닫는다', () => {
    const w = fakeWindow(null);
    const onBack = jest.fn();
    createSheetHistory(w.win).hold(onBack);
    expect(w.position()).toBe(2);

    w.browserBack();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(w.router).not.toHaveBeenCalled();
    expect(w.position()).toBe(1);
  });
});

describe('여러 칸 뒤로(다른 화면까지)', () => {
  it('시트를 닫고 라우터에도 넘긴다', () => {
    const w = fakeWindow({ id: 'route-2' });
    w.entries.unshift({ id: 'route-1' });
    const onBack = jest.fn();
    /* 흉내 창의 위치를 맨 끝으로 맞춘다. */
    const probe = createSheetHistory(w.win);
    w.win.history.go(1);
    w.settle();
    probe.hold(onBack);

    w.browserBack(2);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(w.router).toHaveBeenCalled();
  });
});

describe('네이티브', () => {
  it('웹이 아니면 아무것도 쌓지 않는다 — 안드로이드 하드웨어 Back은 Modal onRequestClose가 받는다', () => {
    const pushState = jest.fn();
    const g = globalThis as unknown as { window?: unknown };
    const previous = g.window;
    g.window = { history: { pushState, replaceState: jest.fn(), go: jest.fn(), state: null }, location: { href: '' }, addEventListener: jest.fn(), removeEventListener: jest.fn() };
    expect(Platform.OS).not.toBe('web');

    const release = holdBrowserBackForSheet(jest.fn());
    release();
    expect(pushState).not.toHaveBeenCalled();
    g.window = previous;
  });
});

describe('라우터의 뒤로(router.back)', () => {
  it('시트 칸이 얹혀 있으면 건너뛰고 라우터가 뜻한 앞 화면으로 간다 — popstate는 라우터가 받는다', () => {
    const w = fakeWindow({ id: 'route-2' });
    w.entries.unshift({ id: 'route-1' });
    const history = createSheetHistory(w.win);
    w.win.history.go(1);
    w.settle();
    w.router.mockClear();
    const onBack = jest.fn();
    history.hold(onBack);
    expect(w.position()).toBe(3);

    /* 시트의 «나가기» — 라우터가 뒤로 간다. */
    w.win.history.go(-1);
    w.settle();
    expect(w.top()).toEqual({ id: 'route-1' });
    expect(w.router).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
    expect(history.depth()).toBe(0);
  });

  it('닫힌 칸(빼기 전)이 얹혀 있어도 건너뛴다', () => {
    const w = fakeWindow({ id: 'route-2' });
    w.entries.unshift({ id: 'route-1' });
    const history = createSheetHistory(w.win);
    w.win.history.go(1);
    w.settle();
    const release = history.hold(jest.fn());

    release();
    w.win.history.go(-1);
    w.settle();
    expect(w.top()).toEqual({ id: 'route-1' });
  });
});

