import { RecommendingBody, type RecommendingBodyProps } from './status-view';

/**
 * @deprecated v3.20에서 궤도 링(코랄 점 + 원 120)이 폐기됐다. 화면 전체는
 * `RecommendingView`, 화면 안 조각은 `RecommendingBody`를 쓴다.
 *
 * 예전 시그니처(`title` · `estimate`)를 받아 새 본문을 그린다. 예전에 있던
 * 타이머로 굴러가는 단계 목록은 넣지 않는다 — 실제 진행과 무관한 가짜 진행률이라
 * 핸드오프가 금지한다. 단계는 `steps`로 실제 상태를 넘긴다.
 */
export function CategoryOrbitLoader({
  title,
  estimate,
  ...rest
}: Omit<RecommendingBodyProps, 'estimatedLabel'> & { estimate?: string }) {
  return <RecommendingBody title={title} estimatedLabel={estimate} {...rest} />;
}
