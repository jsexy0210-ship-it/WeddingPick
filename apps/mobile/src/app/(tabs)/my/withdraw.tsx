import { Redirect } from 'expo-router';

/**
 * 옛 회원탈퇴 경로. 실제 화면은 `/my/withdrawal`(WP-MY-008) 하나뿐이다.
 *
 * 한때 이 경로가 별도 화면(문의로만 연결하는 안내 화면)을 갖고 있었다. 진입점을
 * 두 개로 두면 화면마다 다른 결과가 나올 수 있다 — 실제 자동 탈퇴는 한 곳에서만
 * 일어나야 한다. 그래서 이 경로는 화면을 그리지 않고 바로 넘긴다.
 */
export default function WithdrawRedirect() {
  return <Redirect href="/my/withdrawal" />;
}
