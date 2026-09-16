import type { AppBootstrapResponse, CurrentUser } from '@weddingpick/api-contract';
import { formatCount, manwon } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Layout, LetterSpacing, Radius, Spacing, ThemedText, useTheme } from '@weddingpick/ui';

/**
 * 히어로 — 2026-09-15 대표 사양 §3. 홈에서 가장 먼저 읽는 네 줄이다.
 *
 *   D-214                             ← 가장 높은 시각적 우선순위
 *   2027.04.17 · 루이미스스퀘어          예식일 · 예식장
 *   남은 예산 3,000만원 · 27% 사용
 *   함께 준비 중 · 연결 완료
 *
 * 줄마다 **없을 때 무엇을 말할지**가 정해져 있고, 없는 줄은 「정해볼까요?」가 되어 그 값을
 * 정하는 화면으로 간다. 자리를 비워두지 않는다 — 비면 사용자는 고장으로 읽는다.
 *
 * **예식장은 웨딩홀로 «정한» 업체의 이름이다**(2026-09-15 확정). 예식장을 따로 적는 칸을
 * 만들지 않는다 — 이 앱에서 예식장이 정해지는 경로가 그것 하나다. 그래서 「예식장 미정」을
 * 누르면 웨딩홀 추천으로 가는 것이 말이 된다(§3-2).
 *
 * **예산 카드를 홈에 따로 두지 않는다**(§3) — 예산은 이 한 줄이 전부다.
 */
export type HeroProps = {
  me: CurrentUser | null;
  /** 남은 일수. 예식일을 안 정했으면 null. */
  daysLeft: number | null;
  /** 웨딩홀로 정한 업체 이름 = 예식장. 안 정했으면 null. */
  venueName: string | null;
  budget: AppBootstrapResponse['budget'];
  /** 예산 구간 질문에 답한 적이 있는가. 숫자 예산이 없어도 true일 수 있다. */
  bracketAnswered: boolean;
  partnerInvitePending: boolean;
  onPressDate: () => void;
  onPressVenue: () => void;
  onPressBudget: () => void;
  onPressPartner: () => void;
};

