import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderHandlers,
  type LayoutChangeEvent,
  type PanResponderGestureState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContext } from 'expo-router/build/react-navigation/core';

import {
  FontSize,
  Layout,
  LineHeight,
  Motion,
  PRESS_TRANSITION,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  USE_NATIVE_DRIVER,
  useReduceMotion,
  useTheme,
} from '@weddingpick/ui';

import { KeyboardAvoid } from './keyboard-avoid';

export type BottomSheetProps = {
  visible: boolean;
  /** 스크림 탭 · Android 뒤로가기. 시트를 닫는 쪽의 단 하나의 길이다. */
  onRequestClose: () => void;
  /**
   * 스크림 탭 · Android 뒤로가기로는 닫히지 않는다. 입력 중인 폼 시트(이름 · 노트 · 방문노트 ·
   * 일정 · 지출)는 취소 버튼으로만 닫는다 — 실수로 딤을 눌러 쓰던 내용을 잃지 않게.
   */
  dismissible?: boolean;
  children: ReactNode;
  /** 패널 컨테이너에 얹는 스타일. 배경·둥글기·패딩은 호출하는 쪽이 정한다. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * 바텀시트 공통 껍데기 — 스크림은 제자리에서 페이드하고 패널만 아래에서 올라온다.
 *
 * `Modal animationType="slide"`는 스크림까지 한 덩어리로 밀어 올려서 어두운 배경이 패널과
 * 같이 움직였다(2026-09-08 제보 영상). 그래서 Modal 자체는 `animationType="none"`으로 두고
 * 안에서 둘을 따로 움직인다.
 *
 *   스크림  opacity 0 → 1 · 200ms · ease-out(quad)        — `Motion.scrimFade`
 *   패널    translateY 패널높이 → 0 · 350ms · (.16,1,.3,1)  — `Motion.sheetEnter`
 *   닫힘    거꾸로 — 스크림 1 → 0 · 200ms, 패널 0 → 높이 · 250ms · ease-in(quad) — `Motion.sheetExit`
 *
 * 닫는 모션이 끝난 뒤에야 Modal을 내린다(`mounted`). 패널 높이는 `onLayout`으로 재고, 재기 전에는
 * 화면 밖 값으로 두어 첫 프레임에 패널이 번쩍 보이지 않게 한다. 「움직임 줄이기」가 켜져 있으면
 * 패널도 이동 없이 페이드만 한다.
 *
 * **끌어내려 닫기**(2026-09-26 대표 지시 「실제 앱처럼 자연스럽게」). 닫을 수 있는 시트(`dismissible`)는
 * **손잡이 자리 — 그래버 줄(`SheetGrabber`)과 머리 줄(`SheetHeader`) — 에서만** 끌린다. 끌면 손가락을
 * 따라 내려가고 스크림도 그만큼 옅어진다. 놓았을 때
 *
 *   끈 거리 ≥ 패널 높이의 `DRAG_CLOSE_RATIO`(25%) 또는 아래로 빠르게 튕김(≥ `DRAG_CLOSE_VELOCITY`)
 *     → 그 자리에서 내려가며 `onRequestClose` — X · 스크림 · Back과 같은 단 하나의 닫는 길
 *       (입력 중 확인도 그대로 탄다)
 *   그 밖  → 제자리로 되돌아온다(`Motion.sheetEnter` 곡선)
 *
 * **본문(휠 · 목록 · 폼 스크롤)에서는 끌리지 않는다**(2026-09-26 검수 반례). 패널 전체에 끌기를
 * 걸었더니 날짜 휠을 첫 값에서 한 번 더 내리면 시트가 닫혀 고른 값이 사라졌고, iOS에서는 응답자
 * 협상이 조상 → 자손으로 되돌아가지 않아(Fabric) 휠 · 폼을 아래로 굴릴 때마다 시트가 같이 끌렸다.
 * 손잡이는 스크롤을 품지 않으니 둘이 부딪힐 자리가 없다. 중첩 시트(일정 추가 안의 날짜 휠)의 딤을
 * 쓸어도 바깥 시트의 손잡이는 조상이 아니라 끌리지 않는다.
 *
 * 닫기를 요청했는데 호출한 쪽이 닫지 않으면(입력 중 확인창을 띄운 경우) 제자리로 다시 올라온다.
 * 위로는 끌리지 않는다 — 패널 아래가 비어 보인다. **닫히는 중인 시트는 다시 잡히지 않는다** —
 * 내려가는 시트를 한 번 더 쓸면 닫는 움직임이 끊겨 보이지 않는 Modal이 화면을 덮고 남았다.
 * 웹에서 끄는 동안에만 글자 선택을 막는다(끝나면 본문 글자는 다시 고르고 복사할 수 있다).
 *
 * 패널의 배경 · 둥글기 · 패딩 · 안전영역은 여기서 정하지 않는다 — 호출하는 쪽이 `children` 루트에
 * 준다(`SHEET_PANEL` 참고). 스크림 Pressable과 패널은 형제다 — 패널을 Pressable로 감싸면 웹에서
 * button 안에 button이 들어간다.
 */
export function BottomSheet({
  visible,
  onRequestClose,
  dismissible = true,
  children,
  style,
  testID,
}: BottomSheetProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  /* 끌어서 닫기를 요청한 뒤 호출한 쪽이 정말 닫았는지 본다(아래 `pan`). */
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const [mounted, setMounted] = useState(visible);
  const [scrim] = useState(() => new Animated.Value(0));
  const [panel] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(OFFSCREEN));
  const height = useRef(0);
  /* 열릴 차례인데 아직 패널 높이를 모른다 — onLayout이 오면 그때 올린다. */
  const pendingOpen = useRef(false);
  const running = useRef<Animated.CompositeAnimation | null>(null);
  /* 닫는 움직임이 시작됐다(`close()` · 끌어서 닫기). 이 동안은 다시 잡히지 않는다. */
  const closing = useRef(false);

  const open = useCallback(() => {
    running.current?.stop();
    closing.current = false;
    const from = height.current || OFFSCREEN;

    if (reduceMotion) {
      translateY.setValue(0);
      panel.setValue(0);
    } else {
      translateY.setValue(from);
      panel.setValue(1);
    }

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
  }, [panel, reduceMotion, scrim, translateY]);

  const close = useCallback(() => {
    running.current?.stop();
    closing.current = true;
    const to = height.current || OFFSCREEN;

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
            toValue: to,
            duration: Motion.sheetExit.duration,
            easing: Easing.in(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
    ]);
    running.current.start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [panel, reduceMotion, scrim, translateY]);

  useEffect(() => {
    if (visible) {
      running.current?.stop();
      pendingOpen.current = true;
      /* 이미 떠 있는데 다시 열라는 경우(닫히던 중 되돌림) — 높이를 아니 바로 올린다. */
      if (mounted && height.current > 0) {
        pendingOpen.current = false;
        open();
      } else {
        setMounted(true);
      }
      return;
    }

    pendingOpen.current = false;
    if (mounted) close();
    // mounted는 의도적으로 뺐다 — visible이 바뀔 때만 열고 닫는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => () => running.current?.stop(), []);

  /*
   * 시트가 얹힌 라우트가 걷힐 때(시트형 라우트의 닫기 · Back · 브라우저 뒤로가기) 시트도 같이 내려간다.
   * 시트는 `Modal`이라 라우트 카드 밖(웹은 body 포털, 네이티브는 별도 창)에 그려진다 — 카드가 옅어지며
   * 걷혀도 시트는 그대로 떠 있다가 라우트가 떼어지는 순간 뚝 사라졌다(2026-09-26 녹화). 스택이
   * 알려 주는 «닫히는 전환 시작»(`transitionStart` · closing)에 맞춰 닫는 움직임을 시작한다.
   * 내비게이터 밖(루트의 확인창 호스트 등)에서는 알려 줄 스택이 없어 아무것도 하지 않는다.
   *
   * **웹만 듣는다.** 웹의 JS 스택은 이 신호를 «걷히는 카드»에만 보낸다. 네이티브 native-stack은 다른
   * 화면에 덮일 때도(`onWillDisappear`) 같은 신호를 보내서, 들으면 덮인 화면의 시트까지 닫힌다 —
   * 네이티브에서 걷히는 라우트의 시트는 라우트와 함께 곧바로 내려진다(실기기 확인 전).
   */
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    if (!navigation || Platform.OS !== 'web') return;
    const listen = navigation.addListener as unknown as (
      type: 'transitionStart',
      callback: (event: { data?: { closing?: boolean } }) => void
    ) => () => void;
    return listen('transitionStart', (event) => {
      if (event.data?.closing) close();
    });
  }, [close, navigation]);

  /* 놓은 뒤 제자리로 — 여는 곡선 그대로(감속). 스크림도 다시 짙어진다. */
  const snapBack = useCallback(() => {
    running.current?.stop();
    closing.current = false;
    running.current = Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: Motion.sheetExit.duration,
        easing: Easing.bezier(...Motion.sheetEnter.bezier),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(scrim, {
        toValue: 1,
        duration: Motion.sheetExit.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);
    running.current.start(({ finished }) => {
      /* 되돌아오는 사이 호출한 쪽이 닫았다 — 떠 있는 채로 남기지 않는다. */
      if (finished && !visibleRef.current) close();
    });
  }, [close, scrim, translateY]);

  /*
   * 끌어서 닫기 — 손을 놓은 자리에서 곧바로 내려보내고(`Motion.sheetExit`) 닫기를 요청한다.
   *
   * 시트형 라우트(일정 추가 등)는 `visible`이 끝까지 true다 — 라우트째 사라지며 내려간다
   * (`features/navigation/stack-motion.ts` `sheet`). 상태형 시트는 호출한 쪽이 `visible`을 내리면
   * 위의 효과가 `close()`로 이어받는다. 둘 다 아니면(입력 중 확인창을 띄웠다) 내려가는 움직임이 끝난
   * 뒤에도 떠 있으므로 제자리로 되돌린다.
   */
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (restoreTimer.current) clearTimeout(restoreTimer.current);
  }, []);
  const dismissByDrag = useCallback(() => {
    running.current?.stop();
    closing.current = true;
    running.current = Animated.parallel([
      Animated.timing(translateY, {
        toValue: height.current || OFFSCREEN,
        duration: Motion.sheetExit.duration,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(scrim, {
        toValue: 0,
        duration: Motion.scrimFade.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);
    running.current.start(({ finished }) => {
      /* 이미 닫힌 시트(호출한 쪽 visible=false)라면 여기서 내린다 — 아무도 다시 닫아 주지 않는다. */
      if (finished && !visibleRef.current) setMounted(false);
    });
    onRequestClose();
    if (restoreTimer.current) clearTimeout(restoreTimer.current);
    restoreTimer.current = setTimeout(() => {
      if (visibleRef.current) snapBack();
    }, Motion.sheetExit.duration + DRAG_RESTORE_GRACE);
  }, [onRequestClose, scrim, snapBack, translateY]);

  /*
   * 끄는 동안만 웹 글자 선택을 막는다. 패널 전체에 `user-select: none`을 걸어 두었더니 시트 본문
   * (상담 내용 · 금액 · 안내)을 고르고 복사할 수 없었다(2026-09-26 검수 반례). 놓거나 끊기면 되돌린다.
   */
  const dragFrom = useRef(0);
  const dragging = useRef(false);
  const releaseSelection = useRef<(() => void) | null>(null);
  const endDrag = useCallback(() => {
    dragging.current = false;
    releaseSelection.current?.();
    releaseSelection.current = null;
  }, []);
  useEffect(() => endDrag, [endDrag]);

  const pan = useMemo(
    () =>
      /*
       * 끌기 처리기. 안의 콜백은 손가락이 움직일 때만 ref(패널 높이 · 끌기 시작점 · 진행 중 애니메이션)를
       * 읽는다 — 그리는 동안에는 읽지 않는다. 컴파일러는 PanResponder가 콜백을 언제 부르는지 몰라
       * 막는다.
       */
      // eslint-disable-next-line react-hooks/refs -- 제스처 콜백 안에서만 ref를 읽는다(렌더 중 읽기 없음)
      PanResponder.create({
        /* 닫히는 중(또는 이미 닫힌) 시트는 잡지 않는다 — 잡으면 닫는 움직임이 끊겨 Modal이 남는다. */
        onMoveShouldSetPanResponder: (_event, gesture) =>
          dismissible && visibleRef.current && !closing.current && isDownwardDrag(gesture),
        onPanResponderGrant: () => {
          dragging.current = true;
          releaseSelection.current = lockTextSelection();
          running.current?.stop();
          translateY.stopAnimation((value) => {
            dragFrom.current = Math.max(0, value);
          });
        },
        onPanResponderMove: (_event, gesture) => {
          if (!dragging.current || closing.current) return;
          const y = Math.max(0, dragFrom.current + gesture.dy);
          translateY.setValue(y);
          const h = height.current || 1;
          scrim.setValue(Math.max(0, 1 - y / h));
        },
        onPanResponderRelease: (_event, gesture) => {
          endDrag();
          /* 끄는 사이 호출한 쪽이 닫았다 — 그 닫힘을 끝까지 마친다. */
          if (!visibleRef.current || closing.current) {
            close();
            return;
          }
          const y = Math.max(0, dragFrom.current + gesture.dy);
          const h = height.current || 1;
          if (y >= h * DRAG_CLOSE_RATIO || gesture.vy >= DRAG_CLOSE_VELOCITY) {
            dismissByDrag();
            return;
          }
          snapBack();
        },
        onPanResponderTerminate: () => {
          endDrag();
          if (!visibleRef.current || closing.current) close();
          else snapBack();
        },
        /*
         * 웹은 끄는 동안 넘기지 않는다 — 글자 선택(selectionchange)이 끌기를 끊지 못하게. 손잡이는
         * 스크롤을 품지 않아 넘겨줄 상대도 없다. 네이티브는 OS 제스처가 가져가면 넘긴다.
         */
        onPanResponderTerminationRequest: () => Platform.OS !== 'web',
      }),
    [close, dismissible, dismissByDrag, endDrag, scrim, snapBack, translateY]
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      height.current = event.nativeEvent.layout.height;
      if (pendingOpen.current) {
        pendingOpen.current = false;
        open();
      }
    },
    [open]
  );

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismissible ? onRequestClose : noop}
      testID={testID}>
      {/*
        키보드가 올라오면 패널을 그만큼 밀어 올린다.
        **`KeyboardAvoidingView`가 저장소 전체에 0건이었다**(Release Audit 1차 P1-3).
        입력이 있는 시트(이름 · 노트 · 방문노트 · 일정 · 지출)에서 키보드가 저장 ·
        취소 버튼을 덮어 입력을 끝낼 수 없었다. 여기 한 곳에 두면 그 시트가 전부
        해소된다 — 시트마다 붙이면 새로 만드는 시트가 조용히 빠진다.

        **웹에서는 그동안 아무것도 하지 않았다** — react-native-web의 KeyboardAvoidingView는 빈
        껍데기라 모바일 브라우저에서 키패드가 시트 CTA를 덮었다(2026-09-26 대표 지시 「바텀시트 등
        키패드와 겹치면 안된다」). 공통 `KeyboardAvoid lift`가 네이티브는 그대로 RN
        KeyboardAvoidingView(iOS `padding` · Android `height`), 웹은 visualViewport로 잰 높이만큼
        올린다(`keyboard-avoid.web.tsx`). 패널은 줄어들 수 있게 두어(`flexShrink`) 키패드 위 남은
        높이를 넘으면 안의 스크롤이 줄고 제목 · CTA는 보인다.
      */}
      <KeyboardAvoid lift style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim, opacity: scrim }]}>
          {dismissible ? (
            /*
             * `cancelable={false}` — 딤을 쓸어도 바깥(중첩된 부모 시트의 손잡이 등)이 이 누름을 빼앗지
             * 못한다. 네이티브 응답자 협상은 React 트리를 따라 Modal 경계를 넘어 올라가기 때문이다.
             */
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel="닫기"
              cancelable={false}
              onPress={onRequestClose}
            />
          ) : null}
        </Animated.View>

        <Animated.View
          onLayout={onLayout}
          style={[styles.panel, style, { opacity: panel, transform: [{ translateY }] }]}>
          <SheetDragContext.Provider value={dismissible ? pan.panHandlers : null}>{children}</SheetDragContext.Provider>
        </Animated.View>
      </KeyboardAvoid>
    </Modal>
  );
}

