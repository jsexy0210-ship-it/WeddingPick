import { WEDDING_STYLES, WEDDING_STYLE_LABEL, toggleStyle, type WeddingStyle } from '@weddingpick/domain';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, ThemedText, useTheme } from '@weddingpick/ui';

import { chunk } from './calendar';
import { CheckCircle } from './check-circle';

/**
 * 스타일(5/5 · WP-APP-020 ⑤). SPEC §13.6 «스타일 4종 · 최대 2개» — 2×2 이미지 카드
 * 200 · 도시적인 · 자연스러운 · 로맨틱한 · 화려한. 카드 166×200 · 이미지 5:6 · 사람
 * 없음(넷 다 예식 공간 컷 — 피사체를 섞으면 스타일이 아니라 업종을 고른다).
 *
 * 격자 사이 11(토큰 gap2col · 시안 tasteWrap). **라벨은 배지다**(SPEC §13.6 «취향 카드
 * 라벨은 배지입니다» · 시안 tasteLabel) — 높이 28 · 좌우 10 · radius 6 · rgba(0,0,0,.55)
 * 바탕 · 흰 14/700. 밝은 사진 위에 맨 글자를 올리지 않고, 그라데이션도 깔지 않는다.
 * 고르면 코랄 2px 테두리 + 옅은 코랄 덮개 + 체크 24, 안 고르면 1px 선과 반투명 흰 원
 * (바탕 .28 · 테두리 .85). 안쪽 여백 10.
 *
 * **선택 정책은 도메인 `toggleStyle`이 정한다** — 최소 1 · 최대 2 · 재클릭 해제 ·
 * 3번째는 추가하지 않고 `onLimited`(토스트 «2개까지 고를 수 있어요»). 진입 시 기존
 * 선택값을 초기화하지 않고 `chosen`으로 복원해서 그린다.
 *
 * 온보딩 5/5와 MY «스타일 다시 고르기»(WP-MY-004)가 같은 격자를 쓴다.
 */
export function StyleGrid({
  chosen,
  onChange,
  onLimited,
}: {
  chosen: readonly WeddingStyle[];
  onChange: (next: readonly WeddingStyle[]) => void;
  /** 3번째를 고르려 했다 — 부르는 쪽이 토스트를 띄운다. */
  onLimited?: () => void;
}) {
  function handlePress(style: WeddingStyle) {
    const { next, limited } = toggleStyle(chosen, style);

    if (limited) {
      onLimited?.();
    } else {
      onChange(next);
    }
  }

  return (
    <View style={styles.grid}>
      {chunk(WEDDING_STYLES, COLUMNS).map((row) => (
        <View key={row.join('-')} style={styles.row}>
          {row.map((style) => (
            <Tile key={style} style={style} selected={chosen.includes(style)} onPress={() => handlePress(style)} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Tile({ style, selected, onPress }: { style: WeddingStyle; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const label = WEDDING_STYLE_LABEL[style];

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
      {/* 가운데를 기준으로 자른다 — 5:6 원본이 카드와 비율이 같아 잘리는 곳이 거의 없다. */}
      <Image source={STYLE_IMAGE[style]} style={styles.photo} contentFit="cover" transition={0} />

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
          /* 시안 tasteCheck(off) — 흰 바탕 .28 + 흰 테두리 1.5 · .85. 두 불투명도가 달라 겹으로 둔다. */
          <View style={styles.hollow}>
            <View style={[styles.hollowFill, { backgroundColor: theme.onTint }]} />
            <View style={[styles.hollowRing, { borderColor: theme.onTint }]} />
          </View>
        )}
      </View>

      {/* 시안 tasteLabel — 배지 28 · 좌우 10 · radius 6 · 검정 .55 · 흰 14/700. blur 6은 RN에 없다. */}
      <View style={styles.badge}>
        <ThemedText type="t7" numberOfLines={1} themeColor="onTint" style={styles.label}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/**
 * 스타일 이미지 4장 — `assets/images/style/README.md`. 지금은 임시 그라데이션이고
 * 권리 확보한 사진이 같은 파일명으로 덮어쓴다. 화면은 이 표에서만 사진을 꺼낸다.
 */
const STYLE_IMAGE: Record<WeddingStyle, number> = {
  URBAN: require('../../../assets/images/style/urban.png'),
  NATURAL: require('../../../assets/images/style/natural.png'),
  ROMANTIC: require('../../../assets/images/style/romantic.png'),
  GLAMOROUS: require('../../../assets/images/style/glamorous.png'),
};

const COLUMNS = 2;
/* WP-APP-020 ⑤ 고정값 — 카드 200 · 체크 24 · 배지 높이 28. 안쪽 여백 10은 토큰 cardGap. */
const TILE_HEIGHT = 200;
const CHECK = 24;
const BADGE_HEIGHT = 28;
/** 배지 바탕 — 시안 rgba(0,0,0,.55). 검정에 그 불투명도를 hex로 붙인다(0x8C = 140/255). */
const SHADE = '#000000';
const SHADE_OPACITY = 0.55;
const BADGE_BACKGROUND = `${SHADE}${Math.round(SHADE_OPACITY * 255).toString(16).padStart(2, '0')}`;
/** 시안 선택 덮개 rgba(255,111,97,.16) — 코랄 위에 이 불투명도다. */
const WASH_OPACITY = 0.16;
/** 시안 미선택 원 — 흰 바탕 .28 · 흰 테두리 .85. */
const HOLLOW_FILL_OPACITY = 0.28;
const HOLLOW_RING_OPACITY = 0.85;
/** 카드를 꽉 채우는 겹. `StyleSheet.absoluteFill`은 스프레드할 수 없어 값으로 둔다. */
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  /* 좌우 24 · 아래 24 · 격자 사이 11(시안 tasteWrap gap · 토큰 gap2col). */
  grid: {
    paddingHorizontal: Layout.gutter,
    paddingBottom: Layout.gutter,
    gap: Layout.gap2col,
  },
  row: { flexDirection: 'row', gap: Layout.gap2col },
  /* minmax(0,1fr). 시안 tasteOn — 안쪽 10 · 라벨은 왼쪽 아래. */
  tile: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    height: TILE_HEIGHT,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: Layout.cardGap,
  },
  pressed: { opacity: 0.9 },
  photo: { ...FILL },
  wash: { ...FILL, opacity: WASH_OPACITY },
  frame: { ...FILL, borderRadius: Radius.medium },
  check: { position: 'absolute', top: Layout.cardGap, right: Layout.cardGap },
  hollow: { width: CHECK, height: CHECK },
  hollowFill: { ...FILL, borderRadius: Radius.pill, opacity: HOLLOW_FILL_OPACITY },
  hollowRing: { ...FILL, borderRadius: Radius.pill, borderWidth: 1.5, opacity: HOLLOW_RING_OPACITY },
  badge: {
    /* 배지는 세로를 고정하지 않는다 — 28은 최소 높이다(pick-status-badge `STATUS_BADGE_STYLE`). */
    minHeight: BADGE_HEIGHT,
    paddingHorizontal: Layout.cardGap,
    borderRadius: Radius.small,
    backgroundColor: BADGE_BACKGROUND,
    justifyContent: 'center',
    maxWidth: '100%',
  },
  label: { fontWeight: 700 },
});
