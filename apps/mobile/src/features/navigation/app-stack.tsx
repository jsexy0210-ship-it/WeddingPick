/**
 * 앱의 모든 스택 레이아웃이 쓰는 Stack — **네이티브**(iOS · 안드로이드).
 *
 * expo-router의 Stack(native-stack) 그대로다. 밀기 · 스와이프 Back · 아래에서 올라오기는
 * OS가 그린다(`transition-options.ts`). 웹은 같은 이름의 `app-stack.web.tsx`가 받는다 —
 * 레이아웃은 `AppStack` 하나만 부르고 플랫폼을 모른다.
 */
export { Stack as AppStack } from 'expo-router';
