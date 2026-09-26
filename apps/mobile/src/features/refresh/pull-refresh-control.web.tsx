import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement } from 'react';
import { StyleSheet, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';

import {
  Border,
  CATEGORY_CYCLE_ORDER,
  CategoryIcon,
  Motion,
  Radius,
  useReduceMotion,
  useTheme,
} from '@weddingpick/ui';
import strings from '../../../../../spec/strings.ko.json';

import { createPullTracker, PULL_REFRESH } from './pull-gesture';

export type PullRefreshControlProps = RefreshControlProps;

/**
 * 당겨서 새로 고침 — **웹**. 앱 전체가 이 한 벌을 쓴다(2026-09-26 대표 지시 「화면 자체를 밑으로
 * 내리면 새로고침 진행한다」).
 *
 * react-native-web의 `RefreshControl`은 당기는 몸짓이 없는 빈 View다. 다만 ScrollView가
 * `refreshControl`을 **자기 바깥 틀로 감싸 그린다**(`cloneElement(refreshControl, { style }, scrollView)`
 * — FlatList도 같은 길을 탄다). 그 자리를 이 컴포넌트가 받아 스크롤 바깥에 틀 하나를 두고 거기서
 * 몸짓을 읽는다 — 화면 코드는 네이티브와 똑같이 `refreshControl={…}` 한 줄이다.
 *
 * ```
 * 틀(바깥 크기 · 자리 · overflow hidden)
 *  ├ 밀림(끄는 만큼 translateY) ─ 스크롤(원래 스타일에서 바깥 몫을 뺀 것)
 *  └ 표시(상자 40 · 업종 아이콘 20, 화면 위끝을 따라 내려온다)
 * ```
 *
 * 몸짓 — 스크롤이 **맨 위일 때** 아래로 끌면(터치 · 마우스) 저항을 받으며 내려오고, 64px 넘게
 * 내려온 채로 놓으면 `onRefresh`, 아니면 제자리로 돌아간다(`pull-gesture.ts`). 새로 고치는 동안은
 * 56px에 머물고 `refreshing`이 풀리면 올라간다.
 *
 * 손대지 않는 것:
 *   - 가로가 앞서는 끌기 — 칩 줄 · 추천 줄의 가로 스크롤.
 *   - 안쪽 세로 스크롤이 내려가 있을 때 — 그쪽이 먼저 올라간다.
 *   - 시트 · 확인창 · 풀팝업이 떠 있을 때(`aria-modal`) — 시트 끌어 닫기 · 휠 · 날짜 선택은 그 위에서 돈다.
 *   - 두 손가락 · 마우스 오른쪽 단추.
 * 끌기가 잡히면 눌려 있던 카드의 누름을 풀고(ResponderSystem이 «부모의 scroll»로 알아듣는다), 놓은
 * 직후의 click은 삼킨다 — 마우스로 끌다 카드 위에서 놓으면 그 카드가 열리던 것을 막는다.
 * 「움직임 줄이기」면 놓은 뒤 미끄러지지 않고 곧장 자리를 잡는다(손가락을 따라오는 것은 그대로).
 *
 * 표시 — 정본 `common.js` 로더 표 「당겨서 새로 고침 · 아이콘 순회 20 · 문구 없음」, 모양은 같은 파일
 * `spin(20)`(흰 상자 40 · radius 10 · 1px 선 · 코랄 업종 아이콘 20). 끄는 동안은 첫 아이콘이 거리만큼
 * 짙어지고, 새로 고치는 동안 `Motion.loaderIconCycle.perIconSmall`(820ms)마다 다음 업종으로 바뀐다.
 * 2026-09-25 대표 결정 「스켈레톤으로 해」로 화면 로더는 뼈대가 됐지만 당김 표시는 내용을 가리지 않고
 * 위에 떠야 해서 뼈대로 대신할 수 없다 — 정본 표의 이 한 줄을 따랐다. DESIGN_UNRESOLVED.
 */
export function PullRefreshControl({ refreshing, onRefresh, enabled = true, style, children }: PullRefreshControlProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const wrapRef = useRef<View>(null);
  const shiftRef = useRef<View>(null);
  const indicatorRef = useRef<View>(null);
  const [mode, setMode] = useState<'idle' | 'pulling' | 'armed' | 'refreshing'>('idle');

  /* 몸짓은 한 번 붙여 둔 DOM 이벤트가 읽는다 — 매 렌더 새로 붙이지 않게 값은 ref로 넘긴다. */
  const live = useRef({ enabled, refreshing, onRefresh, reduceMotion, mode });
  useEffect(() => {
    live.current = { enabled, refreshing, onRefresh, reduceMotion, mode };
  });

  const paintRef = useRef<(distance: number, animate: boolean, opacity?: number) => void>(() => undefined);

  useEffect(() => {
    const wrap = dom(wrapRef);
    const shift = dom(shiftRef);
    const indicator = dom(indicatorRef);
    if (!wrap || !shift || !indicator) return;

    const tracker = createPullTracker();
    const scroller = () => shift.firstElementChild as HTMLElement | null;
    let captured = false;
    let swallowClickUntil = 0;
    let restoreSelect: (() => void) | null = null;

    /* 맨 위에서 더 끌 때 브라우저가 제 새로 고침 · 튕김으로 번지지 않게 한다. */
    const initial = scroller();
    if (initial) initial.style.overscrollBehaviorY = 'contain';

    const paint = (distance: number, animate: boolean, opacity?: number) => {
      const transition = animate && !live.current.reduceMotion
        ? `transform ${PULL_REFRESH.settleMs}ms ease-out, opacity ${PULL_REFRESH.settleMs}ms ease-out`
        : 'none';
      shift.style.transition = transition;
      shift.style.transform = distance > 0 ? `translate3d(0, ${distance}px, 0)` : '';
      indicator.style.transition = transition;
      indicator.style.transform = `translate3d(0, ${distance - PULL_REFRESH.indicatorBox - GAP}px, 0)`;
      indicator.style.opacity = String(opacity ?? Math.min(1, distance / PULL_REFRESH.threshold));
    };
    paintRef.current = paint;

    const canStart = (target: EventTarget | null) => {
      const now = live.current;
      if (!now.enabled || now.refreshing || now.mode === 'refreshing') return false;
      const node = scroller();
      if (!node || node.scrollTop > 0) return false;
      if (document.querySelector('[aria-modal="true"]')) return false;
      for (let el = target instanceof Element ? target : null; el && el !== node; el = el.parentElement) {
        if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight) return false;
      }
      return true;
    };

    const grab = (mouse: boolean) => {
      captured = true;
      /* 눌려 있던 카드의 누름을 푼다 — ResponderSystem은 응답자를 품은 부모의 scroll을 «스크롤이
         시작됐다»로 읽는다. 스크롤 자신에 쏘면 화면의 onScroll까지 불리므로 밀림 틀에 쏜다. */
      shift.dispatchEvent(new Event('scroll'));
      if (mouse) {
        const body = document.body.style;
        const previous = body.userSelect;
        body.userSelect = 'none';
        window.getSelection()?.removeAllRanges();
        restoreSelect = () => { body.userSelect = previous; };
      }
      setMode('pulling');
    };

    const follow = (x: number, y: number, event: Event, mouse: boolean) => {
      const result = tracker.move(x, y, (scroller()?.scrollTop ?? 1) <= 0);
      if (!result.capture) return;
      if (event.cancelable) event.preventDefault();
      if (!captured) grab(mouse);
      paint(result.distance, false);
      const next = result.armed ? 'armed' : 'pulling';
      if (live.current.mode !== next) {
        live.current.mode = next;
        setMode(next);
      }
    };

    const release = () => {
      const result = tracker.end();
      if (captured) swallowClickUntil = Date.now() + SWALLOW_CLICK_MS;
      captured = false;
      restoreSelect?.();
      restoreSelect = null;
      if (result === 'refresh') {
        live.current.mode = 'refreshing';
        setMode('refreshing');
        paint(PULL_REFRESH.hold, true, 1);
        live.current.onRefresh?.();
      } else if (result === 'cancel') {
        live.current.mode = 'idle';
        setMode('idle');
        paint(0, true);
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        if (captured) release();
        else tracker.cancel();
        return;
      }
      if (!canStart(event.target)) return;
      tracker.begin(event.touches[0].clientX, event.touches[0].clientY);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) follow(touch.clientX, touch.clientY, event, false);
    };
    const onPointerMove = (event: PointerEvent) => follow(event.clientX, event.clientY, event, true);
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      release();
    };
    const onPointerDown = (event: PointerEvent) => {
      /* 터치는 위 touch 이벤트가 맡는다 — 기본 동작(스크롤)을 막을 수 있는 쪽이 그쪽이다. */
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      if (!canStart(event.target)) return;
      tracker.begin(event.clientX, event.clientY);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };
    const onClickCapture = (event: MouseEvent) => {
      if (Date.now() > swallowClickUntil) return;
      swallowClickUntil = 0;
      event.stopPropagation();
      event.preventDefault();
    };

    wrap.addEventListener('touchstart', onTouchStart, { passive: true });
    wrap.addEventListener('touchmove', onTouchMove, { passive: false });
    wrap.addEventListener('touchend', release);
    wrap.addEventListener('touchcancel', release);
    wrap.addEventListener('pointerdown', onPointerDown);
    wrap.addEventListener('click', onClickCapture, true);

    return () => {
      wrap.removeEventListener('touchstart', onTouchStart);
      wrap.removeEventListener('touchmove', onTouchMove);
      wrap.removeEventListener('touchend', release);
      wrap.removeEventListener('touchcancel', release);
      wrap.removeEventListener('pointerdown', onPointerDown);
      wrap.removeEventListener('click', onClickCapture, true);
      onPointerUp();
      restoreSelect?.();
      paintRef.current = () => undefined;
    };
  }, []);

  /*
   * 밖에서 온 `refreshing`을 따른다. 켜지면(당기지 않고 코드가 새로 고쳐도) 머무는 자리에 서고,
   * 꺼지면 올라간다. 놓았는데 켜지지 않는 호출처(onRefresh가 상태를 안 올림)는 잠시 뒤 올라간다.
   */
  useEffect(() => {
    const paint = paintRef.current;
    if (refreshing) {
      if (live.current.mode !== 'refreshing') {
        live.current.mode = 'refreshing';
        setMode('refreshing');
      }
      paint(PULL_REFRESH.hold, true, 1);
      return;
    }
    if (live.current.mode !== 'refreshing') return;
    const settle = () => {
      live.current.mode = 'idle';
      setMode('idle');
      paint(0, true, 0);
    };
    const timer = setTimeout(settle, 0);
    return () => clearTimeout(timer);
  }, [refreshing]);

  useEffect(() => {
    if (mode !== 'refreshing' || refreshing) return;
    const timer = setTimeout(() => {
      if (live.current.refreshing || live.current.mode !== 'refreshing') return;
      live.current.mode = 'idle';
      setMode('idle');
      paintRef.current(0, true, 0);
    }, ORPHAN_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [mode, refreshing]);

  if (!isValidElement(children)) return <>{children}</>;

  const { outer, inner } = splitStyle(style);
  const scroll = cloneElement(children as ReactElement<{ style?: StyleProp<ViewStyle> }>, {
    style: [inner, styles.fill],
  });

  return (
    <View ref={wrapRef} style={[outer, styles.wrap]}>
      <View ref={shiftRef} style={styles.fill}>
        {scroll}
      </View>
      <View
        ref={indicatorRef}
        pointerEvents="none"
        aria-hidden={mode !== 'refreshing'}
        accessibilityRole={mode === 'refreshing' ? 'progressbar' : undefined}
        accessibilityLabel={mode === 'refreshing' ? strings.journey.loading : undefined}
        style={styles.indicator}>
        <View style={[styles.box, { backgroundColor: theme.background, borderColor: theme.line }]}>
          <IconCycle cycling={mode === 'refreshing'} color={theme.tint} />
        </View>
      </View>
    </View>
  );
}

/** 새로 고치는 동안 업종 아이콘을 차례로 바꿔 보인다. 끄는 동안은 첫 아이콘에 머문다. */
function IconCycle({ cycling, color }: { cycling: boolean; color: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!cycling) return;
    const timer = setInterval(() => setStep((value) => value + 1), Motion.loaderIconCycle.perIconSmall);
    return () => clearInterval(timer);
  }, [cycling]);

  const shown = cycling ? step % CATEGORY_CYCLE_ORDER.length : 0;

  return (
    <>
      {CATEGORY_CYCLE_ORDER.map((kind, index) => (
        <View key={kind} style={[styles.icon, FADE, { opacity: index === shown ? 1 : 0 }]}>
          <CategoryIcon kind={kind} size={PULL_REFRESH.indicatorIcon} color={color} />
        </View>
      ))}
    </>
  );
}

