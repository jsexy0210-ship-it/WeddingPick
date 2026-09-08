import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, Spacing, ThemedText, ThemedView, useTheme } from '@weddingpick/ui';

import { tasteImageSource } from '@/features/taste/images';

import { CategoryImage } from './category-image';
import { TASTE_SETS, type TasteCategory, type TasteOption } from './taste';

/**
 * 어떤 결혼식을 원하세요? — 홈 C-1 시안 1의 취향 고르기 · MY 취향 다시 고르기 ·
 * 온보딩 WP-APP-021. 핸드오프 v3.22 SPEC §13.6 «취향은 다음 미완료 업종 기준».
 *
 * 가입 직후에는 현황판에 채울 것이 없다. 그 자리를 이 격자가 대신한다 — **한
 * 업종의 여섯 장**(2×3)으로 취향을 먼저 받고, 그 다음부터 추천이 성립한다. 어느
 * 업종인지는 부르는 쪽이 정한다(`tasteCategoryFor`) — 이 컴포넌트는 세트를 그릴
 * 뿐 준비 현황을 모른다.
 *
 * **업로드 UI가 아니라 선택 카드다.** 사용자가 사진을 올리는 화면이었던 적이
 * 있는데, 그건 취향을 묻는 게 아니라 일을 시키는 것이었다.
 *
 * **사진은 `features/taste/images`의 표에서 꺼낸다** — 온보딩 5/5와 같은 사진이다.
 * 오늘은 스튜디오 3장뿐이고(IMAGES.md «보유 3장») 나머지 카드는 `CategoryImage`의
 * 업종 기본 면(조용한 단색) 위에 라벨 배지만 얹는다. 사진이 오면 그 표에 한 줄
 * 더하는 것으로 끝난다. 어느 업종을 그릴지(3장 이상 규칙)는 부르는 쪽이 정한다.
 *
 * 라벨은 배지다 — 사진 위에 글자만 얹으면 밝은 사진(화이트 드레스·야외)에서
 * 읽히지 않았다. SPEC §13.6: `rgba(0,0,0,.55)` 배경 + 흰 글자. 그라데이션은 깔지
 * 않는다.
 */

export type TastePickerProps = {
  /** 어느 업종의 세트를 그리는가. `TASTE_SETS[category]`의 여섯 장이다. */
  category: TasteCategory;
  /** 그 업종에서 고른 키. */
  chosen: readonly string[];
  onToggle: (key: string) => void;
  /**
   * 부모가 준 높이를 3행이 나눠 갖는다 — 온보딩처럼 **스크롤 없이** 여섯 장이
   * 한 화면에 들어와야 하는 자리. 없으면 홈처럼 고정 높이로 흐른다.
   */
  fill?: boolean;
};

const COLUMNS = 2;

/**
 * 취향 카드 라벨 배지 바탕. SPEC §13.6이 값을 못박았다(`rgba(0,0,0,.55)`) —
 * `theme.scrim`(#00000080 · 다크 .72)은 시트 뒷면용이라 이 자리에 맞지 않고,
 * spec/tokens.json에는 아직 이 배지 항목이 없다. 토큰이 생기면 여기만 바꾼다.
 */
const TASTE_BADGE_BACKGROUND = 'rgba(0,0,0,0.55)';

export function TastePicker({ category, chosen, onToggle, fill = false }: TastePickerProps) {
  const options = TASTE_SETS[category];

  if (!fill) {
    return (
      <ThemedView style={styles.grid}>
        {options.map((option) => (
          <Tile
            key={option.key}
            option={option}
            selected={chosen.includes(option.key)}
            onPress={() => onToggle(option.key)}
          />
        ))}
      </ThemedView>
    );
  }

  const rows: TasteOption[][] = [];

  for (let index = 0; index < options.length; index += COLUMNS) {
    rows.push(options.slice(index, index + COLUMNS));
  }

  return (
    <View style={styles.fillGrid}>
      {rows.map((row) => (
        <View key={row.map((option) => option.key).join('-')} style={styles.fillRow}>
          {row.map((option) => (
            <Tile
              key={option.key}
              option={option}
              selected={chosen.includes(option.key)}
              onPress={() => onToggle(option.key)}
              fill
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function Tile({
  option,
  selected,
  onPress,
  fill = false,
}: {
  option: TasteOption;
  selected: boolean;
  onPress: () => void;
  fill?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={option.label}
      onPress={onPress}
      style={({ pressed }) => [fill ? styles.tileFill : styles.tile, pressed && styles.pressed]}>
      {/* 사진 자리. 표에 없는 키는 업종 기본 면으로 채워진다 — 빈 상자나 «사진 준비 중»은 아니다. */}
      <CategoryImage uri={tasteImageSource(option.key)?.uri ?? null} style={styles.image} />

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

      <View style={[styles.badge, { backgroundColor: TASTE_BADGE_BACKGROUND }]}>
        <ThemedText type="t7" numberOfLines={1} themeColor="onTint" style={styles.label}>
          {option.label}
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
    /* spec/tokens.json image.tasteCard — 2열 카드 150. */
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
