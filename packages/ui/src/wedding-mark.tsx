import { StyleSheet, View, type ViewStyle } from 'react-native';

export type WeddingMarkProps = {
  /** 한 변의 길이. 핸드오프 0번의 스플래시는 64. */
  size?: number;
  /** 하트 색. */
  color?: string;
  /**
   * 체크를 파낼 색. 하트를 얹은 **바탕과 같은 색**이어야 한다.
   *
   * 체크를 그리지 않고 뚫는 이유는, 그리면 획이 하트 밖으로 나갈 때 어색해지고
   * 작은 크기에서 뭉개지기 때문이다.
   */
  cutColor?: string;
};

/*
 * 하트의 뼈대.
 *
 * **45도 돌린 정사각형 하나와 원 둘**이다. 사각형의 아래 꼭짓점이 하트의 뾰족한
 * 끝이 되고, 원 둘이 사각형의 위쪽 두 변에 얹혀 봉우리가 된다.
 *
 * 처음에는 위만 둥근 사각형 둘을 반대로 돌려 겹쳤는데, 그러면 **아래가 뾰족해지지
 * 않고 V자로 파인다** — 두 도형의 아래 모서리가 한 점에서 만나지 않기 때문이다.
 * 그려서 눈으로 보고 나서야 알았다.
 */

/** 정사각형 한 변 대비 중심에서 꼭짓점까지 = 1/√2. */
const HALF_DIAGONAL = Math.SQRT1_2;
/** 중심에서 변의 중점까지 = 1/(2√2). 원의 중심이 여기 얹힌다. */
const HALF_EDGE = Math.SQRT1_2 / 2;

/** 사각형 한 변을 전체 크기의 몇 배로 둘 것인가. 하트가 틀을 거의 채우도록 맞춘 값. */
const SQUARE_RATIO = 0.58;

export function WeddingMark({
  size = 64,
  color = '#ffffff',
  cutColor = '#3182f6',
}: WeddingMarkProps) {
  const square = size * SQUARE_RATIO;
  const edge = square * HALF_EDGE;

  /** 하트가 세로로 가운데 오도록 사각형 중심을 내린다. */
  const centerY = size * 0.05 + edge + square / 2;
  const centerX = size / 2;

  const lobe = (dx: number): ViewStyle => ({
    position: 'absolute',
    width: square,
    height: square,
    borderRadius: square / 2,
    backgroundColor: color,
    left: centerX + dx - square / 2,
    top: centerY - edge - square / 2,
  });

  /** 체크의 획 하나. */
  const stroke = (length: number, angle: string, left: number, top: number): ViewStyle => ({
    position: 'absolute',
    width: length,
    height: size * 0.085,
    borderRadius: size * 0.045,
    backgroundColor: cutColor,
    left,
    top,
    transform: [{ rotate: angle }],
  });

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      {/* 아래 꼭짓점을 만드는 사각형. */}
      <View
        style={{
          position: 'absolute',
          width: square,
          height: square,
          backgroundColor: color,
          left: centerX - square / 2,
          top: centerY - square / 2,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View style={lobe(-edge)} />
      <View style={lobe(edge)} />

      {/* 체크. 짧은 획이 왼쪽 아래로 내려갔다 긴 획이 오른쪽 위로 올라간다. */}
      <View style={stroke(size * 0.22, '45deg', size * 0.26, centerY - size * 0.02)} />
      <View style={stroke(size * 0.36, '-45deg', size * 0.36, centerY - size * 0.08)} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** 사각형의 아래 꼭짓점이 틀 안에 들어오는지. 비율을 바꿀 때 확인한다. */
export const MARK_BOTTOM_RATIO = 0.05 + HALF_EDGE * SQUARE_RATIO + SQUARE_RATIO * HALF_DIAGONAL;
