import { Modal, Pressable, StyleSheet, View } from 'react-native';

import {
  ActionButton,
  Layout,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

export type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  message?: string;
  /** 확인 버튼 레이블. 기본 "확인". */
  confirmLabel?: string;
  /** 취소 버튼 레이블. 기본 "취소". */
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 확인 바텀시트. 여러 화면의 인라인 모달 패턴을 하나로 뽑았다.
 *
 * 닫기를 막지 않는다 — 스크림을 누르면 취소와 같다.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onCancel}
        />

        <ThemedView style={styles.sheet}>
          <ThemedView style={styles.headline}>
            <ThemedText type="t4">{title}</ThemedText>
            {message ? (
              <ThemedText type="t6" themeColor="textSecondary">
                {message}
              </ThemedText>
            ) : null}
          </ThemedView>

          <ThemedView style={styles.actions}>
            <ActionButton
              variant="primary"
              label={busy ? '처리 중…' : confirmLabel}
              disabled={busy}
              onPress={onConfirm}
            />
            <ActionButton label={cancelLabel} disabled={busy} onPress={onCancel} />
          </ThemedView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: Layout.gutter,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  headline: { gap: Spacing.one },
  actions: { gap: Spacing.two },
});
