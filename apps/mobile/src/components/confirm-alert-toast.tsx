import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

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
  const theme = useTheme();
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
    <View
      accessibilityRole="alert"
      style={[
        styles.toast,
        { backgroundColor: theme.backgroundInk, bottom: dialogToastBottom(docked) },
      ]}>
      <ThemedText type="t7" style={[styles.message, { color: theme.onInk }]}>
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
