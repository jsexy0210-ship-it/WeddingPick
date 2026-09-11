import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  CategoryCycleLoader,
  CircleLoader,
  LoadingView,
  RecommendingBody,
  RecommendingView,
  ThemedView,
  useDelayedVisible,
  type CategoryCycleLoaderSize,
  type CategoryIconKind,
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
 * 700ms는 그대로다. 바뀐 것은 **무엇을 띄우는가**뿐이다 — 아래 `LoaderWait` 참고.
 *
 * 화면은 «지금 기다리는 중인지»(`active`)와 «어떤 성격의 기다림인지»(`wait`)만
 * 말한다. 700ms를 세는 것과, 결정 완료 업종을 순회에서 빼는 것, 닉네임을 붙이는
 * 것은 여기서 한다 — 화면마다 같은 훅 세 개를 다시 부르지 않는다.
 */
/**
 * **어느 로더를 쓰는가.** 2026-09-11 대표 지시 — 「Depth, 페이지간 이동 시 로딩이
 * 발생할 경우 기본 로더 · 써클을 사용하도록한다」.
 *
 * ```
 * 'transition'  기본 로더 · 써클    스쳐 지나가는 기다림
 * 'long'        업종 아이콘 순회    오래 붙잡는 기다림
 * ```
 *
 * **새 화면은 어느 쪽인가 — 이 두 가지로 가른다.**
 *
 * 1. 이 기다림이 끝나면 **사용자가 이미 아는 곳**에 도착하는가. Depth를 한 칸
 *    내려가거나 페이지를 바꾸는 중이라 「누르면 여기가 나온다」를 이미 알고 있으면
 *    `transition`이다. 로더는 그저 「가는 중」을 말할 뿐이라 아이콘을 돌려 볼거리를
 *    만들 이유가 없다.
 * 2. 이 기다림 자체가 **말할 것이 있는가**. 앱이 방금 켜졌다거나(첫 실행·재시작),
 *    서버가 두 사람에게 맞는 곳을 고르는 중이라(추천 계산) 「무엇을 하느라 오래
 *    걸린다」를 보여줘야 하면 `long`이다.
 *
 * 애매하면 `transition`이다 — 기본값이 그쪽인 이유다. 순회 로더는 **드물게** 나와야
 * 「이번엔 좀 걸리겠구나」로 읽힌다. 아무 데서나 돌면 그냥 로더가 된다.
 *
 * 실제로 `long`인 자리는 **추천 계산(WP-ST-015) 하나뿐**이다 —
 * `DelayedRecommendingView` · `DelayedRecommendingBody`. 홈 첫 진입이 그것을 쓰고,
 * `features/loading/first-run.ts`가 실행당 한 번으로 막는다(2026-09-09 사용자 오더).
 * 두 번째부터 홈이 쓰는 `DelayedLoader size={40}`은 탭으로 돌아온 것뿐이라
 * `transition`이다.
 *
 * 부팅은 로더를 쓰지 않는다 — 코랄 스플래시(`features/splash/splash-view.tsx`)가
 * 그 자리를 덮는다. 여기 목록에 넣지 않는다.
 */
export type LoaderWait = 'transition' | 'long';

type DelayedLoaderProps = {
  /** 기다리는 중인가. 기본 true — 로딩 분기 안에서 마운트되는 자리는 안 넘겨도 된다. */
  active?: boolean;
  /** 20 버튼·행 · 28 카드·시트 · 40 화면 전체. */
  size: CategoryCycleLoaderSize;
  /** 기다림의 성격. 기본 `transition`(써클) — 위 `LoaderWait` 참고. */
  wait?: LoaderWait;
  /** 로더를 감싸는 View의 스타일. 로더가 보일 때만 그린다. */
  style?: StyleProp<ViewStyle>;
};

/** 화면 안 한 자리(버튼·행·카드·시트·본문)에 놓는 로더. 700ms 전에는 아무것도 없다. */
export function DelayedLoader({ active = true, size, wait = 'transition', style }: DelayedLoaderProps) {
  const visible = useDelayedVisible(active);
  const exclude = usePreparedExclude();

  if (!visible) return null;

  return (
    <View style={[styles.center, style]}>
      {wait === 'long' ? (
        <CategoryCycleLoader size={size} exclude={exclude} />
      ) : (
        <CircleLoader size={size} />
      )}
    </View>
  );
}

/**
 * 화면 전체 로딩(WP-ST-007) — 700ms 전에는 빈 화면(배경색만)이다. 폼·상세 하나를
 * 읽어오는 자리. 목록은 `SkeletonView`를 바로 그린다(뼈대는 기다림이 아니라 자리다).
 *
 * **페이지 이동이다** — `LoaderWait`의 1번에 해당하므로 써클이 기본이다. 오래
 * 붙잡는 화면이면 `wait="long"`을 넘긴다.
 */
export function DelayedLoadingView({
  active = true,
  wait = 'transition',
  ...props
}: Omit<LoadingViewProps, 'exclude' | 'loader'> & { active?: boolean; wait?: LoaderWait }) {
  const visible = useDelayedVisible(active);
  const exclude = usePreparedExclude();

  if (!visible) return <ThemedView style={styles.blank} />;

  if (wait === 'long') return <LoadingView {...props} loader="cycle" exclude={exclude} />;

  return <LoadingView {...props} loader="circle" />;
}

type DelayedRecommendingProps = Omit<RecommendingBodyProps, 'exclude'> & {
  active?: boolean;
  /**
   * 순회에서 뺄 업종을 화면이 직접 넘긴다. 온보딩 5/5처럼 **답을 방금 받았지만 아직
   * 서버에 없는** 자리를 위한 것이다 — 그때 «나»의 스냅숏에는 결정 완료 업종이
   * 없어서, 넘기지 않으면 방금 «결정 완료»로 고른 웨딩홀이 로더에서 계속 돈다.
   */
  exclude?: readonly CategoryIconKind[];
};

/**
 * 닉네임은 화면이 넘긴 값 → 마지막으로 알려진 «나» 순. 홈은 부트스트랩이 끝나기
 * 전에 이 로더를 보여주므로 화면에는 아직 이름이 없다 — 그때는 로그인 · 설정에서
 * 이미 받아둔 값으로 부른다. 그것도 없으면 «맞는 곳을 찾고 있어요».
 */
function useRecommendingProps({ nickname, exclude, ...rest }: Omit<DelayedRecommendingProps, 'active'>) {
  const me = useCurrentUserSnapshot();
  const known = usePreparedExclude();
  return { ...rest, nickname: nickname ?? me?.displayName ?? undefined, exclude: exclude ?? known };
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
