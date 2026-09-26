import { createPullTracker, isArmed, PULL_REFRESH, resistPull } from './pull-gesture';

/**
 * 당겨서 새로 고침 몸짓(웹) — 문턱 · 방향 · 저항을 숫자로 못 박는다.
 *
 * 2026-09-26 대표 지시 「화면 자체를 밑으로 내리면 새로고침 진행한다」. 네이티브는 OS가 그리고,
 * 웹은 `pull-refresh-control.web.tsx`가 이 규칙으로 따라간다.
 */
describe('끌기 저항', () => {
  it('0 아래는 0, 처음엔 손가락의 0.75배로 따라오고 max를 넘지 않는다', () => {
    expect(resistPull(-40)).toBe(0);
    expect(resistPull(0)).toBe(0);
    expect(resistPull(4)).toBeCloseTo(3, 0);
    expect(resistPull(10_000)).toBeLessThanOrEqual(PULL_REFRESH.max);
    expect(resistPull(10_000)).toBeGreaterThan(PULL_REFRESH.max - 1);
  });

  it('더 당길수록 더 내려오지만 점점 무거워진다', () => {
    const steps = [20, 60, 100, 140, 180].map(resistPull);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
      if (i > 1) expect(steps[i] - steps[i - 1]).toBeLessThan(steps[i - 1] - steps[i - 2]);
    }
  });

  it('문턱 64 — 손가락 약 120px에서 걸린다', () => {
    expect(PULL_REFRESH.threshold).toBe(64);
    expect(isArmed(resistPull(110))).toBe(false);
    expect(isArmed(resistPull(125))).toBe(true);
    expect(isArmed(PULL_REFRESH.hold)).toBe(false);
  });
});

describe('한 번의 누름', () => {
  it('맨 위에서 아래로 끌어 문턱을 넘겨 놓으면 새로 고친다', () => {
    const tracker = createPullTracker();
    tracker.begin(100, 100);
    expect(tracker.move(100, 103, true).capture).toBe(false); // 아직 방향을 모른다
    const first = tracker.move(101, 110, true);
    expect(first.capture).toBe(true);
    expect(first.distance).toBeCloseTo(resistPull(10), 5);
    const far = tracker.move(102, 240, true);
    expect(far.armed).toBe(true);
    expect(tracker.end()).toBe('refresh');
    expect(tracker.phase).toBe('idle');
  });

  it('문턱 전에 놓으면 제자리로 — 새로 고치지 않는다', () => {
    const tracker = createPullTracker();
    tracker.begin(0, 0);
    tracker.move(0, 60, true);
    expect(tracker.end()).toBe('cancel');
  });

  it('도로 올려 놓으면 거리는 0에 붙고 새로 고치지 않는다', () => {
    const tracker = createPullTracker();
    tracker.begin(0, 100);
    tracker.move(0, 250, true);
    const back = tracker.move(0, 60, true);
    expect(back).toEqual({ capture: true, distance: 0, armed: false });
    expect(tracker.end()).toBe('cancel');
  });

  it('가로가 앞서면 칩 줄 가로 스크롤 몫 — 끝날 때까지 다시 잡지 않는다', () => {
    const tracker = createPullTracker();
    tracker.begin(200, 100);
    expect(tracker.move(180, 104, true).capture).toBe(false);
    expect(tracker.phase).toBe('ignored');
    expect(tracker.move(180, 300, true).capture).toBe(false);
    expect(tracker.end()).toBe('none');
  });

  it('위로 올리면 보통 스크롤 몫이다', () => {
    const tracker = createPullTracker();
    tracker.begin(0, 300);
    expect(tracker.move(0, 280, true).capture).toBe(false);
    expect(tracker.move(0, 500, true).capture).toBe(false);
    expect(tracker.end()).toBe('none');
  });

  it('맨 위가 아니면 잡지 않는다 — 내려가 있는 목록은 그냥 스크롤된다', () => {
    const tracker = createPullTracker();
    tracker.begin(0, 0);
    expect(tracker.move(0, 200, false).capture).toBe(false);
    expect(tracker.end()).toBe('none');
  });

  it('begin 없이 온 움직임 · cancel 뒤 움직임은 무시한다', () => {
    const tracker = createPullTracker();
    expect(tracker.move(0, 300, true).capture).toBe(false);
    tracker.begin(0, 0);
    tracker.move(0, 200, true);
    tracker.cancel();
    expect(tracker.move(0, 300, true).capture).toBe(false);
    expect(tracker.end()).toBe('none');
  });
});
