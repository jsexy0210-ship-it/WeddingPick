import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import { CategoryImage } from './category-image';
import { TASTE_LABEL, TASTES, type Taste } from './taste';

/**
 * 어떤 결혼식을 원하세요? — 홈 C-1 시안 1의 취향 고르기.
 *
 * 가입 직후에는 현황판에 채울 것이 없다. 그 자리를 이 격자가 대신한다 — 사진 넉
 * 장으로 취향을 먼저 받고, 그 다음부터 추천이 성립한다.
 *
 * **업로드 UI가 아니라 선택 카드다.** 사용자가 사진을 올리는 화면이었던 적이
 * 있는데, 그건 취향을 묻는 게 아니라 일을 시키는 것이었다.
 */

export type TastePickerProps = {
  chosen: readonly Taste[];
  onToggle: (taste: Taste) => void;
};

export function TastePicker({ chosen, onToggle }: TastePickerProps) {
  return (
    <ThemedView style={styles.grid}>
      {TASTES.map((taste) => (
        <Tile
          key={taste}
          label={TASTE_LABEL[taste]}
          selected={chosen.includes(taste)}
          onPress={() => onToggle(taste)}
        />
      ))}
    </ThemedView>
  );
}

function Tile({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <CategoryImage style={styles.image} />

      {/*
        고른 것은 코랄 테두리로 알린다. 색을 더 쓰지 않고 테두리 하나로 끝내는
        것이 시안의 규칙이다 — 코랄 사용량은 늘리지 않는다.
      */}
      <View
        style={[
          styles.overlay,
          selected
            ? { borderWidth: 2, borderColor: theme.tint }
            : { borderWidth: 1, borderColor: theme.line },
        ]}
      />

      <View
        style={[
          styles.check,
          selected
            ? { backgroundColor: theme.tint, borderColor: theme.tint }
            : { backgroundColor: 'transparent', borderColor: theme.border },
        ]}>
        {selected ? (
          <ThemedText type="badge" themeColor="onTint">
            ✓
          </ThemedText>
        ) : null}
      </View>

      <ThemedText type="t6" numberOfLines={1} style={styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* 2열 카드 사이 — spacing.gap2col. */
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.gap2col },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 0,
    height: 150,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 12,
  },
  pressed: { opacity: 0.9 },
  image: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.medium,
  },
  check: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: 700 },
});