/**
 * 시트 패널 공통 겉모습 — 상단 둥글기 20(`Radius.sheet`). 배경 · 패딩 · 안전영역은 각 시트가 더한다.
 * `<ThemedView style={[SHEET_PANEL, styles.sheet]}>`처럼 children 루트에 얹는다.
 * 새 시트는 아래 `SheetPanel`을 쓰면 패딩 · 그래버 · 안전영역까지 한 번에 맞는다.
 */
export const SHEET_PANEL: ViewStyle = {
  borderTopLeftRadius: Radius.sheet,
  borderTopRightRadius: Radius.sheet,
};

/**
 * 끌어서 닫기 손잡이에 거는 처리기. `BottomSheet`가 닫을 수 있을 때만 준다(닫을 수 없으면 null).
 * 그래버 줄과 머리 줄이 받아 건다 — 본문에는 걸지 않는다(위 `BottomSheet` 머리말).
 */
const SheetDragContext = createContext<GestureResponderHandlers | null>(null);

/**
 * 시트 그래버 — tokens.json component.sheet.grabber: 40×4 · radius 999 · #EAEBEE · 가운데.
 * 패널 맨 위(padding-top 안쪽)에 놓는다.
 *
 * 끌기 손잡이는 막대 4px보다 넓다 — 패널 윗 여백부터 머리 줄 바로 위까지 한 줄 전체다. 음수 여백으로
 * 넓힌 만큼 되돌려서 **배치는 그대로**다(막대 위치 · 머리 줄 위치가 바뀌지 않는다).
 */
