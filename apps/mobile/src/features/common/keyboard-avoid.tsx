import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from 'react-native';

export type KeyboardAvoidProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * 모달 위(바텀시트 · 풀팝업)처럼 앱 뿌리 밖에 그려지는 자리. 웹에서만 뜻이 있다 — 뿌리가 줄어도
   * 모달은 따라 줄지 않아서 스스로 키패드 높이만큼 올라간다(`keyboard-avoid.web.tsx`).
   * 네이티브는 어느 자리든 같은 방식이다.
   */
  lift?: boolean;
  testID?: string;
};

/**
 * 키패드 피하기 — **네이티브**. 화면 껍데기(`SubScreen` · `StepFrame` · `Screen` · 상담 예약) ·
 * 바텀시트 · 풀팝업이 이것 하나로 키패드 위로 올라간다. 웹 판은 `keyboard-avoid.web.tsx`.
 *
 * RN `KeyboardAvoidingView`는 **자기 아래 끝과 키패드 위 끝이 겹친 만큼만** 민다 — 창이 이미
 * 줄었으면(옛 안드로이드 adjustResize) 겹친 것이 없어 0이고, 줄지 않았으면(iOS · edge-to-edge
 * 안드로이드) 키패드 높이만큼이다. 그래서 두 번 밀리지 않는다.
 *
 *   iOS       `padding` — 아래 여백으로 내용(가운데 스크롤 · 하단 dock)을 키패드 위로 줄인다.
 *   Android   `height` — 높이를 키패드만큼 줄인다. 바텀시트가 처음부터 쓰던 값 그대로다.
 *
 * 탭 바가 있는 화면에는 두지 않는다 — 탭 바는 키패드가 뜨면 숨는다(`features/navigation/tab-bar.tsx`).
 */
export function KeyboardAvoid({ children, style, testID }: KeyboardAvoidProps) {
  return (
    <KeyboardAvoidingView style={style} behavior={KEYBOARD_AVOID_BEHAVIOR} testID={testID}>
      {children}
    </KeyboardAvoidingView>
  );
}

export const KEYBOARD_AVOID_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';
