import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import { CategoryImage } from './category-image';
import { TASTE_IMAGE, TASTE_LABEL, TASTES, type Taste } from './taste';

/**
 * 어떤 결혼식을 원하세요? — 홈 C-1 시안 1의 취향 고르기 · 온보딩 WP-APP-021.
 *
 * 가입 직후에는 현황판에 채울 것이 없다. 그 자리를 이 격자가 대신한다 — 사진
 * 여섯 장으로 취향을 먼저 받고, 그 다음부터 추천이 성립한다.
 *
 * **업로드 UI가 아니라 선택 카드다.** 사용자가 사진을 올리는 화면이었던 적이
 * 있는데, 그건 취향을 묻는 게 아니라 일을 시키는 것이었다.
 *
 * 라벨은 배지다 — 사진 위에 글자만 얹으면 밝은 사진(화이트 드레스·야외)에서
 * 읽히지 않았다. 반투명 검정 알약(`scrim`) 위에 흰 글자로 올린다.
 */

export type TastePickerProps = {
  chosen: readonly Taste[];
  onToggle: (taste: Taste) => void;
  /**
   * 부모가 준 높이를 3행이 나눠 갖는다 — 온보딩처럼 **스크롤 없이** 여섯 장이
   * 한 화면에 들어와야 하는 자리. 없으면 홈처럼 고정 높이로 흐른다.
   */
  fill?: boolean;
};

const COLUMNS = 2;

export function TastePicker({ chosen, onToggle, fill = false }: TastePickerProps) {
  if (!fill) {
    return (
      <ThemedView style={styles.grid}>
        {TASTES.map((taste) => (
          <Tile
            key={taste}
            label={TASTE_LABEL[taste]}
            uri={TASTE_IMAGE[taste]}
            selected={chosen.includes(taste)}
            onPress={() => onToggle(taste)}
          />
        ))}
      </ThemedView>
    );
  }

  const rows: Taste[][] = [];

  for (let index = 0; index < TASTES.length; index += COLUMNS) {
    rows.push(TASTES.slice(index, index + COLUMNS));
  }

  return (
    <View style={styles.fillGrid}>
      {rows.map((row) => (
        <View key={row.join('-')} style={styles.fillRow}>
          {row.map((taste) => (
            <Tile
              key={taste}
              label={TASTE_LABEL[taste]}
              uri={TASTE_IMAGE[taste]}
              selected={chosen.includes(taste)}
              onPress={() => onToggle(taste)}
              fill
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function Tile({
  label,
  uri,
  selected,
  onPress,
  fill = false,
}: {
  label: string;
  uri: string;
  selected: boolean;
  onPress: () => void;
  fill?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [fill ? styles.tileFill : styles.tile, pressed && styles.pressed]}>
      <CategoryImage uri={uri} style={styles.image} />

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

      <View style={[styles.badge, { backgroundColor: theme.scrim }]}>
        <ThemedText type="t7" numberOfLines={1} themeColor="onTint" style={styles.label}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* 2열 카드 사이 — spacing.gap2col. */
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Layout.gap2col },
  fillGrid: { flex: 1, gap: Layout.gap2col },
  fillRow: { flex: 1, flexDirection: 'row', gap: Layout.gap2col },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 0,
    height: 150,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: Spacing.two,
  },
  tileFill: {
    flex: 1,
    minWidth: 0,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: Spacing.two,
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
  /* 라벨 배지 — 반투명 검정 알약. 밝은 사진 위에서도 읽힌다. */
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one,
  },
  label: { fontWeight: 700 },
});
