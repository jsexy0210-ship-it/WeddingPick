import { PRIVACY_POLICY_TAB_KEY } from '@weddingpick/domain';

import { ThemedView } from '@weddingpick/ui';
import { TermsDetailModal } from '@/features/auth/terms-detail-modal';
import { useDepthBack } from '@/features/navigation/depth-back';

/**
 * 저장된 링크 `/my/privacy-policy` — 공통 약관 풀팝업(WP-AUTH-011)을 «개인정보처리방침»
 * 탭으로 연다(2026-09-26 대표 지시). 그 전에는 이 경로가 뒤로가기 헤더 화면(my.jsx
 * frame-022 · WP-MY-015b)이었다. MY 행은 이제 이 경로를 거치지 않고 MY 위에서 바로
 * 풀팝업을 연다 — 이 경로는 밖에 남은 링크(알림 · 공유 · 즐겨찾기)를 위해 살려 둔다.
 *
 * 닫으면 Depth Back으로 부모(`/my`)에 간다 — 딥링크로 곧장 들어와도 앱 밖으로 나가지 않는다.
 */
export default function PrivacyPolicyScreen() {
  const depthBack = useDepthBack();

  return (
    <ThemedView style={{ flex: 1 }}>
      <TermsDetailModal visible initialKey={PRIVACY_POLICY_TAB_KEY} onClose={depthBack} />
    </ThemedView>
  );
}
