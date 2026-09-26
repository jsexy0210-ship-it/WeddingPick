import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, ProductSymbol, useTheme } from '@weddingpick/ui';

import { ourWedding as copy } from '../../../../../spec/strings.ko.json';

/** note.js `icoEditSm` · `icoTrashSm` — `ICO('edit' | 'trash', 14, MUTED)`. */
const ICON_SIZE = 14;

/**
 * 지출내역 줄 끝의 수정 · 삭제 아이콘(2026-09-26 대표 지시 — 직접 넣은 지출마다 바로 고치고 지운다).
 *
 * 아이콘은 정본 예산 줄 `bTop`의 `icoEditSm` · `icoTrashSm`(`edit.svg` · `trash.svg` 14px MUTED)을
 * 그대로 쓰고, 누르는 칸은 44 × 44(`Layout.touchTarget`)다 — 14px 아이콘만 누르게 두면 손가락이
 * 옆 줄을 누른다. 직접 입력한 줄에만 그린다(Pick 인증 · 상담 정리 줄은 부모가 이 컴포넌트를
 * 안 그린다). 웨딩일정 타임라인의 일정 · 할 일 줄도 같은 아이콘을 쓴다(2026-09-26 — 한 앱 한 모양).
 */
export function ExpenseRowActions({
  label,
  disabled = false,
  testIDPrefix = 'expense-row',
  onEdit,
  onDelete,
}: {
  label: string;
  disabled?: boolean;
  /** 시험이 찾는 이름 앞부분 — 웨딩일정 타임라인 줄은 `timeline-row`(2026-09-26). */
  testIDPrefix?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${copy['expense.edit']}`}
        disabled={disabled}
        onPress={onEdit}
        testID={`${testIDPrefix}-edit`}
        style={({ pressed }) => [styles.hit, pressed ? styles.pressed : null]}>
        <ProductSymbol name="edit" size={ICON_SIZE} color={theme.textAssistive} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${copy['expense.delete']}`}
        disabled={disabled}
        onPress={onDelete}
        testID={`${testIDPrefix}-delete`}
        style={({ pressed }) => [styles.hit, pressed ? styles.pressed : null]}>
        <ProductSymbol name="trash" size={ICON_SIZE} color={theme.textAssistive} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center' },
  hit: {
    width: Layout.touchTarget,
    height: Layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
