import type { CategoryRecommendation, VendorSummary } from '@weddingpick/api-contract';
import {
  CATEGORY_ACTION_LABEL,
  NOT_ENOUGH_DATA,
  nextStepsCountLine,
  nextStepsSummary,
  type VendorCategory,
} from '@weddingpick/domain';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  Border,
  Layout,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

import { VendorCard } from './vendor-card';

/**
 * Pick 추천 — 홈의 핵심 영역(2026-09-15 대표 사양 §4~§9).
 *
 * 옛 홈의 «준비현황 2×2»와 «웨딩픽 추천»을 하나로 합친 자리다. 둘로 나뉘어 있을 때는
 * 상태를 보는 곳과 업체를 보는 곳이 달라서, 무엇을 정해야 하는지 알고도 한 번 더 눌러야
 * 업체가 나왔다.
 *
 *   웨딩홀                         비교 ⌃     ← 카테고리명과 액션이 «같은 줄»(§5)
 *   ← 추천 업체 가로 슬라이드 최대 3 →
 *                            [한눈에 비교]
 *   스튜디오                       추천 ⌄
 *   메이크업                       추천 ⌄
 *
 * **한 번에 하나만 펼쳐진다**(§5 single-open). **아코디언을 눌러도 화면이 이동하지
 * 않는다** — 펼침 · 접힘뿐이다. 이동은 카드와 「한눈에 비교」가 맡는다.
 *
 * **카테고리 헤더에 개수를 적지 않는다**(§4) — 「추천 3곳」 · 「후보 3곳」 전부 금지다.
 *
 * `[비교]`가 붙은 업종은 담아둔 곳이 둘 이상이라는 뜻이고, 그때 펼침 내용도 **그 사람이
 * Pick한 곳**이다(서버 `vendorsFor`). 자기가 담은 곳이 자기 업종에 없으면 §8의 흐름이
 * 거기서 끊긴다.
 */
export type PickRecommendProps = {
  groups: readonly CategoryRecommendation[];
  /** 지금 펼쳐진 업종. 아무것도 안 펼쳤으면 null. */
  open: VendorCategory | null;
  onToggle: (category: VendorCategory) => void;
  /** 홈에 안 보이는 것까지 포함한, 아직 정하지 않은 업종 전부. */
  remaining: number;
  remainingCategories: readonly VendorCategory[];
  isPicked: (vendorId: string) => boolean;
  onPressVendor: (vendorId: string) => void;
  onPressPick: (vendor: VendorSummary) => void;
  onPressCompare: (category: VendorCategory) => void;
  /** 「다음 준비도 이어서 볼까요?」의 더보기 — 웨딩노트가 아니라 웨딩픽 추천 전체다(§9). */
  onPressMore: () => void;
  /**
   * 「Pick 추천」 제목 줄을 그리는가. 기본은 그린다(홈).
   *
   * 「웨딩픽 추천」 전체 페이지는 화면 제목이 이미 그 말을 하고 있어 끈다 — 제목이 두 번
   * 겹치면 두 번째가 새 섹션의 시작으로 읽힌다.
   */
  heading?: boolean;
};

