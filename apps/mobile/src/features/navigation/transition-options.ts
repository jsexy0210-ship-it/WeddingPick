import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from 'expo-router/build/react-navigation/native-stack';

import { StackMotion, type StackTransition } from './stack-motion';

/**
 * 스택 화면 옵션의 타입. 레이아웃은 `AppStack`(`app-stack.tsx`)에 넘기고, 타입 검사는 네이티브
 * 스택 기준으로 한다 — 웹 스택 옵션(`transition-options.web.ts`)은 거기서 한 번 바꿔 넘긴다.
 */
export type StackScreenOptions = NativeStackNavigationOptions;

export type StackOptionsContext = {
  background: string;
  reduceMotion: boolean;
  /**
   * Depth Back · X 닫기(POP_TO)가 부모를 찾지 못해 현재 화면을 부모로 갈아끼운 라우트인가.
   * 웹만 쓴다(`back-replace.ts`) — 네이티브는 native-stack 기본 갈아끼우기 그대로다(실기기 확인 전).
   */
  replacedByBack?: boolean;
};

/**
 * 네이티브(iOS · 안드로이드) — **OS의 native-stack 전환을 그대로 쓴다.** 숫자를 흉내 내지 않는다.
 *
 *   push   iOS `default`(UINavigationController 밀기 · 이전 화면 시차 · 가장자리 스와이프 Back)
 *          안드로이드 `slide_from_right`(OS 기본값은 아래에서 떠오르는 페이드라 «오른쪽에서 밀려 옴»이
 *          아니다 — 대표 지시의 「실제 앱처럼 … 화면이동」을 두 OS에서 같은 방향으로 맞춘다)
 *   modal  `slide_from_bottom` — 풀팝업은 아래에서 올라와 아래로 내려간다
 *   sheet  `fade`(iOS 250ms) — 시트형 라우트. 밑이 같은 부모 화면이라 겹침은 보이지 않고, 시트가
 *          스스로 올라오며 닫힐 때 시트와 딤이 걷힌다
 *   fade   `fade`
 *   none   `none` — 관리자(네이티브에서는 안내 한 줄뿐)
 *
 * 「움직임 줄이기」가 켜져 있으면 이동 없이 `fade`로 바꾼다.
 */
export function stackScreenOptions(kind: StackTransition, { background, reduceMotion }: StackOptionsContext): StackScreenOptions {
  const base: StackScreenOptions = { headerShown: false, contentStyle: { backgroundColor: background } };

  if (kind === 'none') return { ...base, animation: 'none' };
  if (reduceMotion || kind === 'fade') return { ...base, animation: 'fade' };
  if (kind === 'modal') return { ...base, animation: 'slide_from_bottom' };
  if (kind === 'sheet') return { ...base, animation: 'fade', animationDuration: StackMotion.sheetClose };

  return { ...base, animation: Platform.OS === 'android' ? 'slide_from_right' : 'default' };
}
