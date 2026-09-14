import { useLocalSearchParams } from 'expo-router';

import { WeddingCompleteView } from '@/features/wedding/complete-view';
import { NavBar, Screen } from '@/features/wedding/screen-kit';

/**
 * 예식 완료. WP-OUR-013. 본문은 `features/wedding/complete-view.tsx` — 웨딩일정 탭이 예식일이
 * 지나면 같은 본문을 바로 그린다. 여기는 하위 화면(링크)으로 열릴 때의 껍데기다.
 */
export default function WeddingCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <NavBar title="웨딩일정" />
      <WeddingCompleteView weddingId={id} />
    </Screen>
  );
}
