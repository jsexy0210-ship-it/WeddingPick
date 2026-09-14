import { Redirect } from 'expo-router';

/**
 * 옛 «내 등급 · 미션» 화면. 핸드오프 v3.22가 미션을 혜택(WP-EVT-002)으로 옮겼고, 등급 이름은
 * 사용자 화면에서 빠졌다 — 링크로 들어온 사람을 미션 화면으로 보낸다.
 */
export default function MembershipRedirect() {
  return <Redirect href={'/my/rewards/missions' as never} />;
}
