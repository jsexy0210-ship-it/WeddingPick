import { Redirect } from 'expo-router';

import { useSession } from '@/features/auth/use-session';
import { FullScreenError } from '@/features/errors/full-screen-error';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';

/**
 * 옛 «내 등급 · 미션» 화면. 핸드오프 v3.22가 미션을 혜택(WP-EVT-002)으로 옮겼고, 등급 이름은
 * 사용자 화면에서 빠졌다 — 링크로 들어온 사람을 미션 화면으로 보낸다.
 *
 * **넘기기 전에 로그인부터 본다.** 2026-09-17 전수 검수에서 정적 화면 62개 중 이 한 장만
 * 만료 토큰으로 열었을 때 `/login`이 아니라 미션 화면의 오류 화면에 멈췄다.
 *
 * 원인은 관문이 **한 번만** 도는 데 있다 — `app/_layout.tsx`의 `redirected.current`가 첫
 * 판단 뒤 잠기고, 이 화면의 `<Redirect>`는 그 뒤에 그려지면서 `/login`으로 간 주소를
 * 미션으로 덮어썼다. 12초를 기다려도 돌아오지 않는다. **앞선 이동을 덮어쓰는 쪽이
 * 이기므로, 덮어쓰기 전에 여기서 먼저 본다.**
 *
 * 형제 화면들과 같은 모양이다(`community/index.tsx` · `my/index.tsx`) — 관문을 화면마다
 * 두는 것이 이 저장소의 현행 방식이고, 그 방식에서 이 화면만 빠져 있었다.
 */
export default function MembershipRedirect() {
  const { state, refresh } = useSession();

  if (state.status === 'error') return <FullScreenError kind={state.kind} onRetry={() => void refresh()} />;
  if (state.status === 'loading') return <DelayedLoadingView />;
  if (state.status === 'signedOut') return <Redirect href="/login" />;

  return <Redirect href={'/my/rewards/missions' as never} />;
}
