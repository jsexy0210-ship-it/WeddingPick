/**
 * 웹 빌드에서 바깥 주소를 «앱 안»에 띄우는 껍데기의 상태.
 *
 * 2026-09-15 대표 지시 — 「인앱에서 웹 새창 또는 이동 시 앱을 탈출하게 된다. 하여
 * iframe 껍데기 씌워서 웨딩픽 앱 밖으로 나가지 못하게 한다」(CLAUDE.md 「앱 밖으로
 * 나가지 않는다」).
 *
 * **여는 쪽이 화면이 아니라 함수다.** `openExternal()`은 약관 줄을 누른 순간
 * 불리는 그냥 함수라 리액트 상태를 쥐고 있지 않다. 그래서 상태를 모듈 하나에
 * 두고, 뿌리에 붙은 껍데기(`InAppWebShell`)가 그것을 구독한다 — 화면마다
 * 껍데기를 하나씩 달면 어느 화면에서 열었느냐에 따라 껍데기가 탭바 아래 갇힌다.
 *
 * 네이티브에는 이 자리가 없다 — `expo-web-browser`의 시스템 시트가 앱 «위에»
 * 뜨고 닫으면 앱으로 돌아온다(`open-external.ts`).
 */
export type InAppWebRequest = {
  url: string;
  /**
   * 껍데기 머리에 적을 이름. 주소의 호스트를 그대로 쓰지 않는다 — 영문이
   * 사용자 화면에 뜬다(CLAUDE.md 「사용자 화면에 영문을 쓰지 않는다」).
   */
  title: string;
};

/**
 * 잠깐 띄울 안내. **글이 아니라 종류를 쥔다** — 문구는 화면이 정한다
 * (`in-app-web-shell.tsx`의 `S`). 여기에 한글 문장을 두면 카피가 화면 밖으로
 * 흩어진다.
 */
export type InAppWebNotice = 'newWindow';

export type InAppWebState = {
  request: InAppWebRequest | null;
  notice: InAppWebNotice | null;
};

const EMPTY: InAppWebState = { request: null, notice: null };

/**
 * `useSyncExternalStore`가 읽는 스냅샷. 바뀔 때만 새 객체로 갈아 끼운다 —
 * 매번 새로 만들면 구독자가 끝없이 다시 그린다.
 */
let state: InAppWebState = EMPTY;
const listeners = new Set<() => void>();

function set(next: InAppWebState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

/** 앱 안에서 연다. 열림과 동시에 지난 안내는 지운다. */
export function openInAppWeb(request: InAppWebRequest): void {
  set({ request, notice: null });
}

export function closeInAppWeb(): void {
  if (state.request === null) return;

  set({ request: null, notice: state.notice });
}

/** 새 창으로 넘겼다고 알린다. `null`이면 안내를 거둔다. */
export function noticeInAppWeb(notice: InAppWebNotice | null): void {
  if (state.notice === notice) return;

  set({ request: state.request, notice });
}

export function getInAppWeb(): InAppWebState {
  return state;
}

export function subscribeInAppWeb(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