function dom(ref: { current: View | null }): HTMLElement | null {
  return (ref.current as unknown as HTMLElement | null) ?? null;
}

/** 틀이 가져갈 스타일 — 크기 · 자리 · 바깥 여백. 나머지(배경 · overflow · 안쪽 여백 …)는 스크롤에 남는다. */
const OUTER_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'order',
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'aspectRatio',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'marginStart', 'marginEnd', 'marginBlock', 'marginBlockStart', 'marginBlockEnd',
  'marginInline', 'marginInlineStart', 'marginInlineEnd',
  'position', 'top', 'bottom', 'left', 'right', 'start', 'end', 'inset', 'zIndex',
]);

function splitStyle(style: StyleProp<ViewStyle>) {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) (OUTER_KEYS.has(key) ? outer : inner)[key] = value;
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

/** 표시 상자 위아래 여백 — 머무는 자리 56 = 8 + 40 + 8. */
const GAP = (PULL_REFRESH.hold - PULL_REFRESH.indicatorBox) / 2;
/** 끌기를 놓은 직후 이 안에 오는 click은 끌기의 끝이지 누름이 아니다. */
const SWALLOW_CLICK_MS = 400;
/** 놓았는데 `refreshing`이 켜지지 않으면 이만큼 뒤 올라간다. */
const ORPHAN_SETTLE_MS = 1_000;
/** 아이콘 바뀜 — 정본 `wpSwap` 키프레임의 옅어지는 구간(한 칸 820ms 중 약 240ms). */
const FADE = {
  transitionProperty: 'opacity',
  transitionDuration: '240ms',
  transitionTimingFunction: 'linear',
} as unknown as ViewStyle;

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  fill: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0,
    transform: [{ translateY: -(PULL_REFRESH.indicatorBox + GAP) }],
  },
  /* 정본 `spin(20).box` — 40 · radius 10 · 흰 바탕 · 1px #eaebee 선. */
  box: {
    width: PULL_REFRESH.indicatorBox,
    height: PULL_REFRESH.indicatorBox,
    borderRadius: Radius.medium,
    borderWidth: Border.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { position: 'absolute' },
});
