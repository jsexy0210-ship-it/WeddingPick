import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/features/navigation/screen-options';

export default function WeddingLayout() {
  // 배경색을 깔지 않으면 밀려나는 화면이 비쳐 보인다(features/navigation/screen-options).
  return <Stack screenOptions={useStackScreenOptions()} />;
}
