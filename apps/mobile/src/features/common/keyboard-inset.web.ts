import { useEffect, useSyncExternalStore } from 'react';

import {
  KEYBOARD_HIDDEN,
  createWebKeyboardSource,
  type KeyboardInset,
  type WebKeyboardEnv,
  type WebKeyboardSource,
} from './keyboard-inset.shared';

export { KEYBOARD_HIDDEN, type KeyboardInset } from './keyboard-inset.shared';

/**
 * 웹 — `visualViewport`로 잰 키패드 높이(`keyboard-inset.shared.ts`). 앱 전체가 출처 하나를 나눠 쓴다.
 * 정적 내보내기(서버에서 그리기)에는 창이 없어 «키패드 없음»으로 그린다.
 */
let source: WebKeyboardSource | null = null;

function webSource(): WebKeyboardSource | null {
  if (source) return source;
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  source = createWebKeyboardSource({ window, document } as unknown as WebKeyboardEnv);

  return source;
}

function subscribe(listener: () => void): () => void {
  return webSource()?.subscribe(listener) ?? noop;
}

function getSnapshot(): KeyboardInset {
  return webSource()?.getSnapshot() ?? KEYBOARD_HIDDEN;
}

function getServerSnapshot(): KeyboardInset {
  return KEYBOARD_HIDDEN;
}

/** 지금 키패드가 가린 아래 높이 · 떠 있는지. */
export function useKeyboardInset(): KeyboardInset {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * 앱 뿌리(`#root`)를 키패드 위로 줄인다 — 루트 레이아웃에서 한 번 부른다.
 *
 * 화면(스택 카드) · 하단 고정 dock · 온보딩 · 문의 · 검색처럼 모달이 아닌 것은 전부 `#root` 안에
 * 있다. 그 높이를 보이는 영역만큼으로 줄이면 dock은 키패드 바로 위로, 가운데 스크롤은 그만큼
 * 짧아진다 — 화면마다 따로 밀지 않는다. 모달(바텀시트 · 풀팝업)은 `body`에 따로 붙어서
 * `KeyboardAvoid lift`가 맡는다.
 */
export function useKeyboardAvoidingRoot(): void {
  useEffect(() => webSource()?.attachRoot(), []);
}

function noop() {}
