import { Pressable, StyleSheet, View } from 'react-native';

import {
  Border,
  FontSize,
  Layout,
  LineHeight,
  ProductSymbol,
  Radius,
  ThemedText,
  useTheme,
} from '@weddingpick/ui';

/**
 * 온보딩 선택 행.
 *
 * 기본형(`role="radio"`, description 없음)은 기존 설정 화면 호환용이고,
 * description이 있으면 v3.29 정본 `docs/design/html/대메뉴_홈(로그인, 온보딩).dc.html`
 * WP-AUTH-004(`prepCell`) · WP-AUTH-006(`styleBtn`)의 카드(72px min-height ·
 * padding 16 18 · radius 10 · 이름 17/700 · 보조문구 13/19)를 그대로 쓴다 —
 * 진행 상황(3/5)은 `role="checkbox"` 여러 개, 스타일(5/5)은 `role="checkbox"`
 * 최대 2개다(2026-09-23 대표님 확인 대기 — CLAUDE.md 「⚠️」 참고, 정본 원문은
 * 개수 제한 없음이지만 확인 전까지 기존 2개 제한을 유지한다).
 */
export function OptionRow({
  label,
  description,
  selected,
  onPress,
  role = 'radio',
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  role?: 'radio' | 'checkbox';
}) {
  const theme = useTheme();
  const detailed = Boolean(description);

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        detailed ? styles.detailRow : styles.row,
        selected
          ? {
              backgroundColor: theme.tintSurface,
              borderColor: theme.tint,
              borderWidth: detailed ? Border.selected : Border.hairline,
            }
          : detailed
            ? { backgroundColor: theme.backgroundElement, borderColor: 'transparent', borderWidth: Border.selected }
            : { backgroundColor: theme.background, borderColor: theme.border, borderWidth: Border.hairline },
        pressed && styles.pressed,
      ]}>
      {detailed ? (
        <View style={styles.detailText}>
          <ThemedText
            type="f16"
            themeColor={selected ? 'tint' : 'text'}
            numberOfLines={1}
            style={styles.detailLabel}>
            {label}
          </ThemedText>
          <ThemedText type="f13" themeColor="textAssistive" numberOfLines={1} style={styles.detailDescription}>
            {description}
          </ThemedText>
        </View>
      ) : (
        <ThemedText type="f15" themeColor={selected ? 'tint' : 'text'} numberOfLines={1} style={styles.label}>
          {label}
        </ThemedText>
      )}

      {selected ? (
        detailed ? (
          <View style={[styles.selectedMark, { backgroundColor: theme.tint }]}>
            <ProductSymbol name="check" size={15} color={theme.onTint} />
          </View>
        ) : (
          <ProductSymbol name="check" size={Layout.iconRow} color={theme.tint} />
        )
      ) : detailed ? (
        <View style={[styles.emptyMark, { borderColor: theme.track }]} />
      ) : (
        <View style={styles.checkSlot} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Layout.cardPadding,
    borderRadius: Radius.cardLarge,
  },
  label: { fontWeight: 700, lineHeight: LineHeight.lh23, flexShrink: 1 },
  checkSlot: { width: Layout.iconRow, height: Layout.iconRow },

  detailRow: {
    minHeight: 72,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: Radius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.inlineGap,
  },
  detailText: { flex: 1, minWidth: 0, gap: 3 },
  detailLabel: {
    fontSize: FontSize.dateWheel,
    fontWeight: 700,
  },
  detailDescription: { lineHeight: LineHeight.lh19 },
  selectedMark: {
    width: 24,
    height: 24,
    flexShrink: 0,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMark: {
    width: 24,
    height: 24,
    flexShrink: 0,
    borderRadius: Radius.pill,
    borderWidth: Border.selected,
  },

  pressed: { opacity: 0.8 },
});
