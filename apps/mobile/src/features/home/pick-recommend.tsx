import type { CategoryRecommendation, VendorSummary } from '@weddingpick/api-contract';
import {
  NOT_ENOUGH_DATA,
  VENDOR_CATEGORY_LABEL,
  formatCount,
  nextStepsCountLine,
  nextStepsSummary,
  priceLine,
  type VendorCategory,
} from '@weddingpick/domain';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ActionButton,
  Border,
  Layout,
  Radius,
  SeedIcon,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';

import strings from '../../../../../spec/strings.ko.json';
import { CategoryImage } from './category-image';
import { VendorCard } from './vendor-card';

const S = strings.home;

type SharedRecommendationProps = {
  groups: readonly CategoryRecommendation[];
  isPicked: (vendorId: string) => boolean;
  onPressVendor: (vendorId: string) => void;
  onPressPick: (vendor: VendorSummary) => void;
  onPressCompare: (category: VendorCategory) => void;
  onPressMore: () => void;
};

type HomeRecommendationProps = Omit<SharedRecommendationProps, 'onPressCompare'> & {
  onPressCompare: (vendorIds: readonly string[]) => void;
};

/**
 * 홈 전용 추천.
 * 홈 정본은 아코디언이 아니라 첫 미결정 업종의 업체 카드 최대 3장과 비교 CTA다.
 */
