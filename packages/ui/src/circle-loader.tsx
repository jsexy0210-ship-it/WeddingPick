import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Layout, Motion, USE_NATIVE_DRIVER } from './theme';
import { useTheme } from './use-theme';

/**
 * **기본 로더 · 써클.** Depth를 옮기거나 페이지를 바꾸는 사이처럼 **스쳐 지나가는**
 * 기다림에 쓴다.
 *
 * ```
 * 20   버튼 · 행 안     테두리 2
 * 28   카드 · 시트      테두리 3
 * 40   화면 전체        테두리 4
 * ```
 *
 * 트랙은 `theme.line`(= line.divider #EAEBEE, 시안의 `#eaebee`와 같은 값), 도는 쪽은
 * 스킨 색(기본 coral)이다. 한 바퀴 900ms linear 무한 — RN 정본 `common.js:244` `spinBig`
 * («width:40px;border:3px solid #eaebee;animation:wpSpin 900ms linear infinite»)과 같다.
 *
 * **왜 있는가.** 핸드오프 v3.20(`30-loading.dc.html`)은 «원형 스피너를 쓰지 않아요 —
 * 로더는 업종 아이콘이 도는 것 하나뿐»이라고 적는다. 2026-09-11 대표 지시가 그 규칙을
 * 바꿨다 — 「Depth, 페이지간 이동 시 로딩이 발생할 경우 기본 로더 · 써클을
 * 사용하도록한다」. 대표 결정이 md보다 앞선다(CLAUDE.md).
 *
 * **값은 지어내지 않았다.** 같은 핸드오프의 `17-sheets-states.dc.html`(WP-ST-012
 * 처리 중)이 이미 원형 스피너를 그리고 있었다 —
 * `width:32px;height:32px;border-radius:999px;border:3px solid #eaebee;`
 * `border-top-color:#ff6f61;animation:wpSpin 800ms linear infinite`.
 * 지름만 순회 로더와 같은 자리 이름(20·28·40)으로 맞추고, 두께는 시안의 32:3 비율을
 * 정수 px로 반올림했다(`spec/tokens.json` `size.loaderCircle`의 `$note` 참고).
 *
 * 700ms 규칙은 여기 없다 — 화면이 `useDelayedVisible`로 감싼다.
 *
 * **v3.29 재대조(2026-09-23)** — 정본 WP-LOAD-003이 이 규칙을 다시 뒤집어 「원형
 * 스피너를 쓰지 않는다」고 적지만, 위 2026-09-15 대표 지시가 이미 배포까지 끝낸
 * 더 최근 결정이라 되돌리지 않았다 — 상세 사유는
 * `apps/mobile/src/features/loading/delayed-loader.tsx`의 같은 날짜 주석 참고.
 * `DESIGN_UNRESOLVED`.
 */
export type CircleLoaderSize = 20 | 28 | 40;

export type CircleLoaderProps = {
  /** 원 지름. 20 버튼·행 · 28 카드·시트 · 40 화면 전체. */
  size?: CircleLoaderSize;
  style?: StyleProp<ViewStyle>;
};

/** spec/tokens.json size.loaderCircle — 시안 32:3을 정수 px로 반올림한 두께. */
const STROKE: Record<CircleLoaderSize, number> = {
  20: Layout.loaderCircleStrokeSmall,
  28: Layout.loaderCircleStrokeMedium,
  40: Layout.loaderCircleStrokeLarge,
};

export function CircleLoader({ size = 40, style }: CircleLoaderProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const stroke = STROKE[size];

  /*
   * 트랙 한 바퀴 + 머리 한 조각. `borderTopColor`만 스킨 색으로 덮는 것은 시안과
   * 같은 방식이다 — 원을 두 겹으로 겹치지 않는다.
   */
  const ring = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: stroke,
    borderColor: theme.line,
    borderTopColor: theme.tint,
  } as const;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="불러오는 중"
      style={[styles.wrap, { width: size, height: size }, style]}>
      {reduced ? (
        /* 모션 줄이기를 켰으면 돌리지 않는다 — 멈춘 고리만 남긴다. */
        <View style={ring} />
      ) : Platform.OS === 'web' ? (
        <WebSpin ring={ring} />
      ) : (
        <NativeSpin ring={ring} />
      )}
    </View>
  );
}