export function SheetGrabber() {
  const theme = useTheme();
  const drag = useContext(SheetDragContext);

  return (
    <View
      {...(drag ?? {})}
      style={styles.grabberZone}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="sheet-grabber">
      <View style={[styles.grabber, { backgroundColor: theme.border }]} />
    </View>
  );
}

export type SheetHeaderProps = {
  title: ReactNode;
  /**
   * X를 누르면. 입력 중인 폼 시트는 `requestDirtySheetClose`를 거친 닫기를 넘긴다.
   * 넘기지 않으면 X를 그리지 않는다 — 닫을 수 없는 시트(첫 총예산 등록)에 누를 수 없는 X를
   * 세워 두지 않는다.
   */
  onClose?: () => void;
  /** 저장 · 업로드 중처럼 지금은 닫으면 안 될 때. X를 흐리게 두고 누를 수 없다. */
  closeDisabled?: boolean;
  closeLabel?: string;
  /** 제목이 업체 이름처럼 길 수 있을 때 줄 수를 묶는다. */
  titleLines?: number;
};

/**
 * 시트 머리 — **타이틀 + 우측 X 닫기**(CLAUDE.md v3.29 「바텀시트」 · 2026-09-25 대표 지시
 * 「바텀시트 전체 … 공통 UX 통일」). 시트마다 따로 그리던 머리를 여기 하나로 모은다.
 *
 *   제목   22/30 · 700 · 왼쪽 정렬   RN 정본 `common.js:190` titleStyle(sheet) · WP-DLG-D 「제목은 왼쪽 정렬」
 *   X      36 × 36 원 · 회색(SEC) · close 16 · 글자색   `home.js:705` · `note.js:81` `sheetClose` + `icoX`
 *   배치   양끝 · 세로 가운데 · 사이 12                  `home.js:703` `sheetHead`
 *
 * 서브 문구는 머리에 넣지 않는다(Header 서브 문구 미사용) — 안내는 본문 첫 줄로 둔다.
 */
