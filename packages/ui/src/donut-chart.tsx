import { StyleSheet, View } from 'react-native';

import { useTheme } from './use-theme';

export type DonutSlice = {
  key: string;
  /** 0 이상. 합이 0이면 아무것도 그리지 않고 빈 고리만 남는다. */
  value: number;
  color: string;
};

export type DonutChartProps = {
  slices: readonly DonutSlice[];
  /** 바깥 지름. 핸드오프 14번의 지출내역은 140. */
  size?: number;
  /** 구멍 지름. 핸드오프 14번은 94. */
  holeSize?: number;
  /** 구멍 색. 카드 위에 얹으면 카드 색을 준다. */
  holeColor?: string;
  children?: React.ReactNode;
};

/**
 * 도넛 차트. 디자인 핸드오프 14번.
 *
 * **`conic-gradient` 없이 그린다.** 핸드오프는 CSS를 전제로 썼지만 React Native에는
 * conic-gradient도 SVG도 없다(이 프로젝트에는 react-native-svg를 넣지 않았다).
 *
 * 조각 하나는 이렇게 만든다:
 * 1. 원의 **오른쪽 절반만 보이는 창**을 만들고(`overflow: hidden`),
 * 2. 그 안에 오른쪽이 둥근 반원을 넣어 원 중심을 축으로 돌린다.
 *
 * 창이 180도까지만 보여주므로 **180도를 넘는 조각은 둘로 쪼갠다.** 안 쪼개면 한
 * 조각이 화면의 절반에서 잘린다.
 */
export function DonutChart({
  slices,
  size = 140,
  holeSize = 94,
  holeColor,
  children,
}: DonutChartProps) {
  const theme = useTheme();
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);

  /** 그릴 조각들. 시작 각도와 벌어진 각도로 바꾸고, 180도를 넘으면 쪼갠다. */
  const wedges: { key: string; color: string; start: number; sweep: number }[] = [];
  let cursor = 0;

  for (const slice of slices) {
    const value = Math.max(0, slice.value);

    if (total === 0 || value === 0) continue;

    let sweep = (value / total) * 360;
    let start = cursor;

    cursor += sweep;

    while (sweep > 0) {
      const part = Math.min(sweep, 180);

      wedges.push({ key: `${slice.key}-${start}`, color: slice.color, start, sweep: part });
      start += part;
      sweep -= part;
    }
  }

  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}>
      {/* 자료가 없어도 고리는 남긴다. 빈 화면에서 레이아웃을 바꾸지 않는다. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size / 2, backgroundColor: theme.chartMuted },
        ]}
      />

      {wedges.map((wedge) => (
        <View
          key={wedge.key}
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ rotate: `${wedge.start}deg` }] },
          ]}>
          {/* 오른쪽 절반만 보이는 창. */}
          <View style={{ position: 'absolute', left: size / 2, width: size / 2, height: size, overflow: 'hidden' }}>
            <View
              style={{
                position: 'absolute',
                width: size / 2,
                height: size,
                borderTopRightRadius: size / 2,
                borderBottomRightRadius: size / 2,
                backgroundColor: wedge.color,
                // 축은 원의 중심. 창의 왼쪽 변 한가운데다.
                transformOrigin: 'left center',
                transform: [{ rotate: `${wedge.sweep - 180}deg` }],
              }}
            />
          </View>
        </View>
      ))}

      <View
        style={[
          styles.hole,
          {
            width: holeSize,
            height: holeSize,
            borderRadius: holeSize / 2,
            backgroundColor: holeColor ?? theme.background,
          },
        ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hole: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
