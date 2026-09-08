import { StyleSheet } from 'react-native';

import {
  ActionButton,
  Layout,
  Spacing,
  ThemedText,
  ThemedView,
} from '@weddingpick/ui';
import { BottomSheet, SHEET_PANEL } from '@/features/common/bottom-sheet';

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
  return (
    <BottomSheet visible={visible} onRequestClose={onCancel}>
      <ThemedView style={[SHEET_PANEL, styles.sheet]}>
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
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    padding: Layout.gutter,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  headline: { gap: Spacing.one },
  actions: { gap: Spacing.two },
});
