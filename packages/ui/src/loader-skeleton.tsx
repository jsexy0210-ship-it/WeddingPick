import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ListSkeleton } from './list-skeleton';
import { Skeleton } from './skeleton';

/**
 * **로딩 표시는 스켈레톤이다**(2026-09-25 대표 결정 — 「스켈레톤으로 해」).
 * 원형 스피너(`CircleLoader`)도, 정본 WP-LOAD-001의 업종 아이콘 순회도 쓰지 않는다.
 *
 * 자리 크기(20 · 28 · 40)는 원형 로더 시절 이름을 그대로 받는다 — 호출처 80여 곳이
 * `DelayedLoader size`로 이미 자리를 말하고 있어서, 그 값만 보고 뼈대 크기를 고른다.
 *
 * ```
 * 40   화면 · 본문    목록 뼈대 3줄(WP-LOAD-004, `ListSkeleton`)
 * 28   카드 · 시트    목록 뼈대 2줄
 * 20   행 · 더 보기   바 한 줄
 * ```
 *
 * `shape="mark"`는 뼈대가 맞지 않는 자리(로그인 진행 · 처리 중 단계 화면)에 쓰는
 * 숨쉬는 원형 블록이다 — 돌지 않는다. 그 자리는 문구·단계 목록이 무엇을 하는지 말한다.
 */
export type LoaderSkeletonSize = 20 | 28 | 40;
export type LoaderSkeletonShape = 'content' | 'mark';

export type LoaderSkeletonProps = {
  size?: LoaderSkeletonSize;
  shape?: LoaderSkeletonShape;
  style?: StyleProp<ViewStyle>;
};

export function LoaderSkeleton({ size = 40, shape = 'content', style }: LoaderSkeletonProps) {
  if (shape === 'mark') {
    return (
      <View style={style}>
        <Skeleton width={size} height={size} radius={size / 2} />
      </View>
    );
  }

  return (
    <View style={[styles.stretch, style]}>
      {size === 20 ? <Skeleton height={16} /> : <ListSkeleton rows={size === 40 ? 3 : 2} />}
    </View>
  );
}

const styles = StyleSheet.create({
  stretch: { alignSelf: 'stretch', width: '100%' },
});
