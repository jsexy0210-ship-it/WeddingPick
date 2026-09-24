import {
  CircleLoader,
  type CircleLoaderSize,
  LoadingView,
  type LoadingViewProps,
  RecommendingBody,
  type RecommendingBodyProps,
  RecommendingView,
  ThemedView,
  useDelayedVisible,
} from '@weddingpick/ui';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useCurrentUserSnapshot } from './current-user-snapshot';

/**
 * 700ms 규칙(핸드오프 v3.20 «700ms 임계값»)을 지키는 로더 자리.
 *
 * ```
 * 0~700ms      아무것도 띄우지 않음
 * 700ms 초과   로더 노출
 * ```
 *
 * **로더는 원형 하나뿐이다**(2026-09-15 대표 지시 — 「모든 화면 로딩 발생 시
 * 기본로더로 돌려라. **기존 정책 파기** 기본로더만 사용할것」).
 *
 * ## 없어진 것 — 왜 그랬는지 적어 둔다
 *
 * 전에는 `wait`(`'transition' | 'long'`)로 **어떤 성격의 기다림인가**를 물어
 * 써클과 업종 아이콘 순회를 갈랐다. 그 갈래가 통째로 없어졌다.
 *
 * **로더가 두 종류면 어느 자리가 어느 것인지를 매번 판단해야 하고, 그 판단이
 * 화면마다 갈렸다.** 실제로 2026-09-15까지 순회 로더가 화면 다섯에서 돌고
 * 있었다 — 홈 첫 진입 · 온보딩 완료 · TOP3 · 분석 중 · 확인 중. 규칙은 이미
 * 폐기였는데 코드가 따라오지 않았다.
 *
 * **「오래 걸린다」는 로더 모양이 아니라 글로 말한다** — `RecommendingView`의
 * 제목과 「10초 안에 끝나요」가 그 자리다.
 *
 * 순회에서 뺄 업종을 고르던 `exclude`도 같이 없앴다. 돌 것이 없으면 뺄 것도 없다.
 *
 * ## v3.29 재대조(2026-09-23) — DESIGN_UNRESOLVED, 코드는 그대로 둔다
 *
 * RN 정본 `docs/design/React_Native/common.jsx:276`(common frame-016)의 WP-LOAD-001(업종 순회
 * 로딩) · WP-LOAD-002(업종 아이콘 8종) · WP-LOAD-003(기본 로더 · 업종 아이콘 순회)은
 * 「원형 스피너를 쓰지 않아요 — 로더는 업종 아이콘이 도는 것 하나뿐입니다」라고 적는다 —
 * 바로 위에서 없앴다고 적은 그 모양이다.
 *
 * 이 파일과 `circle-loader.tsx`의 원형 로더는 **2026-09-15 대표 지시(「기존 정책
 * 파기」)로 이미 확정·배포된 결정**이고, v3.29(2026-09-23)의 이 문구를 문자 그대로
 * 따라 되돌리지 않는다 — CLAUDE.md의 「⚠️ 후기 별점」 항목과 같은 성격의 충돌이다:
 * 최신 정본 파일이, 같은 대표님이 이미 확인하고 배포까지 마친 더 이전 결정과 반대로
 * 적혀 있다. 판단은 대표님 몫이라 `docs/design/canonical-manifest.json`의
 * `openQuestions`에 이 항목을 추가하도록 남겨 둔다(이 세션은 `docs/design/`를
 * 건드리지 않는 범위라 직접 추가하지 않았다).
 *
 * 나머지 세 화면은 로더 모양과 무관하게 이미 정본과 토큰 단위로 맞는다 —
 * WP-LOAD-003의 700ms 임계값(`Motion.loaderThreshold` = 700) · WP-LOAD-004 목록
 * 뼈대(`ListSkeleton`, 3줄 · 72/46·58/38·66/42%) · WP-LOAD-005 처리 중 단계 표시
 * (`RecommendingBody` + `StepList`, 「올려주신 자료를 읽고 있어요」·「10초 안에
 * 끝나요」)는 이 파일을 고치지 않아도 이미 일치한다.
 */

type DelayedLoaderProps = {
  /** 기다리는 중인가. 기본 true — 로딩 분기 안에서 마운트되는 자리는 안 넘겨도 된다. */
  active?: boolean;
  /** 20 버튼·행 · 28 카드·시트 · 40 화면 전체. */
  size: CircleLoaderSize;
  /** 로더를 감싸는 View의 스타일. 로더가 보일 때만 그린다. */
  style?: StyleProp<ViewStyle>;
};

/** 화면 안 한 자리(버튼·행·카드·시트·본문)에 놓는 로더. 700ms 전에는 아무것도 없다. */
export function DelayedLoader({ active = true, size, style }: DelayedLoaderProps) {
  const visible = useDelayedVisible(active);

  if (!visible) return null;

  return (
    <View style={[styles.center, style]}>
      <CircleLoader size={size} />
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
}: LoadingViewProps & { active?: boolean }) {
  const visible = useDelayedVisible(active);

  if (!visible) return <ThemedView style={styles.blank} />;

  return <LoadingView {...props} />;
}

type DelayedRecommendingProps = RecommendingBodyProps & { active?: boolean };

/**
 * 닉네임은 화면이 넘긴 값 → 마지막으로 알려진 «나» 순. 홈은 부트스트랩이 끝나기
 * 전에 이 로더를 보여주므로 화면에는 아직 이름이 없다 — 그때는 로그인 · 설정에서
 * 이미 받아둔 값으로 부른다. 그것도 없으면 «맞는 곳을 찾고 있어요».
 */
function useRecommendingProps({ nickname, ...rest }: Omit<DelayedRecommendingProps, 'active'>) {
  const me = useCurrentUserSnapshot();

  return { ...rest, nickname: nickname ?? me?.displayName ?? undefined };
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
