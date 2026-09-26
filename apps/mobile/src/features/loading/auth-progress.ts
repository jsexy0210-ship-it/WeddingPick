import { Motion } from '@weddingpick/ui';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * 로그인 → 약관 동의 → 온보딩 사이의 **기다림 하나**(2026-09-26 대표 지시 — 「스플래시 →
 * 카카오 로그인 → 로더가 두 번 돈다. 로더 써클만 돌도록 통합한다」 · 「약관 동의 → 온보딩
 * 이동 시 로딩이 발생한다. 로더를 넣거나…」).
 *
 * 전에는 자리마다 제 700ms 시계를 따로 켰다 — 로그인 화면의 진행 표시, 카카오 복귀 부팅
 * (`SigningInView`), 약관 동의, 온보딩이 각자 «0ms부터» 다시 셌다. 그래서 한 번의 로그인에
 * 로더가 섰다가 사라지고 다시 섰고(모양도 뼈대 · 원형 블록으로 갈렸다), 사람은 «로더가
 * 두 번 돈다»로 읽었다.
 *
 * 이제 한 번의 흐름은 **시작 시각 하나**를 나눠 쓴다. 700ms 규칙(`Motion.loaderThreshold`,
 * 정본 `common.js:323` 「700ms 넘으면 무조건 띄워요」)은 그 시작부터 센다 — 그래서 흐름 중간에
 * 화면이 바뀌어도 이미 보인 고리는 계속 보이고, 아직 700ms 전이면 계속 안 보인다. 고리의
 * 각도도 같은 시계에 맞춰 돈다(`@weddingpick/ui` `spinPhaseMs`) — 고리가 갈아 끼워져도
 * 이어 돈다.
 *
 * 시계는 웹 `performance.now()`(페이지가 열린 순간이 0 — 카카오에서 돌아온 새 페이지의 첫
 * HTML이 그리는 고리와 같은 시계다, `app/+html.tsx`), 네이티브 `Date.now()`.
 */
export function authClock(): number {
  if (Platform.OS === 'web' && typeof performance !== 'undefined') return performance.now();

  return Date.now();
}

/** 흐름 하나가 이보다 오래 이어지면 앞 흐름의 찌꺼기로 본다 — 새로 센다. */
const STALE_MS = 120_000;

let startedAt: number | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * 새 흐름을 연다 — 사람이 무언가를 눌러 기다림이 **새로** 시작되는 자리(카카오 단추 ·
 * «동의하고 시작하기»). 앞 흐름이 남아 있어도 지금부터 센다.
 */
export function beginAuthProgress(at: number = authClock()): void {
  startedAt = at;
  notify();
}

/** 흐름을 잇는다 — 이미 열린 흐름이 있으면 그 시작을 쓰고, 없으면 지금 연다. */
export function continueAuthProgress(at: number = authClock()): void {
  if (startedAt !== null && at - startedAt <= STALE_MS) return;
  startedAt = at;
  notify();
}

/** 흐름을 닫는다 — 기다림이 끝나 실제 화면(약관 동의 폼 · 온보딩 첫 질문 · 로그인 단추)이 섰다. */
export function endAuthProgress(): void {
  if (startedAt === null) return;
  startedAt = null;
  notify();
}

/** 지금 흐름의 시작 시각. 시험용. */
export function authProgressStartedAt(): number | null {
  return startedAt;
}

/** 고리가 설 때까지 남은 ms. 흐름이 없으면 null, 이미 섰으면 0 이하. */
function msUntilVisible(now: number = authClock()): number | null {
  if (startedAt === null) return null;

  return startedAt + Motion.loaderThreshold - now;
}

/**
 * 이 흐름에서 고리를 보일 때인가 — 시작부터 700ms가 지났으면 true. 마운트할 때 흐름이
 * 없으면 지금 연다(`continueAuthProgress`).
 *
 * **값을 상태로 든다.** 렌더 중에 모듈 변수 · 시계를 읽어 답을 내면 React Compiler가 그 식을
 * 한 번 계산해 두고 다시 계산하지 않는다 — 고리가 영영 안 선다(2026-09-26 웹 연속 캡처로 확인).
 * 시계는 effect와 타이머에서만 읽는다.
 */
export function useAuthProgressVisible(): boolean {
  const [visible, setVisible] = useState(() => {
    const due = msUntilVisible();

    return due !== null && due <= 0;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const update = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      const due = msUntilVisible();

      if (due === null || due > 0) setVisible(false);
      if (due !== null && due <= 0) setVisible(true);
      if (due !== null && due > 0) timer = setTimeout(update, due);
    };

    listeners.add(update);
    /* 들을 준비를 한 뒤에 잇는다 — 여기서 흐름이 새로 열리면 그 알림으로 다시 잰다. */
    continueAuthProgress();
    update();

    return () => {
      listeners.delete(update);
      if (timer !== null) clearTimeout(timer);
    };
  }, []);

  return visible;
}
