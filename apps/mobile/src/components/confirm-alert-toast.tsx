import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

/** 09-dialogs DLG-F: 일반 2초, 행동(되돌리기 등)이 있으면 4초. */
export const DIALOG_TOAST_MS = 2000;
export const DIALOG_TOAST_ACTION_MS = 4000;
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
export function DialogToast({
  message,
  actionLabel = null,
  onAction = null,
  onHidden,
  docked = false,
}: DialogToastProps) {
  const theme = useTheme();
  const [shown, setShown] = useState<string | null>(message);
  const hiddenRef = useRef(onHidden);
  const actionRef = useRef(onAction);

  hiddenRef.current = onHidden;
  actionRef.current = onAction;

  useEffect(() => {
    if (message === null) {
      setShown(null);
      return;
    }

    setShown(message);
    const timer = setTimeout(() => {
      setShown(null);
      hiddenRef.current?.();
    }, dialogToastDuration(Boolean(actionLabel && onAction)));

    return () => clearTimeout(timer);
  }, [actionLabel, message, onAction]);

  if (shown === null) return null;

  const hasAction = Boolean(actionLabel && onAction);

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.toast,
        { backgroundColor: theme.backgroundInk, bottom: dialogToastBottom(docked) },
      ]}>
      <ThemedText type="t7" style={[styles.message, { color: theme.onInk }]}>
        {shown}
      </ThemedText>
      {hasAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel ?? undefined}
          hitSlop={Spacing.two}
          onPress={() => {
            actionRef.current?.();
            setShown(null);
            hiddenRef.current?.();
          }}>
          <ThemedText type="t7" themeColor="tint" style={styles.action}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: Layout.gutter,
    right: Layout.gutter,
    zIndex: 100,
    minHeight: Layout.touchTarget,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  message: { flex: 1 },
  action: { fontWeight: '700' },
});
