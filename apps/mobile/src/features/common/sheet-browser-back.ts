import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * 웹 브라우저 뒤로가기가 **열린 시트 · 풀팝업만 닫는다**(CLAUDE.md 공통 UI 규칙 「Overlay가 열려 있으면
 * Back은 Overlay만 닫음」 · 2026-09-26 대표 지시 「검색 -> 필터도 공통 바텀시트 UX 적용한다」 · 같은 날
 * 「진행해」 — 앱의 모든 상태형 바텀시트 · 풀팝업으로 넓힌다).
 *
 * 상태로 여는 오버레이(라우트가 아닌 시트)는 주소가 바뀌지 않는다. 그대로 두면 브라우저 뒤로가기가 시트
 * 뒤의 화면째 이전 주소로 떠났다 — 안드로이드 뒤로가기(`Modal onRequestClose`)는 시트만 닫는데 웹만
 * 달랐다. 그래서 오버레이가 열릴 때 **같은 주소로 한 칸** 쌓고(`pushState`), 그 칸이 빠지면(뒤로가기)
 * 오버레이를 닫는다.
 *
 *   - 쌓는 칸의 state는 지금 칸을 그대로 복사하고 표식만 더한다 — 라우터(expo-router 메모리 히스토리)는
 *     state의 `id`로 자기 자리를 찾으므로 같은 `id`면 자리가 어긋나지 않는다.
 *   - 쌓은 칸이 빠지는 popstate는 **캡처 단계**에서 먼저 받아 라우터에 넘기지 않는다
 *     (`stopImmediatePropagation`). 뒤로가기가 쌓은 칸 아래(다른 화면)까지 한꺼번에 갔으면 라우터에도 넘긴다.
 *   - **중첩**(시트 위 시트): 칸이 열린 순서대로 쌓인다. 뒤로가기 한 번은 맨 위 하나만 닫는다.
 *   - 오버레이가 다른 길(X · 딤 · 끌기 · CTA)로 닫히면 쌓은 칸을 스스로 뺀다(`history.go(-n)`). 그 popstate도
 *     라우터에 넘기지 않는다. 아래 칸이 아직 열린 오버레이 것이면 위만 뺀다.
 *   - **닫힘 직후 라우팅**: 칸을 빼는 뒤로가기는 비동기다. 그 사이 라우터가 `pushState`/`replaceState`를
 *     부르면(시트의 단추가 닫고 곧바로 다른 화면으로 간다) 뒤로가기가 새 화면을 되돌려 버린다. 그래서
 *     빼는 중에 들어온 push/replace는 **빼기가 끝난 뒤로 미룬다**(`history` 두 함수를 한 번 감싼다).
 *   - 닫을 수 없는 오버레이(`sticky`)는 뒤로가기에 닫히지 않는다 — 칸을 다시 쌓아 화면을 지킨다
 *     (네이티브의 `onRequestClose={noop}`와 같다).
 *   - 히스토리가 비어 있는 첫 진입(주소로 바로 들어옴)에서도 같다 — 쌓은 칸이 있으니 뒤로 갈 곳이 생긴다.
 *
 * 네이티브는 할 일이 없다 — 안드로이드 하드웨어 뒤로가기는 `Modal onRequestClose`가 받는다. 두 길이
 * 겹치지 않는다.
 */
export type BrowserBackWindow = {
  history: Pick<History, 'state' | 'pushState' | 'replaceState' | 'go'>;
  location: { href: string };
  addEventListener: (type: 'popstate', listener: (event: Event) => void, capture: boolean) => void;
  removeEventListener: (type: 'popstate', listener: (event: Event) => void, capture: boolean) => void;
};

/** 쌓은 칸의 표식. 오버레이마다 다른 값이라 중첩돼도 제 칸만 알아본다. */
export const SHEET_HISTORY_KEY = '__wpSheet';

/** 우리가 부른 go(-n)의 popstate를 기다리는 시간 — 오지 않으면(브라우저가 막음) 미뤄 둔 이동을 흘려보낸다. */
const POP_TIMEOUT = 1000;

/** 닫힌 칸을 빼기 전에 기다리는 시간 — 시트가 내려가는 시간(`Motion.sheetExit` 250)을 넘긴다. */
export const RELEASE_SETTLE = 300;

