import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ProductSymbol, Spacing, ThemedText, readWebInteractionState, useTheme } from '@weddingpick/ui';

/** 목록에서는 행동을 접어 두고, 선택한 일정에서만 수정·삭제를 보여 준다. */
export function TimelineRowMenu({
  label,
  disabled = false,
  onEdit,
  onDelete,
}: {
  label: string;
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} 더보기`}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen((value) => !value)}
        style={(state) => {
          const { focused, pressed } = readWebInteractionState(state);
          return [
            styles.more,
            { borderColor: theme.tint, borderWidth: focused ? 2 : 0, opacity: pressed ? 0.8 : 1 },
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
          ];
        }}>
        <ProductSymbol name="more" size={20} color={theme.textSecondary} />
      </Pressable>
      {open ? (
        <View style={[styles.menu, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} 수정`}
            disabled={disabled}
            onPress={() => { setOpen(false); onEdit(); }}
            style={styles.action}>
            <ProductSymbol name="edit" size={17} color={theme.text} />
            <ThemedText type="f13">수정</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} 삭제`}
            disabled={disabled}
            onPress={() => { setOpen(false); onDelete(); }}
            style={styles.action}>
            <ProductSymbol name="trash" size={17} color={theme.negative} />
            <ThemedText type="f13" themeColor="negative">삭제</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-end' },
  more: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  menu: { flexDirection: 'row', gap: Spacing.two, borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.one },
  action: { minWidth: 64, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
});
