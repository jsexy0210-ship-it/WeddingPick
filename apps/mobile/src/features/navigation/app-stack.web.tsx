import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';
import { stackRouterOverride } from 'expo-router/build/layouts/StackClient';
import { Stack as JSStack } from 'expo-router/js-stack';

import { backAwareStackRouter } from './back-replace';

/**
 * 앱의 모든 스택 레이아웃이 쓰는 Stack — **웹**.
 *
 * expo-router의 JS 스택(`expo-router/js-stack` — react-navigation stack의 포크)이다. 기본 Stack의
 * 웹 판은 화면을 켜고 끄기만 해서 전환이 없다. 카드 스택은 두 화면을 겹쳐 그리며 밀고 당기므로
 * push · Back · 브라우저 뒤로가기가 앱처럼 움직인다. 전환 값은 `transition-options.web.ts`.
 *
 * **라우터는 기본 Stack과 같은 것을 쓴다**(2026-09-26 검수 반례). JS 스택은 그대로 두면
 * expo-router의 `stackRouterOverride`를 받지 못해, 같은 라우트를 다른 경로 인자로 열 때(Pick에서
 * 업체 B 상세 — 검색 스택 맨 위가 업체 C 상세) 새 화면을 밀지 않고 C 화면을 그 자리에서 B 인자로
 * 바꿨다. B가 C의 「후기」 탭 · C의 내용으로 열렸다. 기본 Stack처럼 덮개를 씌워 새 화면을 민다.
 * 그 위에 POP_TO 갈아끼우기 표시(`back-replace.ts`)를 더해, 부모 없는 Depth Back이 뒤로 움직이게 한다.
 *
 * 라우터 규칙(`router.push/replace/dismissTo` · 딥링크 · `Stack.Screen`)은 같은 expo-router의 것이라
 * 그대로다. 레이아웃이 네이티브와 같은 타입으로 부르도록 타입만 맞춘다.
 */
type StackProps = ComponentProps<typeof JSStack>;
type RouterOverride = NonNullable<StackProps['UNSTABLE_router']>;

export const webStackRouter = ((original: Parameters<RouterOverride>[0]) =>
  backAwareStackRouter(original as never, stackRouterOverride as never)) as unknown as RouterOverride;

function WebStack(props: StackProps) {
  return <JSStack {...props} UNSTABLE_router={webStackRouter} />;
}

export const AppStack = Object.assign(WebStack, {
  Screen: JSStack.Screen,
  Protected: JSStack.Protected,
}) as unknown as typeof Stack;
