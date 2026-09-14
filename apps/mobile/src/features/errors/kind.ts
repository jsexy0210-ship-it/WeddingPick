/**
 * 전면 오류 화면의 종류. 디자인 핸드오프 WP-APP-006.
 *
 * `spec/strings.ko.json`의 `error.*`와 1:1로 맞춘다.
 */
export type ErrorKind = 'network' | 'maintenance' | 'update' | 'general';

/**
 * 서버 응답을 어떤 전면 화면으로 보여줄 것인가.
 *
 * **503만 점검으로 읽는다.** 4xx는 사용자가 고칠 수 있는 실수이고 500은 우리 잘못이라,
 * 둘을 "점검 중"이라고 말하면 고칠 수 있는 것을 기다리게 만들고 진짜 장애를 예정된
 * 작업처럼 보이게 한다.
 *
 * `general`도 여기서 나오지 않는다 — 서버 응답이 아니라 **앱이 그리다 죽었을 때**의
 * 종류이고, 그건 오류 경계(`app/_layout.tsx`의 `ErrorBoundary`)가 고른다.
 *
 * 새 버전 강제(`update`)는 여기서 나오지 않는다 — 서버에 최소 버전을 알려주는 경로가
 * 아직 없다. 생기면 그 신호를 여기에 더한다.
 */
export function errorKindOf(status: number | null): ErrorKind | null {
  if (status === null) return 'network';
  if (status === 503) return 'maintenance';

  return null;
}
