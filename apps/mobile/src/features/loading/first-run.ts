/**
 * 화면 전체를 덮는 업종 순회 로딩(WP-ST-015 `RecommendingView`)을 **이 앱 실행에서
 * 이미 썼는가**.
 *
 * 사용자 오더(2026-09-09): 「로딩 스윙 전체페이지로 나오는건 최초 또는 앱 재시작 시만
 * 활용한다. 이 외 아이콘 타입 스윙 로딩을 사용한다.」
 *
 * 전체 화면 로딩은 «앱이 지금 막 켜졌다»는 신호다. 홈에 들어올 때마다 그것이 뜨면
 * 같은 신호가 반복되면서 앱이 매번 처음부터 시작하는 것처럼 읽힌다. 그래서 실행당
 * 한 번만 쓰고, 그다음부터는 자리만 차지하는 아이콘 로더로 대신한다.
 *
 * 모듈 변수다 — 앱이 다시 켜지면(또는 웹에서 새로고침하면) 자연히 처음으로 돌아간다.
 * 그것이 정확히 「앱 재시작」의 뜻이라 저장소에 남기지 않는다.
 */

let spent = false;

/**
 * 전체 화면 로딩을 지금 써도 되는가. **부르면 소모된다** — 한 번 true를 받은
 * 뒤에는 같은 실행에서 다시 true가 나오지 않는다.
 */
export function takeFullScreenLoading(): boolean {
  if (spent) return false;

  spent = true;
  return true;
}

/** 테스트에서만 쓴다. 실행 상태를 처음으로 되돌린다. */
export function resetFullScreenLoadingForTest(): void {
  spent = false;
}
