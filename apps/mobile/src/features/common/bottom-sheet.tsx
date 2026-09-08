import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Motion, Radius, useTheme } from '@weddingpick/ui';

export type BottomSheetProps = {
  visible: boolean;
  /** 스크림 탭 · Android 뒤로가기. 시트를 닫는 쪽의 단 하나의 길이다. */
  onRequestClose: () => void;
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
 * 패널의 배경 · 둥글기 · 패딩 · 안전영역은 여기서 정하지 않는다 — 호출하는 쪽이 `children` 루트에
 * 준다(`SHEET_PANEL` 참고). 스크림 Pressable과 패널은 형제다 — 패널을 Pressable로 감싸면 웹에서
 * button 안에 button이 들어간다.
 */
export function BottomSheet({ visible, onRequestClose, children, style, testID }: BottomSheetProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();

  const [mounted, setMounted] = useState(visible);
  const [scrim] = useState(() => new Animated.Value(0));
  const [panel] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(OFFSCREEN));
  const height = useRef(0);
  /* 열릴 차례인데 아직 패널 높이를 모른다 — onLayout이 오면 그때 올린다. */
  const pendingOpen = useRef(false);
  const running = useRef<Animated.CompositeAnimation | null>(null);

  const open = useCallback(() => {
    running.current?.stop();
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
        useNativeDriver: true,
      }),
      reduceMotion
        ? Animated.timing(panel, {
            toValue: 1,
            duration: Motion.scrimFade.duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          })
        : Animated.timing(translateY, {
            toValue: 0,
            duration: Motion.sheetEnter.duration,
            easing: Easing.bezier(...Motion.sheetEnter.bezier),
            useNativeDriver: true,
          }),
    ]);
    running.current.start();
  }, [panel, reduceMotion, scrim, translateY]);

  const close = useCallback(() => {
    running.current?.stop();
    const to = height.current || OFFSCREEN;

    running.current = Animated.parallel([
      Animated.timing(scrim, {
        toValue: 0,
        duration: Motion.scrimFade.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      reduceMotion
        ? Animated.timing(panel, {
            toValue: 0,
            duration: Motion.scrimFade.duration,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          })
        : Animated.timing(translateY, {
            toValue: to,
            duration: Motion.sheetExit.duration,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
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
      onRequestClose={onRequestClose}
      testID={testID}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim, opacity: scrim }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onRequestClose}
          />
        </Animated.View>

        <Animated.View
          onLayout={onLayout}
          style={[styles.panel, style, { opacity: panel, transform: [{ translateY }] }]}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * 시트 패널 공통 겉모습 — 상단 둥글기 20(`Radius.sheet`). 배경 · 패딩 · 안전영역은 각 시트가 더한다.
 * `<ThemedView style={[SHEET_PANEL, styles.sheet]}>`처럼 children 루트에 얹는다.
 */
export const SHEET_PANEL: ViewStyle = {
  borderTopLeftRadius: Radius.sheet,
  borderTopRightRadius: Radius.sheet,
};

/** 「움직임 줄이기」 — 켜져 있으면 이동 없이 페이드만 한다. 웹은 prefers-reduced-motion을 본다. */
function useReduceMotion() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) setReduce(enabled);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduce;
}

/** 패널 높이를 재기 전 임시 위치 — 어떤 화면보다 아래라 첫 프레임에 보이지 않는다. */
const OFFSCREEN = 10000;

/** 최대 높이 — 긴 폼(방문노트 · 일정)은 안의 ScrollView가 굴러가고 시트가 화면을 다 덮지 않는다. */
const MAX_PANEL_HEIGHT = '90%';

const styles = StyleSheet.create({
  /* overflow hidden — 아래로 밀려난 패널이 웹에서 스크롤 영역을 늘리지 않게 한다. */
  root: { flex: 1, justifyContent: 'flex-end', overflow: 'hidden' },
  panel: { width: '100%', maxHeight: MAX_PANEL_HEIGHT },
});
