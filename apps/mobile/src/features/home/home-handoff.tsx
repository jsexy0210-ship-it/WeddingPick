import { usePathname } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { getAppBootstrap } from '@/api/client';
import { HomeSkeleton } from './home-skeleton';

/**
 * 온보딩 저장 → 홈 첫 자료까지 **한 장의 홈 골격**을 유지한다(2026-09-26 대표 감사 4).
 *
 * 전에는 골격이 두 번 그려졌다. 초기 설정이 저장하는 동안 `setup.tsx`가 제 안에
 * `HomeSkeleton`을 그리고, 저장이 끝나 홈으로 넘어가면 홈(`app/(tabs)/index.tsx`)이
 * 제 `HomeSkeleton`을 **새로** 마운트했다. 같은 모양이지만 다른 인스턴스라 반짝임이
 * 처음부터 다시 돌고, 그 사이에 화면 전환 애니메이션까지 끼어 «로더가 한 번 더 뜬다»로
 * 보였다.
 *
 * 이제 골격은 뿌리(`app/_layout.tsx`)의 `HomeHandoffHost` 하나가 들고 있다. 설정이
 * 저장을 시작하면 `beginHomeHandoff()`로 켜고, 홈이 첫 자료를 그릴 수 있게 되면
 * `endHomeHandoff()`로 끈다. 화면이 바뀌어도 이 골격은 내려가지 않는다 — 화면 전환은
 * 그 아래에서 일어난다.
 *
 * **서버를 두 번 묻지 않는다.** 저장이 끝나면 `prefetchHomeBootstrap()`이 홈의
 * `GET /v1/app/bootstrap`를 먼저 띄우고, 홈이 같은 주소를 부르면 API 클라이언트가
 * 가 있는 요청 하나로 합친다(`api/client.ts` `inFlightReads` · 30초 캐시).
 * `api/client.test.ts`가 그 횟수를 센다.
 *
 * **켜 둔 채로 남지 않게** 세 곳이 끈다 — 저장 실패 · 로그인으로 돌려보낼 때(설정 화면),
 * 홈이 자료를 그리거나 오류를 그릴 때(홈), 그리고 설정·홈이 아닌 화면에 닿았을 때(여기).
 * 그래도 남으면 `HOME_HANDOFF_FAILSAFE_MS` 뒤에 스스로 걷힌다.
 */
let active = false;
const listeners = new Set<() => void>();
/**
 * 마지막 안전줄. 위 셋이 모두 빠져도 화면 전체를 덮은 골격이 앱을 잠그지 않게 한다.
 * API 요청 한도(`api/client.ts` `REQUEST_TIMEOUT_MS` 45초)보다 길게 잡는다 — 그 안에서는
 * 홈이 자료나 오류로 스스로 걷는다. 걷힌 뒤에도 홈이 아직 기다리면 홈 제 골격이 같은 자리에 선다.
 */
export const HOME_HANDOFF_FAILSAFE_MS = 50_000;
let failsafe: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

export function beginHomeHandoff(): void {
  if (active) return;
  active = true;
  failsafe = setTimeout(endHomeHandoff, HOME_HANDOFF_FAILSAFE_MS);
  emit();
}

export function endHomeHandoff(): void {
  if (failsafe !== null) {
    clearTimeout(failsafe);
    failsafe = null;
  }
  if (!active) return;
  active = false;
  emit();
}

export function isHomeHandoffActive(): boolean {
  return active;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useHomeHandoffActive(): boolean {
  return useSyncExternalStore(subscribe, isHomeHandoffActive, isHomeHandoffActive);
}

/** 홈이 부를 bootstrap을 미리 띄운다. 실패는 홈이 다시 물어 스스로 말한다 — 여기서는 삼킨다. */
export function prefetchHomeBootstrap(): void {
  void getAppBootstrap().catch(() => undefined);
}

/** 넘겨주는 동안 골격이 설 수 있는 주소 — 초기 설정과 홈뿐이다. */
const HANDOFF_PATHS = new Set(['/setup', '/']);

export function HomeHandoffHost() {
  const visible = useHomeHandoffActive();
  const pathname = usePathname();

  useEffect(() => {
    if (visible && !HANDOFF_PATHS.has(pathname)) endHomeHandoff();
  }, [pathname, visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} testID="home-handoff">
      <HomeSkeleton />
    </View>
  );
}