type SpinProps = { ring: ViewStyle };

// ─── 모든 고리가 같은 각도로 돈다 ─────────────────────────────────────────────

/**
 * 지금 한 바퀴 중 몇 ms째인가 — **문서(앱) 시계에 맞춘 각도**(2026-09-26 대표 지시 —
 * 「로더 써클만 돌도록 통합한다」).
 *
 * 고리마다 제 마운트 순간을 0°로 삼으면, 화면이 바뀌며 고리가 새로 설 때마다 각도가
 * 튀어 «로더가 새로 선다»로 보인다(로그인 → 약관 동의 사이에 실제로 그랬다). 모든 고리를
 * 같은 시계(웹 `performance.now()` — 페이지가 열린 순간이 0, 네이티브 `Date.now()`)에
 * 맞추면 고리가 갈아 끼워져도 같은 자리에서 이어 돈다. 웹의 첫 HTML(`+html.tsx`)이 그리는
 * CSS 고리도 같은 시계로 맞춘다.
 */
export function spinPhaseMs(now: number = currentClock()): number {
  const period = Motion.loaderCircleSpin;

  return ((now % period) + period) % period;
}

function currentClock(): number {
  if (Platform.OS === 'web' && typeof performance !== 'undefined') return performance.now();

  return Date.now();
}

// ─── 웹 · CSS 키프레임 ────────────────────────────────────────────────────────

const KEYFRAMES_STYLE_ID = 'wp-spin-keyframes';

/** 시안 `30-loading.dc.html` · `17-sheets-states.dc.html`과 같은 이름·식이다. */
export function buildSpinKeyframes(): string {
  return '@keyframes wpSpin{to{transform:rotate(360deg)}}';
}

function ensureSpinKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_STYLE_ID;
  style.textContent = buildSpinKeyframes();
  document.head.appendChild(style);
}

/**
 * react-native-web은 `animationName`을 스타일로 받지 않는다(이름 없는
 * `animationKeyframes`만 안다). 핸드오프 이름 `wpSpin`을 그대로 쓰려고 DOM 노드에
 * 직접 `animation`을 적는다 — `CategoryCycleLoader`의 `WebLayer`와 같은 방식이다.
 */
function WebSpin({ ring }: SpinProps) {
  useEffect(ensureSpinKeyframes, []);

  const attach = useCallback((node: View | null) => {
    const el = node as unknown as { style?: { animation: string } } | null;
    if (el?.style) el.style.animation = `wpSpin ${Motion.loaderCircleSpin}ms linear ${-spinPhaseMs()}ms infinite`;
  }, []);

  return <View ref={attach} style={ring} />;
}

// ─── 네이티브 · Animated ──────────────────────────────────────────────────────

function NativeSpin({ ring }: SpinProps) {
  const [t] = useState(() => new Animated.Value(0));

  useEffect(() => {
    /* 같은 시계에 맞춘 각도에서 출발한다 — 새로 선 고리가 앞 고리를 이어 돈다(`spinPhaseMs`). */
    const phase = spinPhaseMs() / Motion.loaderCircleSpin;
    t.setValue(phase);
    let loop: Animated.CompositeAnimation | null = null;
    const first = Animated.timing(t, {
      toValue: 1,
      duration: Motion.loaderCircleSpin * (1 - phase),
      easing: Easing.linear,
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    first.start(({ finished }) => {
      if (!finished) return;
      t.setValue(0);
      loop = Animated.loop(
        Animated.timing(t, {
          toValue: 1,
          duration: Motion.loaderCircleSpin,
          easing: Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        })
      );
      loop.start();
    });
    return () => {
      first.stop();
      loop?.stop();
    };
  }, [t]);

  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return <Animated.View style={[ring, { transform: [{ rotate }] }]} />;
}

// ─── 모션 줄이기 ──────────────────────────────────────────────────────────────

/** OS가 모션 줄이기를 켰으면 고리를 멈춰 보여준다. `CategoryCycleLoader`와 같은 규칙. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReduced(query.matches);
      update();
      query.addEventListener?.('change', update);
      return () => query.removeEventListener?.('change', update);
    }

    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
