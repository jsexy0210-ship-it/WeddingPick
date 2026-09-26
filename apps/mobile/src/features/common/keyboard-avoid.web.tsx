import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { Motion, useReduceMotion } from '@weddingpick/ui';

import type { KeyboardAvoidProps } from './keyboard-avoid';
import { useKeyboardInset } from './keyboard-inset';

export type { KeyboardAvoidProps } from './keyboard-avoid';

/**
 * 키패드 피하기 — **웹**. 네이티브 판(`keyboard-avoid.tsx`)과 같은 자리에 둔다.
 *
 *   화면(기본)   아무것도 하지 않는다. 화면은 앱 뿌리(`#root`) 안에 있고, 뿌리가 통째로 키패드 위로
 *               줄어든다(`useKeyboardAvoidingRoot`) — 여기서 또 밀면 두 번 밀린다.
 *   `lift`      모달(바텀시트 · 풀팝업)은 `body`에 따로 붙어 뿌리를 따라 줄지 않는다. 키패드가 가린
 *               높이만큼 아래 여백을 줘서 패널을 키패드 바로 위로 올린다. 패널 최대 높이(%)도 그
 *               여백을 뺀 높이 기준이라 긴 시트는 안의 스크롤이 줄어들고 CTA는 키패드 위에 남는다.
 *
 * 올라가는 움직임은 시트가 올라오는 곡선(`Motion.sheetEnter` 350 · (.16,1,.3,1)), 내려갈 때는
 * `Motion.sheetExit` 250 같은 곡선. 「움직임 줄이기」면 곧바로 옮긴다.
 */
export function KeyboardAvoid({ children, style, lift = false, testID }: KeyboardAvoidProps) {
  if (!lift) {
    return (
      <View style={style} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <KeyboardLift style={style} testID={testID}>
      {children}
    </KeyboardLift>
  );
}

function KeyboardLift({ children, style, testID }: Omit<KeyboardAvoidProps, 'lift'>) {
  const { inset } = useKeyboardInset();
  const reduceMotion = useReduceMotion();
  const [bottom] = useState(() => new Animated.Value(inset));

  useEffect(() => {
    bottom.stopAnimation();
    if (reduceMotion) {
      bottom.setValue(inset);
      return;
    }

    const rising = inset > 0;
    const animation = Animated.timing(bottom, {
      toValue: inset,
      duration: rising ? Motion.sheetEnter.duration : Motion.sheetExit.duration,
      easing: Easing.bezier(...Motion.sheetEnter.bezier),
      /* 여백(레이아웃 값)은 네이티브 드라이버가 못 움직인다. 웹은 원래 JS로 움직인다. */
      useNativeDriver: false,
    });
    animation.start();

    return () => animation.stop();
  }, [bottom, inset, reduceMotion]);

  return (
    <Animated.View style={[style, { paddingBottom: bottom }]} testID={testID}>
      {children}
    </Animated.View>
  );
}
