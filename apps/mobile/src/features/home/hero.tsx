import type { AppBootstrapResponse, CurrentUser } from '@weddingpick/api-contract';
import { formatCount, manwon } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, Radius, SeedIcon, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

/**
 * 홈 코랄 D-day 히어로.
 *
 * 화면 모양은 docs/design/figma-export/01-home.dc.html, 수치와 토큰은
 * docs/design/handoff를 따른다. 홈에서 예산은 별도 「예산현황」으로 내려갔기 때문에
 * 이 카드에는 D-day · 예식 정보 · 함께 준비하는 사람만 남긴다.
 */
export type HeroProps = {
  me: CurrentUser | null;
  daysLeft: number | null;
  venueName: string | null;
  budget: AppBootstrapResponse['budget'];
  bracketAnswered: boolean;
  partnerInvitePending: boolean;
  /** 이전 호출부 호환용. 최신 홈에서는 false다. */
  showBudget?: boolean;
  onPressDate: () => void;
  onPressVenue: () => void;
  onPressBudget: () => void;
  onPressPartner: () => void;
};

export function Hero({
  me,
  daysLeft,
  venueName,
  partnerInvitePending,
  onPressDate,
  onPressVenue,
  onPressPartner,
}: HeroProps) {
  const theme = useTheme();
  const date = me?.weddingDate ?? null;
  const partner = me?.spouseLinked ? (me.partnerDisplayName ?? '배우자') : null;
  const meName = me?.displayName ?? '우리';

  return (
    <View style={[styles.hero, { backgroundColor: theme.tint }]}>
      <View style={[styles.decor, { backgroundColor: theme.onTint }]} />

      <View style={styles.top}>
        <ThemedText type="f13" themeColor="onTint" style={styles.kicker}>
          두근두근
        </ThemedText>
        <View style={[styles.more, { backgroundColor: theme.onTint }]}>
          <SeedIcon name="moreHorizRegular" size={Layout.iconField} color={theme.tint} />
        </View>
      </View>

      {daysLeft === null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="예식일 정하기"
          onPress={onPressDate}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="f24" themeColor="onTint" style={styles.bold}>
            예식일을 정해볼까요?
          </ThemedText>
        </Pressable>
      ) : (
        <ThemedText type="f32" numeric themeColor="onTint" style={styles.dday}>
          {daysLeft === 0 ? 'D-DAY' : `D${daysLeft > 0 ? '-' : '+'}${formatCount(Math.abs(daysLeft))}`}
        </ThemedText>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={venueName === null ? '웨딩홀 정하기' : '예식 정보'}
        onPress={venueName === null ? onPressVenue : onPressDate}
        style={({ pressed }) => [styles.ceremony, pressed && styles.pressed]}>
        <ThemedText type="f14" themeColor="onTint" numberOfLines={1} style={styles.ceremonyText}>
          {ceremonyLine(date, venueName)}
        </ThemedText>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="함께 준비하기"
        disabled={me?.spouseLinked === true}
        onPress={onPressPartner}
        style={({ pressed }) => [styles.people, pressed && styles.pressed]}>
        <View style={styles.avatars}>
          <View style={[styles.avatar, { backgroundColor: theme.onTint }]}>
            <ThemedText type="f10" style={[styles.avatarText, { color: theme.tint }]}>
              {meName.slice(0, 1)}
            </ThemedText>
          </View>
          <View style={[styles.avatar, styles.avatarSecond, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="f10" themeColor="textSecondary" style={styles.avatarText}>
              {(partner ?? '함').slice(0, 1)}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="f13" themeColor="onTint" numberOfLines={1} style={styles.peopleText}>
          {partner ? `${meName} · ${partner}` : partnerLine(me, partnerInvitePending)}
        </ThemedText>
      </Pressable>
    </View>
  );
}

export function ceremonyLine(weddingDate: string | null, venueName: string | null): string {
  const venue = venueName ?? '예식장 미정';
  if (weddingDate === null) return '예식일 · 예식장 미정';
  return `${weddingDate.replace(/-/g, '.')} · ${venue}`;
}

export function budgetLine(
  budget: AppBootstrapResponse['budget'],
  bracketAnswered: boolean
): string {
  if (budget === null) return bracketAnswered ? '예산 금액을 정하면 여기에 보여요' : '예산을 정해볼까요?';
  const used = budget.total === 0 ? 0 : Math.round((budget.spent / budget.total) * 100);
  if (budget.remaining < 0) return `예산을 넘었어요 · ${formatCount(used)}% 사용`;
  return `남은 예산 ${manwon(budget.remaining)} · ${formatCount(used)}% 사용`;
}

export function partnerLine(me: CurrentUser | null, invitePending: boolean): string {
  if (me?.spouseLinked === true) return '함께 준비 중';
  if (invitePending) return '초대 수락을 기다리고 있어요';
  return '함께 준비할 사람을 초대해보세요';
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: Layout.gutter,
    marginBottom: Layout.sectionGap,
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    overflow: 'hidden',
  },
  decor: {
    position: 'absolute',
    top: -Spacing.five,
    right: -Spacing.five,
    width: Layout.heroDecorLarge,
    height: Layout.heroDecorLarge,
    borderRadius: Radius.pill,
    opacity: 0.1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  kicker: { fontWeight: 700, opacity: 0.88 },
  more: {
    width: Layout.touchTarget,
    height: Layout.touchTarget,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  dday: { fontWeight: 700 },
  bold: { fontWeight: 700 },
  ceremony: { marginTop: Spacing.two, alignSelf: 'flex-start' },
  ceremonyText: { opacity: 0.86, fontWeight: 600 },
  people: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.iconTextGap,
    marginTop: Spacing.three,
  },
  avatars: { width: 42, height: 24, flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSecond: { marginLeft: -6 },
  avatarText: { fontWeight: 700 },
  peopleText: { flex: 1, opacity: 0.86 },
  pressed: { opacity: 0.8 },
});