export function HomeRecommendations({
  groups,
  isPicked,
  onPressVendor,
  onPressPick,
  onPressCompare,
  onPressMore,
}: HomeRecommendationProps) {
  const theme = useTheme();
  const group = groups[0] ?? null;

  return (
    <View style={styles.homeSection}>
      <View style={styles.homeHeading}>
        <View style={styles.homeHeadingCopy}>
          <ThemedText type="f20" style={styles.bold}>{S['recommend.title']}</ThemedText>
          {group === null ? null : (
            <ThemedText type="f13" themeColor="textAssistive" style={styles.homeSub}>
              {`${group.categoryLabel} 후보를 좁힐 차례예요`}
            </ThemedText>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="웨딩픽 추천 전체 보기"
          onPress={onPressMore}
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
          <ThemedText type="f13" themeColor="textAssistive">{S.more}</ThemedText>
          <SeedIcon name="chevronRightRegular" size={Layout.iconField} color={theme.textAssistive} />
        </Pressable>
      </View>

      {group === null ? (
        <ThemedView type="backgroundElement" style={[styles.homeEmpty, { borderColor: theme.border }]}>
          <ThemedText type="f13" themeColor="textAssistive">{S['recommend.empty']}</ThemedText>
        </ThemedView>
      ) : (
        <>
          {group.vendors.length === 0 ? (
            <ThemedView type="backgroundElement" style={[styles.homeEmpty, { borderColor: theme.border }]}>
              <ThemedText type="f13" themeColor="textAssistive">{NOT_ENOUGH_DATA}</ThemedText>
            </ThemedView>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.scroll}
              contentContainerStyle={styles.homeCards}>
              {group.vendors.slice(0, 3).map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  picked={isPicked(vendor.id)}
                  onPress={() => onPressVendor(vendor.id)}
                  onPressPick={() => onPressPick(vendor)}
                  showTags={false}
                />
              ))}
              <View style={styles.tail} />
            </ScrollView>
          )}

          {group.vendors.length >= 2 ? (
            <View style={styles.compareCta}>
              <ActionButton
                variant="primary"
                size="xlarge"
                label={`${Math.min(3, group.vendors.length)}곳 비교하기`}
                onPress={() => onPressCompare(group.vendors.slice(0, 3).map((vendor) => vendor.id))}
              />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

export type PickRecommendProps = SharedRecommendationProps & {
  open: VendorCategory | null;
  interactionDisabled?: boolean;
  onToggle: (category: VendorCategory) => void;
  remaining: number;
  remainingCategories: readonly VendorCategory[];
  onPressSearchMore?: (category: VendorCategory) => void;
  heading?: boolean;
};

/**
 * 「웨딩픽 추천」 전체 화면 전용 아코디언.
 * 첫 업종만 열리고 한 번에 하나만 펼쳐진다. 접힌 줄에도 실제 제보량을 남긴다.
 */
export function PickRecommend({
  groups,
  open,
  onToggle,
  remaining,
  remainingCategories,
  isPicked,
  onPressPick,
  onPressCompare,
  onPressSearchMore,
  onPressMore,
  interactionDisabled = false,
  heading = true,
}: PickRecommendProps) {
  const theme = useTheme();
  const summary = nextStepsSummary(remainingCategories);

  return (
    <View style={styles.section}>
      {heading ? (
        <View style={styles.gutter}>
          <ThemedText type="f20" style={styles.bold}>{S['recommend.title']}</ThemedText>
        </View>
      ) : null}

      {groups.length === 0 ? (
        <View style={styles.gutter}>
          <ThemedView type="backgroundElement" style={[styles.empty, { borderColor: theme.border }]}>
            <ThemedText type="f13" themeColor="textAssistive">
              {remaining === 0 ? S['recommend.done'] : S['recommend.empty']}
            </ThemedText>
          </ThemedView>
        </View>
      ) : groups.map((group) => (
        <CategoryRow
          key={group.category}
          group={group}
          expanded={group.category === open}
          onToggle={() => onToggle(group.category)}
          isPicked={isPicked}
          onPressPick={onPressPick}
          onPressCompare={() => onPressCompare(group.category)}
          onPressSearchMore={
            onPressSearchMore === undefined ? undefined : () => onPressSearchMore(group.category)
          }
          interactionDisabled={interactionDisabled}
        />
      ))}

      {summary === null ? null : (
        <View style={[styles.next, styles.gutter]}>
          <View style={styles.nextText}>
            <ThemedText type="f14" style={styles.bold}>다음 준비도 이어서 볼까요?</ThemedText>
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
            <ThemedText type="f12" style={styles.bold}>더보기</ThemedText>
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
  onPressPick,
  onPressCompare,
  onPressSearchMore,
  interactionDisabled,
}: {
  group: CategoryRecommendation;
  expanded: boolean;
  onToggle: () => void;
  isPicked: (vendorId: string) => boolean;
  onPressPick: (vendor: VendorSummary) => void;
  onPressCompare: () => void;
  onPressSearchMore?: () => void;
  interactionDisabled: boolean;
}) {
  const theme = useTheme();
  const [reasonVendorId, setReasonVendorId] = useState<string | null>(null);

  const handleToggle = () => {
    setReasonVendorId(null);
    onToggle();
  };

  const reasonIndex = reasonVendorId === null
    ? -1
    : group.vendors.findIndex((vendor) => vendor.id === reasonVendorId);
  const reasonVendor = expanded && reasonIndex >= 0 ? group.vendors[reasonIndex]! : null;
  const scarce = group.vendors.length > 0
    && group.vendors.every((vendor) => vendor.comparableQuoteCount < 3);

  return (
    <View style={[styles.category, { borderBottomColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${group.categoryLabel} ${expanded ? '접기' : '펼치기'}`}
        onPress={handleToggle}
        style={({ pressed }) => [styles.rowHead, styles.gutter, pressed && styles.pressed]}>
        <ThemedText type="f18" style={styles.bold}>{group.categoryLabel}</ThemedText>
        <View style={styles.foldMeta}>
          <ThemedText type="f12" numeric themeColor="textAssistive">
            {groupReportLine(group)}
          </ThemedText>
          <View style={expanded ? styles.chevronUp : styles.chevronDown}>
            <SeedIcon name="chevronRightRegular" size={Layout.iconField} color={theme.textAssistive} />
          </View>
        </View>
      </Pressable>

      {!expanded ? null : (
        <View
          pointerEvents={interactionDisabled ? 'none' : 'auto'}
          style={[styles.expanded, interactionDisabled ? styles.interactionDisabled : null]}>
          {reasonVendor !== null ? (
            <RecommendationReasonCard
              vendor={reasonVendor}
              rank={reasonIndex + 1}
              picked={isPicked(reasonVendor.id)}
              onPressCompare={onPressCompare}
              onPressPick={() => onPressPick(reasonVendor)}
            />
          ) : group.vendors.length === 0 ? (
            <View style={styles.gutter}>
              <ThemedView type="backgroundElement" style={[styles.empty, { borderColor: theme.border }]}>
                <ThemedText type="f13" themeColor="textAssistive">{NOT_ENOUGH_DATA}</ThemedText>
              </ThemedView>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.scroll}
              contentContainerStyle={styles.cards}>
              {group.vendors.slice(0, 3).map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  picked={isPicked(vendor.id)}
                  accessibilityLabel={`${vendor.name} 추천 이유 보기`}
                  showReason={false}
                  variant="recommendations"
                  onPress={() => setReasonVendorId(vendor.id)}
                  onPressPick={() => onPressPick(vendor)}
                />
              ))}
              <View style={styles.tail} />
            </ScrollView>
          )}

          {reasonVendor === null && scarce ? (
            <ThemedText type="f12" themeColor="textAssistive" style={styles.scarceNote}>
              제보가 3건 넘으면 금액대를 보여드려요
            </ThemedText>
          ) : null}

          {reasonVendor === null && onPressSearchMore ? (
            <View style={[styles.actions, styles.gutter]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${group.categoryLabel} 더 찾아보기`}
                onPress={onPressSearchMore}
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="f13" style={styles.bold}>{S['recommend.more']}</ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function RecommendationReasonCard({
  vendor,
  rank,
  picked,
  onPressCompare,
  onPressPick,
}: {
  vendor: VendorSummary;
  rank: number;
  picked: boolean;
  onPressCompare: () => void;
  onPressPick: () => void;
}) {
  const theme = useTheme();
  const price = priceLine(vendor.paidPrice, null);

  return (
    <View style={[
      styles.reasonCard,
      { backgroundColor: theme.background, borderColor: theme.tint },
    ]}>
      <View style={styles.reasonImage}>
        <CategoryImage uri={vendor.imageUrl} label={vendor.name} category={vendor.category} />
        <View style={[styles.reasonRank, { backgroundColor: theme.tint }]}>
          <ThemedText type="f12" themeColor="onTint" style={styles.bold}>추천 {rank}위</ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={picked ? `${vendor.name} Pick 해제` : `${vendor.name} Pick`}
          accessibilityState={{ selected: picked }}
          onPress={onPressPick}
          style={({ pressed }) => [
            styles.reasonHeart,
            { backgroundColor: theme.tint },
            pressed && styles.pressed,
          ]}>
          <SeedIcon name={picked ? 'heartFill' : 'heartRegular'} size={Layout.iconRow} color={theme.onTint} />
        </Pressable>
      </View>

      <View style={styles.reasonBody}>
        <ThemedText type="f10" themeColor="textAssistive">
          {VENDOR_CATEGORY_LABEL[vendor.category]}
        </ThemedText>
        <ThemedText type="f20" style={styles.bold} numberOfLines={1}>{vendor.name}</ThemedText>
        <View style={styles.reasonPlace}>
          <SeedIcon name="locationRegular" size={Layout.iconMicro} color={theme.textAssistive} />
          <ThemedText type="f12" themeColor="textAssistive" numberOfLines={1}>{vendor.region}</ThemedText>
        </View>

        <View style={styles.reasonPriceRow}>
          <ThemedText type="f20" numeric style={styles.bold}>{price.text}</ThemedText>
          <ThemedText type="f12" numeric themeColor="textAssistive">
            실 제보 {formatCount(vendor.comparableQuoteCount)}건
          </ThemedText>
        </View>

        <View style={styles.reasonList}>
          {vendor.reasons?.map((reason) => (
            <View key={reason} style={styles.reasonRow}>
              <SeedIcon name="checkFlowerFill" size={Layout.iconField} color={theme.tint} />
              <ThemedText type="f13" style={styles.reasonText}>{reason}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.reasonActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${vendor.name} 비교에 담기`}
            onPress={onPressCompare}
            style={({ pressed }) => [
              styles.reasonButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="f14" style={styles.bold}>비교에 담기</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={picked ? `${vendor.name} Pick 해제` : `${vendor.name} Pick`}
            onPress={onPressPick}
            style={({ pressed }) => [
              styles.reasonButton,
              { backgroundColor: theme.tint },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="f14" themeColor="onTint" style={styles.bold}>
              {picked ? 'Pick했어요' : 'Pick하기'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function groupReportLine(group: CategoryRecommendation): string {
  const count = group.vendors.reduce((sum, vendor) => sum + vendor.comparableQuoteCount, 0);
  return count > 0 ? `실 제보 ${formatCount(count)}건` : '정보 수집 중';
}

const styles = StyleSheet.create({
  homeSection: { marginBottom: Layout.sectionGap },
  homeHeading: {
    paddingHorizontal: Layout.gutter,
    marginBottom: Layout.sectionHeadGap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
  },
  homeHeadingCopy: { flex: 1, minWidth: 0 },
  homeSub: { marginTop: Spacing.half },
  homeCards: {
    flexDirection: 'row',
    gap: Layout.inlineGap,
    paddingLeft: Layout.gutter,
    paddingBottom: Spacing.one,
  },
  homeEmpty: {
    marginHorizontal: Layout.gutter,
    borderRadius: Radius.medium,
    borderWidth: Border.hairline,
    padding: Layout.cardPadding,
  },
  compareCta: { paddingHorizontal: Layout.gutter, marginTop: Spacing.three },
  more: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },

  section: { marginBottom: Layout.sectionGap },
  gutter: { paddingHorizontal: Layout.gutter },
  category: { borderBottomWidth: Border.hairline },
  rowHead: {
    minHeight: Layout.rowMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Layout.inlineGap,
  },
  foldMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  chevronDown: { transform: [{ rotate: '90deg' }] },
  chevronUp: { transform: [{ rotate: '-90deg' }] },
  expanded: { paddingBottom: Layout.sectionHeadGap },
  interactionDisabled: { opacity: 0.55 },

  scroll: { flexGrow: 0, flexShrink: 0 },
  cards: {
    flexDirection: 'row',
    gap: Layout.inlineGap,
    paddingLeft: Layout.gutter,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  tail: { width: Layout.gutter - Layout.inlineGap },

  reasonCard: {
    marginHorizontal: Layout.gutter,
    marginTop: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: Border.selected,
    overflow: 'hidden',
  },
  reasonImage: { height: 200, position: 'relative' },
  reasonRank: {
    position: 'absolute',
    top: Layout.inlineGap,
    left: Layout.inlineGap,
    minHeight: 26,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonHeart: {
    position: 'absolute',
    top: Layout.inlineGap,
    right: Layout.inlineGap,
    width: Layout.chip,
    height: Layout.chip,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonBody: { padding: Layout.cardPadding, gap: Spacing.one },
  reasonPlace: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  reasonPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  reasonList: { gap: Spacing.two, paddingVertical: Spacing.two },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  reasonText: { flex: 1, minWidth: 0 },
  reasonActions: { flexDirection: 'row', gap: Spacing.two, paddingTop: Spacing.two },
  reasonButton: {
    flex: 1,
    height: Layout.controlLarge,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.fieldPaddingX,
  },
  scarceNote: { paddingHorizontal: Layout.gutter, marginTop: Spacing.two },

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.three,
  },
  actionButton: {
    height: Layout.chip,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },

  next: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  nextText: { flex: 1, minWidth: 0 },
  sub: { marginTop: Spacing.half },
  empty: {
    borderRadius: Radius.medium,
    borderWidth: Border.hairline,
    padding: Layout.cardPadding,
  },
  bold: { fontWeight: 700 },
  pressed: { opacity: 0.8 },
});
