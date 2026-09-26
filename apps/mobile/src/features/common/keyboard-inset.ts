import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

import { KEYBOARD_HIDDEN, KEYBOARD_VISIBLE_MIN, type KeyboardInset } from './keyboard-inset.shared';

export { KEYBOARD_HIDDEN, type KeyboardInset } from './keyboard-inset.shared';

/**
 * 네이티브 — `Keyboard` 이벤트의 키패드 높이. 웹 판은 `keyboard-inset.web.ts`(visualViewport).
 *
 * iOS는 키패드가 움직이기 **전**(`keyboardWill*`), 안드로이드는 뜬 **뒤**(`keyboardDid*`)에만 알린다.
 * 화면 · 시트를 미는 일은 여기서 하지 않는다 — RN `KeyboardAvoidingView`가 자기 자리 기준으로
 * 겹친 만큼만 민다(`keyboard-avoid.tsx`). 이 값은 탭 바를 숨길지처럼 «떠 있는가»가 필요한 곳이 읽는다.
 */
export function useKeyboardInset(): KeyboardInset {
  const [state, setState] = useState<KeyboardInset>(() => fromHeight(Keyboard.isVisible() ? Keyboard.metrics()?.height : 0));

  useEffect(() => {
    const show = (event: KeyboardEvent) => setState(fromHeight(event.endCoordinates.height));
    const hide = () => setState(KEYBOARD_HIDDEN);
    /* iOS는 떠 있는 채로 높이가 바뀔 때(이모지 판 등)도 `keyboardWillShow`를 다시 보낸다. */
    const subscriptions =
      Platform.OS === 'ios'
        ? [Keyboard.addListener('keyboardWillShow', show), Keyboard.addListener('keyboardWillHide', hide)]
        : [Keyboard.addListener('keyboardDidShow', show), Keyboard.addListener('keyboardDidHide', hide)];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return state;
}

/** 네이티브에는 줄일 `#root`가 없다 — 화면 껍데기의 `KeyboardAvoid`가 맡는다. */
export function useKeyboardAvoidingRoot(): void {}

function fromHeight(height: number | undefined): KeyboardInset {
  const inset = Math.max(0, Math.round(height ?? 0));

  return inset > 0 ? { inset, visible: inset >= KEYBOARD_VISIBLE_MIN } : KEYBOARD_HIDDEN;
}
