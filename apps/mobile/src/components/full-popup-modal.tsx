import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, useWindowDimensions } from 'react-native';

import { Motion, USE_NATIVE_DRIVER, useReduceMotion, useTheme } from '@weddingpick/ui';

import { NavigationRouteContext } from 'expo-router/build/react-navigation/core';

import { KeyboardAvoid } from '@/features/common/keyboard-avoid';
import { useBrowserBackClose } from '@/features/common/sheet-browser-back';

export type FullPopupModalProps = {
  visible: boolean;
  /** Android 뒤로 · 웹 Esc. 머리의 X(`FullPopupHeader`)와 같은 닫기를 넘긴다. */
  onRequestClose: () => void;
  /** 올라오기 시작할 때 한 번. 열 때마다 초기화할 상태(선택 탭 등)를 여기서 맞춘다. */
  onShow?: () => void;
  children: ReactNode;
};

/**
 * 공통 풀팝업 껍데기 — WP-AUTH-011(약관 상세)에서 뗐다. 머리는 `FullPopupHeader`.
 *
 * **아래에서 올라오고, 닫으면 아래로 내려간다. 뒤에는 모달 딤이 깔렸다 걷힌다**(2026-09-26 대표
 * 지시 「공통 바텀시트 풀팝업이 실제 앱처럼 자연스럽게 나타나게」).
 *
 *   네이티브   RN `Modal` `animationType="slide"` · `presentationStyle="pageSheet"` — OS가 그린다.
 *              iOS는 카드가 올라오며 뒤 화면이 물러나 어두워지고 아래로 끌어 닫힌다.
 *   웹        react-native-web의 `slide`는 판만 250ms로 밀어 올리고 뒤를 깔지 않았다. 그래서 웹은
 *              바텀시트(`features/common/bottom-sheet.tsx`)와 같은 방식으로 직접 움직인다 —
 *              딤 opacity 0 → 1(`Motion.scrimFade` 200) · 판 translateY 화면높이 → 0
 *              (`Motion.sheetEnter` 350 · (.16,1,.3,1)) · 닫힘은 거꾸로(`Motion.sheetExit` 250 ·
 *              ease-in). **닫는 움직임이 끝난 뒤에야 내린다.** 「움직임 줄이기」면 판도 페이드만.
 *
 * 전체 화면을 덮는 풀팝업 «라우트»(상담 예약 · 사진 · 비교 등)는 이 껍데기가 아니라 스택이
 * 같은 움직임으로 올린다(`features/navigation/stack-motion.ts` `modal`).
 *
 * **키패드**(2026-09-26 대표 지시 「키패드와 겹치면 안된다」) — 안의 내용은 공통 `KeyboardAvoid`
 * 안에 둔다. 네이티브는 RN KeyboardAvoidingView, 웹은 모달이 앱 뿌리 밖(`body`)에 붙어서
 * visualViewport로 잰 높이만큼 스스로 올린다(`lift`). 하단 고정 CTA가 키패드 바로 위에 선다.
 */
export function FullPopupModal(props: FullPopupModalProps) {
  if (Platform.OS !== 'web') {
    const { visible, onRequestClose, onShow, children } = props;

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onRequestClose}
        onShow={onShow}>
        <KeyboardAvoid style={styles.fill}>{children}</KeyboardAvoid>
      </Modal>
    );
  }

  return <WebFullPopup {...props} />;
}

function WebFullPopup({ visible, onRequestClose, onShow, children }: FullPopupModalProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [scrim] = useState(() => new Animated.Value(0));
  const [panel] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(height));
  const running = useRef<Animated.CompositeAnimation | null>(null);
  const onShowRef = useRef(onShow);

  useEffect(() => {
    onShowRef.current = onShow;
  }, [onShow]);

  const open = useCallback(() => {
    running.current?.stop();
    onShowRef.current?.();
    translateY.setValue(reduceMotion ? 0 : height);
    panel.setValue(reduceMotion ? 0 : 1);
    running.current = Animated.parallel([
      Animated.timing(scrim, {
        toValue: 1,
        duration: Motion.scrimFade.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      reduceMotion
        ? Animated.timing(panel, {
            toValue: 1,
            duration: Motion.scrimFade.duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          })
        : Animated.timing(translateY, {
            toValue: 0,
            duration: Motion.sheetEnter.duration,
            easing: Easing.bezier(...Motion.sheetEnter.bezier),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
    ]);
    running.current.start();
  }, [height, panel, reduceMotion, scrim, translateY]);

  const close = useCallback(() => {
    running.current?.stop();
    running.current = Animated.parallel([
      Animated.timing(scrim, {
        toValue: 0,
        duration: Motion.scrimFade.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      reduceMotion
        ? Animated.timing(panel, {
            toValue: 0,
            duration: Motion.scrimFade.duration,
            easing: Easing.in(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          })
        : Animated.timing(translateY, {
            toValue: height,
            duration: Motion.sheetExit.duration,
            easing: Easing.in(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
    ]);
    running.current.start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [height, panel, reduceMotion, scrim, translateY]);

  /* 열라는 순간 먼저 그린다(판은 화면 밖에서 시작한다). 내리는 것은 닫는 움직임이 끝난 뒤다. */
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (!mounted) return;
    if (visible) open();
    else close();
    // open · close는 뺐다 — 창 크기 · 「움직임 줄이기」가 바뀔 때 움직임을 처음부터 다시 틀지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mounted]);

  useEffect(() => () => running.current?.stop(), []);

  /*
   * 브라우저 뒤로가기는 풀팝업만 닫는다 — 공통 바텀시트와 같은 장치(`sheet-browser-back.ts`).
   * 라우트가 처음부터 띄운 풀팝업(`my/privacy-policy` — 닫기가 곧 라우트 뒤로)은 빠진다. 뒤로가기가 이미
   * 라우트째 닫으므로 켜면 두 칸이 빠진다.
   */
  const route = useContext(NavigationRouteContext);
  const [openedAtMount] = useState(visible);
  useBrowserBackClose(visible && !(openedAtMount && route != null), onRequestClose);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onRequestClose}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim, opacity: scrim }]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: panel, transform: [{ translateY }] }]}>
        <KeyboardAvoid lift style={styles.fill}>
          {children}
        </KeyboardAvoid>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