type Held = {
  token: string;
  /** 쌓기 전 칸의 라우터 id — 뒤로가기가 이 칸에 멈췄는지(같은 화면인지) 본다. */
  baseId: unknown;
  onBack: () => void;
  sticky: boolean;
  released: boolean;
  /** 이 칸이 맨 위일 때 라우터가 마지막으로 갈아 쓴 값(같은 화면 안의 변화) — 칸을 뺀 뒤 아래 칸에 옮긴다. */
  replaced?: Parameters<History['replaceState']>;
};

/** 칸을 빼는 동안 미뤄 둔 히스토리 조작(라우터의 push/replace · 새로 열린 오버레이의 칸). */
type Deferred = () => void;

export type SheetHistory = {
  hold: (onBack: () => void, options?: { sticky?: boolean }) => () => void;
  /** 시험용 — 지금 쌓여 있는 칸 수. */
  depth: () => number;
};

function stateOf(win: BrowserBackWindow): Record<string, unknown> | null {
  const state = win.history.state as unknown;
  return state && typeof state === 'object' ? (state as Record<string, unknown>) : null;
}

/** 창 하나에 하나. 오버레이가 몇 개든 칸 · 듣기 · 감싸기를 한 곳에서 한다. */
export function createSheetHistory(win: BrowserBackWindow): SheetHistory {
  const stack: Held[] = [];
  let sequence = 0;
  /* 우리가 부른 go(-n) 중 아직 popstate가 오지 않은 수. */
  let pending = 0;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  const deferred: Deferred[] = [];

  /* 원래 함수 — 감싸기 전에 잡아 둔다. 우리 칸을 쌓고 미룬 이동을 흘려보낼 때 쓴다. */
  const rawPush = win.history.pushState.bind(win.history);
  const rawReplace = win.history.replaceState.bind(win.history);
  const rawGo = win.history.go.bind(win.history);
  /* 라우터가 부른 뒤로(go(-n)) 중 아직 popstate가 오지 않은 수 — 그 popstate는 라우터 몫이다. */
  let routerPops = 0;

  const flush = () => {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
    pending = 0;
    for (const run of deferred.splice(0)) run();
  };

  /* 라우터의 push/replace — 칸을 빼는 중이면 끝난 뒤로 미룬다. */
  win.history.pushState = (...args: Parameters<History['pushState']>) => {
    if (pending > 0) deferred.push(() => rawPush(...args));
    else rawPush(...args);
  };
  /*
   * 라우터는 같은 화면 안의 상태가 바뀔 때도 지금 칸을 `{ id }`로 갈아 쓴다. 우리 칸이 맨 위일 때 그대로
   * 두면 표식이 지워져 닫을 때 칸을 못 뺀다 — 표식을 이어 붙인다.
   */
  const keepMarker = (args: Parameters<History['replaceState']>): Parameters<History['replaceState']> => {
    const marker = stateOf(win)?.[SHEET_HISTORY_KEY];
    const [data, ...rest] = args;
    const held = typeof marker === 'string' ? stack.find((entry) => entry.token === marker) : undefined;
    if (!held || !data || typeof data !== 'object') return args;
    held.replaced = args;
    return [{ ...(data as Record<string, unknown>), [SHEET_HISTORY_KEY]: marker }, ...rest];
  };
  /*
   * 뺀 칸들 중 가장 나중 것이 들고 있던 «같은 화면 안의 변화»를 아래 칸에 옮긴다. 옮기지 않으면 칸을 빼는
   * 순간 주소가 시트를 열기 전 값으로 돌아간다(화면은 바뀐 채로).
   */
  const carryReplace = (popped: readonly Held[]) => {
    const last = [...popped].reverse().find((held) => held.replaced)?.replaced;
    if (last) rawReplace(...last);
  };
  win.history.replaceState = (...args: Parameters<History['replaceState']>) => {
    if (pending > 0) deferred.push(() => rawReplace(...keepMarker(args)));
    else rawReplace(...keepMarker(args));
  };

  const goBack = (steps: number) => {
    pending += 1;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(flush, POP_TIMEOUT);
    rawGo(-steps);
  };

  const pushEntry = (held: Held) => {
    const write = () => {
      const base = stateOf(win) ?? {};
      held.baseId = base.id;
      rawPush({ ...base, [SHEET_HISTORY_KEY]: held.token }, '', win.location.href);
    };
    /* 칸을 빼는 중에 열렸다 — 빼기가 끝난 뒤에 쌓아야 순서가 맞다. */
    if (pending > 0) deferred.push(write);
    else write();
  };

  /*
   * 라우터의 뒤로(`router.back()` → `history.go(-1)`) — 우리 칸이 맨 위에 얹혀 있으면 그 칸들을 건너뛰어
   * 라우터가 뜻한 화면으로 간다. 건너뛰지 않으면 라우터의 뒤로가기가 우리 칸 하나만 빼고 끝나 화면이
   * 그대로 남는다(시트의 «나가기» · 라우트를 닫는 단추). 건너뛴 칸의 오버레이는 화면과 함께 걷힌다.
   */
  win.history.go = (delta?: number) => {
    if (pending > 0) {
      deferred.push(() => win.history.go(delta));
      return;
    }
    if (delta !== undefined && delta < 0) {
      const top = stateOf(win)?.[SHEET_HISTORY_KEY];
      const at = stack.findIndex((held) => held.token === top);
      if (at >= 0) {
        /* 쌓인 칸은 맨 위에 붙어 있다 — 0..at이 모두 라우터의 칸 위에 있다. */
        stack.splice(0);
        expectRouterPop();
        rawGo(delta - (at + 1));
        return;
      }
    }
    if (delta !== undefined && delta !== 0) expectRouterPop();
    rawGo(delta);
  };
  /* 라우터의 go가 움직이지 못하면(갈 곳이 없다) popstate가 오지 않는다 — 제한 시간 뒤 잊는다. */
  let routerPopTimer: ReturnType<typeof setTimeout> | null = null;
  function expectRouterPop() {
    routerPops += 1;
    if (routerPopTimer) clearTimeout(routerPopTimer);
    routerPopTimer = setTimeout(() => {
      routerPops = 0;
      routerPopTimer = null;
    }, POP_TIMEOUT);
  }

  const onPop = (event: Event) => {
    if (routerPops > 0) {
      /* 라우터가 부른 이동 — 그대로 넘긴다. */
      routerPops -= 1;
      return;
    }
    if (pending > 0) {
      /* 우리가 뺀 칸 — 라우터가 할 일이 없다. */
      event.stopImmediatePropagation();
      pending -= 1;
      if (pending === 0) flush();
      return;
    }

    const top = stateOf(win)?.[SHEET_HISTORY_KEY];
    const at = stack.findIndex((held) => held.token === top);
    const popped = stack.slice(at + 1);
    if (popped.length === 0) return; // 앞으로 가기 · 우리와 무관한 이동 — 라우터 몫이다.

    /* 같은 화면(쌓기 전 칸)에 멈췄으면 라우터에 넘기지 않는다. 더 멀리 갔으면 라우터도 받는다. */
    const landedId = stateOf(win)?.id;
    const sameScreen = at >= 0 || landedId === popped[0]!.baseId;
    if (sameScreen) event.stopImmediatePropagation();

    stack.splice(at + 1);
    if (sameScreen) carryReplace(popped);
    const sticky = sameScreen ? popped.filter((held) => held.sticky && !held.released) : [];
    /* 안쪽부터 닫는다. 닫을 수 없는 것은 칸을 다시 쌓아 그대로 둔다. */
    for (const held of [...popped].reverse()) {
      if (held.released || sticky.includes(held)) continue;
      held.onBack();
    }
    for (const held of sticky) {
      stack.push(held);
      pushEntry(held);
    }
  };
  win.addEventListener('popstate', onPop, true);

  const hold: SheetHistory['hold'] = (onBack, options) => {
    sequence += 1;
    const held: Held = {
      token: `sheet-${sequence}`,
      baseId: stateOf(win)?.id,
      onBack,
      sticky: options?.sticky === true,
      released: false,
    };
    stack.push(held);
    pushEntry(held);

    return () => {
      if (held.released) return;
      held.released = true;
      if (!stack.includes(held)) return; // 뒤로가기로 이미 빠졌다.
      scheduleTrim();
    };
  };

  /*
   * 닫힌 칸 빼기는 잠깐(`RELEASE_SETTLE`) 기다렸다 한다. 시트의 단추는 닫고 곧바로 다른 화면으로 가는 일이
   * 많다(«Pick 목록 보기»). 곧바로 뒤로 가면 그 사이 라우터가 쌓은 새 화면을 되돌려 버린다(2026-09-26
   * 브라우저 확인). 기다린 뒤 맨 위가 여전히 우리 칸일 때만 뺀다 — 라우터가 위에 쌓았으면 빼지 않는다
   * (그 칸은 같은 화면의 빈 칸으로 남고, 뒤로가기 한 번이 제자리에 머문다 — 새 화면을 잃는 것보다 낫다).
   */
  let trimTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleTrim = () => {
    if (trimTimer) return;
    trimTimer = setTimeout(trim, RELEASE_SETTLE);
  };
  const trim = () => {
    trimTimer = null;
    if (pending > 0) {
      scheduleTrim();
      return;
    }
    /* 맨 위부터 이어서 닫힌 칸만 뺀다 — 아래 칸이 아직 열린 오버레이 것이면 남긴다. */
    const top = stack[stack.length - 1];
    if (!top?.released) return;
    const popped: Held[] = [];
    while (stack.length > 0 && stack[stack.length - 1]!.released) popped.push(stack.pop()!);
    if (stateOf(win)?.[SHEET_HISTORY_KEY] !== top.token) return;
    goBack(popped.length);
    /* 뒤로 간 뒤(아래 칸에 섰을 때) 옮긴다 — 미뤄 둔 이동보다 먼저. */
    deferred.unshift(() => carryReplace(popped));
  };

  return { hold, depth: () => stack.length };
}

