import { StyleSheet, View } from 'react-native';

import { ActionButton, Layout, ThemedText } from '@weddingpick/ui';
import { BottomSheet, SheetPanel } from '@/features/common/bottom-sheet';

export type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  message?: string;
  /** 확인 버튼 레이블. 기본 "확인". */
  confirmLabel?: string;
  /** 취소 버튼 레이블. 기본 "취소". */
  cancelLabel?: string;
  /** 파괴적 확인(빼기 · 신고 · 탈퇴) — 확인 버튼이 #FF4133이 된다(WP-SHT-003 · 013). */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 확인 바텀시트 — 02-design-system «Bottom Sheet» · 17-sheets-states 1:1.
 *
 *   그래버 40×4 → 제목 24/32 → 본문 16/22 #4D5159(간격 6) → 버튼 한 줄
 *   왼쪽 보조(#F2F3F6 · flex 1) · 오른쪽 주 행동(coral · flex 1.4) · 높이 52 · 사이 10
 *
 * 닫기를 막지 않는다 — 스크림을 누르면 취소와 같다.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <BottomSheet visible={visible} onRequestClose={onCancel}>
      <SheetPanel>
        <View style={styles.headline}>
          <ThemedText type="t3">{title}</ThemedText>
          {message ? (
            <ThemedText type="t6" themeColor="textSecondary">
              {message}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.actions}>
          <View style={styles.cancel}>
            <ActionButton size="xlarge" label={cancelLabel} disabled={busy} onPress={onCancel} />
          </View>
          <View style={styles.confirm}>
            <ActionButton
              variant={destructive ? 'danger' : 'primary'}
              size="xlarge"
              label={busy ? '처리 중…' : confirmLabel}
              disabled={busy}
              onPress={onConfirm}
            />
          </View>
        </View>
      </SheetPanel>
    </BottomSheet>
  );
}

/** 02-design-system 시트 버튼 비율 — 보조 1 : 주 행동 1.4. */
const CONFIRM_FLEX = 1.4;

const styles = StyleSheet.create({
  headline: { gap: Layout.sheetHeadGap },
  actions: { flexDirection: 'row', gap: Layout.cardGap },
  cancel: { flex: 1 },
  confirm: { flex: CONFIRM_FLEX },
});