export function PickRecommend({
  groups,
  open,
  onToggle,
  remaining,
  remainingCategories,
  isPicked,
  onPressVendor,
  onPressPick,
  onPressCompare,
  onPressMore,
  heading = true,
}: PickRecommendProps) {
  const theme = useTheme();
  const summary = nextStepsSummary(remainingCategories);

  return (
    <View style={styles.section}>
      {heading ? (
        <View style={styles.head}>
          <ThemedText type="f14" style={styles.semibold}>
            Pick 추천
          </ThemedText>
          <ThemedText type="f12" themeColor="textAssistive" style={styles.sub}>
            지금 준비할 순서에 맞춰 골라봤어요
          </ThemedText>
        </View>
      ) : null}

      {groups.length === 0 ? (
        /* 정할 것이 남지 않았다. 빈 자리를 두지 않고 그 사실을 한 줄로 적는다. */
        <View style={styles.gutter}>
          <ThemedView type="backgroundElement" style={[styles.empty, { borderColor: theme.border }]}>
            <ThemedText type="f12" themeColor="textAssistive">
              정할 준비를 다 끝냈어요
            </ThemedText>
          </ThemedView>
        </View>
      ) : (
        groups.map((group) => (
          <CategoryRow
            key={group.category}
            group={group}
            expanded={group.category === open}
            onToggle={() => onToggle(group.category)}
            isPicked={isPicked}
            onPressVendor={onPressVendor}
            onPressPick={onPressPick}
            onPressCompare={() => onPressCompare(group.category)}
          />
        ))
      )}

      {/* 다음 준비 — 끝낸 것이 아니라 «앞으로 남은» 준비를 적는다(§9). */}
      {summary === null ? null : (
        <View style={[styles.next, styles.gutter]}>
          <View style={styles.nextText}>
            <ThemedText type="f14" style={styles.semibold}>
              다음 준비도 이어서 볼까요?
            </ThemedText>
            <ThemedText type="f12" numeric themeColor="textAssistive" style={styles.sub}>
              {nextStepsCountLine(remaining)}
            </ThemedText>
            <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1} style={styles.sub}>
              {summary}
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="웨딩픽 추천 전체 보기"
            onPress={onPressMore}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="f12" style={styles.semibold}>
              더보기
            </ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function CategoryRow({
  group,
  expanded,
  onToggle,
  isPicked,
  onPressVendor,
  onPressPick,
  onPressCompare,
}: {
  group: CategoryRecommendation;
  expanded: boolean;
  onToggle: () => void;
  isPicked: (vendorId: string) => boolean;
  onPressVendor: (vendorId: string) => void;
  onPressPick: (vendor: VendorSummary) => void;
  onPressCompare: () => void;
}) {
  const theme = useTheme();
  const action = CATEGORY_ACTION_LABEL[group.state];

  return (
    <View style={styles.row}>
      {/*
       * 카테고리명과 액션이 한 줄이다(§5). 누르면 펼침 · 접힘만 — 화면을 옮기지 않는다.
       * chevron은 SEED에 위 · 아래 방향이 없어 오른쪽 것을 돌려 쓴다(부품을 새로 만들지 않는다).
       */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${group.categoryLabel} ${action ?? ''}`.trim()}
        onPress={onToggle}
        style={({ pressed }) => [styles.rowHead, styles.gutter, pressed && styles.pressed]}>
        <ThemedText type="f14" style={styles.semibold}>
          {group.categoryLabel}
        </ThemedText>
        <View style={styles.action}>
          {action === null ? null : (
            <ThemedText type="f12" themeColor="textAssistive" style={styles.semibold}>
              {action}
            </ThemedText>
          )}
          <View style={expanded ? styles.chevronUp : styles.chevronDown}>
            <SeedIcon name="chevronRightRegular" size={Layout.iconField} color={theme.textAssistive} />
          </View>
        </View>
      </Pressable>

      {!expanded ? null : group.vendors.length === 0 ? (
        <View style={styles.gutter}>
          <ThemedView type="backgroundElement" style={[styles.empty, { borderColor: theme.border }]}>
            <ThemedText type="f12" themeColor="textAssistive">
              {NOT_ENOUGH_DATA}
            </ThemedText>
          </ThemedView>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scroll}
            contentContainerStyle={styles.cards}>
            {group.vendors.map((vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                picked={isPicked(vendor.id)}
                onPress={() => onPressVendor(vendor.id)}
                onPressPick={() => onPressPick(vendor)}
              />
            ))}
            {/* 마지막 카드 뒤 여백 — 오른쪽 끝에 붙어 끊기지 않게. */}
            <View style={styles.tail} />
          </ScrollView>

          {/* 견줄 곳이 둘 이상일 때만(§7 COMPARING). 업종 화면이 담은 곳을 다 보여준다. */}
          {group.state !== 'COMPARING' ? null : (
            <View style={styles.gutter}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${group.categoryLabel} 한눈에 비교`}
                onPress={onPressCompare}
                style={({ pressed }) => [
                  styles.compare,
                  { borderColor: theme.tint },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="f12" themeColor="tint" style={styles.semibold}>
                  한눈에 비교
                </ThemedText>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing.four },
  gutter: { paddingHorizontal: Layout.pageX },
  head: { paddingHorizontal: Layout.pageX, marginBottom: Layout.sectionHeadGapCompact },
  semibold: { fontWeight: 600 },
  sub: { marginTop: Spacing.half },

  row: { marginBottom: Layout.sectionHeadGapCompact },
  /* 카테고리명 ↔ 액션. 같은 레벨 한 줄이다(§5). */
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.rowMinHeightCompact,
    gap: Spacing.two,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  /* SEED에 위·아래 chevron이 없어 오른쪽 것을 돌린다. */
  chevronDown: { transform: [{ rotate: '90deg' }] },
  chevronUp: { transform: [{ rotate: '-90deg' }] },

  /* 세로 ScrollView 안의 가로 ScrollView — 남은 높이를 먹지 않게 잠근다. */
  scroll: { flexGrow: 0, flexShrink: 0 },
  cards: {
    flexDirection: 'row',
    gap: Layout.inlineGap,
    paddingLeft: Layout.pageX,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  tail: { width: Spacing.three },

  compare: {
    alignSelf: 'flex-end',
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Layout.fieldPaddingX,
    borderRadius: Radius.pill,
    borderWidth: Border.hairline,
  },

  next: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  nextText: { flex: 1, minWidth: 0 },

  empty: {
    borderRadius: Radius.cardLarge,
    borderWidth: Border.hairline,
    padding: Layout.inlineGap,
  },
  pressed: { opacity: 0.8 },
});
