import { useCallback, useEffect, useMemo, useState } from 'react';
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

import {
  CATEGORY_CYCLE_ORDER,
  CATEGORY_ICON_LABEL,
  CategoryIcon,
  type CategoryIconKind,
} from './category-icon';
import { Motion } from './theme';
import { useTheme } from './use-theme';

/**
 * v3.20 — 웨딩픽의 **유일한 로더**. 업종 아이콘이 흰 박스 안에서 순서대로 바뀐다.
 *
 * 원형 스피너를 새로 만들지 않는다. 크기만 20 · 28 · 40으로 바꾼다.
 *
 * ```
 * 20   버튼 · 행 안    박스 radius 10    아이콘당 820ms
 * 28   카드 · 시트     박스 radius 12    아이콘당 820ms
 * 40   화면 전체       박스 radius 14    아이콘당 620ms
 * ```
 *
 * 박스는 padding 10 · inset 1px #EAEBEE(border) · 흰 배경. 아이콘은 coral, stroke 1.8.
 *
 * **순회 대상 = 12업종 − `exclude`.** 온보딩에서 «결정 완료»로 고른 업종을 `exclude`로
 * 넘기면 그 업종은 돌지 않는다 — 이미 정한 웨딩홀을 다시 찾는 척하지 않는다. 남는
 * 것이 하나면 그 아이콘만 멈춰 보이고, 전부 빼 버리면 12종 전체를 돈다(빈 박스를
 * 보여주지 않는다).
 *
 * 웹은 CSS `@keyframes wpSwap${N}`(N = 순회 개수)로, 네이티브는 `Animated` 하나로
 * 같은 타이밍을 낸다 — 슬롯 = 100/N %, 홀드 슬롯의 70%, 페이드는 슬롯 끝에서
 * 정확히 끝난다. 하나의 키프레임을 모든 개수에 재사용하면 아이콘이 겹쳐 보인다.
 *
 * 700ms 규칙은 여기 없다 — 화면이 `useDelayedVisible`로 감싼다.
 */
export type CategoryCycleLoaderSize = 20 | 28 | 40;

export type CategoryCycleLoaderProps = {
  /** 아이콘 한 변. 박스는 여기에 padding 10씩 더한 40 · 48 · 60. */
  size?: CategoryCycleLoaderSize;
  /** 온보딩 결정 완료 업종. 순회에서 뺀다. */
  exclude?: readonly CategoryIconKind[];
  style?: StyleProp<ViewStyle>;
};

/** spec/tokens.json size.loader — 박스 padding 10 · radius 10/12/14. */
const BOX_PADDING = 10;
const BOX_RADIUS: Record<CategoryCycleLoaderSize, number> = { 20: 10, 28: 12, 40: 14 };
/** 슬롯 안에서 아이콘이 완전히 보이는 비율. 그 뒤 슬롯 끝까지 페이드. */
const HOLD_RATIO = 0.7;

/** 12업종에서 `exclude`를 뺀 순회 순서. 전부 빠지면 12종 전체. */
export function resolveCategoryCycle(
  exclude?: readonly CategoryIconKind[]
): readonly CategoryIconKind[] {
  if (!exclude || exclude.length === 0) return CATEGORY_CYCLE_ORDER;
  const rest = CATEGORY_CYCLE_ORDER.filter((kind) => !exclude.includes(kind));
  return rest.length > 0 ? rest : CATEGORY_CYCLE_ORDER;
}

/** 아이콘당 머무는 시간. 전체 화면(40)만 빠르다. */
export function categoryCyclePerIconMs(size: CategoryCycleLoaderSize): number {
  return size === 40 ? Motion.loaderIconCycle.perIconFull : Motion.loaderIconCycle.perIconSmall;
}

export function CategoryCycleLoader({ size = 40, exclude, style }: CategoryCycleLoaderProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const excludeKey = exclude?.join(',') ?? '';
  // eslint-disable-next-line react-hooks/exhaustive-deps -- exclude는 join한 키로 비교한다
  const order = useMemo(() => resolveCategoryCycle(exclude), [excludeKey]);
  const perIcon = categoryCyclePerIconMs(size);
  const box = size + BOX_PADDING * 2;
  const animate = order.length > 1 && !reduced;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="불러오는 중"
      style={[
        styles.box,
        {
          width: box,
          height: box,
          borderRadius: BOX_RADIUS[size],
          backgroundColor: theme.background,
          borderColor: theme.border,
        },
        style,
      ]}>
      {!animate ? (
        <CategoryIcon kind={order[0]!} size={size} color={theme.tint} />
      ) : Platform.OS === 'web' ? (
        <WebCycle order={order} size={size} perIcon={perIcon} color={theme.tint} />
      ) : (
        <NativeCycle order={order} size={size} perIcon={perIcon} color={theme.tint} />
      )}
    </View>
  );
}

