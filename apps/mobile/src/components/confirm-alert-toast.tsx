import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Elevation, Layout, Radius, Spacing, ThemedText, ToastColors } from '@weddingpick/ui';

/** 사용자 설정: 결과와 되돌리기 토스트 모두 1초 뒤 사라진다. */
export const DIALOG_TOAST_MS = 1000;
export const DIALOG_TOAST_ACTION_MS = 1000;
export const DIALOG_TOAST_DOCK_BOTTOM = 100;
export const DIALOG_TOAST_FREE_BOTTOM = 32;

export function dialogToastDuration(hasAction: boolean): number {
  return hasAction ? DIALOG_TOAST_ACTION_MS : DIALOG_TOAST_MS;
}

export function dialogToastBottom(docked: boolean): number {
  return docked ? DIALOG_TOAST_DOCK_BOTTOM : DIALOG_TOAST_FREE_BOTTOM;
}

export type DialogToastProps = {
  message: string | null;
  actionLabel?: string | null;
  onAction?: (() => void) | null;
  onHidden?: () => void;
  /** 하단 dock/tab bar가 있으면 정본 100, 없으면 32. */
  docked?: boolean;
};

/**
 * DLG-F 토스트.
 *
 * 한 화면에 하나만 렌더하므로 새 message가 오면 이전 문구와 타이머를 즉시 교체한다.
 * 화면 이동 성공 뒤에는 쓰지 않고, 같은 화면에 남는 결과/제한/실패만 알려준다.
 */
export function DialogToast(props: DialogToastProps) {
  const { message } = props;

  if (message === null) return null;

  return (
    <VisibleDialogToast
      key={`${message}:${props.actionLabel ?? ''}`}
      {...props}
      message={message}
    />
  );
}

function VisibleDialogToast({
  message,
  actionLabel = null,
  onAction = null,
  onHidden,
  docked = false,
}: Omit<DialogToastProps, 'message'> & { message: string }) {
  const [visible, setVisible] = useState(true);
  const hasAction = Boolean(actionLabel && onAction);
  const onHiddenRef = useRef(onHidden);

  useEffect(() => {
    onHiddenRef.current = onHidden;
  }, [onHidden]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onHiddenRef.current?.();
    }, dialogToastDuration(hasAction));

    return () => clearTimeout(timer);
  }, [hasAction]);

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: dialogToastBottom(docked) }]}>
      <View
        accessibilityRole="alert"
        style={styles.toast}>
        <ThemedText type="f15" style={styles.message}>
          {message}
        </ThemedText>
        {hasAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel ?? undefined}
            hitSlop={Spacing.two}
            onPress={() => {
              onAction?.();
              setVisible(false);
              onHidden?.();
            }}>
            <ThemedText type="t7" style={styles.action}>
              {actionLabel}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/*
 * RN 정본 `docs/design/React_Native/common.js:198~199`(WP-DLG-F, common frame-006 · 007).
 *   toastWrap  좌우 24 · 가운데 정렬 · bottom dock 100 / 없으면 32
 *   toast      내용 폭(max 100%) · padding 14 18 · radius 10 · gap 14 · 15/22 · 700
 *              배경 rgba(23,25,28,.92) · 그림자 0 4 16 .24 · 되돌리기 14 · 700 · #ffb3ab(`:579`)
 */
const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Layout.gutter,
    right: Layout.gutter,
    zIndex: 100,
    alignItems: 'center',
  },
  toast: {
    maxWidth: '100%',
    borderRadius: Radius.medium,
    paddingHorizontal: Layout.cardPaddingCompactY,
    paddingVertical: Layout.sectionHeadGap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.sectionHeadGap,
    backgroundColor: ToastColors.background,
    ...Elevation.toast,
  },
  message: { flexShrink: 1, fontWeight: '700', color: ToastColors.text },
  action: { fontWeight: '700', color: ToastColors.action },
});
