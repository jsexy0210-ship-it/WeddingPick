/**
 * 당겨서 새로 고침 — 손가락(웹은 마우스도)이 움직인 거리를 «화면이 얼마나 내려가는가»로 바꾸는 규칙.
 *
 * 2026-09-26 대표 지시 「추가로 화면 자체를 밑으로 내리면 새로고침 진행한다」.
 *
 * 네이티브(iOS · 안드로이드)는 OS의 `RefreshControl`이 이 일을 한다 — 여기 값은 웹 빌드가 같은
 * 움직임을 흉내 낼 때(`pull-refresh-control.web.tsx`) 읽는다. 몸통은 DOM을 모르는 순수 함수라
 * 시험이 문턱 · 방향 · 저항을 그대로 잰다(`pull-gesture.test.ts`).
 *
 * **정본에 수치가 없다.** RN 정본 `common.js` 로더 표는 「당겨서 새로 고침 — 아이콘 순회 20 · 문구
 * 없음」만 적고 거리 · 시간을 적지 않는다. 아래 값은 플랫폼 관례(iOS UIRefreshControl · 안드로이드
 * SwipeRefreshLayout이 손가락 100~130px 안팎에서 걸린다)에서 가져온 임시값이다 — DESIGN_UNRESOLVED.
 */
export const PULL_REFRESH = {
  /** 화면이 이만큼 내려간 채로 놓으면 새로 고친다(손가락으로는 약 120px). */
  threshold: 64,
  /** 아무리 당겨도 이 이상은 내려가지 않는다. */
  max: 128,
  /** 새로 고치는 동안 화면이 머무는 자리 — 표시 상자 40 + 위아래 8. */
  hold: 56,
  /** 방향을 가르기 전에 기다리는 움직임. 브라우저가 스크롤을 시작하는 거리(≈15)보다 작아야 한다. */
  slop: 6,
  /** 끌기 저항 — 처음에는 손가락의 0.75배로 따라오고 `max`에 가까울수록 무거워진다. */
  rate: 0.75,
  /** 표시 상자 — 정본 `common.js` `spin(20)`: 상자 40(20 + 20) · 아이콘 20 · radius 10. */
  indicatorBox: 40,
  indicatorIcon: 20,
  /** 놓은 뒤 제자리로(또는 머무는 자리로) 가는 시간 — `Motion.scrimFade`(200)와 같은 값. */
  settleMs: 200,
  /** 표시가 번쩍이고 사라지지 않게 최소 이만큼은 보여준다. */
  minVisibleMs: 500,
} as const;

/** 손가락이 내려간 거리 → 화면이 내려가는 거리. 0 아래는 0, 위로는 `max`에 붙는다. */
export function resistPull(raw: number): number {
  if (!(raw > 0)) return 0;

  return PULL_REFRESH.max * (1 - Math.exp((-raw * PULL_REFRESH.rate) / PULL_REFRESH.max));
}

/** 놓았을 때 새로 고칠 만큼 내려왔는가. */
export function isArmed(distance: number): boolean {
  return distance >= PULL_REFRESH.threshold;
}

export type PullMove = {
  /** 이 움직임을 당기기가 가져간다 — 웹은 기본 동작(스크롤 · 튕김)을 막는다. */
  capture: boolean;
  /** 화면이 내려갈 거리(px). */
  distance: number;
  armed: boolean;
};

export type PullEnd = 'refresh' | 'cancel' | 'none';

const NOT_MINE: PullMove = { capture: false, distance: 0, armed: false };

/**
 * 한 번의 누름(터치 · 마우스)을 따라간다.
 *
 * ```
 * idle ─begin→ pending ─(아래로 · 맨 위 · 세로가 앞섬)→ pulling ─end→ refresh | cancel
 *                  └──(가로가 앞섬 · 위로 · 맨 위 아님)→ ignored ─end→ none
 * ```
 *
 * **가로가 앞서면 손대지 않는다** — 칩 줄 · 추천 카드 줄의 가로 스크롤 몫이다. **위로 올리거나 맨
 * 위가 아니면** 보통 스크롤 몫이다. 한 번 `ignored`가 된 누름은 끝날 때까지 다시 잡지 않는다.
 */
export function createPullTracker() {
  let phase: 'idle' | 'pending' | 'pulling' | 'ignored' = 'idle';
  let originX = 0;
  let originY = 0;
  let distance = 0;

  return {
    get phase() {
      return phase;
    },
    begin(x: number, y: number): void {
      phase = 'pending';
      originX = x;
      originY = y;
      distance = 0;
    },
    move(x: number, y: number, atTop: boolean): PullMove {
      if (phase === 'idle' || phase === 'ignored') return NOT_MINE;
      const dx = x - originX;
      const dy = y - originY;

      if (phase === 'pending') {
        if (Math.abs(dx) < PULL_REFRESH.slop && Math.abs(dy) < PULL_REFRESH.slop) return NOT_MINE;
        if (Math.abs(dx) >= Math.abs(dy) || dy <= 0 || !atTop) {
          phase = 'ignored';
          return NOT_MINE;
        }
        phase = 'pulling';
      }

      distance = resistPull(dy);
      return { capture: true, distance, armed: isArmed(distance) };
    },
    end(): PullEnd {
      const was = phase;
      const reached = distance;
      phase = 'idle';
      distance = 0;
      if (was !== 'pulling') return 'none';
      return isArmed(reached) ? 'refresh' : 'cancel';
    },
    cancel(): void {
      phase = 'idle';
      distance = 0;
    },
  };
}

export type PullTracker = ReturnType<typeof createPullTracker>;