export function SheetHeader({
  title,
  onClose,
  closeDisabled = false,
  closeLabel = '닫기',
  titleLines,
}: SheetHeaderProps) {
  const theme = useTheme();
  const drag = useContext(SheetDragContext);

  return (
    <View {...(drag ?? {})} style={styles.head} testID="sheet-header">
      <ThemedText type="t4" style={styles.headTitle} accessibilityRole="header" numberOfLines={titleLines}>
        {title}
      </ThemedText>
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          accessibilityState={{ disabled: closeDisabled }}
          disabled={closeDisabled}
          onPress={onClose}
          hitSlop={4}
          style={({ pressed }) => [
            styles.headClose,
            PRESS_TRANSITION,
            { backgroundColor: theme.backgroundSelected },
            (pressed || closeDisabled) && styles.headClosePressed,
          ]}>
          <ProductSymbol name="close" size={16} color={theme.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

export type SheetPanelProps = {
  children: ReactNode;
  /** 그래버를 그리지 않는다 — 폼 시트처럼 드래그로 닫히지 않는 시트. 기본은 그린다. */
  grabber?: boolean;
  /** 패널에 더 얹는 스타일(gap 조정 등). 패딩 · 둥글기 · 배경은 여기서 정하므로 덮지 않는다. */
  style?: StyleProp<ViewStyle>;
};

/**
 * 시트 패널 — tokens.json component.sheet · 17-sheets-states 1:1.
 *
 *   radius 20 20 0 0 · 흰 배경 · padding 12 24 (28 + safeBottom) · 요소 간격 20 · 그래버 40×4
 *
 * 하단 안전영역은 여기서 한 번만 더한다(safeArea.formula.sheetBottomPadding). 스크롤 내용에는
 * 넣지 않는다 — 넣으면 스크롤 끝에 빈 공간이 두 번 생긴다.
 */
export function SheetPanel({ children, grabber = true, style }: SheetPanelProps) {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView
      style={[
        SHEET_PANEL,
        styles.sheetPanel,
        { paddingBottom: Layout.sheetPaddingBottom + Math.max(insets.bottom, 0) },
        style,
      ]}>
      {grabber ? <SheetGrabber /> : null}
      {children}
    </ThemedView>
  );
}

/** dismissible=false — Android 뒤로가기를 먹고 아무것도 하지 않는다(시트가 닫히지 않는다). */
function noop() {}

/** 아래로 끈 거리 중 이만큼(패널 높이 대비)을 넘기면 닫는다. 플랫폼 관례값 — DESIGN_UNRESOLVED. */
const DRAG_CLOSE_RATIO = 0.25;
/** 아래로 튕긴 속도(px/ms)가 이 이상이면 거리와 상관없이 닫는다. 플랫폼 관례값 — DESIGN_UNRESOLVED. */
const DRAG_CLOSE_VELOCITY = 0.8;
/**
 * 웹 — 끄는 동안에만 글자 선택을 막는다. 제목을 잡고 마우스로 끌면 브라우저가 글자 선택을 시작하고,
 * react-native-web은 그 선택(selectionchange)으로 끌기 응답자를 끊는다(2026-09-26 녹화). 그래서
 * 끌기가 시작되는 순간 이미 생긴 선택을 지우고 문서 전체의 선택을 잠갔다가, 놓으면 되돌린다.
 * 패널에 늘 걸어 두면 시트 본문을 고르고 복사할 수 없다(2026-09-26 검수 반례). 네이티브는 할 일이 없다.
 */
export function lockTextSelection(): () => void {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || !document.body) return noop;

  const style = document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string };
  const previous = { userSelect: style.userSelect, webkitUserSelect: style.webkitUserSelect };
  style.userSelect = 'none';
  style.webkitUserSelect = 'none';
  if (typeof window !== 'undefined') window.getSelection?.()?.removeAllRanges();

  return () => {
    style.userSelect = previous.userSelect ?? '';
    style.webkitUserSelect = previous.webkitUserSelect ?? '';
  };
}