type CycleProps = {
  order: readonly CategoryIconKind[];
  size: number;
  perIcon: number;
  color: string;
};

// ─── 웹 · CSS 키프레임 ────────────────────────────────────────────────────────

const KEYFRAMES_STYLE_ID = 'wp-swap-keyframes';
const MAX_CYCLE = CATEGORY_CYCLE_ORDER.length;

/** 시안과 같은 자릿수 — 소수 첫째 자리에서 버림(100/6 → 16.6). */
function pct(value: number): string {
  return String(Math.floor(value * 10) / 10);
}

/**
 * `wpSwap2` ~ `wpSwap12`. 시안 `30-loading.dc.html`과 같은 식이다 —
 * `@keyframes wpSwapN{0%,hold%{opacity:1}slot%,100%{opacity:0}}`.
 */
export function buildSwapKeyframes(): string {
  const rules: string[] = [];
  for (let n = 2; n <= MAX_CYCLE; n += 1) {
    const slot = 100 / n;
    rules.push(
      `@keyframes wpSwap${n}{0%,${pct(slot * HOLD_RATIO)}%{opacity:1}${pct(slot)}%,100%{opacity:0}}`
    );
  }
  return rules.join('\n');
}

function ensureSwapKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_STYLE_ID;
  style.textContent = buildSwapKeyframes();
  document.head.appendChild(style);
}

function WebCycle({ order, size, perIcon, color }: CycleProps) {
  useEffect(ensureSwapKeyframes, []);
  const n = order.length;
  const cycle = n * perIcon;

  return (
    <>
      {order.map((kind, i) => (
        <WebLayer
          key={kind}
          animation={`wpSwap${n} ${cycle}ms linear ${i * perIcon}ms infinite`}
          first={i === 0}>
          <CategoryIcon kind={kind} size={size} color={color} />
        </WebLayer>
      ))}
    </>
  );
}

/**
 * react-native-web은 `animationName`을 스타일로 받지 않는다(이름 없는
 * `animationKeyframes`만 안다). 핸드오프 이름 `wpSwap${N}`을 그대로 쓰려고 DOM
 * 노드에 직접 `animation`을 적는다. 시작 전에는 첫 아이콘만 보인다 — 시안과 같다.
 */
function WebLayer({
  animation,
  first,
  children,
}: {
  animation: string;
  first: boolean;
  children: React.ReactNode;
}) {
  const attach = useCallback(
    (node: View | null) => {
      const el = node as unknown as { style?: { animation: string } } | null;
      if (el?.style) el.style.animation = animation;
    },
    [animation]
  );

  return (
    <View ref={attach} style={[styles.layer, { opacity: first ? 1 : 0 }]}>
      {children}
    </View>
  );
}

// ─── 네이티브 · Animated ──────────────────────────────────────────────────────

/**
 * 값 하나가 0 → N을 linear로 돌고, 아이콘 i는 [i, i+0.7]에서 1, [i+0.7, i+1]에서
 * 0으로 떨어진 뒤 N까지 0 — 웹 키프레임과 같은 슬롯·홀드·컷이다.
 */
function NativeCycle({ order, size, perIcon, color }: CycleProps) {
  const n = order.length;
  const [t] = useState(() => new Animated.Value(0));

  useEffect(() => {
    t.setValue(0);
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: n,
        duration: n * perIcon,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [t, n, perIcon]);

  return (
    <>
      {order.map((kind, i) => {
        const opacity =
          i === 0
            ? t.interpolate({ inputRange: [0, HOLD_RATIO, 1, n], outputRange: [1, 1, 0, 0] })
            : t.interpolate({
                inputRange: [0, i, i, i + HOLD_RATIO, i + 1, n],
                outputRange: [0, 0, 1, 1, 0, 0],
              });

        return (
          <Animated.View
            key={kind}
            accessibilityLabel={CATEGORY_ICON_LABEL[kind]}
            style={[styles.layer, { opacity }]}>
            <CategoryIcon kind={kind} size={size} color={color} />
          </Animated.View>
        );
      })}
    </>
  );
}

// ─── 모션 줄이기 ──────────────────────────────────────────────────────────────

/** OS가 모션 줄이기를 켰으면 첫 아이콘만 멈춰 보여준다. */
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
  box: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
