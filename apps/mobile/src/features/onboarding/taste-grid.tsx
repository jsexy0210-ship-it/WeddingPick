import { TASTE_SETS, type TasteCategory } from '@weddingpick/domain';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryIcon, Layout, Radius, Spacing, ThemedText, useTheme, type CategoryIconKind } from '@weddingpick/ui';

import { tasteImageSource } from '@/features/taste/images';

import { chunk } from './calendar';
import { CheckCircle } from './check-circle';

/**
 * 취향(5/5 · WP-APP-021). SPEC §13.6 «컨트롤 규격 (확정) · 취향 카드» — 물을 업종
 * 하나의 세트 6장을 2×3 격자로. height 132 · 2열 · gap 8 · radius 10. 고르면 코랄
 * 2px 테두리 + 옅은 코랄 덮개 + 체크 24, 안 고르면 1px 선과 반투명 흰 원. 라벨은
 * 배지다 — 반투명 검정 위 흰 글자 14/700, 높이 26 · 좌우 9 · radius 6. 밝은 사진
 * 위에 맨 글자를 올리지 않고 그라데이션도 깔지 않는다.
 *
 * 6 × 132 + 8 × 2 = 412 — 5/5는 화면 스크롤 없이 844에 들어간다.
 *
 * 사진은 `features/taste/images`의 표에서 꺼낸다. 이 격자가 열렸다는 것은 그 업종이
 * 3장 이상이라는 뜻이고(`tasteCategoryFor`), 그 안에서 사진이 없는 카드(스튜디오
 * «야외 자연광» 등)만 업종 아이콘을 얹은 옅은 면으로 자리를 잡는다 — 빈 상자나
 * «사진 준비 중»을 내놓지 않는다(홈 C-1 규칙).
 */
export function TasteGrid({
  category,
  keys,
  onToggle,
}: {
  category: TasteCategory;
  keys: readonly string[];
  onToggle: (key: string) => void;
}) {
  const options = TASTE_SETS[category];

  return (
    <View style={styles.grid}>
      {chunk(options, COLUMNS).map((row, rowIndex) => (
        <View key={row.map((option) => option.key).join('-')} style={styles.row}>
          {row.map((option, column) => (
            <Tile
              key={option.key}
              label={option.label}
              image={tasteImageSource(option.key)?.uri ?? null}
              icon={ICON_FOR[category]}
              /* 같은 업종의 여섯 장이 똑같이 보이지 않게 면의 톤을 바둑판으로 번갈아 준다. */
              tone={(rowIndex + column) % 2 === 0 ? 'backgroundSelected' : 'backgroundElement'}
              selected={keys.includes(option.key)}
              onPress={() => onToggle(option.key)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function Tile({
  label,
  image,
  icon,
  tone,
  selected,
  onPress,
}: {
  label: string;
  image: string | null;
  icon: CategoryIconKind;
  tone: 'backgroundSelected' | 'backgroundElement';
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  /* 사진을 못 받으면(오프라인 · 차단) 없는 것과 같이 그린다 — 빈 상자를 두지 않는다. */
  const [failed, setFailed] = useState(false);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: theme[tone] }, pressed && styles.pressed]}>
      {image && !failed ? (
        /* 가운데를 기준으로 자른다(IMAGES.md «crop 중앙 cover»). */
        <Image
          source={{ uri: image }}
          style={styles.photo}
          contentFit="cover"
          transition={0}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.placeholder}>
          <CategoryIcon kind={icon} size={ICON_SIZE} color={theme.tint} />
        </View>
      )}

      {/* 고른 카드의 옅은 코랄 덮개 — 시안 rgba(255,111,97,.16). */}
      {selected ? <View style={[styles.wash, { backgroundColor: theme.tint }]} /> : null}

      <View
        style={[
          styles.frame,
          selected ? { borderWidth: 2, borderColor: theme.tint } : { borderWidth: 1, borderColor: theme.line },
        ]}
      />

      <View style={styles.check}>
        {selected ? (
          <CheckCircle size={CHECK} checked />
        ) : (
          <View style={[styles.hollow, { borderColor: theme.onTint }]} />
        )}
      </View>

      <View style={[styles.badge, { backgroundColor: theme.scrim }]}>
        <ThemedText type="t7" numberOfLines={1} themeColor="onTint" style={styles.badgeLabel}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** 취향 업종 → 업종 아이콘. 예물만 이름이 다르다(ring). */
const ICON_FOR: Record<TasteCategory, CategoryIconKind> = {
  hall: 'hall',
  studio: 'studio',
  dress: 'dress',
  makeup: 'makeup',
  snap: 'snap',
  goods: 'ring',
  dowry: 'dowry',
  honeymoon: 'honeymoon',
  invitation: 'invitation',
};

const COLUMNS = 2;
/* 시안 고정값 — 카드 132 · 체크 24 · 배지 26 · 배지 좌우 9 · 안쪽 10. */
const TILE_HEIGHT = 132;
const CHECK = 24;
const BADGE_HEIGHT = 26;
const BADGE_PADDING_X = 9;
const INSET = 10;
const ICON_SIZE = 40;
/** 시안 tasteOn 덮개 rgba(255,111,97,.16) — 코랄 위에 이 불투명도다. */
const WASH_OPACITY = 0.16;
/** 시안 tasteCheck 미선택 원 — 흰 테두리 .85. */
const HOLLOW_OPACITY = 0.85;
/** 카드를 꽉 채우는 겹. `StyleSheet.absoluteFill`은 스프레드할 수 없어 값으로 둔다. */
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  /* 시안 tasteWrap — 좌우 24 · 아래 12 · 사이 8. */
  grid: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.rowPaddingY,
    gap: Spacing.two,
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  /* minmax(0,1fr). */
  tile: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    height: TILE_HEIGHT,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: INSET,
  },
  pressed: { opacity: 0.9 },
  photo: { ...FILL },
  placeholder: { ...FILL, alignItems: 'center', justifyContent: 'center', opacity: 0.5 },
  wash: { ...FILL, opacity: WASH_OPACITY },
  frame: { ...FILL, borderRadius: Radius.medium },
  check: { position: 'absolute', top: INSET, right: INSET },
  hollow: {
    width: CHECK,
    height: CHECK,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    opacity: HOLLOW_OPACITY,
  },
  badge: {
    height: BADGE_HEIGHT,
    paddingHorizontal: BADGE_PADDING_X,
    borderRadius: Radius.small,
    justifyContent: 'center',
  },
  badgeLabel: { fontWeight: 700 },
});
