import { TermsDetailPage } from '@/features/auth/terms-detail-page';
import { useDepthBack } from '@/features/navigation/depth-back';

export default function TermsScreen() {
  const back = useDepthBack();
  return <TermsDetailPage initialKey="terms" onBack={back} />;
}
