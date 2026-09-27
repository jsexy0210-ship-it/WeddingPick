import { PRIVACY_POLICY_TAB_KEY } from '@weddingpick/domain';

import { TermsDetailPage } from '@/features/auth/terms-detail-page';
import { useDepthBack } from '@/features/navigation/depth-back';

/**
 * MY 행과 저장된 링크 모두 이 페이지를 연다. Back은 부모(`/my`)로 돌아간다.
 */
export default function PrivacyPolicyScreen() {
  const depthBack = useDepthBack();

  return <TermsDetailPage initialKey={PRIVACY_POLICY_TAB_KEY} onBack={depthBack} />;
}
