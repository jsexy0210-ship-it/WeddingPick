import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/features/navigation/screen-options';

export default function PickSubLayout() {
  // 배경색을 깔지 않으면 밀려나는 화면이 비쳐 보인다(features/navigation/screen-options).
  return (
    <Stack screenOptions={useStackScreenOptions()}>
      {/* 결정 완료는 CTA로만 빠져나간다. iOS back swipe도 확인 시트로 되돌리지 않는다. */}
      <Stack.Screen name="done" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
