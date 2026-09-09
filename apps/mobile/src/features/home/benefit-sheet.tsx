import type { MyMonthlyDrawResponse } from '@weddingpick/api-contract';
import { benefitSheetTitle } from '@weddingpick/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActionButton,
  Layout,
  NpayLogo,
  ProductSymbol,
  Radius,
  Spacing,
  ThemedText,
  ThemedView,
  useTheme,
} from '@weddingpick/ui';
import { BottomSheet, SHEET_PANEL } from '@/features/common/bottom-sheet';

export type BenefitSheetProps = {
  visible: boolean;
  draw: MyMonthlyDrawResponse;
  /** 「나중에」 · X · 딤 탭. 닫으면 다시 뜨지 않는다. */
  onDismiss: () => void;
  /** 「혜택 보기」 — 혜택 탭으로. */
  onOpenBenefit: () => void;
};

/**
 * 혜택 안내 시트 — WP-SHT-017 (핸드오프 v3.22).
 *
 * 온보딩 완료 후 홈 최초 진입 1회, 400ms 뒤에 올라온다. 네 가지 혜택 중 금액이 가장
 * 큰 **웨딩지원금 5만원**만 내세운다 — 미션 5천원을 앞세우면 첫인상이 싸 보인다.
 *
 * 안내 문장을 두지 않고 금액 · 진행바 · 조건으로만 말한다. 코랄은 CTA 하나.
 * 기간 · 마감일 · 당첨 확률을 적지 않는다.
 *
 * 제목은 남은 조건 수로 만든다 — 2개 «두 가지만 더 하면», 1개 «하나만 더 하면».
 * 0개면 이 시트를 띄우지 않고 응모 완료 알림으로 대신한다(홈이 그렇게 거른다).
 */
export function BenefitSheet({ visible, draw, onDismiss, onOpenBenefit }: BenefitSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const lead = benefitSheetTitle(draw.remaining);
  const done = draw.conditions.filter((condition) => condition.done).length;
  const total = draw.conditions.length;
  const progress = total === 0 ? 0 : done / total;

  if (lead === null) return null;

  return (
    <BottomSheet visible={visible} onRequestClose={onDismiss} testID="benefit-sheet">
      <ThemedView
        style={[
          SHEET_PANEL,
          styles.sheet,
          { paddingBottom: SHEET_BOTTOM_PADDING + Math.max(insets.bottom, 0) },
        ]}>
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />

        <View style={styles.head}>
          <ThemedText type="t7" themeColor="textAssistive" style={styles.eyebrow}>
            웨딩지원금
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            hitSlop={8}
            onPress={onDismiss}
            style={styles.close}>
            <ProductSymbol name="close" size={CLOSE_ICON} color={theme.textAssistive} />
          </Pressable>
        </View>

        <ThemedText type="t3">
          {lead}
          {'\n'}
          {`Npay ${formatManwon(draw.amountKrw)}에 자동 응모돼요`}
        </ThemedText>

        {/* 금액 카드 — 금액 · Npay · 진행바 · 조건 3행. 안내 문장은 없다. */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.amountRow}>
            <ThemedText type="t1" numeric>
              {`${draw.amountKrw.toLocaleString('ko-KR')}원`}
            </ThemedText>
            <NpayLogo />
          </View>

          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: total, now: done }}
            style={[styles.track, { backgroundColor: theme.track }]}>
            <View
              style={[
                styles.fill,
                { backgroundColor: theme.backgroundInk, width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>

          <View style={styles.list}>
            {draw.conditions.map((condition) => (
              <View key={condition.key} style={styles.item}>
                {condition.done ? (
                  <View style={[styles.dot, { backgroundColor: theme.backgroundInk }]}>
                    <ProductSymbol name="check" size={CHECK_ICON} color={theme.onTint} />
                  </View>
                ) : (
                  <View style={[styles.dot, styles.ring, { borderColor: theme.fieldBorder }]} />
                )}
                <ThemedText
                  type="t6"
                  themeColor={condition.done ? 'textDisabled' : 'text'}
                  style={[styles.itemText, condition.done ? styles.strike : null]}
                  numberOfLines={1}>
                  {condition.label}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.ghost}>
            <ActionButton label="나중에" variant="secondary" size="xlarge" onPress={onDismiss} />
          </View>
          <View style={styles.cta}>
            <ActionButton label="혜택 보기" variant="primary" size="xlarge" onPress={onOpenBenefit} />
          </View>
        </View>
      </ThemedView>
    </BottomSheet>
  );
}

/** 50000 → «5만원». 시트 제목은 짧아야 한 줄에 든다. */
function formatManwon(amountKrw: number): string {
  const man = amountKrw / 10_000;
  return `${Number.isInteger(man) ? man : man.toFixed(1)}만원`;
}

/** 시안 sheet padding-bottom 28 = spec/tokens.json spacing.sectionBottom. */
const SHEET_BOTTOM_PADDING = Layout.sectionGap;
const CLOSE_ICON = 20;
const CHECK_ICON = 11;
/** 시안 — 조건 점 18 · 진행바 4 · 그래버 40×4. */
const DOT = 18;
const TRACK = 4;

const styles = StyleSheet.create({
  /* 시안 sheet: padding 12 24 28 · gap 16. */
  sheet: {
    paddingTop: Layout.rowPaddingY,
    paddingHorizontal: Layout.gutter,
    gap: Spacing.three,
  },
  grabber: { width: 40, height: TRACK, borderRadius: 999, alignSelf: 'center' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  eyebrow: { fontWeight: '700' },
  close: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -Spacing.two,
  },
  /* 시안 stepCard: radius 12 · padding 20 · gap 14. 12는 spec/tokens.json radius에 없어 card 10. */
  card: {
    borderRadius: Radius.medium,
    padding: Layout.cardPadding,
    gap: Layout.sectionHeadGap,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  track: { height: TRACK, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  list: { gap: Spacing.two + Spacing.half },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + Spacing.half },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { borderWidth: 1.5 },
  itemText: { flex: 1, minWidth: 0 },
  strike: { textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  ghost: { flex: 1 },
  cta: { flex: 1.4 },
});
