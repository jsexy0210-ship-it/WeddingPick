import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * 웨딩픽 심볼 — **하트 윤곽선 안에 체크**.
 *
 * 확정된 심볼이다. CLAUDE.md §2의 확정 path를 그대로 쓴다 — 모양(하트·체크)과
 * 기본 색(코랄)은 바꾸지 않는다. 앱 아이콘, 스플래시, Pick 탭, Pick 완료,
 * 최종 결정, 웹, 관리자에서 같은 마크를 쓴다.
 */
export const MARK_VIEWBOX = 24;

/** 하트 윤곽. CLAUDE.md §2 확정본. */
export const MARK_HEART_PATH =
  'M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z';

/** 체크. 하트 중앙(12.0, 11.9)에 위치. CLAUDE.md §2 확정본. */
export const MARK_CHECK_PATH = 'M8.7 11.9l2.2 2.2 4.4-4.4';

/** 획 두께. CLAUDE.md §2 확정값. */
export const MARK_STROKE = 1.9;

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
