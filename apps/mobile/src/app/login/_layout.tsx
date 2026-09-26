import { AppStack } from '@/features/navigation/app-stack';
import { useStackScreenOptions } from '@/features/navigation/screen-options';

/**
 * 로그인 흐름 전용 스택(WP-AUTH-001·008·010). 루트 `_layout.tsx`가 `login` 그룹
 * 전체의 진입·이탈만 막아둔다(`gestureEnabled: false`, 뒤에 아무것도 없어서
 * 스와이프로 나갈 수 없다) — 그 안에서 `age-required` 같은 화면을 오가는 것은
 * 평소처럼 뒤로가기·스와이프로 된다.
 */
export default function LoginLayout() {
  // 배경 · 전환(동의 → 만 14세 안내 등 push)은 다른 스택과 같이 screen-options가 정한다.
  return <AppStack screenOptions={useStackScreenOptions()} />;
}
