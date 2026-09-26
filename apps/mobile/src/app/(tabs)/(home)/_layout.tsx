import { AppStack } from '@/features/navigation/app-stack';
import { useStackScreenOptions } from '@/features/navigation/screen-options';

export default function HomeSubLayout() {
  // 배경 · 전환(push · 풀팝업 올라오기)은 features/navigation/screen-options가 라우터 단위로 정한다.
  return <AppStack screenOptions={useStackScreenOptions()} />;
}