let shared: SheetHistory | null = null;

/**
 * 앱에서 부르는 자리 — 웹이고 창이 있을 때만 쌓는다. 그 밖(네이티브 · 정적 내보내기)에는 아무것도 하지
 * 않는다. 돌려주는 함수는 오버레이가 다른 길로 닫힐 때 부른다.
 */
export function holdBrowserBackForSheet(onBack: () => void, options?: { sticky?: boolean }): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.history?.pushState) return noop;
  shared ??= createSheetHistory(window as unknown as BrowserBackWindow);
  return shared.hold(onBack, options);
}

function noop() {}

/**
 * 오버레이 껍데기(공통 바텀시트 · 풀팝업)가 부르는 훅. `active`인 동안 칸을 하나 쥔다.
 *
 * 뒤로가기에 `onRequestClose`를 부른 뒤에도 오버레이가 그대로면(입력 중 확인창을 띄우고 닫지 않았다)
 * 칸을 다시 쥔다 — 그러지 않으면 다음 뒤로가기가 화면째 떠난다. `sticky`면 닫지 않고 칸만 지킨다.
 */
export function useBrowserBackClose(
  active: boolean,
  onRequestClose: () => void,
  options?: { sticky?: boolean }
): { rearm: () => void } {
  const sticky = options?.sticky === true;
  const requestCloseRef = useRef(onRequestClose);
  const activeRef = useRef(active);
  useEffect(() => {
    requestCloseRef.current = onRequestClose;
    activeRef.current = active;
  }, [active, onRequestClose]);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (sticky) return holdBrowserBackForSheet(noop, { sticky: true });
    let timer: ReturnType<typeof setTimeout> | null = null;
    const release = holdBrowserBackForSheet(() => {
      requestCloseRef.current();
      timer = setTimeout(() => {
        if (activeRef.current) setEpoch((value) => value + 1);
      }, 0);
    });
    return () => {
      if (timer) clearTimeout(timer);
      release();
    };
  }, [active, sticky, epoch]);

  /*
   * 칸을 다시 쥔다 — 확인창을 비동기로 띄워 «계속 쓰기»가 뒤늦게 정해지는 호출부가 부른다(저절로 다시
   * 쥐는 것은 뒤로가기 직후 한 번 본다). 이미 쥐고 있으면 칸이 하나 더 쌓이지 않는다 — 예전 칸을 놓고 새로 쥔다.
   */
  const rearm = useCallback(() => {
    if (activeRef.current) setEpoch((value) => value + 1);
  }, []);
  return { rearm };
}
