import { StyleSheet, View } from 'react-native';

import { ActionButton, Spacing } from '@weddingpick/ui';

import { ourWedding as copy } from '../../../../../spec/strings.ko.json';

/** 지출과 일정에서 같은 크기와 문구의 수정·삭제 CTA를 사용한다. */
export function ExpenseRowActions({
  label,
  disabled = false,
  editDisabled = false,
  testIDPrefix = 'expense-row',
  onEdit,
  onDelete,
}: {
  label: string;
  disabled?: boolean;
  editDisabled?: boolean;
  testIDPrefix?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.actions}>
      <View style={styles.action}>
        <ActionButton
          label={copy['expense.edit']}
          accessibilityLabel={`${label} ${copy['expense.edit']}`}
          variant="ghost"
          size="medium"
          disabled={disabled || editDisabled}
          onPress={onEdit}
          testID={`${testIDPrefix}-edit`}
        />
      </View>
      <View style={styles.action}>
        <ActionButton
          label={copy['expense.delete']}
          accessibilityLabel={`${label} ${copy['expense.delete']}`}
          variant="ghost"
          size="medium"
          disabled={disabled}
          onPress={onDelete}
          testID={`${testIDPrefix}-delete`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1, minWidth: 0 },
});
