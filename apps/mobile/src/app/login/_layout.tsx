import { Stack } from 'expo-router';

/**
 * 로그인 흐름 전용 스택(WP-AUTH-001~008). 루트 `_layout.tsx`가 `login` 그룹
 * 전체의 진입·이탈만 막아둔다(`gestureEnabled: false`, 뒤에 아무것도 없어서
 * 스와이프로 나갈 수 없다) — 그 안에서 이메일 화면들 사이를 오가는 것은
 * 평소처럼 뒤로가기·스와이프로 된다.
 */
export default function LoginLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
