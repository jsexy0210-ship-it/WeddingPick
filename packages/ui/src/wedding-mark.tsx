import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * 웨딩픽 심볼 — **하트 윤곽선 안에 체크**.
 *
 * 확정된 심볼이다. 모양(하트·체크)과 기본 색(코랄)은 바꾸지 않는다.
 * 앱 아이콘, 스플래시, Pick 탭, Pick 완료, 최종 결정, 웹, 관리자에서 같은 마크를 쓴다.
 *
 * 좌표는 64 칸 격자에 잡았다. 24 칸으로 잡으면 소수점이 붙어 눈으로 고치기 어렵다.
 * 획 두께까지 포함한 마크의 실제 크기는 53×45이며, 64 칸 한가운데 놓았다 —
 * 하트는 위가 넓고 아래가 뾰족해서 경로 좌표만 가운데 맞추면 눈에는 내려가 보인다.
 */
export const MARK_VIEWBOX = 64;

/**
 * 하트 윤곽. 아래 꼭짓점에서 시작하지 않고 **위 가운데 홈**에서 시작한다 —
 * 좌우가 같은 순서로 뒤집힌 대칭이라 한쪽을 고치면 반대쪽을 그대로 옮길 수 있다.
 */
export const MARK_HEART_PATH =
  'M32 19 C30 15 26 12 20 12 C13 12 8 17 8 24 C8 35 22 44 32 52 ' +
  'C42 44 56 35 56 24 C56 17 51 12 44 12 C38 12 34 15 32 19 Z';

/** 체크. 하트 안쪽에만 머무르도록 획 끝을 좌우 봉우리 아래에 둔다. */
export const MARK_CHECK_PATH = 'M21 28 L28.5 35.5 L45 19';

/** 획 두께. 하트와 체크가 같아야 한 손으로 그린 것처럼 보인다. */
export const MARK_STROKE = 5;

export type WeddingMarkProps = {
  /** 한 변의 길이. 핸드오프 0번의 스플래시는 64. */
  size?: number;
  /**
   * 선 색. 기본은 코랄. 코랄 바탕 위에 얹을 때만 흰색으로 뒤집는다.
   *
   * 탭 바가 넘겨주는 색은 문자열이 아닐 수 있어서(플랫폼 색 객체) `ColorValue`로 받는다.
   */
  color?: ColorValue;
};

export function WeddingMark({ size = 64, color = '#ff6f61' }: WeddingMarkProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      fill="none">
      {/*
        낭독기용 속성은 걸지 않는다. react-native-svg가 웹에서 알 수 없는 속성을
        DOM으로 그대로 넘겨 경고를 낸다. 마크에는 글자가 없어서 라벨을 가진
        부모(탭·버튼)만 읽히면 되고, 그 편이 실제로 맞다.
       */}
      <Path
        d={MARK_HEART_PATH}
        stroke={color}
        strokeWidth={MARK_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={MARK_CHECK_PATH}
        stroke={color}
        strokeWidth={MARK_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