/** 끌어서 닫기를 요청한 뒤 닫혔는지 확인하기 전 여유 — 시트형 라우트가 걷히는 시간(250)을 넘긴다. */
const DRAG_RESTORE_GRACE = 250;
/** 이만큼 움직여야 끌기로 본다 — 누르기(탭)와 가른다. */
const DRAG_SLOP = 6;

function isDownwardDrag(gesture: PanResponderGestureState): boolean {
  return gesture.dy > DRAG_SLOP && Math.abs(gesture.dy) > Math.abs(gesture.dx);
}

/** 패널 높이를 재기 전 임시 위치 — 어떤 화면보다 아래라 첫 프레임에 보이지 않는다. */
const OFFSCREEN = 10000;

/** 최대 높이 — 긴 폼(방문노트 · 일정)은 안의 ScrollView가 굴러가고 시트가 화면을 다 덮지 않는다. */
const MAX_PANEL_HEIGHT = '90%';

/** 시트 X 닫기 — 정본 `sheetClose` 36 × 36. */
const SHEET_CLOSE_SIZE = 36;

const styles = StyleSheet.create({
  /* overflow hidden — 아래로 밀려난 패널이 웹에서 스크롤 영역을 늘리지 않게 한다. */
  root: { flex: 1, justifyContent: 'flex-end', overflow: 'hidden' },
  /* flexShrink — 키패드가 떠서 남은 높이가 패널보다 작으면 패널(과 `SheetPanel`)이 줄어든다. */
  panel: { width: '100%', maxHeight: MAX_PANEL_HEIGHT, flexShrink: 1 },
  sheetPanel: {
    /* 패널이 줄면 같이 줄어 안의 ScrollView(기본 flexShrink 1)가 굴러간다 — 머리 · CTA는 남는다. */
    flexShrink: 1,
    paddingTop: Layout.sheetPaddingTop,
    paddingHorizontal: Layout.gutter,
    gap: Layout.sheetGap,
  },
  /*
   * 그래버 끌기 손잡이 — 패널 윗 여백(sheetPaddingTop)과 머리 줄 위 간격(sheetGap)까지 덮는다.
   * 넓힌 만큼 음수 여백으로 되돌려 막대와 다음 줄의 자리는 그대로다.
   */
  grabberZone: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: Layout.sheetPaddingTop,
    marginTop: -Layout.sheetPaddingTop,
    paddingBottom: Spacing.one + Layout.sheetGap,
    marginBottom: -Layout.sheetGap,
  },
  /* RN 정본 `common.js:571` `grab` — margin-bottom 4. 패널 gap 12와 더해 제목은 그래버 아래 16에 선다. */
  grabber: {
    width: Layout.grabberWidth,
    height: Layout.grabberHeight,
    borderRadius: Radius.pill,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
    minHeight: SHEET_CLOSE_SIZE,
  },
  headTitle: { flex: 1, fontSize: FontSize.sheetTitle, lineHeight: LineHeight.sheetTitle, fontWeight: 700 },
  headClose: {
    width: SHEET_CLOSE_SIZE,
    height: SHEET_CLOSE_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headClosePressed: { opacity: 0.6 },
});
