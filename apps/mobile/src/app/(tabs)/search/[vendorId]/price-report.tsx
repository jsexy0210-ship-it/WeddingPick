import { Redirect, useLocalSearchParams } from 'expo-router';

import { useSession } from '@/features/auth/use-session';
import { FullScreenError } from '@/features/errors/full-screen-error';
import { DelayedLoadingView } from '@/features/loading/delayed-loader';

/**
 * WP-RPT-010은 v3.24에서 폐기됐다. 기존 링크도 사진 기반 Pick 인증으로 연결한다.
 *
 * **넘기기 전에 로그인부터 본다.** `my/membership.tsx`와 같은 이유다 — 관문이 한 번만
 * 돌기 때문에, 그 뒤에 그려지는 `<Redirect>`가 `/login`으로 간 주소를 덮어쓴다.
 * 이쪽은 주소에 `[vendorId]`가 들어가 2026-09-17 전수 검수(정적 62장)에 안 잡혔고,
 * 같은 모양이라 같이 막는다.
 */
export default function PriceReportScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const { state, refresh } = useSession();

  if (state.status === 'error') return <FullScreenError kind={state.kind} onRetry={() => void refresh()} />;
  if (state.status === 'loading') return <DelayedLoadingView />;
  if (state.status === 'signedOut') return <Redirect href="/login" />;

  return <Redirect href={`/capture/payment/consent?from=vendor/${encodeURIComponent(vendorId)}` as never} />;
}
