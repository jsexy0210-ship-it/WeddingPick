import type { WeatherCondition } from '@weddingpick/api-contract';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * 홈 히어로 날씨 아이콘 — 선 아이콘 다섯 가지.
 *
 * 정본(`docs/design/React_Native`)에 날씨 그림이 없다(2026-09-26 대표 지시로 새로 생긴 자리 —
 * DESIGN_UNRESOLVED). 그래서 새 모양을 꾸미지 않고 앱 선 아이콘과 같은 규칙(24 격자 · 선 1.9 ·
 * 둥근 끝)으로 해 · 달 · 구름 · 빗줄기 · 눈 점만 그린다. 색은 부르는 쪽이 준다(날씨 면 위 코랄 포인트).
 */

const CLOUD = 'M7.5 19h9a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 6.4 12.1 3.5 3.5 0 0 0 7.5 19Z';
const CLOUD_HIGH = 'M7.5 15h9a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 6.4 8.1 3.5 3.5 0 0 0 7.5 15Z';
const SUN_RAYS = 'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4';

const MOON = 'M20 14.6A8 8 0 1 1 9.4 4a6.4 6.4 0 0 0 10.6 10.6Z';

export function WeatherIcon({
  condition,
  size,
  color,
  night = false,
}: {
  condition: WeatherCondition;
  size: number;
  color: string;
  /** 맑은 밤이면 해 대신 달이다(관측 시각 기준). */
  night?: boolean;
}) {
  const stroke = { stroke: color, strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {condition === 'clear' && night ? <Path d={MOON} {...stroke} /> : null}
      {condition === 'clear' && !night ? (
        <>
          <Circle cx={12} cy={12} r={4} {...stroke} />
          <Path d={SUN_RAYS} {...stroke} />
        </>
      ) : null}
      {condition === 'partly_cloudy' ? (
        <>
          <Path d="M8.5 3.5v1.2M3.5 8.5h1.2M4.9 4.9l.9.9M12.1 4.9l-.9.9M5.6 11.3A3.5 3.5 0 1 1 11.6 7" {...stroke} />
          <Path d="M9.5 20h7.5a3.5 3.5 0 0 0 .5-6.96A4.8 4.8 0 0 0 8.6 13.9 3 3 0 0 0 9.5 20Z" {...stroke} />
        </>
      ) : null}
      {condition === 'cloudy' ? <Path d={CLOUD} {...stroke} /> : null}
      {condition === 'rain' ? (
        <>
          <Path d={CLOUD_HIGH} {...stroke} />
          <Path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5" {...stroke} />
        </>
      ) : null}
      {condition === 'snow' ? (
        <>
          <Path d={CLOUD_HIGH} {...stroke} />
          <Circle cx={8} cy={19} r={0.6} {...stroke} />
          <Circle cx={12} cy={20.5} r={0.6} {...stroke} />
          <Circle cx={16} cy={19} r={0.6} {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}
