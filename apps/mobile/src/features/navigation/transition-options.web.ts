import { Animated, Easing } from 'react-native';
import type { StackCardStyleInterpolator, StackNavigationOptions } from 'expo-router/build/react-navigation/stack';

import { StackMotion, type StackTransition } from './stack-motion';
import type { StackOptionsContext, StackScreenOptions } from './transition-options';

/**
 * 웹 — `AppStack`이 웹에서는 JS 스택(`expo-router/js-stack`)이라 전환을 여기서 그린다.
 *
 * **왜 JS 스택인가.** expo-router의 기본 Stack은 웹에서 native-stack의 웹 판을 쓰는데, 그 판은
 * 화면을 `display: none/flex`로 켜고 끌 뿐 전환이 아예 없다(`react-navigation/native-stack/views/
 * NativeStackView.js`). 이전 화면은 누르는 순간 사라지고, Back으로 빠지는 화면은 그 자리에서
 * 떼어진다 — 그래서 웹 빌드가 «웹 페이지처럼» 뚝뚝 넘어갔다(2026-09-26 대표 지시). 들어오는
 * 화면에만 애니메이션을 씌우면 뒤가 빈 채로 밀려 들어오고, 나가는 화면은 이미 없어서 Back은
 * 여전히 뚝 끊긴다. 두 화면을 동시에 그리며 밀고 당기는 것은 카드 스택(JS 스택)만 한다 —
 * 브라우저 뒤로가기 · `dismissTo` · `replace`까지 같은 자리에서 움직인다.
 *
 * 값은 `stack-motion.ts`의 `StackMotion`. transform · opacity만 움직인다(합성 단계, 60fps).
 */
type Timing = NonNullable<StackNavigationOptions['transitionSpec']>['open'];

function timing(duration: number, easing: (value: number) => number): Timing {
  return { animation: 'timing', config: { duration, easing } };
}

/* 들어오는 화면이 끝에서 부드럽게 멈춘다(감속). 되돌아갈 때도 같은 곡선 — 손을 떼면 바로 반응한다. */
const DECELERATE = Easing.bezier(0.2, 0.8, 0.2, 1);

/** push — 오른쪽에서 밀려 들어온다. 밀려난 화면은 제자리에서 옅게 어두워진다(시차 이동 없음). */
const forPush: StackCardStyleInterpolator = ({ current, inverted, layouts: { screen } }) => ({
  cardStyle: {
    transform: [
      {
        translateX: Animated.multiply(
          current.progress.interpolate({ inputRange: [0, 1], outputRange: [screen.width, 0], extrapolate: 'clamp' }),
          inverted
        ),
      },
    ],
  },
  overlayStyle: {
    opacity: current.progress.interpolate({ inputRange: [0, 1], outputRange: [0, StackMotion.dim], extrapolate: 'clamp' }),
  },
});

/** modal — 풀팝업. 아래에서 올라오고 뒤는 모달 딤(.45)으로 깔린다. 닫으면 아래로 내려간다. */
const forModal: StackCardStyleInterpolator = ({ current, layouts: { screen } }) => ({
  cardStyle: {
    transform: [
      {
        translateY: current.progress.interpolate({ inputRange: [0, 1], outputRange: [screen.height, 0], extrapolate: 'clamp' }),
      },
    ],
  },
  overlayStyle: {
    opacity: current.progress.interpolate({ inputRange: [0, 1], outputRange: [0, StackMotion.modalDim], extrapolate: 'clamp' }),
  },
});

/** fade — 제자리에서 겹쳐 바뀐다. */
const forFade: StackCardStyleInterpolator = ({ current }) => ({
  cardStyle: { opacity: current.progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) },
});

const PUSH_SPEC = { open: timing(StackMotion.pushOpen, DECELERATE), close: timing(StackMotion.pushClose, DECELERATE) };
const MODAL_SPEC = {
  open: timing(StackMotion.modalOpen, Easing.bezier(...StackMotion.modalOpenBezier)),
  close: timing(StackMotion.modalClose, Easing.in(Easing.quad)),
};
/* 시트형 라우트 — 열 때는 라우트가 움직이지 않고(0) 시트가 스스로 올라온다. 닫을 때만 걷힌다. */
const SHEET_SPEC = {
  open: timing(0, Easing.linear),
  close: timing(StackMotion.sheetClose, Easing.in(Easing.quad)),
};
const FADE_SPEC = {
  open: timing(StackMotion.fade, Easing.out(Easing.quad)),
  close: timing(StackMotion.fade, Easing.out(Easing.quad)),
};

export function stackScreenOptions(
  kind: StackTransition,
  { background, reduceMotion, replacedByBack = false }: StackOptionsContext
): StackScreenOptions {
  const base: StackNavigationOptions = {
    headerShown: false,
    /*
     * 카드 바탕 + `flex: 1 · overflow: hidden`. JS 스택은 웹에서 카드가 창을 꽉 채우면
     * 문서(body)가 스크롤하도록 카드를 `minHeight: 100%`로 푼다(`CardContent.js` page 모드).
     * 그러면 화면 안의 ScrollView · 하단 고정 CTA · 탭 바가 제 높이를 잃는다 — 지금까지의 웹
     * 배치(native-stack 웹 판의 `flex: 1`)와 똑같이 카드 안에서 스크롤하게 되돌린다.
     */
    cardStyle: { backgroundColor: background, flex: 1, overflow: 'hidden' },
    /* 웹에는 스와이프 Back이 없다(제스처 처리기가 웹에서는 빈 껍데기다). */
    gestureEnabled: false,
    cardOverlayEnabled: true,
    /*
     * 갈아끼우기의 움직임. 기본은 push(새 화면이 제 여는 움직임으로 덮는다) — 상담 → 상담 완료처럼
     * 앞으로 가는 `replace`가 그렇다. 부모가 스택에 없어 Depth Back · X가 부모로 갈아끼운 라우트만
     * pop이다: 떠나는 화면이 제 닫는 움직임(오른쪽으로 · 아래로)으로 빠지고 부모가 밑에 드러난다
     * (`back-replace.ts` · 2026-09-26 검수 반례 — 뒤로를 눌렀는데 부모가 오른쪽에서 밀려 들어왔다).
     */
    animationTypeForReplace: replacedByBack ? 'pop' : 'push',
  };

  let options: StackNavigationOptions;

  if (kind === 'none') {
    options = { ...base, animation: 'none' };
  } else if (reduceMotion || kind === 'fade') {
    options = { ...base, animation: 'fade', cardStyleInterpolator: forFade, transitionSpec: FADE_SPEC, cardOverlayEnabled: false };
  } else if (kind === 'sheet') {
    options = { ...base, animation: 'fade', cardStyleInterpolator: forFade, transitionSpec: SHEET_SPEC, cardOverlayEnabled: false };
  } else if (kind === 'modal') {
    options = { ...base, animation: 'slide_from_bottom', cardStyleInterpolator: forModal, transitionSpec: MODAL_SPEC };
  } else {
    options = { ...base, animation: 'slide_from_right', cardStyleInterpolator: forPush, transitionSpec: PUSH_SPEC };
  }

  /*
   * 레이아웃은 네이티브 스택 옵션 타입으로 검사받는다(`transition-options.ts`). 웹에서 실제로
   * 받는 것은 JS 스택이라 그 옵션을 그대로 넘긴다 — 두 타입이 겹치지 않는 칸(cardStyle 등)이
   * 있어 여기서 한 번만 바꾼다.
   */
  return options as unknown as StackScreenOptions;
}
