import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  CategoryCycleLoader,
  LoadingView,
  RecommendingBody,
  RecommendingView,
  ThemedView,
  useDelayedVisible,
  type CategoryCycleLoaderSize,
  type LoadingViewProps,
  type RecommendingBodyProps,
} from '@weddingpick/ui';

import { useCurrentUserSnapshot } from './current-user-snapshot';
import { usePreparedExclude } from './exclude';

/**
 * 700ms 규칙(핸드오프 v3.20 «700ms 임계값»)을 지키는 로더 자리.
 *
 * ```
 * 0~700ms      아무것도 띄우지 않음
 * 700ms 초과   화면 성격과 무관하게 로더 노출
 * ```
 *
 * 화면은 «지금 기다리는 중인지»(`active`)만 말한다. 700ms를 세는 것과, 결정 완료
 * 업종을 순회에서 빼는 것, 닉네임을 붙이는 것은 여기서 한다 — 화면마다 같은
 * 훅 세 개를 다시 부르지 않는다.
 */
type DelayedLoaderProps = {
  /** 기다리는 중인가. 기본 true — 로딩 분기 안에서 마운트되는 자리는 안 넘겨도 된다. */
  active?: boolean;
  /** 20 버튼·행 · 28 카드·시트 · 40 화면 전체. */
  size: CategoryCycleLoaderSize;
  /** 로더를 감싸는 View의 스타일. 로더가 보일 때만 그린다. */
  style?: StyleProp<ViewStyle>;
};

/** 화면 안 한 자리(버튼·행·카드·시트·본문)에 놓는 로더. 700ms 전에는 아무것도 없다. */
export function DelayedLoader({ active = true, size, style }: DelayedLoaderProps) {
  const visible = useDelayedVisible(active);
  const exclude = usePreparedExclude();

  if (!visible) return null;

  return (
    <View style={[styles.center, style]}>
      <CategoryCycleLoader size={size} exclude={exclude} />
    </View>
  );
}

/**
 * 화면 전체 로딩(WP-ST-007) — 700ms 전에는 빈 화면(배경색만)이다. 폼·상세 하나를
 * 읽어오는 자리. 목록은 `SkeletonView`를 바로 그린다(뼈대는 기다림이 아니라 자리다).
 */
export function DelayedLoadingView({
  active = true,
  ...props
}: Omit<LoadingViewProps, 'exclude'> & { active?: boolean }) {
  const visible = useDelayedVisible(active);
  const exclude = usePreparedExclude();

  if (!visible) return <ThemedView style={styles.blank} />;

  return <LoadingView {...props} exclude={exclude} />;
}

type DelayedRecommendingProps = Omit<RecommendingBodyProps, 'exclude'> & { active?: boolean };

/**
 * 닉네임은 화면이 넘긴 값 → 마지막으로 알려진 «나» 순. 홈은 부트스트랩이 끝나기
 * 전에 이 로더를 보여주므로 화면에는 아직 이름이 없다 — 그때는 로그인 · 설정에서
 * 이미 받아둔 값으로 부른다. 그것도 없으면 «맞는 곳을 찾고 있어요».
 */
function useRecommendingProps({ nickname, ...rest }: Omit<DelayedRecommendingProps, 'active'>) {
  const me = useCurrentUserSnapshot();
  const exclude = usePreparedExclude();
  return { ...rest, nickname: nickname ?? me?.displayName ?? undefined, exclude };
}

/** WP-ST-015 추천 계산 — 화면 전체. 700ms 전에는 빈 화면. */
export function DelayedRecommendingView({ active = true, ...props }: DelayedRecommendingProps) {
  const visible = useDelayedVisible(active);
  const resolved = useRecommendingProps(props);

  if (!visible) return <ThemedView style={styles.blank} />;

  return <RecommendingView {...resolved} />;
}

/** WP-ST-015 추천 계산 — 부모가 자리를 정하는 본문. 700ms 전에는 아무것도 없다. */
export function DelayedRecommendingBody({ active = true, ...props }: DelayedRecommendingProps) {
  const visible = useDelayedVisible(active);
  const resolved = useRecommendingProps(props);

  if (!visible) return null;

  return <RecommendingBody {...resolved} />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  blank: { flex: 1 },
});