export function Hero({
  me,
  daysLeft,
  venueName,
  budget,
  bracketAnswered,
  partnerInvitePending,
  onPressDate,
  onPressVenue,
  onPressBudget,
  onPressPartner,
}: HeroProps) {
  const theme = useTheme();
  const date = me?.weddingDate ?? null;

  return (
    <View style={[styles.hero, { backgroundColor: theme.tint }]}>
      <View style={[styles.decorLarge, { backgroundColor: theme.onTint }]} />
      <View style={[styles.decorSmall, { borderColor: theme.onTint }]} />

      {/* D-day — 예식일이 없으면 큰 글씨 대신 정하러 가는 줄이 선다. */}
      {daysLeft === null ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPressDate}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="f24" themeColor="onTint" style={styles.bold}>
            예식일을 정해볼까요?
          </ThemedText>
        </Pressable>
      ) : (
        <ThemedText type="f46" numeric themeColor="onTint" style={styles.dday}>
          D-{formatCount(daysLeft)}
        </ThemedText>
      )}

      {/* 예식일 · 예식장. 예식장이 없으면 그 자리를 눌러 웨딩홀 추천으로 간다. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={venueName === null ? '웨딩홀 정하기' : '예식 정보'}
        onPress={venueName === null ? onPressVenue : onPressDate}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="f12" themeColor="onTint" numberOfLines={1} style={styles.line}>
          {ceremonyLine(date, venueName)}
        </ThemedText>
      </Pressable>

      {/* 예산. 숫자 예산이 없으면 정하러 간다 — 구간만 고른 사람도 여기서 숫자를 정한다. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={budget === null ? '예산 정하기' : '예산'}
        onPress={onPressBudget}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="f12" numeric themeColor="onTint" numberOfLines={1} style={styles.line}>
          {budgetLine(budget, bracketAnswered)}
        </ThemedText>
      </Pressable>

      {/* 커플 연결. 연결돼 있으면 누를 것이 없다. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="함께 준비하기"
        disabled={me?.spouseLinked === true}
        onPress={onPressPartner}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="f12" themeColor="onTint" numberOfLines={1} style={styles.line}>
          {partnerLine(me, partnerInvitePending)}
        </ThemedText>
      </Pressable>
    </View>
  );
}

/**
 * «2027.04.17 · 루이미스스퀘어» — 사양 §3의 세 꼴 그대로.
 *
 *   둘 다 있다   2027.04.17 · 루이미스스퀘어
 *   예식일만     2027.04.17 · 예식장 미정
 *   둘 다 없다   예식일 · 예식장 미정
 */
export function ceremonyLine(weddingDate: string | null, venueName: string | null): string {
  const venue = venueName ?? '예식장 미정';

  if (weddingDate === null) return '예식일 · 예식장 미정';

  return `${weddingDate.replace(/-/g, '.')} · ${venue}`;
}

/**
 * «남은 예산 3,000만원 · 27% 사용» — 사양 §3.
 *
 * **구간만 고른 사람에게 다시 묻지 않는다.** 온보딩의 «4,000만원 이상» · «아직 모르겠어요»는
 * 상한이 없어 숫자 예산이 서지 않지만 이미 답한 사람이다(`features/home/priority.ts`가
 * 주석으로 적어둔 함정이다). 그 사람에게는 「예산을 정해볼까요?」 대신 아직 숫자가 없다고만
 * 말한다.
 *
 * 넘겼으면 얼마나 남았는지가 아니라 넘겼다는 사실을 적는다 — 음수 예산은 읽히지 않는다.
 */
export function budgetLine(
  budget: AppBootstrapResponse['budget'],
  bracketAnswered: boolean
): string {
  if (budget === null) return bracketAnswered ? '예산 금액을 정하면 여기에 보여요' : '예산을 정해볼까요?';

  const used = budget.total === 0 ? 0 : Math.round((budget.spent / budget.total) * 100);

  if (budget.remaining < 0) return `예산을 넘었어요 · ${formatCount(used)}% 사용`;

  return `남은 예산 ${manwon(budget.remaining)} · ${formatCount(used)}% 사용`;
}

/** 사양 §3의 세 꼴. 연결 완료 · 초대 대기 · 아직 혼자. */
export function partnerLine(me: CurrentUser | null, invitePending: boolean): string {
  if (me?.spouseLinked === true) return '함께 준비 중 · 연결 완료';
  if (invitePending) return '초대 수락을 기다리고 있어요';

  return '함께 준비할 사람을 초대해보세요';
}

const styles = StyleSheet.create({
  /* «pad 16 · mar 0 20 24 20 · r22». 장식 원이 밖으로 나가므로 overflow hidden. */
  hero: {
    marginHorizontal: Layout.pageX,
    marginBottom: Spacing.four,
    borderRadius: Radius.hero,
    padding: Spacing.three,
    overflow: 'hidden',
  },
  decorLarge: {
    position: 'absolute',
    top: -Spacing.five,
    right: -Spacing.five,
    width: Layout.heroDecorLarge,
    height: Layout.heroDecorLarge,
    borderRadius: Radius.pill,
    opacity: 0.1,
  },
  decorSmall: {
    position: 'absolute',
    bottom: -Spacing.five,
    left: -Spacing.four,
    width: Layout.heroDecorSmall,
    height: Layout.heroDecorSmall,
    borderRadius: Radius.pill,
    borderWidth: Layout.heroDecorBorder,
    opacity: 0.07,
  },
  /* «46/700 · lh 46 · ls -1.38px» — 화면에서 가장 큰 글씨다(§3 「가장 높은 시각적 우선순위」). */
  dday: { fontWeight: 700, letterSpacing: LetterSpacing.n138 },
  bold: { fontWeight: 700 },
  /* 히어로의 보조 줄 셋. 흰색에 투명도를 준 것이고 색을 새로 만들지 않는다. */
  line: { opacity: 0.7, marginTop: Spacing.one },
  pressed: { opacity: 0.8 },
});
