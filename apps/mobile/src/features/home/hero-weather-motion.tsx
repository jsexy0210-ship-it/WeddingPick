import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useIsFocused } from 'expo-router/build/useIsFocused';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useReduceMotion } from '@weddingpick/ui';

import { HERO_WEATHER_PALETTE, type HeroWeatherTone } from './hero-weather';

/**
 * 날씨 히어로 배경 — 그라데이션 · 은은한 빗방울 · 부드러운 햇빛(2026-09-26 대표 명세 5).
 *
 * - **카드 안에서만** 움직인다: 부모(히어로)가 `overflow: hidden`이고 이 층은 글자 뒤에 깔린다.
 *   손가락을 받지 않는다(`pointerEvents="none"`).
 * - **움직임 줄이기**가 켜져 있으면 움직이지 않는다 — 빗방울은 그리지 않고 햇빛은 멈춘 채 둔다.
 * - **배터리 · 렌더링**: 빗방울 열 개 · 햇빛 원 하나만 움직이고, 네이티브 드라이버(transform ·
 *   opacity)로 돌린다. 홈 탭이 가려지면(포커스 없음) 멈춘다.
 * - **이모지 · 유사 아이콘을 쓰지 않는다** — 빗방울은 가는 선, 햇빛은 번지는 원이다.
 * - **자연스러운 색 전환**: 새 팔레트는 이전 면(처음엔 정본 코랄) 위에서 600ms 동안 서서히 나타난다.
 */

const FADE_MS = 600;
const NATIVE_DRIVER = Platform.OS !== 'web';

/** 빗방울 자리(카드 폭 비율) · 길이 · 한 번 떨어지는 시간 · 시작 지연. 고정값이라 매번 같은 그림이다. */
const DROPS = [
  { x: 0.06, length: 12, duration: 1500, delay: 0 },
  { x: 0.16, length: 9, duration: 1300, delay: 700 },
  { x: 0.27, length: 11, duration: 1650, delay: 300 },
  { x: 0.38, length: 8, duration: 1250, delay: 1000 },
  { x: 0.49, length: 12, duration: 1550, delay: 500 },
  { x: 0.6, length: 10, duration: 1400, delay: 1200 },
  { x: 0.7, length: 9, duration: 1350, delay: 200 },
  { x: 0.79, length: 12, duration: 1600, delay: 900 },
  { x: 0.88, length: 8, duration: 1300, delay: 400 },
  { x: 0.96, length: 11, duration: 1500, delay: 1100 },
] as const;

export function HeroWeatherBackground({ tone }: { tone: HeroWeatherTone }) {
  const [layers, setLayers] = useState<{ below: HeroWeatherTone | null; top: HeroWeatherTone }>({ below: null, top: tone });
  const [fade] = useState(() => new Animated.Value(0));
  const reduceMotion = useReduceMotion();

  /* 팔레트가 바뀌면 이전 면을 아래에 남기고 새 면을 위에서 서서히 올린다(렌더 중 상태 맞춤). */
  if (layers.top !== tone) setLayers({ below: layers.top, top: tone });

  useEffect(() => {
    fade.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) return;
    const animation = Animated.timing(fade, { toValue: 1, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE_DRIVER });
    animation.start();
    return () => animation.stop();
  }, [fade, layers.top, reduceMotion]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {layers.below !== null ? <Gradient tone={layers.below} /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <Gradient tone={layers.top} />
        {layers.top === 'rain' ? <Rain color={HERO_WEATHER_PALETTE.rain.motion} still={reduceMotion} /> : null}
        {layers.top === 'clearDay' ? <Sunlight color={HERO_WEATHER_PALETTE.clearDay.motion} still={reduceMotion} /> : null}
      </Animated.View>
    </View>
  );
}

function Gradient({ tone }: { tone: HeroWeatherTone }) {
  const palette = HERO_WEATHER_PALETTE[tone];
  const id = `hero-weather-${tone}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={palette.from} />
          <Stop offset="1" stopColor={palette.to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** 탭이 가려졌거나 움직임 줄이기면 멈춘다. */
function useRunning(still: boolean): boolean {
  const focused = useIsFocused();
  return focused && !still;
}

function Rain({ color, still }: { color: string; still: boolean }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const running = useRunning(still);
  const [progress] = useState(() => DROPS.map(() => new Animated.Value(0)));

  useEffect(() => {
    if (!running || size === null) return;
    const loops = DROPS.map((drop, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(drop.delay),
          Animated.timing(progress[index]!, { toValue: 1, duration: drop.duration, easing: Easing.linear, useNativeDriver: NATIVE_DRIVER }),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [progress, running, size]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) => (previous?.width === width && previous.height === height ? previous : { width, height }));
  };

  /* 움직임 줄이기면 빗방울을 그리지 않는다 — 멈춘 선은 긁힌 자국처럼 읽힌다. 배경색만으로 비를 말한다. */
  if (still) return null;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} testID="hero-weather-rain">
      {size === null
        ? null
        : DROPS.map((drop, index) => (
            <Animated.View
              key={drop.x}
              style={[
                styles.drop,
                {
                  left: drop.x * size.width,
                  height: drop.length,
                  backgroundColor: color,
                  transform: [
                    {
                      translateY: progress[index]!.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-drop.length, size.height + drop.length],
                      }),
                    },
                    { rotate: '12deg' },
                  ],
                },
              ]}
            />
          ))}
    </View>
  );
}

function Sunlight({ color, still }: { color: string; still: boolean }) {
  const running = useRunning(still);
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!running) {
      pulse.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, running]);

  return (
    <Animated.View
      testID="hero-weather-sun"
      style={[
        styles.sun,
        {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
        },
      ]}>
      <Svg width="100%" height="100%" viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id="hero-weather-sunlight" cx="100" cy="100" r="100" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="200" height="200" fill="url(#hero-weather-sunlight)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  drop: { position: 'absolute', top: 0, width: 1.5, borderRadius: 1 },
  /* 정본 `heroBlob1` 자리(오른쪽 위 -40)에 번지는 햇빛. 크기만 키웠다. */
  sun: { position: 'absolute', top: -70, right: -70, width: 220, height: 220 },
});
