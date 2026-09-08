import { useSyncExternalStore } from 'react';

import type { CurrentUser } from '@weddingpick/api-contract';

/**
 * 마지막으로 서버가 알려준 «나». 로더가 닉네임(«{닉네임}님에게 맞는 곳을 찾고
 * 있어요»)과 결정 완료 업종(순회 제외)을 쓰려고 읽는다.
 *
 * 로더 때문에 서버를 새로 부르지 않는다 — `getCurrentUser` · `getAppBootstrap`이
 * 어차피 받아온 값을 여기 적어두고, 화면은 그때까지 알던 값을 쓴다. 아직 아무도
 * 안 불렀으면 null이고 로더는 이름 없이 12업종 전체를 돈다. 로그아웃하면 지운다.
 */
let snapshot: CurrentUser | null = null;
const listeners = new Set<() => void>();

export function rememberCurrentUser(me: CurrentUser | null): void {
  if (me === snapshot) return;
  snapshot = me;
  listeners.forEach((listener) => listener());
}

export function readCurrentUserSnapshot(): CurrentUser | null {
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 서버 호출 없이, 지금까지 알려진 «나». 없으면 null. */
export function useCurrentUserSnapshot(): CurrentUser | null {
  return useSyncExternalStore(subscribe, readCurrentUserSnapshot, readCurrentUserSnapshot);
}
