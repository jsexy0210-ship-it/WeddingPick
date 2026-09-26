import { AppStack } from '@/features/navigation/app-stack';
import { useStackScreenOptions } from '@/features/navigation/screen-options';

export default function CommunitySubLayout() {
  // 배경 · 전환은 features/navigation/screen-options가 라우터 단위로 정한다(다른 스택과 같다).
  return <AppStack screenOptions={useStackScreenOptions()} />;
}
